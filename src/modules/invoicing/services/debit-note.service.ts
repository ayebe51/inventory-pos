import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { Invoice } from '../interfaces/invoicing.interfaces';

@Injectable()
export class DebitNoteService {
  private readonly logger = new Logger(DebitNoteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Create a Debit Note against an existing Purchase Invoice
   */
  async createDebitNote(invoiceId: UUID, amount: number, reason: string, userId: UUID): Promise<Invoice> {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.invoice_type !== 'PURCHASE') {
        throw new BusinessRuleException('Valid Purchase Invoice required for Debit Note', ErrorCode.VALIDATION_ERROR);
      }

      if (amount <= 0 || amount > Number(invoice.total_amount)) {
        throw new BusinessRuleException('Invalid debit note amount', ErrorCode.VALIDATION_ERROR);
      }

      const dnNumber = await this.numbering.generate(DocumentType.INV); // Or DN doc type

      const debitNote = await tx.invoice.create({
        data: {
          invoice_number: dnNumber,
          invoice_type: 'DEBIT_NOTE',
          supplier_id: invoice.supplier_id,
          branch_id: invoice.branch_id,
          invoice_date: new Date(),
          due_date: new Date(), // Immediate
          subtotal: amount,
          tax_amount: 0,
          total_amount: amount,
          outstanding_amount: amount,
          status: 'OPEN',
          reference_type: 'INVOICE',
          reference_id: invoice.id,
          notes: reason,
          created_by: userId
        }
      });

      // Post debit note immediately
      await this.postDebitNote(debitNote.id, userId, tx);
      
      // Reduce the outstanding amount of the original purchase invoice
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

      return debitNote as any;
    });
  }

  private async postDebitNote(dnId: UUID, userId: UUID, tx: any): Promise<void> {
    const dn = await tx.invoice.findUnique({ where: { id: dnId } });
    if (!dn) return;

    // A Debit Note for purchase reduces Accounts Payable (Debit) and reduces Inventory/Expense (Credit)
    await this.journalEngine.processEvent({
      event_type: 'GOODS_RECEIPT', // or an appropriate JournalEventType for debit notes
      reference_type: 'DEBIT_NOTE',
      reference_id: dn.id,
      reference_number: dn.invoice_number,
      amount: Number(dn.total_amount),
      period_id: 'auto-resolve' as any,
      entry_date: dn.invoice_date,
      created_by: userId,
      metadata: {
        description: `Debit Note ${dn.invoice_number} for Invoice ${dn.reference_id}`
      }
    });

    await tx.invoice.update({
      where: { id: dn.id },
      data: { status: 'POSTED' }
    });
  }
}
