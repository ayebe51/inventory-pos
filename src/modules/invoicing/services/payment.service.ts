import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  PaymentService as IPaymentService,
  CreatePaymentDTO,
  AllocationDTO,
  Payment,
} from '../interfaces/invoicing.interfaces';

@Injectable()
export class PaymentService implements IPaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  async createPayment(data: CreatePaymentDTO, userId?: UUID): Promise<Payment> {
    return await this.prisma.$transaction(async (tx) => {
      // Create payment number PV or RCV depending on payment type
      const docType = data.payment_type === 'RECEIPT' ? DocumentType.RCV : DocumentType.PV;
      const paymentNumber = await this.numberingService.generate(docType);

      // We assume bank_account_id is provided or a default payment_method_id is mapped.
      // The schema for Payment expects payment_method_id.
      const paymentMethod = await tx.paymentMethod.findFirst({ where: { is_active: true } });
      if (!paymentMethod) throw new BusinessRuleException('No active payment methods found', ErrorCode.NOT_FOUND);

      const payment = await tx.payment.create({
        data: {
          payment_number: paymentNumber,
          payment_type: data.payment_type,
          customer_id: data.customer_id,
          supplier_id: data.supplier_id,
          branch_id: data.branch_id,
          payment_date: data.payment_date,
          payment_method_id: paymentMethod.id,
          amount: data.amount,
          status: 'DRAFT',
          reference_number: data.reference,
          notes: data.notes,
          created_by: userId || data.customer_id || data.supplier_id || data.branch_id,
        }
      });

      return payment as any;
    });
  }

  async approve(id: UUID, approverId: UUID): Promise<Payment> {
    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);

      // Enforce SOD-002: creator cannot approve
      if (payment.created_by === approverId) {
        throw new BusinessRuleException('SOD-002: Creator cannot approve their own payment', ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      if (payment.status !== 'DRAFT' && payment.status !== 'PENDING_APPROVAL') {
        throw new BusinessRuleException(`Cannot approve payment in ${payment.status} status`, ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approved_by: approverId,
          approved_at: new Date()
        }
      });

      return updated as any;
    });
  }

  async post(id: UUID, userId: UUID): Promise<Payment> {
    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);

      if (payment.status !== 'APPROVED') {
        throw new BusinessRuleException('Payment must be APPROVED before posting', ErrorCode.VALIDATION_ERROR);
      }

      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.VALIDATION_ERROR);

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: 'POSTED',
          posted_by: userId,
          posted_at: new Date()
        }
      });

      // Trigger auto journal
      const eventType = payment.payment_type === 'RECEIPT' ? 'PAYMENT_RECEIPT' : 'PURCHASE_PAYMENT';
      await this.journalEngine.processEvent({
        event_type: eventType,
        reference_type: 'PAYMENT',
        reference_id: id,
        reference_number: payment.payment_number,
        entry_date: payment.payment_date,
        period_id: period.id,
        amount: Number(payment.amount),
        created_by: userId,
      }, tx);

      return updated as any;
    });
  }

  async allocateToInvoices(paymentId: UUID, allocations: AllocationDTO[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ 
        where: { id: paymentId },
        include: { allocations: true }
      });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);

      const alreadyAllocated = payment.allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
      const newAllocationTotal = allocations.reduce((sum, a) => sum + a.amount, 0);

      if (alreadyAllocated + newAllocationTotal > Number(payment.amount)) {
        throw new BusinessRuleException('Allocation total exceeds payment amount', ErrorCode.VALIDATION_ERROR);
      }

      for (const alloc of allocations) {
        const invoice = await tx.invoice.findUnique({ where: { id: alloc.invoice_id } });
        if (!invoice) throw new BusinessRuleException(`Invoice ${alloc.invoice_id} not found`, ErrorCode.NOT_FOUND);

        const outstanding = Number(invoice.outstanding_amount);
        if (alloc.amount > outstanding) {
          throw new BusinessRuleException(`Allocation (${alloc.amount}) exceeds invoice ${invoice.invoice_number} outstanding (${outstanding})`, ErrorCode.VALIDATION_ERROR);
        }

        await tx.invoiceAllocation.create({
          data: {
            invoice_id: alloc.invoice_id,
            payment_id: paymentId,
            allocated_amount: alloc.amount,
            allocated_at: new Date(),
            created_by: payment.created_by,
          }
        });

        const newOutstanding = outstanding - alloc.amount;
        let newStatus = invoice.status;
        if (newOutstanding <= 0.01) newStatus = 'PAID';
        else if (newOutstanding < Number(invoice.total_amount)) newStatus = 'PARTIAL';

        await tx.invoice.update({
          where: { id: alloc.invoice_id },
          data: {
            paid_amount: { increment: alloc.amount },
            outstanding_amount: newOutstanding,
            status: newStatus
          }
        });
      }
    });
  }

  async reverse(id: UUID, userId: UUID, reason: string): Promise<Payment> {
    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);

      if (payment.status === 'POSTED') {
        const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
        if (period) {
          const originalJe = await tx.journalEntry.findFirst({
            where: {
              reference_type: 'PAYMENT',
              reference_id: id,
              status: 'POSTED',
            },
            include: { lines: true },
          });

          if (originalJe) {
            const reversalLines = originalJe.lines.map((l) => ({
              account_id: l.account_id,
              cost_center_id: l.cost_center_id ?? undefined,
              description: `Reversal of Payment ${payment.payment_number}: ${reason}`,
              debit: Number(l.credit),
              credit: Number(l.debit),
            }));

            await this.journalEngine.createManualEntry(
              'PAYMENT_REVERSAL',
              id,
              `Reversal of Payment ${payment.payment_number}`,
              new Date(),
              reversalLines,
              userId,
              tx,
            );

            await tx.journalEntry.update({
              where: { id: originalJe.id },
              data: {
                status: 'REVERSED',
                reversed_by: userId,
                reversed_at: new Date(),
              },
            });
          }
        }
      }

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversed_by: userId,
          reversed_at: new Date(),
          reversal_reason: reason
        }
      });
      return updated as any;
    });
  }

  async reconcile(id: UUID, bankStatementRef: string): Promise<Payment> {
    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);

      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: 'RECONCILED'
        }
      });
      return updated as any;
    });
  }

  async findById(id: UUID): Promise<Payment | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { allocations: true },
    });
    return payment as any;
  }

  async search(filters: {
    payment_type?: string;
    status?: string;
    customer_id?: string;
    supplier_id?: string;
    page?: number;
    per_page?: number;
  }) {
    const page = filters.page || 1;
    const per_page = filters.per_page || 20;
    const skip = (page - 1) * per_page;

    const where: any = { deleted_at: null };
    if (filters.payment_type) where.payment_type = filters.payment_type;
    if (filters.status) where.status = filters.status;
    if (filters.customer_id) where.customer_id = filters.customer_id;
    if (filters.supplier_id) where.supplier_id = filters.supplier_id;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, per_page },
    };
  }
}
