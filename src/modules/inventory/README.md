# Inventory Module

## Overview

The Inventory Module manages stock movements across multiple warehouses using an **append-only ledger** pattern. This ensures complete audit trail and data integrity for all inventory transactions.

## Key Features

- **Append-Only Ledger**: All inventory movements are recorded as immutable entries (BR-INV-002)
- **Running Balance Calculation**: Real-time stock balance computed from ledger entries
- **Weighted Average Cost (WAC)**: Automatic cost calculation for inventory valuation
- **Multi-Warehouse Support**: Track stock across multiple warehouse locations
- **Transaction Types**: Support for GR, SO, TRANSFER, ADJUSTMENT, OPNAME, RETURN

## Business Rules

### BR-INV-002: Append-Only Ledger
- Inventory ledger entries can only be **created**, never updated or deleted
- All stock movements are recorded as new entries with running balance
- Ensures complete audit trail and data integrity

### BR-INV-003: Non-Negative Average Cost
- Average cost must always be >= 0
- Running cost is protected from becoming negative

## Architecture

### InventoryService

The main service for recording and querying inventory movements.

#### Key Methods

##### `recordMovement(data: StockMovementDTO): Promise<InventoryLedgerEntry>`

Records a new inventory movement with append-only insert.

**Validations:**
- `qty_in` and `qty_out` must be >= 0
- Either `qty_in` or `qty_out` must be > 0, but not both
- `unit_cost` must be >= 0
- `movement_date` cannot be in the future

**Process:**
1. Validate input data
2. Calculate running balance from latest ledger entry
3. Insert new ledger entry (append-only)
4. Return created entry

**Example:**
```typescript
const movement: StockMovementDTO = {
  product_id: 'uuid-product',
  warehouse_id: 'uuid-warehouse',
  transaction_type: 'GR',
  reference_type: 'PO',
  reference_id: 'uuid-po',
  reference_number: 'PO-202501-00001',
  movement_date: new Date(),
  qty_in: 100,
  qty_out: 0,
  unit_cost: 10000,
  notes: 'Goods receipt from supplier',
  created_by: 'uuid-user',
};

const entry = await inventoryService.recordMovement(movement);
```

##### `getStockBalance(productId: UUID, warehouseId: UUID): Promise<StockBalance>`

Get current stock balance for a product in a warehouse.

**Status:** To be implemented in Task 10.2

##### `calculateAverageCost(productId: UUID, warehouseId: UUID): Promise<number>`

Calculate weighted average cost for a product in a warehouse.

**Status:** To be implemented in Task 10.4

##### `transferStock(data: StockTransferDTO): Promise<StockTransfer>`

Transfer stock between warehouses atomically.

**Status:** To be implemented in Task 10.5

##### `adjustStock(data: StockAdjustmentDTO, userId: UUID): Promise<StockAdjustment>`

Adjust stock with reason (requires STOCK.ADJUST permission).

**Status:** To be implemented in Task 10.6

##### `lockWarehouse(warehouseId: UUID, reason: string): Promise<void>`

Lock warehouse (e.g., during stock opname).

**Status:** To be implemented in Task 10.7

## Data Model

### InventoryLedger

```typescript
interface InventoryLedgerEntry {
  id: UUID;
  product_id: UUID;
  warehouse_id: UUID;
  transaction_type: InventoryTransactionType;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  movement_date: Date;
  qty_in: number;              // Quantity received
  qty_out: number;             // Quantity issued
  unit_cost: number;           // Cost per unit
  total_cost: number;          // qty_in * unit_cost
  running_qty: number;         // Balance after this movement
  running_cost: number;        // Total value after this movement
  batch_number: string | null;
  serial_number: string | null;
  notes: string | null;
  created_by: UUID;
  created_at: Date;
  // NO updated_at or deleted_at - append-only!
}
```

### Transaction Types

| Type | Description |
|------|-------------|
| GR | Goods Receipt from supplier |
| SO | Sales Order / POS transaction |
| TRANSFER_IN | Stock transfer in |
| TRANSFER_OUT | Stock transfer out |
| ADJUSTMENT | Stock adjustment |
| OPNAME | Stock opname/physical count |
| RETURN_IN | Sales return |
| RETURN_OUT | Purchase return |

## Running Balance Calculation

The running balance is calculated from the latest ledger entry:

```typescript
currentQty = latestEntry?.running_qty || 0
currentValue = latestEntry?.running_cost || 0

newQty = currentQty + qty_in - qty_out
incomingValue = qty_in * unit_cost
outgoingValue = qty_out * (currentQty > 0 ? currentValue / currentQty : 0)
newValue = currentValue + incomingValue - outgoingValue

averageCost = newQty > 0 ? newValue / newQty : 0
```

## Testing

### Unit Tests

Run inventory service tests:
```bash
npm test -- src/modules/inventory/services/inventory.service.spec.ts
```

### Test Coverage

- ✅ Append-only insert (BR-INV-002)
- ✅ Stock-in movement recording
- ✅ Stock-out movement recording
- ✅ First movement with zero balance
- ✅ Running balance calculation
- ✅ Input validation (negative quantities, future dates)
- ✅ Non-negative cost enforcement (BR-INV-003)
- ✅ Multiple transaction types
- ✅ Sequential movements

## Integration

### Module Registration

```typescript
import { InventoryModule } from './modules/inventory';

@Module({
  imports: [InventoryModule],
})
export class AppModule {}
```

### Service Injection

```typescript
import { InventoryService } from './modules/inventory';

@Injectable()
export class GoodsReceiptService {
  constructor(private readonly inventoryService: InventoryService) {}

  async confirmReceipt(grId: UUID) {
    // Record inventory movement
    await this.inventoryService.recordMovement({
      product_id: productId,
      warehouse_id: warehouseId,
      transaction_type: 'GR',
      reference_type: 'GR',
      reference_id: grId,
      reference_number: grNumber,
      movement_date: new Date(),
      qty_in: qtyReceived,
      qty_out: 0,
      unit_cost: unitCost,
      created_by: userId,
    });
  }
}
```

## Future Enhancements

- [ ] Batch number tracking
- [ ] Serial number tracking
- [ ] Stock reservation system
- [ ] Stock status management (Available, Reserved, Damaged, etc.)
- [ ] Warehouse locking during opname
- [ ] Negative stock prevention (BR-INV-001)

## Related Modules

- **Purchase Module**: Creates GR movements
- **POS Module**: Creates SO movements
- **Accounting Module**: Auto journal for stock movements
- **Reporting Module**: Stock position and movement reports

## References

- Design Document: `.kiro/specs/enterprise-inventory-pos-finance/design.md`
- Requirements: `.kiro/specs/enterprise-inventory-pos-finance/requirements.md`
- Tasks: `.kiro/specs/enterprise-inventory-pos-finance/tasks.md`
