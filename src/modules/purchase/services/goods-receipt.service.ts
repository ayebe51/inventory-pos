import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  GoodsReceipt,
  OverReceiptPolicy,
  CreateGRDTO,
} from '../interfaces/purchase.interfaces';
import {
  GoodsReceiptSchema,
} from '../dto/purchase-order.dto';

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Over-receipt tolerance percentage.
 * BR-PUR-003: GR qty cannot exceed PO qty × (1 + tolerance).
 * Default: 5% tolerance (0.05).
 */
const OVER_RECEIPT_TOLERANCE = 0.05;

/**
 * Default over-receipt policy.
 * REJECT: Reject any over-receipt beyond tolerance.
 * ACCEPT_WITH_TOLERANCE: Accept over-receipt within tolerance.
 */
const DEFAULT_OVER_RECEIPT_POLICY: OverReceiptPolicy = 'REJECT';

// ── Mappers ───────────────────────────────────────────────────────────────────

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
export class GoodsReceiptService {
  private readonly logger = new Logger(GoodsReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * Create a new Goods Receipt from a Purchase Order.
   * Validates BR-PUR-003: qty_received cannot exceed qty_ordered × (1 + tolerance).
   *
   * @param poId - Purchase Order ID
   * @param data - Goods receipt data with lines
   * @param userId - User creating the GR
   * @returns Created goods receipt in DRAFT status
   */
  async create(poId: UUID, data: CreateGRDTO, userId: UUID): Promise<GoodsReceipt> {
    const validated = GoodsReceiptSchema.parse(data);

    // Fetch PO with lines
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        lines: true,
        supplier: true,
        warehouse: true,
      },
    });

    if (!po || po.deleted_at !== null) {
      throw new NotFoundException(`Purchase Order ${poId} not found`);
    }

    // PO must be APPROVED or PARTIALLY_RECEIVED to create GR
    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new BusinessRuleException(
        `Cannot create Goods Receipt for PO in ${po.status} status. PO must be APPROVED or PARTIALLY_RECEIVED.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Validate warehouse is not locked
    if (po.warehouse.is_locked) {
      throw new BusinessRuleException(
        `Warehouse ${po.warehouse.name} is locked. Cannot receive goods.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Validate all GR lines reference valid PO lines
    const poLineMap = new Map(po.lines.map((line) => [line.id, line]));
    const invalidLines = validated.lines.filter((line) => !poLineMap.has(line.po_line_id));

    if (invalidLines.length > 0) {
      throw new BusinessRuleException(
        `Invalid PO line IDs: ${invalidLines.map((l) => l.po_line_id).join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // BR-PUR-003: Validate quantities don't exceed PO qty × (1 + tolerance)
    const policy = DEFAULT_OVER_RECEIPT_POLICY;
    const tolerance = policy === 'ACCEPT_WITH_TOLERANCE' ? OVER_RECEIPT_TOLERANCE : 0;

    for (const grLine of validated.lines) {
      const poLine = poLineMap.get(grLine.po_line_id);
      if (!poLine) continue;

      const qtyOrdered = Number(poLine.qty_ordered);
      const qtyAlreadyReceived = Number(poLine.qty_received);
      const qtyReceiving = grLine.qty_received;
      const newTotalReceived = qtyAlreadyReceived + qtyReceiving;

      // Calculate maximum allowed quantity with tolerance
      const maxAllowedQty = qtyOrdered * (1 + tolerance);

      // Validate against maximum allowed
      if (newTotalReceived > maxAllowedQty) {
        const remainingQty = qtyOrdered - qtyAlreadyReceived;
        const maxReceivableNow = maxAllowedQty - qtyAlreadyReceived;

        throw new BusinessRuleException(
          `BR-PUR-003: Cannot receive ${qtyReceiving} units for product ${grLine.product_id}. ` +
            `Ordered: ${qtyOrdered}, Already received: ${qtyAlreadyReceived}, ` +
            `Remaining: ${remainingQty}, Max receivable (with ${tolerance * 100}% tolerance): ${maxReceivableNow.toFixed(4)}`,
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }

      // Validate product matches PO line
      if (grLine.product_id !== poLine.product_id) {
        throw new BusinessRuleException(
          `Product mismatch: GR line references product ${grLine.product_id} but PO line has product ${poLine.product_id}`,
          ErrorCode.VALIDATION_ERROR,
        );
      }

      // Validate UOM matches PO line
      if (grLine.uom_id !== poLine.uom_id) {
        throw new BusinessRuleException(
          `UOM mismatch: GR line uses UOM ${grLine.uom_id} but PO line uses UOM ${poLine.uom_id}`,
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
          po_id: poId,
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

      // Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'GoodsReceipt',
          entity_id: gr.id,
          before_snapshot: undefined,
          after_snapshot: { ...gr, total_amount: totalAmount },
        },
        tx,
      );

      return { ...gr, total_amount: totalAmount };
    });

    this.logger.log(
      `Created Goods Receipt ${result.gr_number} for PO ${po.po_number} by user ${userId}`,
    );

    return mapGoodsReceipt(result);
  }

  /**
   * Confirm Goods Receipt (DRAFT → CONFIRMED).
   * Task 9.6 implementation:
   * - Updates PO line qty_received
   * - Updates PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED
   * - Records inventory movement (append-only ledger)
   * - Triggers WAC recalculation
   * - Triggers auto journal GR
   * - All operations are atomic (single DB transaction)
   *
   * @param id - Goods Receipt ID
   * @param userId - User confirming the GR
   * @returns Confirmed goods receipt
   */
  async confirm(id: UUID, userId: UUID): Promise<GoodsReceipt> {
    // Fetch GR with all related data
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            po_line: true,
          },
        },
        purchase_order: {
          include: {
            lines: true,
          },
        },
        warehouse: true,
      },
    });

    if (!gr || gr.deleted_at !== null) {
      throw new NotFoundException(`Goods Receipt ${id} not found`);
    }

    // Validate GR is in DRAFT status
    if (gr.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot confirm Goods Receipt ${gr.gr_number}: current status is ${gr.status}. Only DRAFT GRs can be confirmed.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Validate warehouse is not locked (BR-INV-005)
    if (gr.warehouse.is_locked) {
      throw new BusinessRuleException(
        `BR-INV-005: Warehouse ${gr.warehouse.name} is locked. Cannot confirm goods receipt.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Get fiscal period for the receipt date
    const { PeriodManagerService } = await import('../../../services/period-manager/period-manager.service');
    const periodManager = new PeriodManagerService(this.prisma);
    const fiscalPeriod = await periodManager.getPeriodForDate(gr.receipt_date);

    // Validate period is OPEN (BR-ACC-002)
    await periodManager.validatePeriodOpen(fiscalPeriod.id);

    // Execute all operations in a single transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update qty_received on each PO line
      for (const grLine of gr.lines) {
        const currentPoLine = await tx.purchaseOrderLine.findUnique({
          where: { id: grLine.po_line_id },
        });

        if (!currentPoLine) {
          throw new BusinessRuleException(
            `PO line ${grLine.po_line_id} not found`,
            ErrorCode.NOT_FOUND,
          );
        }

        const newQtyReceived = Number(currentPoLine.qty_received) + Number(grLine.qty_received);

        await tx.purchaseOrderLine.update({
          where: { id: grLine.po_line_id },
          data: {
            qty_received: newQtyReceived,
            line_status:
              newQtyReceived >= Number(currentPoLine.qty_ordered)
                ? 'CLOSED'
                : 'PARTIAL',
          },
        });
      }

      // 2. Update PO status based on fulfillment
      const updatedPoLines = await tx.purchaseOrderLine.findMany({
        where: { po_id: gr.po_id },
      });

      const allLinesClosed = updatedPoLines.every(
        (line) => Number(line.qty_received) >= Number(line.qty_ordered),
      );
      const anyLinePartial = updatedPoLines.some(
        (line) =>
          Number(line.qty_received) > 0 &&
          Number(line.qty_received) < Number(line.qty_ordered),
      );

      let newPoStatus: string;
      if (allLinesClosed) {
        newPoStatus = 'FULLY_RECEIVED';
      } else if (anyLinePartial || updatedPoLines.some((line) => Number(line.qty_received) > 0)) {
        newPoStatus = 'PARTIALLY_RECEIVED';
      } else {
        newPoStatus = gr.purchase_order.status; // Keep current status
      }

      await tx.purchaseOrder.update({
        where: { id: gr.po_id },
        data: { status: newPoStatus },
      });

      // 3. Record inventory movements (append-only) and calculate WAC for each line
      for (const grLine of gr.lines) {
        // Get current stock balance and average cost
        const currentBalance = await this.getStockBalance(
          grLine.product_id,
          gr.warehouse_id,
          tx,
        );

        // Calculate new WAC using formula: WAC_baru = (nilai_stok_lama + nilai_masuk_baru) / (qty_stok_lama + qty_masuk_baru)
        const currentQty = currentBalance.qty;
        const currentValue = currentBalance.value;
        const incomingQty = Number(grLine.qty_received);
        const incomingValue = Number(grLine.qty_received) * Number(grLine.unit_cost);

        const newTotalQty = currentQty + incomingQty;
        const newTotalValue = currentValue + incomingValue;

        // BR-INV-003: Average cost must be >= 0
        const newAverageCost = newTotalQty > 0 ? newTotalValue / newTotalQty : 0;

        if (newAverageCost < 0) {
          throw new BusinessRuleException(
            `BR-INV-003: Average cost cannot be negative. Product: ${grLine.product_id}, Warehouse: ${gr.warehouse_id}`,
            ErrorCode.BUSINESS_RULE_VIOLATION,
          );
        }

        // Record inventory ledger entry (append-only, BR-INV-002)
        await tx.inventoryLedger.create({
          data: {
            product_id: grLine.product_id,
            warehouse_id: gr.warehouse_id,
            transaction_type: 'GR',
            reference_type: 'GR',
            reference_id: gr.id,
            reference_number: gr.gr_number,
            movement_date: gr.receipt_date,
            qty_in: grLine.qty_received,
            qty_out: 0,
            unit_cost: newAverageCost, // Use new WAC
            total_cost: incomingValue,
            running_qty: newTotalQty,
            running_cost: newTotalValue,
            batch_number: grLine.batch_number,
            serial_number: grLine.serial_number,
            notes: grLine.notes,
            created_by: userId,
          },
        });
      }

      // 4. Trigger auto journal for GR
      const { JournalEngineService } = await import('../../../services/journal-engine/journal-engine.service');
      const { NumberingService } = await import('../../../services/numbering/numbering.service');
      const journalEngine = new JournalEngineService(
        this.prisma,
        new NumberingService(this.prisma),
        periodManager,
      );

      // Calculate total amount for journal
      const totalAmount = gr.lines.reduce(
        (sum, line) => sum + Number(line.qty_received) * Number(line.unit_cost),
        0,
      );

      // Create journal event for GOODS_RECEIPT
      await journalEngine.processEvent(
        {
          event_type: 'GOODS_RECEIPT',
          reference_type: 'GR',
          reference_id: gr.id,
          reference_number: gr.gr_number,
          entry_date: gr.receipt_date,
          period_id: fiscalPeriod.id,
          amount: totalAmount,
          created_by: userId,
        },
        tx,
      );

      // 5. Update GR status to CONFIRMED
      const confirmedGr = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmed_by: userId,
          confirmed_at: new Date(),
        },
      });

      // 6. Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'APPROVE',
          entity_type: 'GoodsReceipt',
          entity_id: gr.id,
          before_snapshot: { status: 'DRAFT' },
          after_snapshot: { status: 'CONFIRMED', confirmed_by: userId },
        },
        tx,
      );

      return confirmedGr;
    });

    this.logger.log(
      `Confirmed Goods Receipt ${gr.gr_number} by user ${userId}. PO ${gr.purchase_order.po_number} status updated.`,
    );

    // Calculate total amount for response
    const totalAmount = gr.lines.reduce(
      (sum, line) => sum + Number(line.qty_received) * Number(line.unit_cost),
      0,
    );

    return mapGoodsReceipt({ ...result, total_amount: totalAmount });
  }

  /**
   * Handle over-receipt policy configuration.
   * This method allows changing the over-receipt policy for a specific GR.
   *
   * @param grId - Goods Receipt ID
   * @param policy - Over-receipt policy to apply
   */
  async handleOverReceipt(grId: UUID, policy: OverReceiptPolicy): Promise<void> {
    // TODO: Implement policy override mechanism if needed
    // For now, policy is applied at creation time
    this.logger.log(`Over-receipt policy ${policy} requested for GR ${grId}`);
  }

  /**
   * Update average cost for a product in a warehouse.
   * Calculates WAC using formula: WAC_baru = (nilai_stok_lama + nilai_masuk_baru) / (qty_stok_lama + qty_masuk_baru)
   *
   * @param productId - Product ID
   * @param warehouseId - Warehouse ID
   * @param newQty - New quantity received
   * @param newCost - New cost value (total, not unit cost)
   * @returns New average cost
   */
  async updateAverageCost(
    productId: UUID,
    warehouseId: UUID,
    newQty: number,
    newCost: number,
  ): Promise<number> {
    const balance = await this.getStockBalance(productId, warehouseId);

    const currentQty = balance.qty;
    const currentValue = balance.value;

    const newTotalQty = currentQty + newQty;
    const newTotalValue = currentValue + newCost;

    // BR-INV-003: Average cost must be >= 0
    const newAverageCost = newTotalQty > 0 ? newTotalValue / newTotalQty : 0;

    if (newAverageCost < 0) {
      throw new BusinessRuleException(
        `BR-INV-003: Average cost cannot be negative. Product: ${productId}, Warehouse: ${warehouseId}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    return newAverageCost;
  }

  /**
   * Get current stock balance for a product in a warehouse.
   * Calculates from inventory ledger: balance = SUM(qty_in) - SUM(qty_out)
   *
   * @param productId - Product ID
   * @param warehouseId - Warehouse ID
   * @param tx - Optional transaction client
   * @returns Stock balance with qty and value
   */
  private async getStockBalance(
    productId: UUID,
    warehouseId: UUID,
    tx?: any,
  ): Promise<{ qty: number; value: number }> {
    const client = tx ?? this.prisma;

    const ledgerEntries = await client.inventoryLedger.findMany({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 1,
    });

    if (ledgerEntries.length === 0) {
      return { qty: 0, value: 0 };
    }

    const lastEntry = ledgerEntries[0];
    return {
      qty: Number(lastEntry.running_qty),
      value: Number(lastEntry.running_cost),
    };
  }

  /**
   * Find a goods receipt by ID.
   *
   * @param id - Goods Receipt ID
   * @returns Goods receipt or null if not found
   */
  async findById(id: UUID): Promise<GoodsReceipt | null> {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        lines: true,
      },
    });

    if (!gr || gr.deleted_at !== null) {
      return null;
    }

    // Calculate total amount from lines
    const totalAmount = gr.lines.reduce(
      (sum, line) => sum + Number(line.total_cost),
      0,
    );

    return mapGoodsReceipt({ ...gr, total_amount: totalAmount });
  }

  /**
   * Get over-receipt tolerance configuration.
   *
   * @returns Current tolerance percentage (e.g., 0.05 for 5%)
   */
  getOverReceiptTolerance(): number {
    return OVER_RECEIPT_TOLERANCE;
  }

  /**
   * Get default over-receipt policy.
   *
   * @returns Current default policy
   */
  getDefaultOverReceiptPolicy(): OverReceiptPolicy {
    return DEFAULT_OVER_RECEIPT_POLICY;
  }

  /**
   * Search goods receipts with filters and pagination.
   *
   * @param filters - Search filters
   * @returns Paginated goods receipts
   */
  async search(filters: any): Promise<any> {
    const page = filters.page || 1;
    const perPage = filters.per_page || 20;
    const skip = (page - 1) * perPage;

    const where: any = {
      deleted_at: null,
      ...(filters.gr_number && { gr_number: { contains: filters.gr_number } }),
      ...(filters.po_id && { po_id: filters.po_id }),
      ...(filters.supplier_id && { supplier_id: filters.supplier_id }),
      ...(filters.warehouse_id && { warehouse_id: filters.warehouse_id }),
      ...(filters.status && { status: filters.status }),
    };

    if (filters.date_from || filters.date_to) {
      where.receipt_date = {};
      if (filters.date_from) {
        where.receipt_date.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        where.receipt_date.lte = new Date(filters.date_to);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        include: {
          lines: true,
          purchase_order: {
            select: {
              po_number: true,
            },
          },
          supplier: {
            select: {
              name: true,
            },
          },
          warehouse: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    const totalPages = Math.ceil(total / perPage);

    return {
      data: items.map((gr) => {
        const totalAmount = gr.lines.reduce(
          (sum, line) => sum + Number(line.total_cost),
          0,
        );
        return mapGoodsReceipt({ ...gr, total_amount: totalAmount });
      }),
      meta: {
        page,
        per_page: perPage,
        total,
        total_pages: totalPages,
      },
    };
  }

  /**
   * Find goods receipts by Purchase Order ID.
   *
   * @param poId - Purchase Order ID
   * @returns Array of goods receipts for the PO
   */
  async findByPurchaseOrder(poId: UUID): Promise<GoodsReceipt[]> {
    const receipts = await this.prisma.goodsReceipt.findMany({
      where: {
        po_id: poId,
        deleted_at: null,
      },
      include: {
        lines: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return receipts.map((gr) => {
      const totalAmount = gr.lines.reduce(
        (sum, line) => sum + Number(line.total_cost),
        0,
      );
      return mapGoodsReceipt({ ...gr, total_amount: totalAmount });
    });
  }

  /**
   * Cancel a Goods Receipt (only in DRAFT status).
   *
   * @param id - Goods Receipt ID
   * @param userId - User cancelling the GR
   * @param reason - Cancellation reason
   * @returns Updated goods receipt
   */
  async cancel(id: UUID, userId: UUID, reason: string): Promise<GoodsReceipt> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Goods Receipt ${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot cancel Goods Receipt in ${existing.status} status. Only DRAFT GRs can be cancelled.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const gr = await tx.goodsReceipt.update({
        where: { id },
        data: {
          notes: `${existing.notes || ''}\nCancellation: ${reason}`,
          deleted_at: new Date(),
        },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'DELETE',
          entity_type: 'GoodsReceipt',
          entity_id: id,
          before_snapshot: { status: 'DRAFT' },
          after_snapshot: { status: 'CANCELLED', cancelled_by: userId, reason },
        },
        tx,
      );

      return gr;
    });

    this.logger.log(`Cancelled Goods Receipt ${existing.gr_number} by user ${userId}: ${reason}`);

    return mapGoodsReceipt({ ...result, total_amount: existing.total_amount });
  }
}
