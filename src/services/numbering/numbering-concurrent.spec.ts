/**
 * Property-based test: generate 1000 nomor dokumen secara concurrent,
 * verifikasi tidak ada duplikat.
 *
 * **Validates: Requirements 5.3**
 *
 * Properti yang diuji:
 *   P1 — Uniqueness under concurrent load:
 *        Untuk setiap batch N generate() yang dijalankan secara concurrent
 *        (Promise.all), semua nomor dokumen yang dihasilkan harus unik.
 *
 * Strategi mock:
 *   - Prisma.$queryRaw disimulasikan dengan shared atomic counter per
 *     (prefix, period) menggunakan closure + synchronous increment.
 *   - Ini mereplikasi perilaku INSERT ... ON CONFLICT DO UPDATE RETURNING
 *     last_value yang bersifat atomic di PostgreSQL.
 *   - Setiap call ke $queryRaw mengembalikan nilai counter yang berbeda,
 *     sehingga race condition yang mungkin terjadi di layer service
 *     (retry logic) tetap terdeteksi jika ada bug.
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentType, NumberingService } from './numbering.service';
import { PrismaService } from '../../config/prisma.service';

// ---------------------------------------------------------------------------
// Mock factory: shared atomic counter per (prefix, period)
// ---------------------------------------------------------------------------

/**
 * Builds a PrismaService mock whose $queryRaw simulates the DB-level
 * atomic upsert.  The counter is shared across all concurrent calls,
 * so each invocation receives a strictly-incrementing unique value —
 * exactly what the real PostgreSQL upsert guarantees.
 */
function makeAtomicPrisma(): PrismaService {
  const counters = new Map<string, number>();

  return {
    $queryRaw: jest.fn().mockImplementation((...args: unknown[]) => {
      // Template literal tag: args[0] = TemplateStringsArray,
      // args[1] = prefix (DocumentType), args[2] = period (string)
      const prefix = String(args[1]);
      const period = String(args[2]);
      const key = `${prefix}:${period}`;

      const current = counters.get(key) ?? 0;
      const next = current + 1;
      counters.set(key, next);

      return Promise.resolve([{ next_val: BigInt(next) }]);
    }),
  } as unknown as PrismaService;
}

// ---------------------------------------------------------------------------
// Helper: build a NumberingService with the given prisma mock
// ---------------------------------------------------------------------------

async function buildService(prisma: PrismaService): Promise<NumberingService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NumberingService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();

  return module.get<NumberingService>(NumberingService);
}

// ---------------------------------------------------------------------------
// Concurrent uniqueness tests
// ---------------------------------------------------------------------------

describe('NumberingService — concurrent uniqueness (PBT)', () => {
  const FIXED_DATE = new Date('2025-06-15T00:00:00Z');

  // -------------------------------------------------------------------------
  // P1 — 1000 concurrent generates for a single document type produce no
  //      duplicates.
  // -------------------------------------------------------------------------

  it('P1: 1000 concurrent PR numbers are all unique', async () => {
    const prisma = makeAtomicPrisma();
    const service = await buildService(prisma);

    const results = await Promise.all(
      Array.from({ length: 1000 }, () =>
        service.generate(DocumentType.PR, FIXED_DATE),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(1000);
  }, 30_000);

  it('P1: 1000 concurrent PO numbers are all unique', async () => {
    const prisma = makeAtomicPrisma();
    const service = await buildService(prisma);

    const results = await Promise.all(
      Array.from({ length: 1000 }, () =>
        service.generate(DocumentType.PO, FIXED_DATE),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(1000);
  }, 30_000);

  it('P1: 1000 concurrent INV numbers are all unique', async () => {
    const prisma = makeAtomicPrisma();
    const service = await buildService(prisma);

    const results = await Promise.all(
      Array.from({ length: 1000 }, () =>
        service.generate(DocumentType.INV, FIXED_DATE),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(1000);
  }, 30_000);

  it('P1: 1000 concurrent POS numbers are all unique', async () => {
    const prisma = makeAtomicPrisma();
    const service = await buildService(prisma);

    const results = await Promise.all(
      Array.from({ length: 1000 }, () =>
        service.generate(DocumentType.POS, FIXED_DATE),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(1000);
  }, 30_000);

  // -------------------------------------------------------------------------
  // P1 (mixed) — 1000 concurrent generates across multiple document types
  //              produce no duplicates within each type.
  // -------------------------------------------------------------------------

  it('P1: 1000 concurrent generates across PR/PO/INV/POS — no duplicates per type', async () => {
    const prisma = makeAtomicPrisma();
    const service = await buildService(prisma);

    const types = [
      DocumentType.PR,
      DocumentType.PO,
      DocumentType.INV,
      DocumentType.POS,
    ];

    // 250 per type = 1000 total
    const allResults = await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        service.generate(types[i % types.length], FIXED_DATE),
      ),
    );

    // Group by prefix and verify uniqueness within each group
    const byType = new Map<string, string[]>();
    for (const num of allResults) {
      const prefix = num.split('-')[0];
      if (!byType.has(prefix)) byType.set(prefix, []);
      byType.get(prefix)!.push(num);
    }

    for (const [prefix, nums] of byType) {
      const unique = new Set(nums);
      expect(unique.size).toBe(nums.length);
    }
  }, 30_000);

  // -------------------------------------------------------------------------
  // P1 (fast-check) — property: for any batch size N in [1..200], concurrent
  //                   generates always produce N unique numbers.
  //
  // We cap at 200 per fast-check run to keep the suite fast; the 1000-item
  // tests above cover the full scale requirement.
  // -------------------------------------------------------------------------

  it(
    'P1 (fast-check): for any batch size N in [1..200], concurrent generates produce N unique numbers',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 200 }),
          fc.constantFrom(
            DocumentType.PR,
            DocumentType.PO,
            DocumentType.INV,
            DocumentType.POS,
            DocumentType.GR,
            DocumentType.JE,
          ),
          async (batchSize, docType) => {
            const prisma = makeAtomicPrisma();
            const service = await buildService(prisma);

            const results = await Promise.all(
              Array.from({ length: batchSize }, () =>
                service.generate(docType, FIXED_DATE),
              ),
            );

            const unique = new Set(results);
            return unique.size === batchSize;
          },
        ),
        {
          numRuns: 50,
          verbose: true,
        },
      );
    },
    60_000,
  );

  // -------------------------------------------------------------------------
  // Retry resilience under concurrent load:
  // Simulate transient DB conflicts on some calls — service must still
  // produce unique numbers via exponential backoff retry.
  // -------------------------------------------------------------------------

  it('P1 (retry): 200 concurrent generates with intermittent DB failures still produce unique numbers', async () => {
    const counters = new Map<string, number>();

    // Pre-generate a failure schedule: request indices that should fail on
    // their first attempt (every 3rd request).  Since MAX_RETRIES = 3, all
    // requests will eventually succeed.
    //
    // We track "request identity" by the order in which $queryRaw is first
    // called for a given Promise chain.  Because JS is single-threaded, the
    // first 200 calls map 1-to-1 to the 200 Promise.all slots; retries are
    // additional calls beyond the first 200.
    const TOTAL = 200;
    const shouldFailFirst = new Set<number>(
      Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i % 3 === 0),
    );

    let firstCallIndex = 0;
    // Map from call-order-index → whether it has already failed once
    const hasFailed = new Set<number>();

    const flakyPrisma: PrismaService = {
      $queryRaw: jest.fn().mockImplementation((...args: unknown[]) => {
        const prefix = String(args[1]);
        const period = String(args[2]);
        const key = `${prefix}:${period}`;

        const idx = firstCallIndex++;

        // For the first TOTAL calls: fail once for scheduled slots
        if (idx < TOTAL && shouldFailFirst.has(idx) && !hasFailed.has(idx)) {
          hasFailed.add(idx);
          return Promise.reject(new Error('transient unique constraint violation'));
        }

        // Success path: atomically increment counter
        const current = counters.get(key) ?? 0;
        const next = current + 1;
        counters.set(key, next);
        return Promise.resolve([{ next_val: BigInt(next) }]);
      }),
    } as unknown as PrismaService;

    const service = await buildService(flakyPrisma);

    const results = await Promise.all(
      Array.from({ length: TOTAL }, () =>
        service.generate(DocumentType.PR, FIXED_DATE),
      ),
    );

    const unique = new Set(results);
    expect(unique.size).toBe(TOTAL);
  }, 30_000);
});
