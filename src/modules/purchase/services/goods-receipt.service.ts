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
   * This will be implemented in task 9.6.
   * - Updates PO line qty_received
   * - Updates PO status to PARTIALLY_RECEIVED or FULLY_RECEIVED
   * - Triggers WAC recalculation
   * - Triggers auto journal GR
   *
   * @param id - Goods Receipt ID
   * @param userId - User confirming the GR
   * @returns Confirmed goods receipt
   */
  async confirm(id: UUID, userId: UUID): Promise<GoodsReceipt> {
    // TODO: Implement in task 9.6
    throw new Error('Not implemented yet - will be implemented in task 9.6');
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
   * This will be implemented in task 9.6 as part of GR confirmation.
   *
   * @param productId - Product ID
   * @param warehouseId - Warehouse ID
   * @param newQty - New quantity received
   * @param newCost - New cost value
   */
  async updateAverageCost(
    productId: UUID,
    warehouseId: UUID,
    newQty: number,
    newCost: number,
  ): Promise<void> {
    // TODO: Implement in task 9.6
    throw new Error('Not implemented yet - will be implemented in task 9.6');
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
}
