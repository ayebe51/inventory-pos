import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * 3-way matching tolerance percentage.
 * BR-PUR-003: Invoice qty must match PO qty and GR qty within tolerance.
 * Default: 5% tolerance (0.05).
 */
const THREE_WAY_MATCHING_TOLERANCE = 0.05;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ThreeWayMatchingResult {
  isValid: boolean;
  violations: ThreeWayMatchingViolation[];
  summary: ThreeWayMatchingSummary;
}

export interface ThreeWayMatchingViolation {
  product_id: UUID;
  product_code: string;
  product_name: string;
  po_qty: number;
  gr_qty: number;
  invoice_qty: number;
  violation_type: 'QTY_MISMATCH' | 'AMOUNT_MISMATCH';
  message: string;
}

export interface ThreeWayMatchingSummary {
  po_id: UUID;
  po_number: string;
  total_po_amount: number;
  total_gr_amount: number;
  total_invoice_amount: number;
  lines_checked: number;
  lines_matched: number;
  lines_violated: number;
}

export interface ThreeWayMatchingInput {
  po_id: UUID;
  invoice_lines: InvoiceLineInput[];
}

export interface InvoiceLineInput {
  product_id: UUID;
  qty: number;
  unit_price: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Three-Way Matching Service
 * 
 * Implements BR-PUR-003: 3-way matching validation
 * Validates that PO qty, GR qty, and supplier invoice qty match within tolerance.
 * 
 * Matching Rules:
 * 1. Invoice qty must not exceed PO qty by more than tolerance %
 * 2. Invoice qty must not exceed GR qty by more than tolerance %
 * 3. Invoice amount must not exceed PO amount by more than 5% (BR-PUR-008)
 * 
 * Tolerance is configurable but defaults to 5%.
 */
@Injectable()
export class ThreeWayMatchingService {
  private readonly logger = new Logger(ThreeWayMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate 3-way matching for a supplier invoice against PO and GR.
   * 
   * BR-PUR-003: Validates that invoice quantities match PO and GR quantities within tolerance.
   * BR-PUR-008: Validates that invoice amount does not exceed PO amount + 5%.
   * 
   * @param input - Matching input with PO ID and invoice lines
   * @param tolerance - Optional tolerance percentage (default: 5%)
   * @returns Matching result with violations if any
   * @throws BusinessRuleException if validation fails
   */
  async validate(
    input: ThreeWayMatchingInput,
    tolerance: number = THREE_WAY_MATCHING_TOLERANCE,
  ): Promise<ThreeWayMatchingResult> {
    // Fetch PO with lines
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: input.po_id },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!po || po.deleted_at !== null) {
      throw new BusinessRuleException(
        `Purchase Order ${input.po_id} not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Fetch all confirmed GRs for this PO
    const goodsReceipts = await this.prisma.goodsReceipt.findMany({
      where: {
        po_id: input.po_id,
        status: 'CONFIRMED',
      },
      include: {
        lines: true,
      },
    });

    // Aggregate GR quantities by product
    const grQtyByProduct = new Map<UUID, number>();
    for (const gr of goodsReceipts) {
      for (const grLine of gr.lines) {
        const currentQty = grQtyByProduct.get(grLine.product_id) || 0;
        grQtyByProduct.set(grLine.product_id, currentQty + Number(grLine.qty_received));
      }
    }

    // Create PO qty map for quick lookup
    const poQtyByProduct = new Map<UUID, { qty: number; line: any }>();
    for (const poLine of po.lines) {
      poQtyByProduct.set(poLine.product_id, {
        qty: Number(poLine.qty_ordered),
        line: poLine,
      });
    }

    // Validate each invoice line
    const violations: ThreeWayMatchingViolation[] = [];
    let totalInvoiceAmount = 0;

    for (const invoiceLine of input.invoice_lines) {
      const invoiceQty = invoiceLine.qty;
      const invoiceLineAmount = invoiceQty * invoiceLine.unit_price;
      totalInvoiceAmount += invoiceLineAmount;

      // Get PO qty for this product
      const poData = poQtyByProduct.get(invoiceLine.product_id);
      if (!poData) {
        violations.push({
          product_id: invoiceLine.product_id,
          product_code: 'UNKNOWN',
          product_name: 'UNKNOWN',
          po_qty: 0,
          gr_qty: 0,
          invoice_qty: invoiceQty,
          violation_type: 'QTY_MISMATCH',
          message: `Product ${invoiceLine.product_id} not found in PO ${po.po_number}`,
        });
        continue;
      }

      const poQty = poData.qty;
      const poLine = poData.line;

      // Get GR qty for this product
      const grQty = grQtyByProduct.get(invoiceLine.product_id) || 0;

      // Calculate tolerance thresholds
      const maxAllowedQtyVsPO = poQty * (1 + tolerance);
      const maxAllowedQtyVsGR = grQty * (1 + tolerance);

      // Check if invoice qty exceeds PO qty beyond tolerance
      if (invoiceQty > maxAllowedQtyVsPO) {
        violations.push({
          product_id: invoiceLine.product_id,
          product_code: poLine.product.code,
          product_name: poLine.product.name,
          po_qty: poQty,
          gr_qty: grQty,
          invoice_qty: invoiceQty,
          violation_type: 'QTY_MISMATCH',
          message: `BR-PUR-003: Invoice qty (${invoiceQty}) exceeds PO qty (${poQty}) by more than ${tolerance * 100}%. Max allowed: ${maxAllowedQtyVsPO.toFixed(4)}`,
        });
      }

      // Check if invoice qty exceeds GR qty beyond tolerance
      if (invoiceQty > maxAllowedQtyVsGR) {
        violations.push({
          product_id: invoiceLine.product_id,
          product_code: poLine.product.code,
          product_name: poLine.product.name,
          po_qty: poQty,
          gr_qty: grQty,
          invoice_qty: invoiceQty,
          violation_type: 'QTY_MISMATCH',
          message: `BR-PUR-003: Invoice qty (${invoiceQty}) exceeds GR qty (${grQty}) by more than ${tolerance * 100}%. Max allowed: ${maxAllowedQtyVsGR.toFixed(4)}`,
        });
      }

      // Check if invoice qty is significantly less than GR qty (warning, not violation)
      if (invoiceQty < grQty * (1 - tolerance)) {
        this.logger.warn(
          `Invoice qty (${invoiceQty}) is significantly less than GR qty (${grQty}) for product ${poLine.product.code} in PO ${po.po_number}`,
        );
      }
    }

    // BR-PUR-008: Validate total invoice amount does not exceed PO amount + 5%
    const maxAllowedInvoiceAmount = Number(po.total_amount) * 1.05;
    if (totalInvoiceAmount > maxAllowedInvoiceAmount) {
      violations.push({
        product_id: '' as UUID,
        product_code: 'TOTAL',
        product_name: 'Total Amount',
        po_qty: 0,
        gr_qty: 0,
        invoice_qty: 0,
        violation_type: 'AMOUNT_MISMATCH',
        message: `BR-PUR-008: Total invoice amount (${totalInvoiceAmount.toFixed(2)}) exceeds PO amount (${Number(po.total_amount).toFixed(2)}) by more than 5%. Max allowed: ${maxAllowedInvoiceAmount.toFixed(2)}`,
      });
    }

    // Calculate summary
    const summary: ThreeWayMatchingSummary = {
      po_id: po.id as UUID,
      po_number: po.po_number,
      total_po_amount: Number(po.total_amount),
      total_gr_amount: goodsReceipts.reduce(
        (sum, gr) => sum + gr.lines.reduce((lineSum, line) => lineSum + Number(line.total_cost), 0),
        0,
      ),
      total_invoice_amount: totalInvoiceAmount,
      lines_checked: input.invoice_lines.length,
      lines_matched: input.invoice_lines.length - violations.filter(v => v.violation_type === 'QTY_MISMATCH').length,
      lines_violated: violations.filter(v => v.violation_type === 'QTY_MISMATCH').length,
    };

    const isValid = violations.length === 0;

    if (!isValid) {
      this.logger.warn(
        `3-way matching validation failed for PO ${po.po_number}. ${violations.length} violation(s) found.`,
      );
    } else {
      this.logger.log(
        `3-way matching validation passed for PO ${po.po_number}. All ${input.invoice_lines.length} line(s) matched.`,
      );
    }

    return {
      isValid,
      violations,
      summary,
    };
  }

  /**
   * Validate and throw exception if 3-way matching fails.
   * Convenience method that calls validate() and throws if validation fails.
   * 
   * @param input - Matching input with PO ID and invoice lines
   * @param tolerance - Optional tolerance percentage (default: 5%)
   * @throws BusinessRuleException if validation fails with detailed violation messages
   */
  async validateAndThrow(
    input: ThreeWayMatchingInput,
    tolerance: number = THREE_WAY_MATCHING_TOLERANCE,
  ): Promise<void> {
    const result = await this.validate(input, tolerance);

    if (!result.isValid) {
      const violationMessages = result.violations.map(v => v.message).join('\n');
      throw new BusinessRuleException(
        `3-way matching validation failed for PO ${result.summary.po_number}:\n${violationMessages}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }
  }

  /**
   * Get 3-way matching report for a PO.
   * Returns detailed matching information without validation.
   * 
   * @param poId - Purchase Order ID
   * @returns Matching report with PO, GR, and invoice data
   */
  async getMatchingReport(poId: UUID): Promise<{
    po: any;
    goodsReceipts: any[];
    invoices: any[];
    summary: {
      total_po_qty: number;
      total_gr_qty: number;
      total_invoice_qty: number;
      total_po_amount: number;
      total_gr_amount: number;
      total_invoice_amount: number;
    };
  }> {
    // Fetch PO with lines
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    if (!po || po.deleted_at !== null) {
      throw new BusinessRuleException(
        `Purchase Order ${poId} not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    // Fetch all confirmed GRs for this PO
    const goodsReceipts = await this.prisma.goodsReceipt.findMany({
      where: {
        po_id: poId,
        status: 'CONFIRMED',
      },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    // Fetch all invoices referencing this PO
    const invoices = await this.prisma.invoice.findMany({
      where: {
        reference_type: 'PO',
        reference_id: poId,
        deleted_at: null,
      },
      include: {
        lines: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate summary
    const totalPoQty = po.lines.reduce((sum, line) => sum + Number(line.qty_ordered), 0);
    const totalGrQty = goodsReceipts.reduce(
      (sum, gr) => sum + gr.lines.reduce((lineSum, line) => lineSum + Number(line.qty_received), 0),
      0,
    );
    const totalInvoiceQty = invoices.reduce(
      (sum, inv) => sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.qty), 0),
      0,
    );

    const totalPoAmount = Number(po.total_amount);
    const totalGrAmount = goodsReceipts.reduce(
      (sum, gr) => sum + gr.lines.reduce((lineSum, line) => lineSum + Number(line.total_cost), 0),
      0,
    );
    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

    return {
      po,
      goodsReceipts,
      invoices,
      summary: {
        total_po_qty: totalPoQty,
        total_gr_qty: totalGrQty,
        total_invoice_qty: totalInvoiceQty,
        total_po_amount: totalPoAmount,
        total_gr_amount: totalGrAmount,
        total_invoice_amount: totalInvoiceAmount,
      },
    };
  }

  /**
   * Get current tolerance configuration.
   * 
   * @returns Current tolerance percentage (e.g., 0.05 for 5%)
   */
  getTolerance(): number {
    return THREE_WAY_MATCHING_TOLERANCE;
  }
}
