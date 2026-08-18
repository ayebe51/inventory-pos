import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
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
  SalesReturnDTO,
  SalesReturn,
} from '../interfaces/pos.interfaces';

@Injectable()
export class POSService implements IPOSService {
  private readonly logger = new Logger(POSService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly journalEngine: JournalEngineService,
    private readonly periodManager: PeriodManagerService,
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

      if (data.customer_id) {
        const customer = await tx.customer.findUnique({ where: { id: data.customer_id } });
        if (!customer) {
          throw new BusinessRuleException('Customer not found', ErrorCode.NOT_FOUND);
        }
        // GAP-26: Credit limit check
        const limit = Number(customer.credit_limit);
        const outstanding = Number(customer.outstanding_balance);
        if (limit > 0 && outstanding >= limit) {
          throw new BusinessRuleException(
            `Customer credit limit exceeded. Limit: ${limit}, Outstanding: ${outstanding}`,
            ErrorCode.BUSINESS_RULE_VIOLATION
          );
        }
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

      // Post Auto-Journal Entries for POS Sale and POS Sale COGS
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (period) {
        // 1. POS_SALE (Debit Cash/Bank, Credit Revenue & Tax)
        await this.journalEngine.processEvent(
          {
            event_type: 'POS_SALE',
            reference_type: 'POS_TRANSACTION',
            reference_id: transactionId,
            reference_number: updatedTx.transaction_number,
            entry_date: new Date(),
            period_id: period.id,
            amount: Number(updatedTx.total_amount),
            created_by: transaction.cashier_id,
          },
          tx,
        );

        // 2. POS_SALE_COGS (Debit COGS Expense, Credit Inventory Asset)
        const ledgerEntries = await tx.inventoryLedger.findMany({
          where: { reference_type: 'POS_TRANSACTION', reference_id: transactionId },
        });
        const totalCogs = ledgerEntries.reduce((sum, entry) => sum + Number(entry.total_cost), 0);

        if (totalCogs > 0) {
          await this.journalEngine.processEvent(
            {
              event_type: 'POS_SALE_COGS',
              reference_type: 'POS_TRANSACTION',
              reference_id: transactionId,
              reference_number: updatedTx.transaction_number,
              entry_date: new Date(),
              period_id: period.id,
              amount: totalCogs,
              created_by: transaction.cashier_id,
            },
            tx,
          );
        }
      }

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

  async forceCloseShift(shiftId: UUID, supervisorId: UUID, closingBalance: number, reason: string): Promise<ShiftReport> {
    this.logger.warn(`Force closing shift ${shiftId} by supervisor ${supervisorId}. Reason: ${reason}`);

    return await this.prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({ where: { id: shiftId } });
      if (!shift) throw new BusinessRuleException('Shift not found', ErrorCode.NOT_FOUND);
      if (shift.status === 'CLOSED') throw new BusinessRuleException('Shift already closed', ErrorCode.BUSINESS_RULE_VIOLATION);

      // Cancel all OPEN pos transactions in this shift
      await tx.posTransaction.updateMany({
        where: { shift_id: shiftId, status: 'OPEN' },
        data: { status: 'CANCELLED' } // Assume cancelled status
      });

      // Calculate totals for PAID transactions
      const txs = await tx.posTransaction.findMany({
        where: { shift_id: shiftId, status: 'PAID' },
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

      // We might log the force close reason in an Audit table, but returning it is enough here.

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

  async listShifts(query: { status?: string; branch_id?: string | null; page: number; per_page: number }): Promise<{ data: Shift[]; meta: { total: number; page: number; per_page: number } }> {
    const where: any = {};
    if (query.branch_id) where.branch_id = query.branch_id;
    if (query.status) where.status = query.status;

    const total = await this.prisma.shift.count({ where });
    const data = await this.prisma.shift.findMany({
      where,
      skip: (query.page - 1) * query.per_page,
      take: Number(query.per_page),
      orderBy: { created_at: 'desc' },
    });
    return { data: data as any, meta: { total, page: query.page, per_page: query.per_page } };
  }

  async getShift(id: UUID, user?: { branch_id?: string | null }): Promise<Shift> {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new BusinessRuleException('Shift not found', ErrorCode.NOT_FOUND);
    if (user && user.branch_id && shift.branch_id !== user.branch_id) {
      throw new ForbiddenException('Access denied: Shift belongs to another branch');
    }
    return shift as any;
  }

  async listTransactions(query: { shift_id?: UUID; status?: string; branch_id?: string | null; page: number; per_page: number }): Promise<{ data: POSTransaction[]; meta: { total: number; page: number; per_page: number } }> {
    const where: any = {};
    if (query.shift_id) where.shift_id = query.shift_id;
    if (query.status) where.status = query.status;
    if (query.branch_id) where.shift = { branch_id: query.branch_id };

    const total = await this.prisma.posTransaction.count({ where });
    const data = await this.prisma.posTransaction.findMany({
      where,
      skip: (query.page - 1) * query.per_page,
      take: Number(query.per_page),
      orderBy: { created_at: 'desc' },
      include: { lines: true, payments: true }
    });
    return { data: data as any, meta: { total, page: query.page, per_page: query.per_page } };
  }

  async listSalesReturns(query: { branch_id?: string | null; page: number; per_page: number }): Promise<{ data: any[]; meta: { total: number; page: number; per_page: number } }> {
    const where: any = {};
    if (query.branch_id) where.branch_id = query.branch_id;

    const total = await this.prisma.salesReturn.count({ where });
    const data = await this.prisma.salesReturn.findMany({
      where,
      skip: (query.page - 1) * query.per_page,
      take: Number(query.per_page),
      orderBy: { created_at: 'desc' },
      include: { lines: true }
    });
    return { data: data as any, meta: { total, page: query.page, per_page: query.per_page } };
  }

  async processFullTransaction(data: { shift_id: UUID; cashier_id: UUID; customer_id?: UUID; items: any[]; payments: any[] }): Promise<Receipt> {
    const transaction = await this.createTransaction(data.shift_id, { customer_id: data.customer_id });
    
    // Using a for loop to process sequentially to avoid optimistic lock failures if processed concurrently
    for (const item of data.items) {
      let itemUomId = item.uom_id;
      if (!itemUomId || itemUomId === '00000000-0000-0000-0000-000000000000') {
        const prod = await this.prisma.product.findUnique({ where: { id: item.product_id } });
        if (!prod) throw new BusinessRuleException(`Product ${item.product_id} not found`, ErrorCode.NOT_FOUND);
        itemUomId = prod.uom_id;
      }

      const currentTx = await this.prisma.posTransaction.findUnique({ where: { id: transaction.id } });
      await this.addItem(transaction.id, {
        product_id: item.product_id,
        qty: item.quantity,
        unit_price: item.unit_price,
        discount_pct: item.discount_pct || 0,
        uom_id: itemUomId,
        version: currentTx!.version
      });
    }

    const currentTxForPayment = await this.prisma.posTransaction.findUnique({ where: { id: transaction.id } });
    const payments = data.payments.map(p => ({ ...p, version: currentTxForPayment!.version }));
    return await this.applyPayment(transaction.id, payments);
  }

  async createSalesReturn(userId: UUID, data: SalesReturnDTO): Promise<SalesReturn> {
    this.logger.log(`Creating Sales Return for reference ${data.reference_id}`);
    
    return await this.prisma.$transaction(async (tx) => {
      const returnNumber = await this.numberingService.generate(DocumentType.SR);
      
      let totalAmount = 0;
      data.lines.forEach(line => {
        totalAmount += line.qty * line.unit_price;
      });

      const salesReturn = await tx.salesReturn.create({
        data: {
          return_number: returnNumber,
          customer_id: data.customer_id,
          warehouse_id: data.warehouse_id,
          reference_type: data.reference_type,
          reference_id: data.reference_id,
          return_date: data.return_date,
          reason: data.reason,
          status: 'COMPLETED',
          total_amount: totalAmount,
          created_by: userId,
          lines: {
            create: data.lines.map(line => ({
              product_id: line.product_id,
              qty: line.qty,
              uom_id: line.uom_id,
              unit_price: line.unit_price,
              line_total: line.qty * line.unit_price,
            }))
          }
        },
        include: { lines: true }
      });

      // Adjust inventory ledger for each line (returning stock back to warehouse)
      for (const line of salesReturn.lines) {
        // Fetch current running qty and cost
        const lastLedger = await tx.inventoryLedger.findFirst({
          where: { product_id: line.product_id, warehouse_id: data.warehouse_id },
          orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }]
        });

        const prevQty = lastLedger ? Number(lastLedger.running_qty) : 0;
        const prevCost = lastLedger ? Number(lastLedger.running_cost) : 0;
        let unitCost = 0;
        if (lastLedger && prevQty > 0) {
          unitCost = prevCost / prevQty;
        } else {
          const product = await tx.product.findUnique({ where: { id: line.product_id } });
          unitCost = Number(product?.standard_cost) || 0;
        }
        
        const returnedQty = Number(line.qty);
        const addedCost = returnedQty * unitCost;

        await tx.inventoryLedger.create({
          data: {
            product_id: line.product_id,
            warehouse_id: data.warehouse_id,
            transaction_type: 'SALES_RETURN',
            reference_type: 'SALES_RETURN',
            reference_id: salesReturn.id,
            reference_number: salesReturn.return_number,
            movement_date: data.return_date,
            qty_in: returnedQty,
            qty_out: 0,
            unit_cost: unitCost,
            total_cost: addedCost,
            running_qty: prevQty + returnedQty,
            running_cost: prevCost + addedCost,
            notes: `Return ${salesReturn.return_number} reason: ${data.reason}`,
            created_by: userId
          }
        });
      }

      // Post Auto-Journal Entry for Sales Return
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (period && Number(salesReturn.total_amount) > 0) {
        await this.journalEngine.processEvent(
          {
            event_type: 'SALES_RETURN',
            reference_type: 'SALES_RETURN',
            reference_id: salesReturn.id,
            reference_number: salesReturn.return_number,
            entry_date: data.return_date,
            period_id: period.id,
            amount: Number(salesReturn.total_amount),
            created_by: userId,
          },
          tx,
        );
      }

      return salesReturn as any;
    });
  }
}
