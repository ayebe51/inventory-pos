import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { Customer } from '../interfaces/master-data.interfaces';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CustomerFilterSchema,
  CreateCustomerDTO,
  UpdateCustomerDTO,
  CustomerFilter,
} from '../dto/customer.dto';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapCustomer(row: {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  credit_limit: Prisma.Decimal;
  outstanding_balance: Prisma.Decimal;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): Customer {
  return {
    id: row.id as UUID,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    credit_limit: Number(row.credit_limit),
    outstanding_balance: Number(row.outstanding_balance),
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new customer.
   * Validates code uniqueness across all non-deleted customers.
   * credit_limit >= 0 enforced by DTO schema.
   */
  async create(data: CreateCustomerDTO, userId: UUID): Promise<Customer> {
    const validated = CreateCustomerSchema.parse(data);

    const existing = await this.prisma.customer.findFirst({
      where: { code: validated.code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode customer '${validated.code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    const customer = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'Customer',
        entityId: '',
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.customer.create({
          data: {
            code: validated.code,
            name: validated.name,
            email: validated.email ?? null,
            phone: validated.phone ?? null,
            address: validated.address ?? null,
            credit_limit: validated.credit_limit,
            is_active: validated.is_active,
          },
        });
      },
    );

    return mapCustomer(customer);
  }

  /**
   * Update an existing customer.
   * Validates code uniqueness if code is being changed.
   * credit_limit >= 0 enforced by DTO schema.
   */
  async update(id: UUID, data: UpdateCustomerDTO, userId: UUID): Promise<Customer> {
    const validated = UpdateCustomerSchema.parse(data);

    const existing = await this.prisma.customer.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Customer dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    if (validated.code && validated.code !== existing.code) {
      const codeConflict = await this.prisma.customer.findFirst({
        where: { code: validated.code, deleted_at: null, id: { not: id } },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode customer '${validated.code}' sudah digunakan`,
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
        entityType: 'Customer',
        entityId: id,
        before: mapCustomer(existing) as unknown as Record<string, unknown>,
        after: { ...mapCustomer(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.customer.update({
          where: { id },
          data: {
            ...(validated.code !== undefined && { code: validated.code }),
            ...(validated.name !== undefined && { name: validated.name }),
            ...(validated.email !== undefined && { email: validated.email }),
            ...(validated.phone !== undefined && { phone: validated.phone }),
            ...(validated.address !== undefined && { address: validated.address }),
            ...(validated.credit_limit !== undefined && { credit_limit: validated.credit_limit }),
            ...(validated.is_active !== undefined && { is_active: validated.is_active }),
          },
        });
      },
    );

    return mapCustomer(updated);
  }

  /**
   * Find a customer by ID.
   * Throws NOT_FOUND if customer doesn't exist or is soft-deleted.
   */
  async findById(id: UUID): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deleted_at: null },
    });
    if (!customer) {
      throw new BusinessRuleException(
        `Customer dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }
    return mapCustomer(customer);
  }

  /**
   * Search customers with filters and pagination.
   * Excludes soft-deleted customers.
   */
  async search(filters: CustomerFilter): Promise<PaginatedResult<Customer>> {
    const validated = CustomerFilterSchema.parse(filters);
    const { page, per_page, code, name, is_active } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.CustomerWhereInput = {
      deleted_at: null,
      ...(code && { code: { contains: code, mode: 'insensitive' } }),
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(is_active !== undefined && { is_active }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapCustomer),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a customer by setting deleted_at.
   * Throws NOT_FOUND if customer doesn't exist or is already deleted.
   */
  async deactivate(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.customer.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Customer dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'Customer',
        entityId: id,
        before: mapCustomer(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.customer.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );
  }

  /**
   * Check if a customer has sufficient credit available.
   * Returns true if (credit_limit - outstanding_balance) >= requiredAmount.
   * Used by Sales Order module (BR-SAL-003).
   */
  async checkCreditAvailable(id: UUID, requiredAmount: number): Promise<boolean> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deleted_at: null },
      select: { credit_limit: true, outstanding_balance: true },
    });
    if (!customer) {
      throw new BusinessRuleException(
        `Customer dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }
    const available = Number(customer.credit_limit) - Number(customer.outstanding_balance);
    return available >= requiredAmount;
  }

  /**
   * Get remaining credit limit for a customer.
   */
  async getRemainingCredit(id: UUID): Promise<number> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, deleted_at: null },
      select: { credit_limit: true, outstanding_balance: true },
    });
    if (!customer) {
      throw new BusinessRuleException(
        `Customer dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }
    return Number(customer.credit_limit) - Number(customer.outstanding_balance);
  }
}
