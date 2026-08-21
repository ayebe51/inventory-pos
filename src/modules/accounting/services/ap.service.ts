import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class APService {
  private readonly logger = new Logger(APService.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Get outstanding Accounts Payable invoices
   */
  async getAPOutstanding(branchId?: UUID, asOfDate: Date = new Date()) {
    const invoices = await this.prismaRead.invoice.findMany({
      where: {
        invoice_type: 'PURCHASE',
        status: { in: ['POSTED', 'PARTIAL', 'OVERDUE'] },
        invoice_date: { lte: asOfDate },
        ...(branchId ? { branch_id: branchId } : {}),
      },
      include: {
        supplier: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: { due_date: 'asc' },
    });

    const now = new Date();
    return invoices.map((inv) => {
      const dueDate = new Date(inv.due_date);
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
      
      let agingBucket = 'CURRENT';
      if (daysOverdue > 90) agingBucket = 'OVER_90';
      else if (daysOverdue > 60) agingBucket = 'DAYS_61_90';
      else if (daysOverdue > 30) agingBucket = 'DAYS_31_60';
      else if (daysOverdue > 0) agingBucket = 'DAYS_1_30';

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        supplier_id: inv.supplier_id,
        supplier_name: inv.supplier?.name || 'Unknown',
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total_amount: Number(inv.total_amount),
        paid_amount: Number(inv.paid_amount),
        outstanding_amount: Number(inv.outstanding_amount),
        days_overdue: daysOverdue,
        aging_bucket: agingBucket,
        status: inv.status,
      };
    });
  }

  /**
   * Record payment to supplier
   */
  async recordSupplierPayment(
    invoiceId: UUID,
    amount: number,
    paymentMethodId: UUID,
    userId: UUID,
    referenceNumber?: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) throw new BusinessRuleException('Purchase Invoice not found', ErrorCode.NOT_FOUND);
      if (invoice.invoice_type !== 'PURCHASE') throw new BusinessRuleException('Invoice is not a purchase invoice', ErrorCode.VALIDATION_ERROR);
      
      const outstanding = Number(invoice.outstanding_amount);
      if (amount > outstanding) {
        throw new BusinessRuleException(`Payment amount (${amount}) exceeds outstanding amount (${outstanding})`, ErrorCode.VALIDATION_ERROR);
      }

      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      // Post PURCHASE_PAYMENT to GL
      await this.journalEngine.processEvent(
        {
          event_type: 'PURCHASE_PAYMENT',
          reference_type: 'PURCHASE_INVOICE',
          reference_id: invoiceId,
          reference_number: invoice.invoice_number,
          entry_date: new Date(),
          period_id: period.id,
          amount: amount,
          created_by: userId,
          metadata: { reference_number: referenceNumber },
        },
        tx,
      );

      const newPaid = Number(invoice.paid_amount) + amount;
      const newOutstanding = outstanding - amount;
      const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIAL';

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paid_amount: newPaid,
          outstanding_amount: newOutstanding,
          status: newStatus,
        },
      });

      return updated;
    });
  }
}
