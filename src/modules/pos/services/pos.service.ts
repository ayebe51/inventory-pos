import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  POSService as IPOSService,
  OpenShiftDTO,
  POSTransactionDTO,
  POSLineItemDTO,
  PaymentMethodDTO,
  Shift,
  POSTransaction,
  Receipt,
  ShiftReport,
} from '../interfaces/pos.interfaces';

@Injectable()
export class POSService implements IPOSService {
  private readonly logger = new Logger(POSService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  async openShift(data: OpenShiftDTO): Promise<Shift> {
    this.logger.log(`Opening shift for cashier ${data.cashier_id}`);
    
    return await this.prisma.$transaction(async (tx) => {
      const activeShift = await tx.shift.findFirst({
        where: { cashier_id: data.cashier_id, status: 'OPEN' },
      });

      if (activeShift) {
        throw new BusinessRuleException('Cashier already has an open shift', ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      const shiftNumber = await this.numberingService.generate(DocumentType.SHF);
      
      const shift = await tx.shift.create({
        data: {
          shift_number: shiftNumber,
          cashier_id: data.cashier_id,
          branch_id: data.branch_id,
          warehouse_id: data.warehouse_id,
          opening_balance: data.opening_balance,
          status: 'OPEN',
          opened_at: new Date(),
        }
      });
      return shift as any;
    });
  }

  async createTransaction(shiftId: UUID, data: POSTransactionDTO): Promise<POSTransaction> {
    return await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.status !== 'OPEN') {
        throw new BusinessRuleException('Valid open shift required', ErrorCode.VALIDATION_ERROR);
      }

      const txNumber = await this.numberingService.generate(DocumentType.POS);
      const transaction = await tx.posTransaction.create({
        data: {
          transaction_number: txNumber,
          shift_id: shiftId,
          cashier_id: shift.cashier_id,
          customer_id: data.customer_id,
          transaction_date: new Date(),
          status: 'OPEN',
          version: 1,
        }
      });
      return transaction as any;
    });
  }

  async addItem(transactionId: UUID, item: POSLineItemDTO): Promise<POSTransaction> {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const transaction = await tx.posTransaction.findUnique({ 
            where: { id: transactionId },
            include: { shift: true }
          });

          if (!transaction) throw new BusinessRuleException('Transaction not found', ErrorCode.NOT_FOUND);
          if (transaction.status !== 'OPEN') throw new BusinessRuleException('Transaction is not OPEN', ErrorCode.BUSINESS_RULE_VIOLATION);
          
          if (transaction.version !== item.version) {
            throw new BusinessRuleException('Optimistic lock failed: version mismatch', ErrorCode.CONCURRENCY_ERROR);
          }

          // Pessimistic lock for inventory ledger
          await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, item.product_id);
          
          const aggSource = await tx.inventoryLedger.aggregate({
            where: { product_id: item.product_id, warehouse_id: transaction.shift.warehouse_id },
            _sum: { qty_in: true, qty_out: true },
          });
          const srcQty = (Number(aggSource._sum.qty_in) || 0) - (Number(aggSource._sum.qty_out) || 0);

          if (srcQty < item.qty) {
            throw new BusinessRuleException(`Insufficient stock for product ${item.product_id}`, ErrorCode.INSUFFICIENT_STOCK);
          }

          const latestSrc = await tx.inventoryLedger.findFirst({
            where: { product_id: item.product_id, warehouse_id: transaction.shift.warehouse_id },
            orderBy: { created_at: 'desc' },
          });
          const srcRunningCost = Number(latestSrc?.running_cost) || 0;
          const srcRunningQty = Number(latestSrc?.running_qty) || 0;
          const unitCost = srcRunningQty > 0 ? srcRunningCost / srcRunningQty : 0;
          
          const newQty = srcQty - item.qty;
          const newCost = srcRunningCost - (item.qty * unitCost);

          const discountAmt = (item.discount_pct || 0) / 100 * (item.qty * item.unit_price);
          const lineTotal = (item.qty * item.unit_price) - discountAmt;

          await tx.posTransactionLine.create({
            data: {
              transaction_id: transactionId,
              product_id: item.product_id,
              qty: item.qty,
              uom_id: item.uom_id,
              unit_price: item.unit_price,
              discount_pct: item.discount_pct || 0,
              discount_amount: discountAmt,
              line_total: lineTotal,
            }
          });

          const updatedTx = await tx.posTransaction.update({
            where: { id: transactionId },
            data: {
              subtotal: { increment: lineTotal },
              total_amount: { increment: lineTotal },
              version: { increment: 1 },
            },
            include: { lines: true }
          });

          await tx.inventoryLedger.create({
            data: {
              product_id: item.product_id,
              warehouse_id: transaction.shift.warehouse_id,
              transaction_type: 'SALES',
              reference_type: 'POS',
              reference_id: transaction.id,
              reference_number: transaction.transaction_number,
              movement_date: new Date(),
              qty_in: 0,
              qty_out: item.qty,
              unit_cost: unitCost,
              total_cost: item.qty * unitCost,
              running_qty: newQty,
              running_cost: Math.max(0, newCost),
              created_by: transaction.cashier_id,
            }
          });

          return updatedTx as any;
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

  async holdTransaction(transactionId: UUID, version: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.posTransaction.findUnique({ where: { id: transactionId } });
      if (!transaction || transaction.status !== 'OPEN') throw new BusinessRuleException('Cannot hold non-open transaction', ErrorCode.BUSINESS_RULE_VIOLATION);
      if (transaction.version !== version) throw new BusinessRuleException('Version mismatch', ErrorCode.CONCURRENCY_ERROR);

      await tx.posTransaction.update({
        where: { id: transactionId },
        data: { status: 'HELD', version: { increment: 1 } }
      });
    });
  }

  async resumeTransaction(transactionId: UUID, version: number): Promise<POSTransaction> {
    return await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.posTransaction.findUnique({ where: { id: transactionId } });
      if (!transaction || transaction.status !== 'HELD') throw new BusinessRuleException('Cannot resume non-held transaction', ErrorCode.BUSINESS_RULE_VIOLATION);
      if (transaction.version !== version) throw new BusinessRuleException('Version mismatch', ErrorCode.CONCURRENCY_ERROR);

      const updated = await tx.posTransaction.update({
        where: { id: transactionId },
        data: { status: 'OPEN', version: { increment: 1 } }
      });
      return updated as any;
    });
  }

  async applyPayment(transactionId: UUID, payments: PaymentMethodDTO[]): Promise<Receipt> {
    return await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.posTransaction.findUnique({ 
        where: { id: transactionId },
      });

      if (!transaction) throw new BusinessRuleException('Transaction not found', ErrorCode.NOT_FOUND);
      if (transaction.status !== 'OPEN') throw new BusinessRuleException('Transaction is not OPEN', ErrorCode.BUSINESS_RULE_VIOLATION);
      
      const expectedVersion = payments[0]?.version || transaction.version;
      if (transaction.version !== expectedVersion) {
        throw new BusinessRuleException('Version mismatch', ErrorCode.CONCURRENCY_ERROR);
      }

      let totalPaid = 0;
      for (const p of payments) {
        totalPaid += p.amount;
        
        const pm = await tx.paymentMethod.findFirst({ where: { type: p.method }});
        if (!pm) throw new BusinessRuleException(`Invalid payment method ${p.method}`, ErrorCode.VALIDATION_ERROR);

        await tx.posPayment.create({
          data: {
            transaction_id: transactionId,
            payment_method_id: pm.id,
            amount: p.amount,
            reference_number: p.reference,
          }
        });
      }

      if (totalPaid < Number(transaction.total_amount)) {
        throw new BusinessRuleException('Insufficient payment', ErrorCode.VALIDATION_ERROR);
      }

      const change = totalPaid - Number(transaction.total_amount);

      const updatedTx = await tx.posTransaction.update({
        where: { id: transactionId },
        data: {
          paid_amount: totalPaid,
          change_amount: change,
          status: 'COMPLETED',
          version: { increment: 1 }
        }
      });

      return {
        transaction_id: updatedTx.id,
        transaction_number: updatedTx.transaction_number,
        total_amount: Number(updatedTx.total_amount),
        paid_amount: Number(updatedTx.paid_amount),
        change_amount: Number(updatedTx.change_amount),
        issued_at: new Date(),
      };
    });
  }

  async voidTransaction(transactionId: UUID, supervisorId: UUID, reason: string, version: number): Promise<void> {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const transaction = await tx.posTransaction.findUnique({ 
            where: { id: transactionId },
            include: { lines: true, shift: true }
          });
          if (!transaction) throw new BusinessRuleException('Transaction not found', ErrorCode.NOT_FOUND);
          
          if (transaction.status === 'VOIDED') throw new BusinessRuleException('Already voided', ErrorCode.BUSINESS_RULE_VIOLATION);
          if (transaction.version !== version) throw new BusinessRuleException('Version mismatch', ErrorCode.CONCURRENCY_ERROR);

          const productIds = Array.from(new Set(transaction.lines.map(l => l.product_id)));
          productIds.sort();
          for (const productId of productIds) {
            await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, productId);
          }

          await tx.posTransaction.update({
            where: { id: transactionId },
            data: {
              status: 'VOIDED',
              void_reason: reason,
              voided_by: supervisorId,
              voided_at: new Date(),
              version: { increment: 1 }
            }
          });

          for (const line of transaction.lines) {
            const latest = await tx.inventoryLedger.findFirst({
              where: { product_id: line.product_id, warehouse_id: transaction.shift.warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const runningCost = Number(latest?.running_cost) || 0;
            const runningQty = Number(latest?.running_qty) || 0;
            const unitCost = runningQty > 0 ? runningCost / runningQty : 0;
            
            const newQty = runningQty + Number(line.qty);
            const newCost = runningCost + (Number(line.qty) * unitCost);

            await tx.inventoryLedger.create({
              data: {
                product_id: line.product_id,
                warehouse_id: transaction.shift.warehouse_id,
                transaction_type: 'VOID',
                reference_type: 'POS',
                reference_id: transaction.id,
                reference_number: transaction.transaction_number,
                movement_date: new Date(),
                qty_in: line.qty,
                qty_out: 0,
                unit_cost: unitCost,
                total_cost: Number(line.qty) * unitCost,
                running_qty: newQty,
                running_cost: Math.max(0, newCost),
                created_by: supervisorId,
              }
            });
          }
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

  async closeShift(shiftId: UUID, closingBalance: number): Promise<ShiftReport> {
    return await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId }});
      if (!shift || shift.status !== 'OPEN') throw new BusinessRuleException('Valid open shift required', ErrorCode.VALIDATION_ERROR);

      const txs = await tx.posTransaction.findMany({
        where: { shift_id: shiftId, status: 'COMPLETED' },
        include: { payments: { include: { payment_method: true } } }
      });

      let cashSales = 0;
      let cardSales = 0;
      let transferSales = 0;
      let totalSales = 0;

      for (const t of txs) {
        totalSales += Number(t.total_amount);
        for (const p of t.payments) {
          if (p.payment_method.type === 'CASH') cashSales += Number(p.amount);
          else if (p.payment_method.type === 'CARD') cardSales += Number(p.amount);
          else if (p.payment_method.type === 'TRANSFER') transferSales += Number(p.amount);
        }
        cashSales -= Number(t.change_amount);
      }
      
      const expectedBalance = Number(shift.opening_balance) + cashSales;
      const difference = closingBalance - expectedBalance;

      const updatedShift = await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          closed_at: new Date(),
          closing_balance: closingBalance,
          expected_balance: expectedBalance,
          difference: difference,
        }
      });

      return {
        shift_id: updatedShift.id,
        cashier_id: updatedShift.cashier_id,
        opening_balance: Number(updatedShift.opening_balance),
        closing_balance: closingBalance,
        total_transactions: txs.length,
        total_sales: totalSales,
        cash_sales: cashSales,
        card_sales: cardSales,
        transfer_sales: transferSales,
        cash_difference: difference,
        opened_at: updatedShift.opened_at,
        closed_at: updatedShift.closed_at!,
      };
    });
  }
}
