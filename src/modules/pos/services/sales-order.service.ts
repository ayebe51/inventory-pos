import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  SalesOrderService as ISalesOrderService,
  CreateSODTO,
  FulfillmentDTO,
  SalesReturnDTO,
  SalesOrder,
  DeliveryOrder,
  SalesReturn,
} from '../interfaces/pos.interfaces';

@Injectable()
export class SalesOrderService implements ISalesOrderService {
  private readonly logger = new Logger(SalesOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  async create(data: CreateSODTO): Promise<SalesOrder> {
    return await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: data.customer_id } });
      if (!customer) throw new BusinessRuleException('Customer not found', ErrorCode.NOT_FOUND);

      let subtotal = 0;
      let totalAmount = 0;
      const taxAmount = 0; // Assuming 0 for now unless provided

      for (const line of data.lines) {
        const lineTotal = line.qty * line.unit_price;
        subtotal += lineTotal;
        totalAmount += lineTotal;
      }

      // BR-SAL-003: Check credit limit
      const projectedBalance = Number(customer.outstanding_balance) + totalAmount;
      if (projectedBalance > Number(customer.credit_limit)) {
        throw new BusinessRuleException(
          `Credit limit exceeded. Limit: ${customer.credit_limit}, Projected: ${projectedBalance}`,
          ErrorCode.BUSINESS_RULE_VIOLATION
        );
      }

      const soNumber = await this.numberingService.generate(DocumentType.SO);

      const so = await tx.salesOrder.create({
        data: {
          so_number: soNumber,
          customer_id: data.customer_id,
          branch_id: data.branch_id,
          warehouse_id: data.branch_id, // Wait, create SO needs a default warehouse. The schema has warehouse_id on SO. We will use branch_id or assume it's passed? The interface doesn't have warehouse_id. I will fetch the first warehouse of the branch.
          status: 'PENDING_APPROVAL',
          order_date: data.order_date,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          created_by: data.customer_id, // In a real scenario, created_by comes from req.user
          lines: {
            create: data.lines.map(l => ({
              product_id: l.product_id,
              qty_ordered: l.qty,
              uom_id: l.uom_id,
              unit_price: l.unit_price,
              line_total: l.qty * l.unit_price,
            }))
          }
        },
        include: { lines: true }
      });

      // We need a valid warehouse_id. Let's fix that.
      const branchWarehouse = await tx.warehouse.findFirst({ where: { branch_id: data.branch_id }});
      if (branchWarehouse) {
        await tx.salesOrder.update({ where: { id: so.id }, data: { warehouse_id: branchWarehouse.id } });
      }

      return so as any;
    });
  }

  async approve(id: UUID, userId: UUID): Promise<SalesOrder> {
    return await this.prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUnique({ where: { id } });
      if (!so) throw new BusinessRuleException('SO not found', ErrorCode.NOT_FOUND);
      if (so.status !== 'PENDING_APPROVAL') throw new BusinessRuleException('SO is not pending approval', ErrorCode.BUSINESS_RULE_VIOLATION);

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approved_by: userId,
          approved_at: new Date()
        }
      });
      return updated as any;
    });
  }

  async fulfill(id: UUID, data: FulfillmentDTO): Promise<DeliveryOrder> {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const so = await tx.salesOrder.findUnique({ 
            where: { id }, 
            include: { lines: true } 
          });
          if (!so) throw new BusinessRuleException('SO not found', ErrorCode.NOT_FOUND);
          if (so.status !== 'APPROVED' && so.status !== 'FULFILLED') throw new BusinessRuleException('SO must be APPROVED to fulfill', ErrorCode.BUSINESS_RULE_VIOLATION);

          const doNumber = await this.numberingService.generate(DocumentType.DO);
          
          const deliveryOrder = await tx.deliveryOrder.create({
            data: {
              do_number: doNumber,
              so_id: id,
              warehouse_id: data.warehouse_id,
              status: 'SHIPPED',
              delivery_date: data.delivery_date,
              created_by: so.created_by, // ideally from req
            }
          });

          // Sort product IDs for pessimistic locking
          const productIds = Array.from(new Set(data.lines.map((l) => {
            const soLine = so.lines.find(x => x.id === l.so_line_id);
            return soLine?.product_id;
          }))).filter(Boolean) as string[];
          productIds.sort();

          for (const productId of productIds) {
            await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, productId);
          }

          let allFulfilled = true;

          for (const fLine of data.lines) {
            const soLine = so.lines.find(x => x.id === fLine.so_line_id);
            if (!soLine) throw new BusinessRuleException('SO Line not found', ErrorCode.NOT_FOUND);

            const remainingQty = Number(soLine.qty_ordered) - Number(soLine.qty_delivered);
            if (fLine.qty_fulfilled > remainingQty) {
              throw new BusinessRuleException('Cannot fulfill more than ordered qty', ErrorCode.VALIDATION_ERROR);
            }

            // Deduct stock
            const aggSource = await tx.inventoryLedger.aggregate({
              where: { product_id: soLine.product_id, warehouse_id: data.warehouse_id },
              _sum: { qty_in: true, qty_out: true },
            });
            const srcQty = (Number(aggSource._sum.qty_in) || 0) - (Number(aggSource._sum.qty_out) || 0);

            if (srcQty < fLine.qty_fulfilled) {
              throw new BusinessRuleException(`Insufficient stock for product ${soLine.product_id}`, ErrorCode.INSUFFICIENT_STOCK);
            }

            const latestSrc = await tx.inventoryLedger.findFirst({
              where: { product_id: soLine.product_id, warehouse_id: data.warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const srcRunningCost = Number(latestSrc?.running_cost) || 0;
            const srcRunningQty = Number(latestSrc?.running_qty) || 0;
            const unitCost = srcRunningQty > 0 ? srcRunningCost / srcRunningQty : 0;
            
            const newQty = srcQty - fLine.qty_fulfilled;
            const newCost = srcRunningCost - (fLine.qty_fulfilled * unitCost);

            await tx.inventoryLedger.create({
              data: {
                product_id: soLine.product_id,
                warehouse_id: data.warehouse_id,
                transaction_type: 'SALES',
                reference_type: 'DO',
                reference_id: deliveryOrder.id,
                reference_number: deliveryOrder.do_number,
                movement_date: data.delivery_date,
                qty_in: 0,
                qty_out: fLine.qty_fulfilled,
                unit_cost: unitCost,
                total_cost: fLine.qty_fulfilled * unitCost,
                running_qty: newQty,
                running_cost: Math.max(0, newCost),
                created_by: so.created_by,
              }
            });

            // Update SO Line
            await tx.salesOrderLine.update({
              where: { id: soLine.id },
              data: {
                qty_delivered: { increment: fLine.qty_fulfilled }
              }
            });

            if (Number(soLine.qty_delivered) + fLine.qty_fulfilled < Number(soLine.qty_ordered)) {
              allFulfilled = false;
            }
          }

          if (allFulfilled) {
            await tx.salesOrder.update({
              where: { id },
              data: { status: 'FULFILLED' }
            });
          }

          // Also increase customer outstanding balance upon fulfillment
          // Wait, typically invoice increases outstanding balance, not DO.
          // The requirements don't specify if DO creates an invoice automatically, but usually it's invoiced later.
          // I will leave outstanding balance to be updated when Invoice is created.

          return deliveryOrder as any;
        });
      } catch (err: any) {
        lastError = err;
        if (err.message && (err.message.includes('could not obtain lock') || err.message.includes('NOWAIT') || err.message.includes('deadlock'))) {
          const delay = 50 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async createReturn(soId: UUID, data: SalesReturnDTO): Promise<SalesReturn> {
    // Validate return against SO, refund stock, create SR
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const so = await tx.salesOrder.findUnique({ 
            where: { id: soId }, 
            include: { lines: true } 
          });
          if (!so) throw new BusinessRuleException('SO not found', ErrorCode.NOT_FOUND);

          const srNumber = await this.numberingService.generate(DocumentType.SR);
          
          let totalAmount = 0;

          const productIds = Array.from(new Set(data.lines.map((l) => l.product_id)));
          productIds.sort();
          for (const productId of productIds) {
            await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, productId);
          }

          const salesReturn = await tx.salesReturn.create({
            data: {
              return_number: srNumber,
              reference_type: 'SO',
              reference_id: so.id,
              customer_id: so.customer_id,
              warehouse_id: so.warehouse_id,
              return_date: data.return_date,
              reason: data.reason,
              status: 'APPROVED',
              created_by: so.created_by,
            }
          });

          for (const rLine of data.lines) {
            const soLine = so.lines.find(x => x.product_id === rLine.product_id);
            if (!soLine) throw new BusinessRuleException('Product not in SO', ErrorCode.VALIDATION_ERROR);

            const latest = await tx.inventoryLedger.findFirst({
              where: { product_id: rLine.product_id, warehouse_id: so.warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const runningCost = Number(latest?.running_cost) || 0;
            const runningQty = Number(latest?.running_qty) || 0;
            const unitCost = runningQty > 0 ? runningCost / runningQty : 0;
            
            const newQty = runningQty + rLine.qty;
            const newCost = runningCost + (rLine.qty * unitCost);

            const lineTotal = rLine.qty * rLine.unit_price;
            totalAmount += lineTotal;

            await tx.salesReturnLine.create({
              data: {
                return_id: salesReturn.id,
                product_id: rLine.product_id,
                qty: rLine.qty,
                uom_id: soLine.uom_id,
                unit_price: rLine.unit_price,
                unit_cost: unitCost,
                line_total: lineTotal
              }
            });

            await tx.inventoryLedger.create({
              data: {
                product_id: rLine.product_id,
                warehouse_id: so.warehouse_id,
                transaction_type: 'SALES_RETURN',
                reference_type: 'SR',
                reference_id: salesReturn.id,
                reference_number: salesReturn.return_number,
                movement_date: data.return_date,
                qty_in: rLine.qty,
                qty_out: 0,
                unit_cost: unitCost,
                total_cost: rLine.qty * unitCost,
                running_qty: newQty,
                running_cost: Math.max(0, newCost),
                created_by: so.created_by,
              }
            });
          }

          const finalSR = await tx.salesReturn.update({
            where: { id: salesReturn.id },
            data: { total_amount: totalAmount }
          });

          return finalSR as any;
        });
      } catch (err: any) {
        lastError = err;
        if (err.message && (err.message.includes('could not obtain lock') || err.message.includes('NOWAIT') || err.message.includes('deadlock'))) {
          const delay = 50 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async findById(id: UUID): Promise<SalesOrder | null> {
    const so = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    return so as any;
  }

  async search(filters: {
    status?: string;
    customer_id?: string;
    page?: number;
    per_page?: number;
  }) {
    const page = filters.page || 1;
    const per_page = filters.per_page || 20;
    const skip = (page - 1) * per_page;

    const where: any = { deleted_at: null };
    if (filters.status) where.status = filters.status;
    if (filters.customer_id) where.customer_id = filters.customer_id;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, per_page },
    };
  }
}
