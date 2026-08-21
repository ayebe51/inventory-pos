import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { Invoice } from '../interfaces/invoicing.interfaces';

@Injectable()
export class CreditNoteService {
  private readonly logger = new Logger(CreditNoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Create a Credit Note against an existing Sales Invoice
   */
  async createCreditNote(invoiceId: UUID, amount: number, reason: string, userId: UUID): Promise<Invoice> {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.invoice_type !== 'SALES') {
        throw new BusinessRuleException('Valid Sales Invoice required for Credit Note', ErrorCode.VALIDATION_ERROR);
      }

      if (amount <= 0 || amount > Number(invoice.total_amount)) {
        throw new BusinessRuleException('Invalid credit note amount', ErrorCode.VALIDATION_ERROR);
      }

      const cnNumber = await this.numbering.generate(DocumentType.CN);

      const creditNote = await tx.invoice.create({
        data: {
          invoice_number: cnNumber,
          invoice_type: 'CREDIT_NOTE',
          customer_id: invoice.customer_id,
          branch_id: invoice.branch_id,
          invoice_date: new Date(),
          due_date: new Date(), // Immediate
          subtotal: amount,
          tax_amount: 0, // Simplified
          total_amount: amount,
          outstanding_amount: amount,
          status: 'OPEN',
          reference_type: 'INVOICE',
          reference_id: invoice.id,
          notes: reason,
          created_by: userId
        }
      });

      // Post the credit note immediately (in a real system this might require approval)
      await this.postCreditNote(creditNote.id, userId, tx);
      
      // Reduce the outstanding amount of the original invoice
      const newOutstanding = Number(invoice.outstanding_amount) - amount;
      let newStatus = invoice.status;
      if (newOutstanding <= 0) {
        newStatus = 'PAID';
      } else if (newOutstanding < Number(invoice.total_amount)) {
        newStatus = 'PARTIAL';
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          outstanding_amount: newOutstanding,
          status: newStatus
        }
      });

      return creditNote as any;
    });
  }

  private async postCreditNote(cnId: UUID, userId: UUID, tx: any): Promise<void> {
    const cn = await tx.invoice.findUnique({ where: { id: cnId } });
    if (!cn) return;

    const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
    if (!period) {
      throw new BusinessRuleException('No open fiscal period found for Credit Note posting', ErrorCode.NOT_FOUND);
    }

    await this.journalEngine.processEvent({
      event_type: 'SALES_RETURN',
      reference_type: 'CREDIT_NOTE',
      reference_id: cn.id,
      reference_number: cn.invoice_number,
      amount: Number(cn.total_amount),
      period_id: period.id,
      entry_date: cn.invoice_date,
      created_by: userId,
      metadata: {
        description: `Credit Note ${cn.invoice_number} for Invoice ${cn.reference_id}`
      }
    }, tx);

    await tx.invoice.update({
      where: { id: cn.id },
      data: { status: 'POSTED' }
    });
  }
}
