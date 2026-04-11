import { Test, TestingModule } from '@nestjs/testing';
import { DocumentType, NumberingService } from './numbering.service';
import { PrismaService } from '../../config/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrisma(overrides: Partial<PrismaService> = {}): PrismaService {
  return {
    $queryRaw: jest.fn(),
    ...overrides,
  } as unknown as PrismaService;
}

/** Build a mock that returns incrementing sequence values per (prefix, period) */
function makeIncrementingPrisma(): PrismaService {
  const counters: Record<string, number> = {};

  return {
    $queryRaw: jest.fn().mockImplementation((..._args: unknown[]) => {
      // jest captures the raw strings array + interpolated values.
      // args[0] = TemplateStringsArray, args[1] = prefix, args[2] = period
      const prefix = String(_args[1]);
      const period = String(_args[2]);
      const key = `${prefix}:${period}`;
      counters[key] = (counters[key] ?? 0) + 1;
      return Promise.resolve([{ next_val: BigInt(counters[key]) }]);
    }),
  } as unknown as PrismaService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NumberingService', () => {
  let service: NumberingService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = makeIncrementingPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NumberingService>(NumberingService);
  });

  // -------------------------------------------------------------------------
  // Format correctness
  // -------------------------------------------------------------------------

  describe('format correctness', () => {
    const MONTHLY_TYPES: DocumentType[] = [
      DocumentType.PR, DocumentType.PO, DocumentType.GR, DocumentType.INV,
      DocumentType.RCV, DocumentType.PV, DocumentType.JE, DocumentType.SA,
      DocumentType.SO, DocumentType.CN, DocumentType.DN, DocumentType.TO,
    ];

    const date = new Date('2025-01-15T10:00:00Z');

    it.each(MONTHLY_TYPES)(
      '%s uses YYYYMM period and 5-digit counter',
      async (type) => {
        const result = await service.generate(type, date);
        expect(result).toMatch(new RegExp(`^${type}-202501-\\d{5}$`));
      },
    );

    it('POS uses YYYYMMDD period and 5-digit counter', async () => {
      const result = await service.generate(DocumentType.POS, date);
      expect(result).toMatch(/^POS-20250115-\d{5}$/);
    });

    it('counter is zero-padded to 5 digits', async () => {
      const result = await service.generate(DocumentType.PR, date);
      expect(result).toBe('PR-202501-00001');
    });

    it('second call increments counter', async () => {
      const first = await service.generate(DocumentType.PR, date);
      const second = await service.generate(DocumentType.PR, date);
      expect(first).toBe('PR-202501-00001');
      expect(second).toBe('PR-202501-00002');
    });

    it('different types have independent counters', async () => {
      const pr = await service.generate(DocumentType.PR, date);
      const po = await service.generate(DocumentType.PO, date);
      expect(pr).toBe('PR-202501-00001');
      expect(po).toBe('PO-202501-00001');
    });

    it('different months have independent counters', async () => {
      const jan = await service.generate(DocumentType.JE, new Date('2025-01-01'));
      const feb = await service.generate(DocumentType.JE, new Date('2025-02-01'));
      expect(jan).toBe('JE-202501-00001');
      expect(feb).toBe('JE-202502-00001');
    });

    it('uses current date when no date provided', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const result = await service.generate(DocumentType.PV);
      expect(result).toMatch(new RegExp(`^PV-${year}${month}-\\d{5}$`));
    });
  });

  // -------------------------------------------------------------------------
  // All 13 document types produce correct prefix
  // -------------------------------------------------------------------------

  describe('all 13 document types', () => {
    const date = new Date('2025-06-01');
    const cases: [DocumentType, string][] = [
      [DocumentType.PR,  'PR-202506-00001'],
      [DocumentType.PO,  'PO-202506-00001'],
      [DocumentType.GR,  'GR-202506-00001'],
      [DocumentType.INV, 'INV-202506-00001'],
      [DocumentType.POS, 'POS-20250601-00001'],
      [DocumentType.RCV, 'RCV-202506-00001'],
      [DocumentType.PV,  'PV-202506-00001'],
      [DocumentType.JE,  'JE-202506-00001'],
      [DocumentType.SA,  'SA-202506-00001'],
      [DocumentType.SO,  'SO-202506-00001'],
      [DocumentType.CN,  'CN-202506-00001'],
      [DocumentType.DN,  'DN-202506-00001'],
      [DocumentType.TO,  'TO-202506-00001'],
    ];

    it.each(cases)('%s generates %s', async (type, expected) => {
      const result = await service.generate(type, date);
      expect(result).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // Retry logic (exponential backoff, max 3 attempts)
  // -------------------------------------------------------------------------

  describe('retry on failure', () => {
    it('retries up to 3 times and succeeds on 3rd attempt', async () => {
      let callCount = 0;
      const retryPrisma = {
        $queryRaw: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('unique constraint violation'));
          }
          return Promise.resolve([{ next_val: BigInt(1) }]);
        }),
      } as unknown as PrismaService;

      const module = await Test.createTestingModule({
        providers: [
          NumberingService,
          { provide: PrismaService, useValue: retryPrisma },
        ],
      }).compile();

      const svc = module.get<NumberingService>(NumberingService);
      const result = await svc.generate(DocumentType.PR, new Date('2025-01-01'));
      expect(result).toBe('PR-202501-00001');
      expect(callCount).toBe(3);
    });

    it('throws after 3 failed attempts', async () => {
      const failPrisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('DB error')),
      } as unknown as PrismaService;

      const module = await Test.createTestingModule({
        providers: [
          NumberingService,
          { provide: PrismaService, useValue: failPrisma },
        ],
      }).compile();

      const svc = module.get<NumberingService>(NumberingService);
      await expect(svc.generate(DocumentType.PR, new Date('2025-01-01'))).rejects.toThrow(
        /failed to generate number for PR after 3 attempts/,
      );
      expect(failPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    });

    it('applies exponential backoff delays between retries', async () => {
      jest.useFakeTimers();
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      // Spy on sleep by intercepting setTimeout
      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn: (...args: unknown[]) => void, ms?: number) => {
          delays.push(ms ?? 0);
          fn();
          return {} as ReturnType<typeof setTimeout>;
        });

      const failThenSucceedPrisma = {
        $queryRaw: jest
          .fn()
          .mockRejectedValueOnce(new Error('conflict'))
          .mockRejectedValueOnce(new Error('conflict'))
          .mockResolvedValueOnce([{ next_val: BigInt(1) }]),
      } as unknown as PrismaService;

      const module = await Test.createTestingModule({
        providers: [
          NumberingService,
          { provide: PrismaService, useValue: failThenSucceedPrisma },
        ],
      }).compile();

      const svc = module.get<NumberingService>(NumberingService);
      await svc.generate(DocumentType.PR, new Date('2025-01-01'));

      // Attempt 1 fails → delay 50ms (50 * 2^0)
      // Attempt 2 fails → delay 100ms (50 * 2^1)
      // Attempt 3 succeeds → no delay
      expect(delays).toEqual([50, 100]);

      setTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
