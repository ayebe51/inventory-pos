import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

export interface PurchaseReturnLineInput {
  product_id: UUID;
  uom_id: UUID;
  qty: number;
  unit_cost: number;
  po_line_id?: UUID;
}

export interface CreatePurchaseReturnDTO {
  supplier_id: UUID;
  branch_id: UUID;
  warehouse_id: UUID;
  po_id?: UUID;
  gr_id?: UUID;
  return_date?: Date;
  reason: string;
  lines: PurchaseReturnLineInput[];
}

@Injectable()
export class PurchaseReturnService {
  private readonly logger = new Logger(PurchaseReturnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly journalEngine: JournalEngineService,
    private readonly periodManager: PeriodManagerService,
  ) {}

  /**
   * Create and execute a Purchase Return (Return to Vendor)
   * Decrements stock in inventory_ledger and posts reversal journal entry.
   */
  async createReturn(data: CreatePurchaseReturnDTO, userId: UUID) {
    if (!data.lines || data.lines.length === 0) {
      throw new BusinessRuleException('Purchase return must contain at least one line', ErrorCode.VALIDATION_ERROR);
    }

    // Validate supplier
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplier_id },
    });
    if (!supplier || supplier.deleted_at !== null || !supplier.is_active) {
      throw new BusinessRuleException(`Supplier ${data.supplier_id} not found or inactive`, ErrorCode.VALIDATION_ERROR);
    }

    // Validate warehouse
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: data.warehouse_id },
    });
    if (!warehouse || warehouse.deleted_at !== null || !warehouse.is_active) {
      throw new BusinessRuleException(`Warehouse ${data.warehouse_id} not found or inactive`, ErrorCode.VALIDATION_ERROR);
    }
    if (warehouse.is_locked) {
      throw new BusinessRuleException(`Warehouse ${warehouse.name} is locked`, ErrorCode.BUSINESS_RULE_VIOLATION);
    }

    // If GR reference is provided, validate return quantities against received quantities
    if (data.gr_id) {
      const gr = await this.prisma.goodsReceipt.findUnique({
        where: { id: data.gr_id },
        include: { lines: true },
      });
      if (!gr || gr.deleted_at !== null) {
        throw new BusinessRuleException(`Goods Receipt ${data.gr_id} not found`, ErrorCode.NOT_FOUND);
      }
      if (gr.status !== 'CONFIRMED') {
        throw new BusinessRuleException(`Cannot return against unconfirmed Goods Receipt ${gr.gr_number}`, ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      // Check existing returns against this GR
      const existingReturns = await this.prisma.purchaseReturn.findMany({
        where: { gr_id: data.gr_id, status: 'CONFIRMED' },
        include: { lines: true },
      });

      const alreadyReturnedByProduct = new Map<string, number>();
      for (const ret of existingReturns) {
        for (const line of ret.lines) {
          const curr = alreadyReturnedByProduct.get(line.product_id) || 0;
          alreadyReturnedByProduct.set(line.product_id, curr + Number(line.qty));
        }
      }

      for (const line of data.lines) {
        const grLine = gr.lines.find((l) => l.product_id === line.product_id);
        if (!grLine) {
          throw new BusinessRuleException(
            `Product ${line.product_id} was not part of Goods Receipt ${gr.gr_number}`,
            ErrorCode.VALIDATION_ERROR,
          );
        }
        const previouslyReturned = alreadyReturnedByProduct.get(line.product_id) || 0;
        const availableToReturn = Number(grLine.qty_received) - previouslyReturned;
        if (line.qty > availableToReturn) {
          throw new BusinessRuleException(
            `Return quantity (${line.qty}) exceeds returnable quantity (${availableToReturn}) for product ${line.product_id}`,
            ErrorCode.BUSINESS_RULE_VIOLATION,
          );
        }
      }
    }

    // Validate products and UOMs
    const returnDate = data.return_date ? new Date(data.return_date) : new Date();
    const period = await this.periodManager.getPeriodForDate(returnDate);
    await this.periodManager.validatePeriodOpen(period.id);

    const returnNumber = await this.numbering.generate(DocumentType.PRET, returnDate);

    const totalAmount = data.lines.reduce((sum, l) => sum + l.qty * l.unit_cost, 0);

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create Purchase Return Header
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          return_number: returnNumber,
          supplier_id: data.supplier_id,
          branch_id: data.branch_id,
          warehouse_id: data.warehouse_id,
          po_id: data.po_id || null,
          gr_id: data.gr_id || null,
          return_date: returnDate,
          reason: data.reason,
          total_amount: totalAmount,
          status: 'CONFIRMED',
          created_by: userId,
        },
      });

      // 2. Create Lines and Record Inventory Ledger Movements
      for (const line of data.lines) {
        await tx.purchaseReturnLine.create({
          data: {
            return_id: purchaseReturn.id,
            product_id: line.product_id,
            qty: line.qty,
            uom_id: line.uom_id,
            unit_cost: line.unit_cost,
            line_total: line.qty * line.unit_cost,
          },
        });

        // Get current stock balance for WAC calculation
        const lastLedger = await tx.inventoryLedger.findFirst({
          where: {
            product_id: line.product_id,
            warehouse_id: data.warehouse_id,
          },
          orderBy: { created_at: 'desc' },
        });

        const currentQty = lastLedger ? Number(lastLedger.running_qty) : 0;
        const currentCost = lastLedger ? Number(lastLedger.running_cost) : 0;

        if (currentQty < line.qty) {
          throw new BusinessRuleException(
            `Insufficient stock in warehouse to perform return: current stock is ${currentQty}, requested return is ${line.qty}`,
            ErrorCode.INSUFFICIENT_STOCK,
          );
        }

        const newQty = currentQty - line.qty;
        const newCost = Math.max(0, currentCost - (line.qty * line.unit_cost));

        await tx.inventoryLedger.create({
          data: {
            product_id: line.product_id,
            warehouse_id: data.warehouse_id,
            movement_date: returnDate,
            transaction_type: 'PURCHASE_RETURN',
            reference_type: 'PURCHASE_RETURN',
            reference_id: purchaseReturn.id,
            reference_number: purchaseReturn.return_number,
            qty_in: 0,
            qty_out: line.qty,
            unit_cost: line.unit_cost,
            total_cost: line.qty * line.unit_cost,
            running_qty: newQty,
            running_cost: newCost,
            created_by: userId,
          },
        });
      }

      // 3. Post Accounting Journal Event
      // Debit: GR Clearing (1.104.001) or AP, Credit: Persediaan Barang (1.103.001)
      await this.journalEngine.processEvent(
        {
          event_type: 'STOCK_ADJUSTMENT_NEGATIVE',
          reference_type: 'PURCHASE_RETURN',
          reference_id: purchaseReturn.id,
          reference_number: purchaseReturn.return_number,
          entry_date: returnDate,
          period_id: period.id,
          amount: totalAmount,
          created_by: userId,
          metadata: {
            description: `Purchase Return ${purchaseReturn.return_number} to Supplier ${data.supplier_id}`,
          },
        },
        tx,
      );

      // 4. Audit Log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'PurchaseReturn',
          entity_id: purchaseReturn.id,
          after_snapshot: purchaseReturn,
        },
        tx,
      );

      return purchaseReturn;
    });
  }

  /**
   * List purchase returns with pagination
   */
  async listReturns(params?: {
    supplier_id?: UUID;
    warehouse_id?: UUID;
    page?: number;
    per_page?: number;
  }) {
    const page = params?.page || 1;
    const perPage = params?.per_page || 20;
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (params?.supplier_id) where.supplier_id = params.supplier_id;
    if (params?.warehouse_id) where.warehouse_id = params.warehouse_id;

    const [data, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { return_date: 'desc' },
        include: {
          supplier: true,
          warehouse: true,
          branch: true,
          lines: {
            include: {
              product: true,
              uom: true,
            },
          },
        },
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get purchase return by ID
   */
  async getReturnById(id: UUID) {
    const ret = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        branch: true,
        lines: {
          include: {
            product: true,
            uom: true,
          },
        },
      },
    });

    if (!ret) {
      throw new NotFoundException(`Purchase return ${id} not found`);
    }

    return ret;
  }
}
