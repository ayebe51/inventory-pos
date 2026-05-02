/**
 * Example: Using ThreeWayMatchingService in Invoice Creation
 * 
 * This example demonstrates how to integrate 3-way matching validation
 * when creating a supplier invoice from a Purchase Order.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ThreeWayMatchingService } from '../services/three-way-matching.service';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class InvoiceCreationExample {
  private readonly logger = new Logger(InvoiceCreationExample.name);

  constructor(
    private readonly threeWayMatching: ThreeWayMatchingService,
  ) {}

  /**
   * Example 1: Validate before creating supplier invoice
   * 
   * This is the recommended approach - validate first, then create invoice.
   */
  async createSupplierInvoiceWithValidation(
    poId: UUID,
    invoiceData: {
      supplier_id: UUID;
      invoice_date: Date;
      lines: Array<{
        product_id: UUID;
        qty: number;
        unit_price: number;
      }>;
    },
  ): Promise<void> {
    this.logger.log(`Creating supplier invoice for PO ${poId}`);

    // Step 1: Perform 3-way matching validation
    const matchingResult = await this.threeWayMatching.validate({
      po_id: poId,
      invoice_lines: invoiceData.lines,
    });

    // Step 2: Check if validation passed
    if (!matchingResult.isValid) {
      this.logger.error(
        `3-way matching failed for PO ${matchingResult.summary.po_number}`,
      );

      // Log all violations
      for (const violation of matchingResult.violations) {
        this.logger.error(
          `Violation: ${violation.product_code} - ${violation.message}`,
        );
      }

      // You can choose to:
      // A) Reject the invoice creation entirely
      throw new Error('3-way matching validation failed');

      // B) Flag the invoice for manual review
      // await this.flagInvoiceForReview(poId, matchingResult.violations);

      // C) Allow creation but mark as disputed
      // await this.createDisputedInvoice(invoiceData, matchingResult.violations);
    }

    // Step 3: If validation passed, proceed with invoice creation
    this.logger.log(
      `3-way matching passed. Creating invoice for PO ${matchingResult.summary.po_number}`,
    );

    // TODO: Call InvoiceService.createPurchaseInvoice(...)
    // await this.invoiceService.createPurchaseInvoice({
    //   supplier_id: invoiceData.supplier_id,
    //   po_id: poId,
    //   invoice_date: invoiceData.invoice_date,
    //   lines: invoiceData.lines,
    // });
  }

  /**
   * Example 2: Use validateAndThrow for simpler error handling
   * 
   * This approach throws an exception immediately if validation fails.
   */
  async createSupplierInvoiceWithThrow(
    poId: UUID,
    invoiceData: {
      supplier_id: UUID;
      invoice_date: Date;
      lines: Array<{
        product_id: UUID;
        qty: number;
        unit_price: number;
      }>;
    },
  ): Promise<void> {
    try {
      // This will throw BusinessRuleException if validation fails
      await this.threeWayMatching.validateAndThrow({
        po_id: poId,
        invoice_lines: invoiceData.lines,
      });

      // If we reach here, validation passed
      this.logger.log(`3-way matching passed for PO ${poId}`);

      // TODO: Create invoice
      // await this.invoiceService.createPurchaseInvoice(...);
    } catch (error) {
      this.logger.error(`Failed to create invoice: ${error.message}`);
      throw error; // Re-throw to caller
    }
  }

  /**
   * Example 3: Use custom tolerance for specific scenarios
   * 
   * Some suppliers may have different tolerance agreements.
   */
  async createInvoiceWithCustomTolerance(
    poId: UUID,
    invoiceData: any,
    tolerancePercent: number = 0.10, // 10% tolerance
  ): Promise<void> {
    const matchingResult = await this.threeWayMatching.validate(
      {
        po_id: poId,
        invoice_lines: invoiceData.lines,
      },
      tolerancePercent,
    );

    if (!matchingResult.isValid) {
      throw new Error(
        `3-way matching failed with ${tolerancePercent * 100}% tolerance`,
      );
    }

    // TODO: Create invoice
  }

  /**
   * Example 4: Get matching report for review
   * 
   * Useful for displaying matching information to users before invoice creation.
   */
  async getMatchingReportForReview(poId: UUID): Promise<any> {
    const report = await this.threeWayMatching.getMatchingReport(poId);

    this.logger.log(`Matching Report for PO ${report.po.po_number}:`);
    this.logger.log(`- PO Amount: ${report.summary.total_po_amount}`);
    this.logger.log(`- GR Amount: ${report.summary.total_gr_amount}`);
    this.logger.log(`- Invoice Amount: ${report.summary.total_invoice_amount}`);
    this.logger.log(`- PO Qty: ${report.summary.total_po_qty}`);
    this.logger.log(`- GR Qty: ${report.summary.total_gr_qty}`);
    this.logger.log(`- Invoice Qty: ${report.summary.total_invoice_qty}`);

    return report;
  }

  /**
   * Example 5: Batch validation for multiple invoices
   * 
   * Validate multiple invoices at once and return results.
   */
  async validateMultipleInvoices(
    invoices: Array<{
      po_id: UUID;
      lines: Array<{ product_id: UUID; qty: number; unit_price: number }>;
    }>,
  ): Promise<
    Array<{
      po_id: UUID;
      isValid: boolean;
      violations: any[];
    }>
  > {
    const results = [];

    for (const invoice of invoices) {
      const result = await this.threeWayMatching.validate({
        po_id: invoice.po_id,
        invoice_lines: invoice.lines,
      });

      results.push({
        po_id: invoice.po_id,
        isValid: result.isValid,
        violations: result.violations,
      });
    }

    return results;
  }

  /**
   * Example 6: Partial invoice validation
   * 
   * Validate a partial invoice (not all PO lines included).
   */
  async createPartialInvoice(
    poId: UUID,
    partialLines: Array<{
      product_id: UUID;
      qty: number;
      unit_price: number;
    }>,
  ): Promise<void> {
    // 3-way matching will validate only the lines provided
    // It won't fail if some PO lines are missing from the invoice
    const matchingResult = await this.threeWayMatching.validate({
      po_id: poId,
      invoice_lines: partialLines,
    });

    if (!matchingResult.isValid) {
      throw new Error('Partial invoice validation failed');
    }

    this.logger.log(
      `Partial invoice validated: ${matchingResult.summary.lines_checked} of ${matchingResult.summary.lines_checked} lines matched`,
    );

    // TODO: Create partial invoice
  }
}

/**
 * Usage in InvoiceService:
 * 
 * @Injectable()
 * export class InvoiceService {
 *   constructor(
 *     private readonly threeWayMatching: ThreeWayMatchingService,
 *     private readonly prisma: PrismaService,
 *   ) {}
 * 
 *   async createPurchaseInvoice(data: CreatePurchaseInvoiceDTO): Promise<Invoice> {
 *     // If invoice references a PO, perform 3-way matching
 *     if (data.po_id) {
 *       await this.threeWayMatching.validateAndThrow({
 *         po_id: data.po_id,
 *         invoice_lines: data.lines,
 *       });
 *     }
 * 
 *     // Proceed with invoice creation
 *     const invoice = await this.prisma.invoice.create({
 *       data: {
 *         // ... invoice data
 *       },
 *     });
 * 
 *     return invoice;
 *   }
 * }
 */
