import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { ChartOfAccount, ChartOfAccountNode } from '../interfaces/master-data.interfaces';
import {
  CreateCOASchema,
  UpdateCOASchema,
  COAFilterSchema,
  CreateCOADTO,
  UpdateCOADTO,
  COAFilterDTO,
  AccountType,
  getAccountCodeLevel,
} from '../dto/coa.dto';

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapCOA(row: {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  account_category: string | null;
  parent_id: string | null;
  level: number;
  is_header: boolean;
  normal_balance: string;
  is_active: boolean;
  is_system: boolean;
  branch_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): ChartOfAccount {
  return {
    id: row.id as UUID,
    account_code: row.account_code,
    account_name: row.account_name,
    account_type: row.account_type as AccountType,
    account_category: row.account_category,
    parent_id: row.parent_id as UUID | null,
    level: row.level,
    is_header: row.is_header,
    normal_balance: row.normal_balance as 'DEBIT' | 'CREDIT',
    is_active: row.is_active,
    is_system: row.is_system,
    branch_id: row.branch_id as UUID | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(accounts: ChartOfAccount[]): ChartOfAccountNode[] {
  const map = new Map<string, ChartOfAccountNode>();
  const roots: ChartOfAccountNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Service ───────────────────────────────────────────────────────────────────

const MAX_COA_LEVEL = 5;

@Injectable()
export class CoaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new COA account.
   * Validates account_code format, level 1-5, parent hierarchy, and uniqueness.
   */
  async create(data: CreateCOADTO, userId: UUID): Promise<ChartOfAccount> {
    const validated = CreateCOASchema.parse(data);

    const codeLevel = getAccountCodeLevel(validated.account_code);
    if (codeLevel < 1 || codeLevel > MAX_COA_LEVEL) {
      throw new BusinessRuleException(
        `Level akun harus antara 1 dan ${MAX_COA_LEVEL}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check code uniqueness
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { account_code: validated.account_code, deleted_at: null },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Kode akun '${validated.account_code}' sudah digunakan`,
        ErrorCode.CONFLICT,
      );
    }

    // Validate parent if provided
    let parentLevel = 0;
    if (validated.parent_id) {
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: validated.parent_id, deleted_at: null },
        select: { id: true, level: true, is_header: true },
      });
      if (!parent) {
        throw new BusinessRuleException(
          `Parent akun dengan id '${validated.parent_id}' tidak ditemukan`,
          ErrorCode.NOT_FOUND,
        );
      }
      if (!parent.is_header) {
        throw new BusinessRuleException(
          'Parent akun harus berstatus is_header=true',
          ErrorCode.VALIDATION_ERROR,
        );
      }
      parentLevel = parent.level;
      if (codeLevel !== parentLevel + 1) {
        throw new BusinessRuleException(
          `Level akun (${codeLevel}) harus sama dengan level parent + 1 (${parentLevel + 1})`,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    } else {
      // Root account must be level 1
      if (codeLevel !== 1) {
        throw new BusinessRuleException(
          'Akun tanpa parent harus berada di level 1',
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    const coa = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'CREATE',
        entityType: 'ChartOfAccount',
        entityId: '',
        after: validated as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.chartOfAccount.create({
          data: {
            account_code: validated.account_code,
            account_name: validated.account_name,
            account_type: validated.account_type,
            account_category: validated.account_category ?? null,
            parent_id: validated.parent_id ?? null,
            level: codeLevel,
            is_header: validated.is_header,
            normal_balance: validated.normal_balance,
            is_active: validated.is_active,
            branch_id: validated.branch_id ?? null,
          },
        });
      },
    );

    return mapCOA(coa);
  }

  /**
   * Update an existing COA account.
   * Cannot change account_type if account has journal history.
   */
  async update(id: UUID, data: UpdateCOADTO, userId: UUID): Promise<ChartOfAccount> {
    const validated = UpdateCOASchema.parse(data);

    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Akun COA dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Validate new account_code if provided
    if (validated.account_code && validated.account_code !== existing.account_code) {
      const codeConflict = await this.prisma.chartOfAccount.findFirst({
        where: { account_code: validated.account_code, deleted_at: null, id: { not: id } },
        select: { id: true },
      });
      if (codeConflict) {
        throw new BusinessRuleException(
          `Kode akun '${validated.account_code}' sudah digunakan`,
          ErrorCode.CONFLICT,
        );
      }
    }

    // Cannot change account_type if has journal history (BR-ACC-005 related)
    if (validated.account_type && validated.account_type !== existing.account_type) {
      const hasHistory = await this.prisma.journalEntryLine.findFirst({
        where: { account_id: id },
        select: { id: true },
      });
      if (hasHistory) {
        throw new BusinessRuleException(
          'Tidak dapat mengubah tipe akun yang sudah memiliki riwayat jurnal',
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }
    }

    const updated = await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'UPDATE',
        entityType: 'ChartOfAccount',
        entityId: id,
        before: mapCOA(existing) as unknown as Record<string, unknown>,
        after: { ...mapCOA(existing), ...validated } as unknown as Record<string, unknown>,
      },
      async (tx) => {
        return tx.chartOfAccount.update({
          where: { id },
          data: {
            ...(validated.account_code !== undefined && { account_code: validated.account_code }),
            ...(validated.account_name !== undefined && { account_name: validated.account_name }),
            ...(validated.account_type !== undefined && { account_type: validated.account_type }),
            ...(validated.account_category !== undefined && { account_category: validated.account_category }),
            ...(validated.parent_id !== undefined && { parent_id: validated.parent_id }),
            ...(validated.is_header !== undefined && { is_header: validated.is_header }),
            ...(validated.normal_balance !== undefined && { normal_balance: validated.normal_balance }),
            ...(validated.is_active !== undefined && { is_active: validated.is_active }),
            ...(validated.branch_id !== undefined && { branch_id: validated.branch_id }),
          },
        });
      },
    );

    return mapCOA(updated);
  }

  /**
   * Find a COA account by ID, including its children.
   */
  async findById(id: UUID): Promise<ChartOfAccount & { children: ChartOfAccount[] }> {
    const coa = await this.prisma.chartOfAccount.findFirst({
      where: { id, deleted_at: null },
      include: {
        children: {
          where: { deleted_at: null },
          orderBy: { account_code: 'asc' },
        },
      },
    });
    if (!coa) {
      throw new BusinessRuleException(
        `Akun COA dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    return {
      ...mapCOA(coa),
      children: coa.children.map(mapCOA),
    };
  }

  /**
   * Paginated list of COA accounts with optional filters.
   */
  async findAll(filters: COAFilterDTO): Promise<PaginatedResult<ChartOfAccount>> {
    const validated = COAFilterSchema.parse(filters);
    const { page, per_page, account_type, is_header, is_active, parent_id, branch_id, search } = validated;
    const skip = (page - 1) * per_page;

    const where: Prisma.ChartOfAccountWhereInput = {
      deleted_at: null,
      ...(account_type && { account_type }),
      ...(is_header !== undefined && { is_header }),
      ...(is_active !== undefined && { is_active }),
      ...(parent_id !== undefined && { parent_id }),
      ...(branch_id !== undefined && { branch_id }),
      ...(search && {
        OR: [
          { account_code: { contains: search, mode: 'insensitive' } },
          { account_name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.chartOfAccount.count({ where }),
      this.prisma.chartOfAccount.findMany({
        where,
        orderBy: { account_code: 'asc' },
        skip,
        take: per_page,
      }),
    ]);

    return {
      data: rows.map(mapCOA),
      meta: {
        page,
        per_page,
        total,
        total_pages: Math.ceil(total / per_page),
      },
    };
  }

  /**
   * Soft-delete a COA account.
   * BR-ACC-005: Cannot delete if has journal history (soft delete only).
   * is_system=true: block entirely.
   */
  async softDelete(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { id, deleted_at: null },
    });
    if (!existing) {
      throw new BusinessRuleException(
        `Akun COA dengan id '${id}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    // is_system accounts cannot be deleted at all
    if (existing.is_system) {
      throw new BusinessRuleException(
        `Akun sistem tidak dapat dihapus`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // BR-ACC-005: check journal history — only soft delete allowed
    const hasHistory = await this.prisma.journalEntryLine.findFirst({
      where: { account_id: id },
      select: { id: true },
    });
    if (hasHistory) {
      // Soft delete is allowed but hard delete is not — we proceed with soft delete
      // and note this is the only allowed operation per BR-ACC-005
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId,
        action: 'DELETE',
        entityType: 'ChartOfAccount',
        entityId: id,
        before: mapCOA(existing) as unknown as Record<string, unknown>,
      },
      async (tx) => {
        await tx.chartOfAccount.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );
  }

  /**
   * Validate that an account is postable (not a header account).
   * BR-ACC-006: Throws VALIDATION_ERROR if is_header=true.
   */
  async validatePostable(accountId: UUID): Promise<void> {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id: accountId, deleted_at: null },
      select: { id: true, is_header: true, account_code: true, account_name: true },
    });

    if (!account) {
      throw new BusinessRuleException(
        `Akun COA dengan id '${accountId}' tidak ditemukan`,
        ErrorCode.NOT_FOUND,
      );
    }

    if (account.is_header) {
      throw new BusinessRuleException(
        `Akun '${account.account_code} - ${account.account_name}' adalah akun header dan tidak dapat digunakan dalam jurnal (BR-ACC-006)`,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  /**
   * Return full COA tree hierarchy, optionally filtered by branch.
   */
  async getTree(branchId?: UUID): Promise<ChartOfAccountNode[]> {
    const where: Prisma.ChartOfAccountWhereInput = {
      deleted_at: null,
      is_active: true,
      ...(branchId !== undefined && {
        OR: [{ branch_id: branchId }, { branch_id: null }],
      }),
    };

    const rows = await this.prisma.chartOfAccount.findMany({
      where,
      orderBy: { account_code: 'asc' },
    });

    return buildTree(rows.map(mapCOA));
  }
}
