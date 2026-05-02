import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  InvoiceAllocation,
  CreateSalesInvoiceDTO,
  CreatePurchaseInvoiceDTO,
  InvoiceService as IInvoiceService,
} from '../interfaces/invoicing.interfaces';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapInvoice(row: any): Invoice {
  return {
    id: row.id as UUID,
    invoice_number: row.invoice_number,
    invoice_type: row.invoice_type as InvoiceType,
    customer_id: row.customer_id as UUID | null,
    supplier_id: row.supplier_id as UUID | null,
    branch_id: row.branch_id as UUID,
    status: row.status as InvoiceStatus,
    invoice_date: row.invoice_date,
    due_date: row.due_date,
    subtotal: Number(row.subtotal),
    tax_amount: Number(row.tax_amount),
    total_amount: Number(row.total_amount),
    paid_amount: Number(row.paid_amount),
    outstanding_amount: Number(row.outstanding_amount),
    reference_type: row.reference_type,
    reference_id: row.reference_id as UUID | null,
    notes: row.notes,
    created_by: row.created_by as UUID,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function mapInvoiceAllocation(row: any): InvoiceAllocation {
  return {
    id: row.id as UUID,
    invoice_id: row.invoice_id as UUID,
    payment_id: row.payment_id as UUID,
    amount: Number(row.allocated_amount),
    allocated_at: row.allocated_at,
    created_by: row.created_by as UUID,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class InvoiceService implements IInvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  /**
   * Create a sales invoice from Sales Order or POS transaction.
   * Generates invoice number in format INV-YYYYMM-XXXXX.
   * Status starts as DRAFT.
   *
   * @param data - Sales invoice data
   * @returns Created invoice
   */
  async createSalesInvoice(data: CreateSalesInvoiceDTO, userId: UUID): Promise<Invoice> {
    // Verify customer exists and is active
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customer_id },
    });

    if (!customer || customer.deleted_at !== null || !customer.is_active) {
      throw new BusinessRuleException(
        `Customer ${data.customer_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify branch exists and is active
    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branch_id },
    });

    if (!branch || branch.deleted_at !== null || !branch.is_active) {
      throw new BusinessRuleException(
        `Branch ${data.branch_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Calculate line totals
    const linesWithTotals = data.lines.map((line) => {
      const subtotal = line.qty * line.unit_price;
      const taxAmount = (subtotal * line.tax_pct) / 100;
      const lineTotal = subtotal + taxAmount;

      return {
        ...line,
        line_total: lineTotal,
      };
    });

    // Calculate invoice totals
    const subtotal = linesWithTotals.reduce((sum, line) => sum + line.line_total, 0);
    const taxAmount = linesWithTotals.reduce(
      (sum, line) => sum + (line.qty * line.unit_price * line.tax_pct) / 100,
      0,
    );
    const totalAmount = subtotal;

    // Generate invoice number
    const invoiceNumber = await this.numbering.generate(DocumentType.INV);

    // Create invoice with lines in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create invoice header
      const invoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          invoice_type: 'SALES',
          reference_type: data.reference_type || 'MANUAL',
          reference_id: data.reference_id || invoiceNumber,
          customer_id: data.customer_id,
          supplier_id: null,
          branch_id: data.branch_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date,
          status: 'DRAFT',
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: 0,
          outstanding_amount: totalAmount,
          notes: null,
          created_by: userId,
        },
      });

      // Create invoice lines
      await Promise.all(
        linesWithTotals.map((line) =>
          tx.invoiceLine.create({
            data: {
              invoice_id: invoice.id,
              product_id: line.product_id,
              description: line.description || '',
              qty: line.qty,
              unit_price: line.unit_price,
              discount_pct: 0,
              tax_pct: line.tax_pct,
              line_total: line.line_total,
            },
          }),
        ),
      );

      // Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'Invoice',
          entity_id: invoice.id,
          before_snapshot: undefined,
          after_snapshot: invoice,
        },
        tx,
      );

      return invoice;
    });

    this.logger.log(`Created Sales Invoice ${result.invoice_number} by user ${userId}`);

    return mapInvoice(result);
  }

  /**
   * Create a purchase invoice from Goods Receipt.
   * Validates BR-PUR-008: Total invoice amount cannot exceed PO amount + 5%.
   * Generates invoice number in format INV-YYYYMM-XXXXX.
   * Status starts as DRAFT.
   *
   * @param data - Purchase invoice data
   * @returns Created invoice
   */
  async createPurchaseInvoice(data: CreatePurchaseInvoiceDTO, userId: UUID): Promise<Invoice> {
    // Verify supplier exists and is active
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplier_id },
    });

    if (!supplier || supplier.deleted_at !== null || !supplier.is_active) {
      throw new BusinessRuleException(
        `Supplier ${data.supplier_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Verify branch exists and is active
    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branch_id },
    });

    if (!branch || branch.deleted_at !== null || !branch.is_active) {
      throw new BusinessRuleException(
        `Branch ${data.branch_id} not found or inactive`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Calculate line totals
    const linesWithTotals = data.lines.map((line) => {
      const subtotal = line.qty * line.unit_price;
      const taxAmount = (subtotal * line.tax_pct) / 100;
      const lineTotal = subtotal + taxAmount;

      return {
        ...line,
        line_total: lineTotal,
      };
    });

    // Calculate invoice totals
    const subtotal = linesWithTotals.reduce((sum, line) => sum + line.line_total, 0);
    const taxAmount = linesWithTotals.reduce(
      (sum, line) => sum + (line.qty * line.unit_price * line.tax_pct) / 100,
      0,
    );
    const totalAmount = subtotal;

    // BR-PUR-008: Validate invoice amount does not exceed PO amount + 5%
    if (data.po_id) {
      await this.validatePurchaseInvoiceAmount(data.po_id, totalAmount);
    }

    // Generate invoice number
    const invoiceNumber = await this.numbering.generate(DocumentType.INV);

    // Create invoice with lines in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create invoice header
      const invoice = await tx.invoice.create({
        data: {
          invoice_number: invoiceNumber,
          invoice_type: 'PURCHASE',
          reference_type: data.po_id ? 'PO' : 'MANUAL',
          reference_id: data.po_id || invoiceNumber,
          customer_id: null,
          supplier_id: data.supplier_id,
          branch_id: data.branch_id,
          invoice_date: data.invoice_date,
          due_date: data.due_date,
          status: 'DRAFT',
          subtotal: subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: 0,
          outstanding_amount: totalAmount,
          notes: null,
          created_by: userId,
        },
      });

      // Create invoice lines
      await Promise.all(
        linesWithTotals.map((line) =>
          tx.invoiceLine.create({
            data: {
              invoice_id: invoice.id,
              product_id: line.product_id,
              description: line.description || '',
              qty: line.qty,
              unit_price: line.unit_price,
              discount_pct: 0,
              tax_pct: line.tax_pct,
              line_total: line.line_total,
            },
          }),
        ),
      );

      // Record audit log
      await this.audit.record(
        {
          user_id: userId,
          action: 'CREATE',
          entity_type: 'Invoice',
          entity_id: invoice.id,
          before_snapshot: undefined,
          after_snapshot: invoice,
        },
        tx,
      );

      return invoice;
    });

    this.logger.log(`Created Purchase Invoice ${result.invoice_number} by user ${userId}`);

    return mapInvoice(result);
  }

  /**
   * BR-PUR-008: Validate that supplier invoice does not exceed PO amount + 5%.
   *
   * @param poId - Purchase Order ID
   * @param invoiceAmount - Total invoice amount
   * @throws BusinessRuleException if invoice exceeds PO amount + 5%
   */
  private async validatePurchaseInvoiceAmount(poId: UUID, invoiceAmount: number): Promise<void> {
    // Get PO with total amount
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        po_number: true,
        total_amount: true,
        status: true,
      },
    });

    if (!po || po.status === 'CANCELLED') {
      throw new BusinessRuleException(
        `Purchase Order ${poId} not found or cancelled`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const poTotalAmount = Number(po.total_amount);
    const maxAllowedAmount = poTotalAmount * 1.05; // PO amount + 5%

    if (invoiceAmount > maxAllowedAmount) {
      const exceededAmount = invoiceAmount - maxAllowedAmount;
      const exceededPercentage = ((invoiceAmount - poTotalAmount) / poTotalAmount) * 100;

      throw new BusinessRuleException(
        `BR-PUR-008: Supplier invoice amount (Rp ${invoiceAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}) exceeds PO ${po.po_number} amount (Rp ${poTotalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}) by ${exceededPercentage.toFixed(2)}%. Maximum allowed is 5% (Rp ${maxAllowedAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}). Exceeded by Rp ${exceededAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    this.logger.log(
      `BR-PUR-008 validation passed: Invoice amount Rp ${invoiceAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })} is within 5% of PO ${po.po_number} amount Rp ${poTotalAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })} (max allowed: Rp ${maxAllowedAmount.toLocaleString('id-ID', { minimumFractionDigits: 2 })})`,
    );
  }

  /**
   * Post invoice (DRAFT → OPEN).
   * Triggers auto journal entry for the invoice.
   *
   * @param id - Invoice ID
   * @param userId - User posting the invoice
   * @returns Updated invoice
   */
  async post(id: UUID, userId: UUID): Promise<Invoice> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot post invoice in ${existing.status} status. Invoice must be in DRAFT status.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          status: 'OPEN',
          posted_by: userId,
          posted_at: new Date(),
        },
      });

      // TODO: Trigger auto journal entry (will be implemented in journal engine)

      await this.audit.record(
        {
          user_id: userId,
          action: 'POST',
          entity_type: 'Invoice',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: invoice,
        },
        tx,
      );

      return invoice;
    });

    this.logger.log(`Posted Invoice ${result.invoice_number} by user ${userId}`);

    return mapInvoice(result);
  }

  /**
   * Apply payment to invoice.
   * Updates paid_amount and outstanding_amount.
   * Updates status to PARTIAL or PAID based on outstanding amount.
   *
   * @param invoiceId - Invoice ID
   * @param paymentId - Payment ID
   * @param amount - Amount to allocate
   * @returns Invoice allocation record
   */
  async applyPayment(
    invoiceId: UUID,
    paymentId: UUID,
    amount: number,
    userId: UUID,
  ): Promise<InvoiceAllocation> {
    if (amount <= 0) {
      throw new BusinessRuleException(
        'Payment amount must be greater than zero',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const invoice = await this.findById(invoiceId);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== 'OPEN' && invoice.status !== 'PARTIAL' && invoice.status !== 'OVERDUE') {
      throw new BusinessRuleException(
        `Cannot apply payment to invoice in ${invoice.status} status`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    if (amount > invoice.outstanding_amount) {
      throw new BusinessRuleException(
        `Payment amount (${amount}) exceeds outstanding amount (${invoice.outstanding_amount})`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create allocation record
      const allocation = await tx.invoiceAllocation.create({
        data: {
          invoice_id: invoiceId,
          payment_id: paymentId,
          allocated_amount: amount,
          allocated_at: new Date(),
          created_by: userId,
        },
      });

      // Update invoice amounts and status
      const newPaidAmount = invoice.paid_amount + amount;
      const newOutstandingAmount = invoice.total_amount - newPaidAmount;
      const newStatus: InvoiceStatus =
        newOutstandingAmount <= 0.01 ? 'PAID' : 'PARTIAL';

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paid_amount: newPaidAmount,
          outstanding_amount: newOutstandingAmount,
          status: newStatus,
        },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'Invoice',
          entity_id: invoiceId,
          before_snapshot: invoice as any,
          after_snapshot: { ...invoice, paid_amount: newPaidAmount, outstanding_amount: newOutstandingAmount, status: newStatus },
        },
        tx,
      );

      return allocation;
    });

    this.logger.log(
      `Applied payment ${paymentId} (${amount}) to invoice ${invoiceId} by user ${userId}`,
    );

    return mapInvoiceAllocation(result);
  }

  /**
   * Mark invoice as disputed.
   *
   * @param id - Invoice ID
   * @param reason - Dispute reason
   * @returns Updated invoice
   */
  async dispute(id: UUID, reason: string, userId: UUID): Promise<Invoice> {
    if (!reason || reason.trim().length === 0) {
      throw new BusinessRuleException('Dispute reason is required', ErrorCode.VALIDATION_ERROR);
    }

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (existing.status !== 'OPEN' && existing.status !== 'PARTIAL' && existing.status !== 'OVERDUE') {
      throw new BusinessRuleException(
        `Cannot dispute invoice in ${existing.status} status`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          status: 'DISPUTED',
          notes: `${existing.notes || ''}\nDisputed: ${reason}`.trim(),
        },
      });

      await this.audit.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'Invoice',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: invoice,
        },
        tx,
      );

      return invoice;
    });

    this.logger.log(`Disputed Invoice ${result.invoice_number} by user ${userId}`);

    return mapInvoice(result);
  }

  /**
   * Write off invoice (bad debt).
   * Requires INVOICE.WRITE_OFF permission.
   * Triggers auto journal entry.
   *
   * @param id - Invoice ID
   * @param userId - User writing off the invoice
   * @param reason - Write-off reason
   * @returns Updated invoice
   */
  async writeOff(id: UUID, userId: UUID, reason: string): Promise<Invoice> {
    if (!reason || reason.trim().length === 0) {
      throw new BusinessRuleException('Write-off reason is required', ErrorCode.VALIDATION_ERROR);
    }

    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (existing.status !== 'OVERDUE') {
      throw new BusinessRuleException(
        `Cannot write off invoice in ${existing.status} status. Invoice must be OVERDUE.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: {
          status: 'WRITTEN_OFF',
          notes: `${existing.notes || ''}\nWritten Off: ${reason}`.trim(),
        },
      });

      // TODO: Trigger auto journal entry for write-off (will be implemented in journal engine)

      await this.audit.record(
        {
          user_id: userId,
          action: 'WRITE_OFF',
          entity_type: 'Invoice',
          entity_id: id,
          before_snapshot: existing as any,
          after_snapshot: invoice,
        },
        tx,
      );

      return invoice;
    });

    this.logger.log(`Wrote off Invoice ${result.invoice_number} by user ${userId}`);

    return mapInvoice(result);
  }

  /**
   * Find an invoice by ID.
   *
   * @param id - Invoice ID
   * @returns Invoice or null if not found
   */
  async findById(id: UUID): Promise<Invoice | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice || invoice.deleted_at !== null) {
      return null;
    }

    return mapInvoice(invoice);
  }
}
