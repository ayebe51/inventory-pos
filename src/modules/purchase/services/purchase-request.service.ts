import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { withAudit } from '../../../services/audit/with-audit.helper';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import {
  PurchaseRequest,
  PurchaseRequestLine,
  PurchaseRequestWithLines,
  PRStatus,
} from '../interfaces/purchase.interfaces';
import {
  CreatePurchaseRequestSchema,
  UpdatePurchaseRequestSchema,
  PurchaseRequestFilterSchema,
  CreatePurchaseRequestDTO,
  UpdatePurchaseRequestDTO,
  PurchaseRequestFilter,
} from '../dto/purchase-request.dto';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapPurchaseRequest(row: {
  id: string;
  pr_number: string;
  branch_id: string;
  warehouse_id: string;
  status: string;
  requested_by: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}): PurchaseRequest {
  return {
    id: row.id as UUID,
    pr_number: row.pr_number,
    branch_id: row.branch_id as UUID,
    warehouse_id: row.warehouse_id as UUID,
    status: row.status as PRStatus,
    requested_by: row.requested_by as UUID,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function mapPurchaseRequestLine(row: {
  id: string;
  pr_id: string;
  product_id: string;
  qty_requested: Prisma.Decimal;
  uom_id: string;
  estimated_price: Prisma.Decimal | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}): PurchaseRequestLine {
  return {
    id: row.id as UUID,
    pr_id: row.pr_id as UUID,
    product_id: row.product_id as UUID,
    qty_requested: Number(row.qty_requested),
    uom_id: row.uom_id as UUID,
    estimated_price: row.estimated_price !== null ? Number(row.estimated_price) : null,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PurchaseRequestService {
  private readonly logger = new Logger(PurchaseRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * Create a new Purchase Request with status DRAFT.
   * Generates PR number in format PR-YYYYMM-XXXXX.
   *
   * @param data - Purchase request data with lines
   * @param userId - User creating the PR
   * @returns Created purchase request with lines
   */
  async create(data: CreatePurchaseRequestDTO, userId: UUID): Promise<PurchaseRequestWithLines> {
    // Validate input
    const validated = CreatePurchaseRequestSchema.parse(data);

    // Verify branch exists and is active
    const branch = await this.prisma.branch.findUnique({
      where: { id: validated.branch_id },
    });

    if (!branch || branch.deleted_at !== null || !branch.is_active) {
      throw new BusinessRuleException(
        `Branch ${validated.branch_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify warehouse exists, is active, and belongs to the branch
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: validated.warehouse_id },
    });

    if (!warehouse || warehouse.deleted_at !== null || !warehouse.is_active) {
      throw new BusinessRuleException(
        `Warehouse ${validated.warehouse_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (warehouse.branch_id !== validated.branch_id) {
      throw new BusinessRuleException(
        `Warehouse ${validated.warehouse_id} does not belong to branch ${validated.branch_id}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify all products exist and are active
    const productIds = validated.lines.map((line) => line.product_id);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        deleted_at: null,
        is_active: true,
      },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      throw new BusinessRuleException(
        `Products not found or inactive: ${missingIds.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify all UOMs exist and are active
    const uomIds = validated.lines.map((line) => line.uom_id);
    const uoms = await this.prisma.unitOfMeasure.findMany({
      where: {
        id: { in: uomIds },
        is_active: true,
      },
    });

    if (uoms.length !== uomIds.length) {
      const foundIds = new Set(uoms.map((u) => u.id));
      const missingIds = uomIds.filter((id) => !foundIds.has(id));
      throw new BusinessRuleException(
        `UOMs not found or inactive: ${missingIds.join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Generate PR number
    const prNumber = await this.numbering.generate(DocumentType.PR);

    // Create PR with lines in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create PR header
      const pr = await tx.purchaseRequest.create({
        data: {
          pr_number: prNumber,
          branch_id: validated.branch_id,
          warehouse_id: validated.warehouse_id,
          status: 'DRAFT',
          requested_by: userId,
          notes: validated.notes ?? null,
        },
      });

      // Create PR lines
      const lines = await Promise.all(
        validated.lines.map((line) =>
          tx.purchaseRequestLine.create({
            data: {
              pr_id: pr.id,
              product_id: line.product_id,
              qty_requested: line.qty_requested,
              uom_id: line.uom_id,
              estimated_price: line.estimated_price ?? null,
              notes: line.notes ?? null,
            },
          }),
        ),
      );

      // Record audit log
      await this.audit.record({
        user_id: userId,
        action: 'CREATE',
        entity_type: 'PurchaseRequest',
        entity_id: pr.id,
        before_snapshot: undefined,
        after_snapshot: { ...pr, lines },
      });

      return { pr, lines };
    });

    this.logger.log(`Created Purchase Request ${result.pr.pr_number} by user ${userId}`);

    return {
      ...mapPurchaseRequest(result.pr),
      lines: result.lines.map(mapPurchaseRequestLine),
    };
  }

  /**
   * Find a purchase request by ID with its lines.
   *
   * @param id - Purchase request ID
   * @returns Purchase request with lines or null if not found
   */
  async findById(id: UUID): Promise<PurchaseRequestWithLines | null> {
    const pr = await this.prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        lines: true,
      },
    });

    if (!pr) {
      return null;
    }

    return {
      ...mapPurchaseRequest(pr),
      lines: pr.lines.map(mapPurchaseRequestLine),
    };
  }

  /**
   * Search purchase requests with filters and pagination.
   *
   * @param filters - Search filters
   * @returns Paginated purchase requests
   */
  async search(filters: PurchaseRequestFilter): Promise<PaginatedResult<PurchaseRequestWithLines>> {
    const validated = PurchaseRequestFilterSchema.parse(filters);

    const page = validated.page ?? 1;
    const perPage = validated.per_page ?? 20;
    const skip = (page - 1) * perPage;

    const where: Prisma.PurchaseRequestWhereInput = {
      deleted_at: null,
      ...(validated.branch_id && { branch_id: validated.branch_id }),
      ...(validated.warehouse_id && { warehouse_id: validated.warehouse_id }),
      ...(validated.status && { status: validated.status }),
      ...(validated.requested_by && { requested_by: validated.requested_by }),
    };

    const [items, total] = await Promise.all([
      this.prisma.purchaseRequest.findMany({
        where,
        include: {
          lines: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.purchaseRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: items.map((pr) => ({
        ...mapPurchaseRequest(pr),
        lines: pr.lines.map(mapPurchaseRequestLine),
      })),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Update a purchase request (only allowed in DRAFT status).
   *
   * @param id - Purchase request ID
   * @param data - Update data
   * @param userId - User performing the update
   * @returns Updated purchase request with lines
   */
  async update(
    id: UUID,
    data: UpdatePurchaseRequestDTO,
    userId: UUID,
  ): Promise<PurchaseRequestWithLines> {
    const validated = UpdatePurchaseRequestSchema.parse(data);

    // Find existing PR
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Request ${id} not found`);
    }

    // Only DRAFT PRs can be updated
    if (existing.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot update Purchase Request in ${existing.status} status. Only DRAFT PRs can be updated.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Verify warehouse if provided
    if (validated.warehouse_id) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: validated.warehouse_id },
      });

      if (!warehouse || warehouse.deleted_at !== null || !warehouse.is_active) {
        throw new BusinessRuleException(
          `Warehouse ${validated.warehouse_id} not found or inactive`,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      if (warehouse.branch_id !== existing.branch_id) {
        throw new BusinessRuleException(
          `Warehouse ${validated.warehouse_id} does not belong to branch ${existing.branch_id}`,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    // Verify products and UOMs if lines are provided
    if (validated.lines) {
      const productIds = validated.lines.map((line) => line.product_id);
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          deleted_at: null,
          is_active: true,
        },
      });

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missingIds = productIds.filter((id) => !foundIds.has(id));
        throw new BusinessRuleException(
          `Products not found or inactive: ${missingIds.join(', ')}`,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      const uomIds = validated.lines.map((line) => line.uom_id);
      const uoms = await this.prisma.unitOfMeasure.findMany({
        where: {
          id: { in: uomIds },
          is_active: true,
        },
      });

      if (uoms.length !== uomIds.length) {
        const foundIds = new Set(uoms.map((u) => u.id));
        const missingIds = uomIds.filter((id) => !foundIds.has(id));
        throw new BusinessRuleException(
          `UOMs not found or inactive: ${missingIds.join(', ')}`,
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    // Update PR in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update PR header
      const pr = await tx.purchaseRequest.update({
        where: { id },
        data: {
          ...(validated.warehouse_id && { warehouse_id: validated.warehouse_id }),
          ...(validated.notes !== undefined && { notes: validated.notes }),
        },
      });

      let lines = existing.lines;

      // Replace lines if provided
      if (validated.lines) {
        // Delete existing lines
        await tx.purchaseRequestLine.deleteMany({
          where: { pr_id: id },
        });

        // Create new lines
        const newLines = await Promise.all(
          validated.lines.map((line) =>
            tx.purchaseRequestLine.create({
              data: {
                pr_id: id,
                product_id: line.product_id,
                qty_requested: line.qty_requested,
                uom_id: line.uom_id,
                estimated_price: line.estimated_price ?? null,
                notes: line.notes ?? null,
              },
            }),
          ),
        );

        lines = newLines.map(mapPurchaseRequestLine);
      }

      // Record audit log
      await this.audit.record({
        user_id: userId,
        action: 'UPDATE',
        entity_type: 'PurchaseRequest',
        entity_id: id,
        before_snapshot: existing as any,
        after_snapshot: { ...pr, lines } as any,
      });

      return { pr, lines };
    });

    this.logger.log(`Updated Purchase Request ${result.pr.pr_number} by user ${userId}`);

    return {
      ...mapPurchaseRequest(result.pr),
      lines: result.lines,
    };
  }

  /**
   * Soft delete a purchase request (only allowed in DRAFT status).
   *
   * @param id - Purchase request ID
   * @param userId - User performing the deletion
   */
  async delete(id: UUID, userId: UUID): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Request ${id} not found`);
    }

    // Only DRAFT PRs can be deleted
    if (existing.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot delete Purchase Request in ${existing.status} status. Only DRAFT PRs can be deleted.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    await withAudit(
      this.prisma,
      this.audit,
      {
        userId: userId,
        action: 'DELETE',
        entityType: 'PurchaseRequest',
        entityId: id,
        before: existing as any,
        after: undefined,
      },
      async (tx) => {
        await tx.purchaseRequest.update({
          where: { id },
          data: { deleted_at: new Date() },
        });
      },
    );

    this.logger.log(`Deleted Purchase Request ${existing.pr_number} by user ${userId}`);
  }
}
