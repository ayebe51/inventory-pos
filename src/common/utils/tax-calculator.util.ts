/**
 * Centralized Tax Engine Utility (BR-TAX-001)
 *
 * Enforces unified tax calculation, discount processing, and desimal rounding (2 decimal places)
 * across POS, Invoicing, Procurement, and Financial Posting modules.
 */
export class TaxCalculator {
  /**
   * Calculate line item tax and total
   */
  static calculateLineItem({
    qty,
    unitPrice,
    discountPct = 0,
    discountAmount = 0,
    taxPct = 0,
  }: {
    qty: number;
    unitPrice: number;
    discountPct?: number;
    discountAmount?: number;
    taxPct?: number;
  }) {
    const rawSubtotal = qty * unitPrice;

    // Calculate discount
    let calcDiscount = 0;
    if (discountPct > 0) {
      calcDiscount = (rawSubtotal * discountPct) / 100;
    } else if (discountAmount > 0) {
      calcDiscount = discountAmount;
    }
    calcDiscount = Math.min(rawSubtotal, calcDiscount);

    const discountedSubtotal = rawSubtotal - calcDiscount;

    // Calculate tax
    const taxAmount = taxPct > 0 ? (discountedSubtotal * taxPct) / 100 : 0;
    const lineTotal = discountedSubtotal + taxAmount;

    return {
      rawSubtotal: this.roundCurrency(rawSubtotal),
      discountAmount: this.roundCurrency(calcDiscount),
      discountedSubtotal: this.roundCurrency(discountedSubtotal),
      taxAmount: this.roundCurrency(taxAmount),
      lineTotal: this.roundCurrency(lineTotal),
    };
  }

  /**
   * Calculate document summary totals from line items
   */
  static calculateDocumentTotals(
    lines: {
      subtotal?: number;
      discountedSubtotal?: number;
      discountAmount?: number;
      taxAmount?: number;
      lineTotal?: number;
    }[],
    additionalCost: number = 0,
  ) {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    for (const line of lines) {
      discountAmount += line.discountAmount ?? 0;
      taxAmount += line.taxAmount ?? 0;
      subtotal += line.lineTotal ?? 0;
    }

    const totalAmount = subtotal + additionalCost;

    return {
      subtotal: this.roundCurrency(subtotal),
      discountAmount: this.roundCurrency(discountAmount),
      taxAmount: this.roundCurrency(taxAmount),
      additionalCost: this.roundCurrency(additionalCost),
      totalAmount: this.roundCurrency(totalAmount),
    };
  }

  /**
   * Enforce 2 decimal places precision for currency (IDR / USD)
   */
  static roundCurrency(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }
}
