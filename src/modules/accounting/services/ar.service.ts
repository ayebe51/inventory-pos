import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class ARService {
  private readonly logger = new Logger(ARService.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Get outstanding Accounts Receivable invoices
   */
  async getAROutstanding(branchId?: UUID, asOfDate: Date = new Date()) {
    const invoices = await this.prismaRead.invoice.findMany({
      where: {
        invoice_type: 'SALES',
        status: { in: ['POSTED', 'PARTIAL', 'OVERDUE'] },
        invoice_date: { lte: asOfDate },
        ...(branchId ? { branch_id: branchId } : {}),
      },
      include: {
        customer: {
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
        customer_id: inv.customer_id,
        customer_name: inv.customer?.name || 'Unknown',
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
   * Write off bad debt AR invoice
   */
  async writeOffAR(invoiceId: UUID, reason: string, userId: UUID) {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) throw new BusinessRuleException('Invoice not found', ErrorCode.NOT_FOUND);
      if (invoice.invoice_type !== 'SALES') throw new BusinessRuleException('Invoice is not a sales invoice', ErrorCode.VALIDATION_ERROR);
      if (invoice.status !== 'POSTED' && invoice.status !== 'PARTIAL') {
        throw new BusinessRuleException('Only POSTED or PARTIAL invoices can be written off', ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const writeOffAmount = Number(invoice.outstanding_amount);
      if (writeOffAmount <= 0) {
        throw new BusinessRuleException('Invoice has no outstanding balance', ErrorCode.VALIDATION_ERROR);
      }

      // Post WRITE_OFF_AR event to GL
      await this.journalEngine.processEvent(
        {
          event_type: 'WRITE_OFF_AR',
          reference_type: 'SALES_INVOICE',
          reference_id: invoiceId,
          reference_number: invoice.invoice_number,
          entry_date: new Date(),
          period_id: period.id,
          amount: writeOffAmount,
          created_by: userId,
          metadata: { reason },
        },
        tx,
      );

      // Update Invoice status
      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          outstanding_amount: 0,
          status: 'PAID', // or CLOSED/WRITTEN_OFF
          notes: invoice.notes ? `${invoice.notes} | Written off: ${reason}` : `Written off: ${reason}`,
        },
      });

      return updated;
    });
  }
}
