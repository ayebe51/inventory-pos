import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { Warehouse } from '../interfaces/master-data.interfaces';
import {
  CreateWarehouseSchema,
  UpdateWarehouseSchema,
  WarehouseFilterSchema,
  CreateWarehouseDTO,
  UpdateWarehouseDTO,
  WarehouseFilterDTO,
} from '../dto/warehouse.dto';

// ── Cache key helpers ─────────────────────────────────────────────────────────

const CACHE_TTL = 300; // 5 minutes

function branchCacheKey(branchId: string): string {
  return `warehouse:branch:${branchId}`;
}

function warehouseCacheKey(id: string): string {
  return `warehouse:${id}`;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapWarehouse(row: {
  id: string;
  code: string;
  name: string;
  branch_id: string;
  address: string | null;
  is_active: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  locked_at: Date | null;
  locked_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): Warehouse {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    branch_id: row.branch_id as UUID,
    address: row.address,
    is_active: row.is_active,
    is_locked: row.is_locked,
    lock_reason: row.lock_reason,
    locked_at: row.locked_at,
    locked_by: row.locked_by as UUID | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Create a new warehouse.
   * Validates code uniqueness within the same branch (Req 2.7).
   * Records audit log in the same transaction.
   */
  async create(data: CreateWarehouseDTO, userId: UUID): Promise<Warehouse> {
    const validated = CreateWarehouseSchema.parse(data);

    // Check code uniqueness per branch (Req 2.7)
    const existing = await this.prisma.warehouse.findFirst({
      where: { code: validated.code, branch_id: validated.branch_id, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode gudang '${validated.code}' sudah digunakan di branch ini`,
        ErrorCode.CONFLICT,
      );
    }

    const warehouse = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Warehouse',
        entityId: '',
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.warehouse.create({
          data: {
            code: validated.code,
            name: validated.name,
            branch_id: validated.branch_id,
            address: validated.address ?? null,
          },
        });
      },
    );

    // Invalidate branch cache
    await this.cache.del(branchCacheKey(validated.branch_id));

    return mapWarehouse(warehouse);
  }

  /**
   * Update an existing warehouse.
   * Validates code uniqueness per branch if code is changed.
   * Invalidates Redis cache on update.
   */
  async update(id: UUID, data: UpdateWarehouseDTO, userId: UUID): Promise<Warehouse> {
    const validated = UpdateWarehouseSchema.parse(data);

    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Gudang dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Check code uniqueness per branch if code is being changed
    const targetBranchId = validated.branch_id ?? existing.branch_id;
    if (validated.code && validated.code !== existing.code) {
      const codeConflict = await this.prisma.warehouse.findFirst({
        where: {
          code: validated.code,
          branch_id: targetBranchId,
          deleted_at: null,
          id: { not: id },
        },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode gudang '${validated.code}' sudah digunakan di branch ini`,
          ErrorCode.CONFLICT,
        );
      }
    }

    const updated = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'UPDATE',
        entityType: 'Warehouse',
        entityId: id,
        before: mapWarehouse(existing) as unknown as Record<string, unknown>,
        after: { ...mapWarehouse(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.warehouse.update({
          where: { id },
          data: {
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.branch_id !== undefined && { branch_id: validated.branch_id }),
            ...(validated.address !== undefined && { address: validated.address }),
          },
        });
      },
    );

    // Invalidate caches
    await Promise.all([
      this.cache.del(warehouseCacheKey(id)),
      this.cache.del(branchCacheKey(existing.branch_id)),
      ...(validated.branch_id && validated.branch_id !== existing.branch_id
        ? [this.cache.del(branchCacheKey(validated.branch_id))]
        : []),
    ]);

    return mapWarehouse(updated);
  }

  /**
   * Find a warehouse by ID.
   * Uses Redis cache (TTL 5 min). Throws NOT_FOUND if not found or soft-deleted.
   */
  async findById(id: UUID): Promise<Warehouse> {
    const cacheKey = warehouseCacheKey(id);
    const cached = await this.cache.get<Warehouse>(cacheKey);
    if (cached) return cached;

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, deleted_at: null },
    });
    if (!warehouse) {
      throw new BusinessRuleException(
        `Gudang dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    const result = mapWarehouse(warehouse);
    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * Return all active warehouses for a branch.
   * Uses Redis cache (TTL 5 min).
   */
  async findByBranch(branchId: UUID): Promise<Warehouse[]> {
    const cacheKey = branchCacheKey(branchId);
    const cached = await this.cache.get<Warehouse[]>(cacheKey);
    if (cached) return cached;

    const rows = await this.prisma.warehouse.findMany({
      where: { branch_id: branchId, is_active: true, deleted_at: null },
      orderBy: { code: 'asc' },
    });

    const result = rows.map(mapWarehouse);
    await this.cache.set(cacheKey, result, CACHE_TTL);
    return result;
  }

  /**
   * Paginated search with filters.
   */
  async search(filters: WarehouseFilterDTO): Promise<PaginatedResult<Warehouse>> {
    const validated = WarehouseFilterSchema.parse(filters);
    const { page, per_page, branch_id, is_active, is_locked, search } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.WarehouseWhereInput = {
      deleted_at: null,
      ...(branch_id && { branch_id }),
      ...(is_active !== undefined && { is_active }),
      ...(is_locked !== undefined && { is_locked }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapWarehouse),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a warehouse by setting deleted_at.
   * Invalidates cache and records audit log.
   */
  async deactivate(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Gudang dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'Warehouse',
        entityId: id,
        before: mapWarehouse(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.warehouse.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );

    await Promise.all([
      this.cache.del(warehouseCacheKey(id)),
      this.cache.del(branchCacheKey(existing.branch_id)),
    ]);
  }

  /**
   * Lock a warehouse (e.g. during stock opname — BR-INV-005).
   * Sets is_locked=true, lock_reason, locked_at, locked_by.
   */
  async lock(id: UUID, reason: string, lockedBy: UUID): Promise<void> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Gudang dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId: lockedBy,
        action: 'LOCK',
        entityType: 'Warehouse',
        entityId: id,
        before: mapWarehouse(existing) as unknown as Record<string, unknown>,
        after: { is_locked: true, lock_reason: reason, locked_by: lockedBy } as Record<string, unknown>,
      },
      async (tx) => {
        await tx.warehouse.update({
          where: { id },
          data: {
            is_locked: true,
            lock_reason: reason,
            locked_at: new Date(),
            locked_by: lockedBy,
          },
        });
      },
    );

    await Promise.all([
      this.cache.del(warehouseCacheKey(id)),
      this.cache.del(branchCacheKey(existing.branch_id)),
    ]);
  }

  /**
   * Unlock a warehouse.
   * Clears is_locked and all lock fields.
   */
  async unlock(id: UUID, unlockedBy: UUID): Promise<void> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Gudang dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId: unlockedBy,
        action: 'UNLOCK',
        entityType: 'Warehouse',
        entityId: id,
        before: mapWarehouse(existing) as unknown as Record<string, unknown>,
        after: { is_locked: false, lock_reason: null, locked_at: null, locked_by: null } as Record<string, unknown>,
      },
      async (tx) => {
        await tx.warehouse.update({
          where: { id },
          data: {
            is_locked: false,
            lock_reason: null,
            locked_at: null,
            locked_by: null,
          },
        });
      },
    );

    await Promise.all([
      this.cache.del(warehouseCacheKey(id)),
      this.cache.del(branchCacheKey(existing.branch_id)),
    ]);
  }
}
