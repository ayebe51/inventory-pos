/**
 * AuditTrailService.query() Tests — Task 4.3
 *
 * Validates Requirement 10 AC 6 & 7:
 *   - Audit logs are queryable with filters (user_id, action, entity_type,
 *     entity_id, from_date, to_date) and pagination (page, per_page).
 *   - Audit logs are immutable — no updated_at / deleted_at fields.
 *
 * Also validates Requirement 1 AC 10:
 *   - Audit trail records user_id, action, entity_type, entity_id, timestamps.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../config/prisma.service';
import { AuditFilter } from '../../modules/governance/interfaces/governance.interfaces';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAuditRow(overrides: Partial<{
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  data_before: unknown;
  data_after: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'audit-uuid-1',
    user_id: overrides.user_id ?? 'user-uuid-1',
    action: overrides.action ?? 'CREATE',
    entity_type: overrides.entity_type ?? 'Product',
    entity_id: overrides.entity_id ?? 'entity-uuid-1',
    data_before: overrides.data_before ?? null,
    data_after: overrides.data_after ?? null,
    ip_address: overrides.ip_address ?? null,
    user_agent: overrides.user_agent ?? null,
    created_at: overrides.created_at ?? new Date('2025-01-15T10:00:00Z'),
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCount = jest.fn();
const mockFindMany = jest.fn();

const mockPrisma = {
  auditLog: {
    create: jest.fn(),
    count: mockCount,
    findMany: mockFindMany,
  },
} as unknown as PrismaService;

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AuditService.query() — Task 4.3', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // ── Pagination defaults ────────────────────────────────────────────────────

  describe('pagination', () => {
    it('uses page=1 and per_page=20 as defaults', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      const result = await service.query({});

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.meta).toEqual({
        page: 1,
        per_page: 20,
        total: 0,
        total_pages: 0,
      });
    });

    it('calculates correct skip for page 3 with per_page 10', async () => {
      mockCount.mockResolvedValue(25);
      mockFindMany.mockResolvedValue([]);

      const result = await service.query({ page: 3, per_page: 10 });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta.total_pages).toBe(3);
    });

    it('returns correct total_pages when total is not divisible by per_page', async () => {
      mockCount.mockResolvedValue(21);
      mockFindMany.mockResolvedValue([]);

      const result = await service.query({ page: 1, per_page: 10 });

      expect(result.meta.total_pages).toBe(3);
    });

    it('orders results by created_at descending', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({});

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { created_at: 'desc' } }),
      );
    });
  });

  // ── Filter: user_id ────────────────────────────────────────────────────────

  describe('filter: user_id', () => {
    it('passes user_id filter to Prisma where clause', async () => {
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([buildAuditRow({ user_id: 'user-uuid-42' })]);

      const filters: AuditFilter = { user_id: 'user-uuid-42' };
      await service.query(filters);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'user-uuid-42' }),
        }),
      );
    });

    it('omits user_id from where clause when not provided', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({});

      const call = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(call.where).not.toHaveProperty('user_id');
    });
  });

  // ── Filter: action ─────────────────────────────────────────────────────────

  describe('filter: action', () => {
    it('passes action filter to Prisma where clause', async () => {
      mockCount.mockResolvedValue(2);
      mockFindMany.mockResolvedValue([
        buildAuditRow({ action: 'APPROVE' }),
        buildAuditRow({ action: 'APPROVE', id: 'audit-uuid-2' }),
      ]);

      await service.query({ action: 'APPROVE' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'APPROVE' }),
        }),
      );
    });
  });

  // ── Filter: entity_type ────────────────────────────────────────────────────

  describe('filter: entity_type', () => {
    it('passes entity_type filter to Prisma where clause', async () => {
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([buildAuditRow({ entity_type: 'PurchaseOrder' })]);

      await service.query({ entity_type: 'PurchaseOrder' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entity_type: 'PurchaseOrder' }),
        }),
      );
    });
  });

  // ── Filter: entity_id ─────────────────────────────────────────────────────

  describe('filter: entity_id', () => {
    it('passes entity_id filter to Prisma where clause', async () => {
      const entityId = 'po-uuid-99';
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([buildAuditRow({ entity_id: entityId })]);

      await service.query({ entity_id: entityId });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entity_id: entityId }),
        }),
      );
    });
  });

  // ── Filter: date range ─────────────────────────────────────────────────────

  describe('filter: date range', () => {
    it('passes from_date as gte filter', async () => {
      const from = new Date('2025-01-01T00:00:00Z');
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({ from_date: from });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({ gte: from }),
          }),
        }),
      );
    });

    it('passes to_date as lte filter', async () => {
      const to = new Date('2025-01-31T23:59:59Z');
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({ to_date: to });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: expect.objectContaining({ lte: to }),
          }),
        }),
      );
    });

    it('passes both from_date and to_date together', async () => {
      const from = new Date('2025-01-01T00:00:00Z');
      const to = new Date('2025-01-31T23:59:59Z');
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({ from_date: from, to_date: to });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            created_at: { gte: from, lte: to },
          }),
        }),
      );
    });

    it('omits created_at filter when neither from_date nor to_date is provided', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      await service.query({});

      const call = mockFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(call.where).not.toHaveProperty('created_at');
    });
  });

  // ── Combined filters ───────────────────────────────────────────────────────

  describe('combined filters', () => {
    it('applies all filters simultaneously', async () => {
      const from = new Date('2025-01-01T00:00:00Z');
      const to = new Date('2025-01-31T23:59:59Z');
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([buildAuditRow()]);

      await service.query({
        user_id: 'user-uuid-1',
        action: 'DELETE',
        entity_type: 'Product',
        entity_id: 'product-uuid-1',
        from_date: from,
        to_date: to,
      });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: 'user-uuid-1',
            action: 'DELETE',
            entity_type: 'Product',
            entity_id: 'product-uuid-1',
            created_at: { gte: from, lte: to },
          },
        }),
      );
    });
  });

  // ── Response mapping ───────────────────────────────────────────────────────

  describe('response mapping', () => {
    it('maps DB rows to AuditLog domain objects correctly', async () => {
      const row = buildAuditRow({
        id: 'audit-uuid-mapped',
        user_id: 'user-uuid-mapped',
        action: 'POST',
        entity_type: 'Invoice',
        entity_id: 'invoice-uuid-1',
        data_before: { status: 'DRAFT' },
        data_after: { status: 'OPEN' },
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        created_at: new Date('2025-06-01T12:00:00Z'),
      });

      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([row]);

      const result = await service.query({});

      expect(result.data).toHaveLength(1);
      const log = result.data[0];
      expect(log.id).toBe('audit-uuid-mapped');
      expect(log.user_id).toBe('user-uuid-mapped');
      expect(log.action).toBe('POST');
      expect(log.entity_type).toBe('Invoice');
      expect(log.entity_id).toBe('invoice-uuid-1');
      expect(log.before_snapshot).toEqual({ status: 'DRAFT' });
      expect(log.after_snapshot).toEqual({ status: 'OPEN' });
      expect(log.ip_address).toBe('192.168.1.1');
      expect(log.user_agent).toBe('Mozilla/5.0');
      expect(log.created_at).toEqual(new Date('2025-06-01T12:00:00Z'));
    });

    it('mapped AuditLog has no updated_at or deleted_at fields (immutable)', async () => {
      mockCount.mockResolvedValue(1);
      mockFindMany.mockResolvedValue([buildAuditRow()]);

      const result = await service.query({});
      const log = result.data[0];

      expect(log).not.toHaveProperty('updated_at');
      expect(log).not.toHaveProperty('deleted_at');
    });

    it('returns empty data array when no records match', async () => {
      mockCount.mockResolvedValue(0);
      mockFindMany.mockResolvedValue([]);

      const result = await service.query({ action: 'NONEXISTENT' });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.total_pages).toBe(0);
    });

    it('runs count and findMany in parallel', async () => {
      const countOrder: string[] = [];
      mockCount.mockImplementation(async () => {
        countOrder.push('count');
        return 5;
      });
      mockFindMany.mockImplementation(async () => {
        countOrder.push('findMany');
        return [];
      });

      await service.query({});

      // Both should have been called (order may vary due to Promise.all)
      expect(countOrder).toContain('count');
      expect(countOrder).toContain('findMany');
      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledTimes(1);
    });
  });
});
