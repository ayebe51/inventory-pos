import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { Supplier } from '../interfaces/master-data.interfaces';
import {
  CreateSupplierSchema,
  UpdateSupplierSchema,
  SupplierFilterSchema,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SupplierFilter,
} from '../dto/supplier.dto';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapSupplier(row: {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms_days: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): Supplier {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    payment_terms_days: row.payment_terms_days,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new supplier.
   * Validates code uniqueness across all non-deleted suppliers.
   */
  async create(data: CreateSupplierDTO, userId: UUID): Promise<Supplier> {
    const validated = CreateSupplierSchema.parse(data);

    const existing = await this.prisma.supplier.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode supplier '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const supplier = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Supplier',
        entityId: '',
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.supplier.create({
          data: {
            code: validated.code,
            name: validated.name,
            email: validated.email ?? null,
            phone: validated.phone ?? null,
            address: validated.address ?? null,
            payment_terms_days: validated.payment_terms_days,
            is_active: validated.is_active,
          },
        });
      },
    );

    return mapSupplier(supplier);
  }

  /**
   * Update an existing supplier.
   * Validates code uniqueness if code is being changed.
   */
  async update(id: UUID, data: UpdateSupplierDTO, userId: UUID): Promise<Supplier> {
    const validated = UpdateSupplierSchema.parse(data);

    const existing = await this.prisma.supplier.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Supplier dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    if (validated.code && validated.code !== existing.code) {
      const codeConflict = await this.prisma.supplier.findFirst({
        where: { code: validated.code, deleted_at: null, id: { not: id } },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode supplier '${validated.code}' sudah digunakan`,
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
        entityType: 'Supplier',
        entityId: id,
        before: mapSupplier(existing) as unknown as Record<string, unknown>,
        after: { ...mapSupplier(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.supplier.update({
          where: { id },
          data: {
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.email !== undefined && { email: validated.email }),
            ...(validated.phone !== undefined && { phone: validated.phone }),
            ...(validated.address !== undefined && { address: validated.address }),
            ...(validated.payment_terms_days !== undefined && {
              payment_terms_days: validated.payment_terms_days,
            }),
            ...(validated.is_active !== undefined && { is_active: validated.is_active }),
          },
        });
      },
    );

    return mapSupplier(updated);
  }

  /**
   * Find a supplier by ID.
   * Throws NOT_FOUND if supplier doesn't exist or is soft-deleted.
   */
  async findById(id: UUID): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deleted_at: null },
    });
    if (!supplier) {
      throw new BusinessRuleException(
        `Supplier dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }
    return mapSupplier(supplier);
  }

  /**
   * Search suppliers with filters and pagination.
   * Excludes soft-deleted suppliers.
   */
  async search(filters: SupplierFilter): Promise<PaginatedResult<Supplier>> {
    const validated = SupplierFilterSchema.parse(filters);
    const { page, per_page, code, name, is_active } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.SupplierWhereInput = {
      deleted_at: null,
      ...(code && { code: { contains: code, mode: 'insensitive' } }),
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(is_active !== undefined && { is_active }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapSupplier),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a supplier by setting deleted_at.
   * Throws NOT_FOUND if supplier doesn't exist or is already deleted.
   */
  async deactivate(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Supplier dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'Supplier',
        entityId: id,
        before: mapSupplier(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.supplier.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );
  }
}
