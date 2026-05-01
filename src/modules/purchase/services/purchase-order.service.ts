import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  PurchaseOrder,
  POStatus,
  ApprovalLevel,
  GoodsReceipt,
} from '../interfaces/purchase.interfaces';
import {
  CreatePODTO,
  CreatePOSchema,
  GoodsReceiptDTO,
  GoodsReceiptSchema,
} from '../dto/purchase-order.dto';

// ── State Machine Transitions ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  REJECTED: ['DRAFT'], // Can revise back to DRAFT
  APPROVED: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['FULLY_RECEIVED'],
  FULLY_RECEIVED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

// ── Approval Thresholds ───────────────────────────────────────────────────────

const APPROVAL_THRESHOLDS = {
  LEVEL_1: 5_000_000, // < 5M = Level 1 (Supervisor)
  LEVEL_2: 50_000_000, // 5M-50M = Level 2 (Finance Manager)
  // > 50M = Level 3 (Owner)
};

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapPurchaseOrder(row: any): PurchaseOrder {
  return {
    id: row.id as UUID,
    po_number: row.po_number,
    pr_id: row.pr_id as UUID | null,
    supplier_id: row.supplier_id as UUID,
    branch_id: row.branch_id as UUID,
    warehouse_id: row.warehouse_id as UUID,
    status: row.status as POStatus,
    order_date: row.order_date,
    expected_delivery_date: row.expected_delivery_date,
    currency: row.currency,
    exchange_rate: Number(row.exchange_rate),
    subtotal: Number(row.subtotal),
    tax_amount: Number(row.tax_amount),
    additional_cost: Number(row.additional_cost),
    total_amount: Number(row.total_amount),
    approval_level: row.approval_level,
    approved_by: row.approved_by as UUID | null,
    approved_at: row.approved_at,
    notes: row.notes,
    terms_of_payment_id: row.terms_of_payment_id as UUID | null,
    created_by: row.created_by as UUID,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function mapGoodsReceipt(row: any): GoodsReceipt {
  return {
    id: row.id as UUID,
    gr_number: row.gr_number,
    po_id: row.po_id as UUID,
    supplier_id: row.supplier_id as UUID,
    warehouse_id: row.warehouse_id as UUID,
    receipt_date: row.receipt_date,
    status: row.status,
    total_amount: Number(row.total_amount || 0),
    notes: row.notes,
    confirmed_by: row.confirmed_by as UUID | null,
    confirmed_at: row.confirmed_at,
    created_by: row.created_by as UUID,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * Create a new Purchase Order with status DRAFT.
   * Generates PO number in format PO-YYYYMM-XXXXX.
   * Calculates totals and determines approval level based on amount.
   *
   * @param data - Purchase order data with lines
   * @returns Created purchase order
   */
  async create(data: CreatePODTO, userId: UUID): Promise<PurchaseOrder> {
    const validated = CreatePOSchema.parse(data);

    // Verify supplier exists and is active
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: validated.supplier_id },
    });

    if (!supplier || supplier.deleted_at !== null || !supplier.is_active) {
      throw new BusinessRuleException(
        `Supplier ${validated.supplier_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

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

    // Verify PR if provided
    if (validated.pr_id) {
      const pr = await this.prisma.purchaseRequest.findUnique({
        where: { id: validated.pr_id },
      });

      if (!pr || pr.deleted_at !== null) {
        throw new BusinessRuleException(
          `Purchase Request ${validated.pr_id} not found`,
          ErrorCode.VALIDATION_ERROR,
        );
      }
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

    // Calculate line totals
    const linesWithTotals = validated.lines.map((line) => {
      const discountAmount = (line.unit_price * line.qty_ordered * line.discount_pct!) / 100;
      const subtotal = line.unit_price * line.qty_ordered - discountAmount;
      const taxAmount = (subtotal * line.tax_pct!) / 100;
      const lineTotal = subtotal + taxAmount;

      return {
        ...line,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        line_total: lineTotal,
      };
    });

    // Calculate PO totals
    const subtotal = linesWithTotals.reduce((sum, line) => sum + line.line_total, 0);
    const taxAmount = linesWithTotals.reduce((sum, line) => sum + line.tax_amount, 0);
    const totalAmount = subtotal + (validated.additional_cost || 0);

    // Determine approval level
    const approvalLevel = this.getApprovalThreshold(totalAmount);

    // Generate PO number
    const poNumber = await this.numbering.generate(DocumentType.PO);

    // Create PO with lines in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create PO header
      const po = await tx.purchaseOrder.create({
        data: {
          po_number: poNumber,
          pr_id: validated.pr_id ?? null,
          supplier_id: validated.supplier_id,
          branch_id: validated.branch_id,
          warehouse_id: validated.warehouse_id,
          status: 'DRAFT',
          order_date: validated.order_date,
          expected_delivery_date: validated.expected_delivery_date ?? null,
          currency: validated.currency,
          exchange_rate: validated.exchange_rate,
          subtotal: subtotal,
          tax_amount: taxAmount,
          additional_cost: validated.additional_cost || 0,
          total_amount: totalAmount,
          approval_level: approvalLevel,
          notes: validated.notes ?? null,
          created_by: userId,
        },
      });

      // Create PO lines
      await Promise.all(
        linesWithTotals.map((line) =>
          tx.purchaseOrderLine.create({
            data: {
              po_id: po.id,
              product_id: line.product_id,
              description: line.description ?? null,
              qty_ordered: line.qty_ordered,
              qty_received: 0,
              uom_id: line.uom_id,
              unit_price: line.unit_price,
              discount_pct: line.discount_pct!,
              discount_amount: line.discount_amount,
              tax_pct: line.tax_pct!,
              tax_amount: line.tax_amount,
              line_total: line.line_total,
              line_status: 'OPEN',
            },
          }),
        ),
      );

      // Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'PurchaseOrder',
          entity_id: po.id,
          before_snapshot: undefined,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Created Purchase Order ${result.po_number} by user ${userId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Submit PO for approval (DRAFT → PENDING_APPROVAL).
   *
   * @param id - Purchase order ID
   * @param userId - User submitting the PO
   * @returns Updated purchase order
   */
  async submit(id: UUID, userId: UUID): Promise<PurchaseOrder> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'PENDING_APPROVAL');

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL' },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Submitted Purchase Order ${result.po_number} for approval by user ${userId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Approve PO (PENDING_APPROVAL → APPROVED).
   * Validates that approver is not the creator (SOD-001).
   *
   * @param id - Purchase order ID
   * @param approverId - User approving the PO
   * @param notes - Optional approval notes
   * @returns Updated purchase order
   */
  async approve(id: UUID, approverId: UUID, notes?: string): Promise<PurchaseOrder> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'APPROVED');

    // SOD-001: Pembuat PO tidak bisa menjadi approver PO yang sama
    if (existing.created_by === approverId) {
      throw new BusinessRuleException(
        'SOD-001: PO creator cannot approve their own PO',
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approved_by: approverId,
          approved_at: new Date(),
          notes: notes ? `${existing.notes || ''}\nApproval: ${notes}`.trim() : existing.notes,
        },
      });

      await this.audit.record(
        {
          user_id: approverId,
          action: 'APPROVE',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Approved Purchase Order ${result.po_number} by user ${approverId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Reject PO (PENDING_APPROVAL → REJECTED).
   *
   * @param id - Purchase order ID
   * @param approverId - User rejecting the PO
   * @param reason - Rejection reason (required)
   * @returns Updated purchase order
   */
  async reject(id: UUID, approverId: UUID, reason: string): Promise<PurchaseOrder> {
    if (!reason || reason.trim().length === 0) {
      throw new BusinessRuleException(
        'Rejection reason is required',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'REJECTED');

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: `${existing.notes || ''}\nRejected: ${reason}`.trim(),
        },
      });

      await this.audit.record(
        {
          user_id: approverId,
          action: 'REJECT',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Rejected Purchase Order ${result.po_number} by user ${approverId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Revise rejected PO back to DRAFT (REJECTED → DRAFT).
   *
   * @param id - Purchase order ID
   * @param userId - User revising the PO
   * @returns Updated purchase order
   */
  async revise(id: UUID, userId: UUID): Promise<PurchaseOrder> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'DRAFT');

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'DRAFT' },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Revised Purchase Order ${result.po_number} back to DRAFT by user ${userId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Cancel PO (APPROVED → CANCELLED).
   * Only allowed if no Goods Receipt has been confirmed yet.
   *
   * @param id - Purchase order ID
   * @param userId - User cancelling the PO
   * @param reason - Cancellation reason (required)
   * @returns Updated purchase order
   */
  async cancel(id: UUID, userId: UUID, reason: string): Promise<PurchaseOrder> {
    if (!reason || reason.trim().length === 0) {
      throw new BusinessRuleException(
        'Cancellation reason is required',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'CANCELLED');

    // Check if any GR has been confirmed
    const confirmedGR = await this.prisma.goodsReceipt.findFirst({
      where: {
        po_id: id,
        status: 'CONFIRMED',
      },
    });

    if (confirmedGR) {
      throw new BusinessRuleException(
        'Cannot cancel PO: Goods Receipt has already been confirmed',
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: `${existing.notes || ''}\nCancelled: ${reason}`.trim(),
        },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'CANCEL',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Cancelled Purchase Order ${result.po_number} by user ${userId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Create Goods Receipt for PO.
   * Updates PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED based on quantities.
   * This method creates the GR in DRAFT status - confirmation is handled by GoodsReceiptService.
   *
   * @param id - Purchase order ID
   * @param data - Goods receipt data
   * @param userId - User creating the GR
   * @returns Created goods receipt
   */
  async receiveGoods(id: UUID, data: GoodsReceiptDTO, userId: UUID): Promise<GoodsReceipt> {
    const validated = GoodsReceiptSchema.parse(data);

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!po || po.deleted_at !== null) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // PO must be APPROVED to receive goods
    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new BusinessRuleException(
        `Cannot receive goods for PO in ${po.status} status. PO must be APPROVED or PARTIALLY_RECEIVED.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Validate all lines reference valid PO lines
    const poLineIds = new Set(po.lines.map((l) => l.id));
    const invalidLines = validated.lines.filter((l) => !poLineIds.has(l.po_line_id));
    if (invalidLines.length > 0) {
      throw new BusinessRuleException(
        `Invalid PO line IDs: ${invalidLines.map((l) => l.po_line_id).join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Validate quantities don't exceed ordered quantities
    for (const grLine of validated.lines) {
      const poLine = po.lines.find((l) => l.id === grLine.po_line_id);
      if (!poLine) continue;

      const remainingQty = Number(poLine.qty_ordered) - Number(poLine.qty_received);
      if (grLine.qty_received > remainingQty) {
        throw new BusinessRuleException(
          `Cannot receive ${grLine.qty_received} units for product ${grLine.product_id}. Only ${remainingQty} units remaining.`,
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }
    }

    // Generate GR number
    const grNumber = await this.numbering.generate(DocumentType.GR);

    // Calculate total amount
    const totalAmount = validated.lines.reduce(
      (sum, line) => sum + line.qty_received * line.unit_cost,
      0,
    );

    // Create GR in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create GR header
      const gr = await tx.goodsReceipt.create({
        data: {
          gr_number: grNumber,
          po_id: id,
          supplier_id: po.supplier_id,
          warehouse_id: po.warehouse_id,
          receipt_date: validated.receipt_date,
          status: 'DRAFT',
          notes: validated.notes ?? null,
          created_by: userId,
        },
      });

      // Create GR lines
      await Promise.all(
        validated.lines.map((line) =>
          tx.goodsReceiptLine.create({
            data: {
              gr_id: gr.id,
              po_line_id: line.po_line_id,
              product_id: line.product_id,
              qty_received: line.qty_received,
              uom_id: line.uom_id,
              unit_cost: line.unit_cost,
              total_cost: line.qty_received * line.unit_cost,
              batch_number: line.batch_number ?? null,
              serial_number: line.serial_number ?? null,
              notes: line.notes ?? null,
            },
          }),
        ),
      );

      // Update PO line quantities (but don't change PO status yet - that happens on GR confirmation)
      for (const grLine of validated.lines) {
        const poLine = po.lines.find((l) => l.id === grLine.po_line_id);
        if (!poLine) continue;

        const newQtyReceived = Number(poLine.qty_received) + grLine.qty_received;
        const qtyOrdered = Number(poLine.qty_ordered);

        await tx.purchaseOrderLine.update({
          where: { id: grLine.po_line_id },
          data: {
            qty_received: newQtyReceived,
            line_status: newQtyReceived >= qtyOrdered ? 'CLOSED' : 'PARTIAL',
          },
        });
      }

      // Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'GoodsReceipt',
          entity_id: gr.id,
          before_snapshot: undefined,
          after_snapshot: gr,
        },
        tx,
      );

      return { ...gr, total_amount: totalAmount };
    });

    this.logger.log(`Created Goods Receipt ${result.gr_number} for PO ${po.po_number}`);

    return mapGoodsReceipt(result);
  }

  /**
   * Update PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED.
   * Called by GoodsReceiptService when GR is confirmed.
   *
   * @param id - Purchase order ID
   * @param userId - User confirming the GR
   */
  async updateReceiptStatus(id: UUID, userId: UUID): Promise<PurchaseOrder> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Check if all lines are fully received
    const allFullyReceived = po.lines.every(
      (line) => Number(line.qty_received) >= Number(line.qty_ordered),
    );

    const newStatus: POStatus = allFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';

    // Validate transition
    this.validateTransition(po.status as POStatus, newStatus);

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: po as any,
          after_snapshot: updated,
        },
        tx,
      );

      return updated;
    });

    this.logger.log(`Updated Purchase Order ${result.po_number} status to ${newStatus}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Close PO (FULLY_RECEIVED → CLOSED).
   *
   * @param id - Purchase order ID
   * @param userId - User closing the PO
   * @returns Updated purchase order
   */
  async close(id: UUID, userId: UUID): Promise<PurchaseOrder> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Purchase Order ${id} not found`);
    }

    // Validate state transition
    this.validateTransition(existing.status, 'CLOSED');

    const result = await this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CLOSED' },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'PurchaseOrder',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: po,
        },
        tx,
      );

      return po;
    });

    this.logger.log(`Closed Purchase Order ${result.po_number} by user ${userId}`);

    return mapPurchaseOrder(result);
  }

  /**
   * Get approval threshold level based on total amount.
   *
   * @param amount - Total PO amount
   * @returns Approval level (1, 2, or 3)
   */
  getApprovalThreshold(amount: number): ApprovalLevel {
    if (amount < APPROVAL_THRESHOLDS.LEVEL_1) {
      return 1; // Supervisor
    } else if (amount < APPROVAL_THRESHOLDS.LEVEL_2) {
      return 2; // Finance Manager
    } else {
      return 3; // Owner
    }
  }

  /**
   * Find a purchase order by ID.
   *
   * @param id - Purchase order ID
   * @returns Purchase order or null if not found
   */
  async findById(id: UUID): Promise<PurchaseOrder | null> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po || po.deleted_at !== null) {
      return null;
    }

    return mapPurchaseOrder(po);
  }

  /**
   * Validate state transition.
   *
   * @param currentStatus - Current PO status
   * @param newStatus - Target status
   * @throws BusinessRuleException if transition is invalid
   */
  private validateTransition(currentStatus: POStatus, newStatus: POStatus): void {
    const validNextStates = VALID_TRANSITIONS[currentStatus];

    if (!validNextStates.includes(newStatus)) {
      throw new BusinessRuleException(
        `Invalid state transition: ${currentStatus} → ${newStatus}. Valid transitions from ${currentStatus}: ${validNextStates.join(', ')}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }
  }
}
