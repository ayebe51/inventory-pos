# 3-Way Matching Implementation

## Overview

The 3-way matching service validates that supplier invoice quantities and amounts match the Purchase Order (PO) and Goods Receipt (GR) within acceptable tolerance levels. This is a critical control in the procurement process to prevent overpayment and ensure accurate inventory valuation.

## Business Rules

### BR-PUR-003: Quantity Matching
Invoice quantities must match both PO and GR quantities within a configurable tolerance (default: 5%).

**Validation Rules:**
- Invoice qty ≤ PO qty × (1 + tolerance)
- Invoice qty ≤ GR qty × (1 + tolerance)

**Example with 5% tolerance:**
- PO qty: 100 units
- Max allowed invoice qty: 105 units (100 × 1.05)
- Invoice qty of 104 units: ✅ PASS
- Invoice qty of 110 units: ❌ FAIL

### BR-PUR-008: Amount Matching
Total invoice amount must not exceed PO amount by more than 5%.

**Validation Rule:**
- Total invoice amount ≤ PO total amount × 1.05

**Example:**
- PO amount: Rp 10,000,000
- Max allowed invoice amount: Rp 10,500,000
- Invoice amount of Rp 10,200,000: ✅ PASS
- Invoice amount of Rp 12,000,000: ❌ FAIL

## Service API

### `validate(input, tolerance?)`

Validates 3-way matching and returns detailed results.

**Parameters:**
- `input: ThreeWayMatchingInput` - PO ID and invoice lines
- `tolerance?: number` - Optional tolerance percentage (default: 0.05 for 5%)

**Returns:** `ThreeWayMatchingResult`
```typescript
{
  isValid: boolean;
  violations: ThreeWayMatchingViolation[];
  summary: ThreeWayMatchingSummary;
}
```

**Example:**
```typescript
const result = await threeWayMatching.validate({
  po_id: 'po-uuid',
  invoice_lines: [
    { product_id: 'prod-1', qty: 100, unit_price: 50000 },
    { product_id: 'prod-2', qty: 50, unit_price: 100000 },
  ],
});

if (!result.isValid) {
  console.log('Violations:', result.violations);
}
```

### `validateAndThrow(input, tolerance?)`

Validates and throws `BusinessRuleException` if validation fails.

**Parameters:**
- `input: ThreeWayMatchingInput` - PO ID and invoice lines
- `tolerance?: number` - Optional tolerance percentage

**Throws:** `BusinessRuleException` with detailed violation messages

**Example:**
```typescript
try {
  await threeWayMatching.validateAndThrow({
    po_id: 'po-uuid',
    invoice_lines: [...],
  });
  // Validation passed, proceed with invoice creation
} catch (error) {
  // Validation failed, handle error
  console.error(error.message);
}
```

### `getMatchingReport(poId)`

Returns comprehensive matching report for a PO.

**Parameters:**
- `poId: UUID` - Purchase Order ID

**Returns:** Detailed report with PO, GRs, invoices, and summary

**Example:**
```typescript
const report = await threeWayMatching.getMatchingReport('po-uuid');
console.log('PO Amount:', report.summary.total_po_amount);
console.log('GR Amount:', report.summary.total_gr_amount);
console.log('Invoice Amount:', report.summary.total_invoice_amount);
```

### `getTolerance()`

Returns current tolerance configuration.

**Returns:** `number` - Tolerance percentage (e.g., 0.05 for 5%)

## Integration with Invoice Service

### Recommended Integration Pattern

```typescript
@Injectable()
export class InvoiceService {
  constructor(
    private readonly threeWayMatching: ThreeWayMatchingService,
    private readonly prisma: PrismaService,
  ) {}

  async createPurchaseInvoice(
    data: CreatePurchaseInvoiceDTO,
    userId: UUID,
  ): Promise<Invoice> {
    // Step 1: Validate 3-way matching if PO is referenced
    if (data.po_id) {
      await this.threeWayMatching.validateAndThrow({
        po_id: data.po_id,
        invoice_lines: data.lines,
      });
    }

    // Step 2: Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoice_type: 'PURCHASE',
        supplier_id: data.supplier_id,
        branch_id: data.branch_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        reference_type: 'PO',
        reference_id: data.po_id,
        status: 'DRAFT',
        created_by: userId,
        // ... other fields
      },
    });

    // Step 3: Create invoice lines
    // ...

    return invoice;
  }
}
```

## Violation Types

### QTY_MISMATCH
Invoice quantity exceeds PO or GR quantity beyond tolerance.

**Example Violation:**
```typescript
{
  product_id: 'prod-uuid',
  product_code: 'PROD-001',
  product_name: 'Product 1',
  po_qty: 100,
  gr_qty: 100,
  invoice_qty: 110,
  violation_type: 'QTY_MISMATCH',
  message: 'BR-PUR-003: Invoice qty (110) exceeds PO qty (100) by more than 5%. Max allowed: 105.0000'
}
```

### AMOUNT_MISMATCH
Total invoice amount exceeds PO amount by more than 5%.

**Example Violation:**
```typescript
{
  product_id: '',
  product_code: 'TOTAL',
  product_name: 'Total Amount',
  po_qty: 0,
  gr_qty: 0,
  invoice_qty: 0,
  violation_type: 'AMOUNT_MISMATCH',
  message: 'BR-PUR-008: Total invoice amount (12000000.00) exceeds PO amount (10000000.00) by more than 5%. Max allowed: 10500000.00'
}
```

## Matching Summary

The service returns a summary with key metrics:

```typescript
{
  po_id: 'po-uuid',
  po_number: 'PO-202501-00001',
  total_po_amount: 10000000,
  total_gr_amount: 10000000,
  total_invoice_amount: 10000000,
  lines_checked: 2,
  lines_matched: 2,
  lines_violated: 0,
}
```

## Handling Multiple Goods Receipts

The service automatically aggregates quantities from multiple GRs for the same PO.

**Example:**
- PO qty: 100 units
- GR-001: 60 units received
- GR-002: 40 units received
- Total GR qty: 100 units
- Invoice qty: 100 units ✅ PASS

## Custom Tolerance

You can specify custom tolerance for specific scenarios:

```typescript
// Use 10% tolerance instead of default 5%
const result = await threeWayMatching.validate(input, 0.10);
```

**Use Cases for Custom Tolerance:**
- Suppliers with special agreements
- Bulk commodities with measurement variance
- Perishable goods with expected shrinkage

## Partial Invoices

The service supports partial invoicing - you don't need to invoice all PO lines at once.

**Example:**
- PO has 3 products
- Invoice only includes 2 products
- Validation checks only the 2 products in the invoice ✅

## Error Handling

### PO Not Found
```typescript
BusinessRuleException: Purchase Order {id} not found
ErrorCode: NOT_FOUND
```

### Product Not in PO
```typescript
Violation: Product {id} not found in PO {po_number}
```

### Validation Failed
```typescript
BusinessRuleException: 3-way matching validation failed for PO {po_number}:
BR-PUR-003: Invoice qty (110) exceeds PO qty (100) by more than 5%...
ErrorCode: BUSINESS_RULE_VIOLATION
```

## Testing

Comprehensive unit tests are provided in `three-way-matching.service.spec.ts`:

- ✅ Exact quantity matching
- ✅ Within tolerance matching
- ✅ Exceeds PO qty tolerance
- ✅ Exceeds GR qty tolerance
- ✅ Exceeds amount tolerance (BR-PUR-008)
- ✅ Product not in PO
- ✅ PO not found
- ✅ Multiple GRs aggregation
- ✅ Custom tolerance
- ✅ Summary information
- ✅ validateAndThrow behavior
- ✅ Matching report generation

Run tests:
```bash
npm test -- three-way-matching.service.spec.ts
```

## Configuration

Default tolerance is configured in the service:

```typescript
const THREE_WAY_MATCHING_TOLERANCE = 0.05; // 5%
```

To change the default, update this constant in `three-way-matching.service.ts`.

## Performance Considerations

- The service performs database queries to fetch PO, GRs, and invoices
- For high-volume scenarios, consider caching PO and GR data
- Validation is performed synchronously before invoice creation
- Typical validation time: < 100ms for standard POs

## Audit Trail

All 3-way matching validations are logged:

- ✅ Validation passed: INFO level
- ❌ Validation failed: WARN level with violation details

Example log:
```
[ThreeWayMatchingService] 3-way matching validation passed for PO PO-202501-00001. All 2 line(s) matched.
```

## Future Enhancements

Potential improvements for future iterations:

1. **Configurable tolerance per supplier** - Different suppliers may have different agreements
2. **Tolerance per product category** - Bulk commodities vs. precision parts
3. **Automatic dispute creation** - Flag invoices for review instead of rejecting
4. **Historical matching reports** - Track matching success rates over time
5. **Price variance analysis** - Compare invoice prices to PO prices
6. **Batch validation** - Validate multiple invoices at once

## Related Documentation

- [Purchase Module README](../README.md)
- [Goods Receipt Service](./GOODS_RECEIPT.md)
- [Invoice Service](../../invoicing/docs/INVOICE.md)
- [Business Rules Reference](../../../../docs/BUSINESS_RULES.md)
