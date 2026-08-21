# Purchase Module API Endpoints

## Overview

REST API endpoints for Purchase Request (PR), Purchase Order (PO), and Goods Receipt (GR) management with RBAC permission enforcement.

**Base URL**: `/api/v1`

**Authentication**: All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

**RBAC**: Each endpoint enforces specific permissions via the `@RequirePermissions` decorator.

---

## Purchase Request Endpoints

### 1. Create Purchase Request

**POST** `/purchase-requests`

**Permission**: `PURCHASE.CREATE`

**Request Body**:
```json
{
  "branch_id": "uuid",
  "warehouse_id": "uuid",
  "notes": "Optional notes",
  "lines": [
    {
      "product_id": "uuid",
      "qty_requested": 100,
      "uom_id": "uuid",
      "estimated_price": 50000,
      "notes": "Optional line notes"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "pr_number": "PR-202501-00001",
    "branch_id": "uuid",
    "warehouse_id": "uuid",
    "status": "DRAFT",
    "requested_by": "uuid",
    "notes": "Optional notes",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z",
    "deleted_at": null,
    "lines": [...]
  },
  "message": "Purchase Request created successfully"
}
```

---

### 2. Search Purchase Requests

**GET** `/purchase-requests`

**Permission**: `PURCHASE.READ`

**Query Parameters**:
- `pr_number` (optional): Filter by PR number
- `branch_id` (optional): Filter by branch
- `warehouse_id` (optional): Filter by warehouse
- `status` (optional): Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED)
- `requested_by` (optional): Filter by user
- `date_from` (optional): Filter by date range start
- `date_to` (optional): Filter by date range end
- `page` (optional, default: 1): Page number
- `per_page` (optional, default: 20): Items per page

**Response**:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

### 3. Get Purchase Request by ID

**GET** `/purchase-requests/:id`

**Permission**: `PURCHASE.READ`

**Response**: Same as Create PR response

---

### 4. Update Purchase Request

**PUT** `/purchase-requests/:id`

**Permission**: `PURCHASE.UPDATE`

**Note**: Only DRAFT PRs can be updated.

**Request Body**: Same as Create PR (all fields optional)

---

### 5. Submit Purchase Request for Approval

**PUT** `/purchase-requests/:id/submit`

**Permission**: `PURCHASE.CREATE`

**Status Transition**: DRAFT → SUBMITTED

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "SUBMITTED",
    ...
  },
  "message": "Purchase Request submitted for approval"
}
```

---

### 6. Approve Purchase Request

**PUT** `/purchase-requests/:id/approve`

**Permission**: `PURCHASE.APPROVE`

**Status Transition**: SUBMITTED → APPROVED

**Request Body**:
```json
{
  "notes": "Approved for procurement"
}
```

---

### 7. Reject Purchase Request

**PUT** `/purchase-requests/:id/reject`

**Permission**: `PURCHASE.APPROVE`

**Status Transition**: SUBMITTED → REJECTED

**Request Body**:
```json
{
  "reason": "Insufficient budget"
}
```

---

### 8. Cancel Purchase Request

**PUT** `/purchase-requests/:id/cancel`

**Permission**: `PURCHASE.DELETE`

**Status Transition**: DRAFT/SUBMITTED → CANCELLED

**Request Body**:
```json
{
  "reason": "No longer needed"
}
```

---

### 9. Delete Purchase Request

**DELETE** `/purchase-requests/:id`

**Permission**: `PURCHASE.DELETE`

**Note**: Only DRAFT PRs can be deleted (soft delete).

**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Purchase Request deleted successfully"
}
```

---

## Purchase Order Endpoints

### 1. Create Purchase Order

**POST** `/purchase-orders`

**Permission**: `PURCHASE.CREATE`

**Request Body**:
```json
{
  "pr_id": "uuid (optional)",
  "supplier_id": "uuid",
  "branch_id": "uuid",
  "warehouse_id": "uuid",
  "order_date": "2025-01-15",
  "expected_delivery_date": "2025-01-20",
  "currency": "IDR",
  "exchange_rate": 1,
  "additional_cost": 0,
  "notes": "Optional notes",
  "lines": [
    {
      "product_id": "uuid",
      "qty_ordered": 100,
      "uom_id": "uuid",
      "unit_price": 50000,
      "discount_pct": 0,
      "tax_pct": 11,
      "description": "Optional description"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "po_number": "PO-202501-00001",
    "status": "DRAFT",
    "subtotal": 5000000,
    "tax_amount": 550000,
    "total_amount": 5550000,
    "approval_level": 2,
    ...
  },
  "message": "Purchase Order created successfully"
}
```

---

### 2. Get Purchase Order by ID

**GET** `/purchase-orders/:id`

**Permission**: `PURCHASE.READ`

---

### 3. Submit Purchase Order for Approval

**PUT** `/purchase-orders/:id/submit`

**Permission**: `PURCHASE.CREATE`

**Status Transition**: DRAFT → PENDING_APPROVAL

**Approval Level Determination**:
- Level 1 (< Rp 5,000,000): Supervisor
- Level 2 (Rp 5,000,000 - Rp 50,000,000): Finance Manager
- Level 3 (> Rp 50,000,000): Owner/Director

---

### 4. Approve Purchase Order

**PUT** `/purchase-orders/:id/approve`

**Permission**: `PURCHASE.APPROVE`

**Status Transition**: PENDING_APPROVAL → APPROVED

**SOD Enforcement**: SOD-001 - Approver cannot be the same as creator

**Request Body**:
```json
{
  "notes": "Approved"
}
```

---

### 5. Reject Purchase Order

**PUT** `/purchase-orders/:id/reject`

**Permission**: `PURCHASE.APPROVE`

**Status Transition**: PENDING_APPROVAL → REJECTED

**Request Body**:
```json
{
  "reason": "Price too high"
}
```

---

### 6. Revise Purchase Order

**PUT** `/purchase-orders/:id/revise`

**Permission**: `PURCHASE.UPDATE`

**Status Transition**: REJECTED → DRAFT

---

### 7. Cancel Purchase Order

**PUT** `/purchase-orders/:id/cancel`

**Permission**: `PURCHASE.DELETE`

**Status Transition**: APPROVED → CANCELLED

**Note**: Cannot cancel if GR already confirmed

**Request Body**:
```json
{
  "reason": "Supplier unavailable"
}
```

---

### 8. Close Purchase Order

**PUT** `/purchase-orders/:id/close`

**Permission**: `PURCHASE.UPDATE`

**Status Transition**: FULLY_RECEIVED → CLOSED

---

### 9. Create Goods Receipt from PO

**POST** `/purchase-orders/:id/goods-receipts`

**Permission**: `INVENTORY.CREATE`

**Request Body**:
```json
{
  "receipt_date": "2025-01-20",
  "notes": "Optional notes",
  "lines": [
    {
      "po_line_id": "uuid",
      "product_id": "uuid",
      "qty_received": 100,
      "uom_id": "uuid",
      "unit_cost": 50000,
      "batch_number": "BATCH001",
      "serial_number": "SN001",
      "notes": "Optional line notes"
    }
  ]
}
```

**Validation**: BR-PUR-003 - qty_received cannot exceed qty_ordered × (1 + tolerance)

---

## Goods Receipt Endpoints

### 1. Create Goods Receipt

**POST** `/goods-receipts`

**Permission**: `INVENTORY.CREATE`

**Request Body**: Same as "Create Goods Receipt from PO" above, with additional `po_id` field

---

### 2. Search Goods Receipts

**GET** `/goods-receipts`

**Permission**: `INVENTORY.READ`

**Query Parameters**:
- `gr_number` (optional): Filter by GR number
- `po_id` (optional): Filter by PO
- `supplier_id` (optional): Filter by supplier
- `warehouse_id` (optional): Filter by warehouse
- `status` (optional): Filter by status (DRAFT, CONFIRMED)
- `date_from` (optional): Filter by date range start
- `date_to` (optional): Filter by date range end
- `page` (optional, default: 1): Page number
- `per_page` (optional, default: 20): Items per page

---

### 3. Get Goods Receipt by ID

**GET** `/goods-receipts/:id`

**Permission**: `INVENTORY.READ`

---

### 4. Confirm Goods Receipt

**PUT** `/goods-receipts/:id/confirm`

**Permission**: `INVENTORY.UPDATE`

**Status Transition**: DRAFT → CONFIRMED

**Operations Performed** (Task 9.6):
1. Update `qty_received` on PO lines
2. Update PO status (PARTIALLY_RECEIVED or FULLY_RECEIVED)
3. Record inventory ledger entry (append-only)
4. Recalculate Weighted Average Cost (WAC)
5. Create auto journal entry (Debit Inventory, Credit GR Clearing)
6. All operations are atomic (single DB transaction)

**Validations**:
- BR-INV-005: Warehouse must not be locked
- BR-ACC-002: Fiscal period must be OPEN
- BR-INV-003: Average cost must be >= 0

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "gr_number": "GR-202501-00001",
    "status": "CONFIRMED",
    "confirmed_by": "uuid",
    "confirmed_at": "2025-01-20T14:30:00Z",
    ...
  },
  "message": "Goods Receipt confirmed successfully"
}
```

---

### 5. Get Goods Receipts by Purchase Order

**GET** `/goods-receipts/by-po/:poId`

**Permission**: `INVENTORY.READ`

**Response**: Array of goods receipts for the specified PO

---

### 6. Cancel Goods Receipt

**PUT** `/goods-receipts/:id/cancel`

**Permission**: `INVENTORY.DELETE`

**Note**: Only DRAFT GRs can be cancelled

**Request Body**:
```json
{
  "reason": "Wrong items received"
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": ["validation error"]
    }
  }
}
```

### Common Error Codes

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 422 | `VALIDATION_ERROR` | Input validation failed |
| 422 | `BUSINESS_RULE_VIOLATION` | Business rule violated (e.g., BR-PUR-003) |
| 422 | `PERIOD_LOCKED` | Fiscal period is closed |
| 422 | `INSUFFICIENT_STOCK` | Not enough stock |
| 409 | `CONFLICT` | Data conflict |
| 500 | `INTERNAL_ERROR` | Server error |

---

## RBAC Permission Matrix

| Endpoint | Permission | Personas with Access |
|----------|------------|---------------------|
| Create PR/PO | `PURCHASE.CREATE` | Purchasing_Staff, Finance_Staff |
| Read PR/PO/GR | `PURCHASE.READ`, `INVENTORY.READ` | All users with purchase/inventory access |
| Update PR/PO | `PURCHASE.UPDATE` | Purchasing_Staff, Finance_Staff |
| Approve PR/PO | `PURCHASE.APPROVE` | Supervisor (Level 1), Finance_Manager (Level 2), Owner (Level 3) |
| Delete/Cancel PR/PO | `PURCHASE.DELETE` | Finance_Manager, Owner |
| Create GR | `INVENTORY.CREATE` | Warehouse_Staff, Warehouse_Manager |
| Confirm GR | `INVENTORY.UPDATE` | Warehouse_Manager |
| Cancel GR | `INVENTORY.DELETE` | Warehouse_Manager |

---

## Business Rules Reference

### Purchase Module (BR-PUR)

- **BR-PUR-003**: 3-way matching - PO qty, GR qty, and Invoice qty must match within tolerance
- **BR-PUR-007**: Approval threshold based on total amount including tax
- **BR-PUR-008**: Supplier invoice cannot exceed PO amount + 5%

### Inventory Module (BR-INV)

- **BR-INV-001**: Stock cannot be negative (unless backorder enabled)
- **BR-INV-002**: Inventory ledger is append-only (no UPDATE/DELETE)
- **BR-INV-003**: Average cost must be >= 0
- **BR-INV-005**: Locked warehouse cannot receive/issue stock
- **BR-INV-008**: In-transit stock cannot be sold

### Accounting Module (BR-ACC)

- **BR-ACC-001**: Journal entry must balance (tolerance <= Rp 0.01)
- **BR-ACC-002**: No transactions in closed fiscal period

### Separation of Duties (SOD)

- **SOD-001**: PO creator cannot be PO approver
- **SOD-002**: Payment creator cannot be payment approver
- **SOD-003**: Cashier cannot void their own transactions

---

## Integration Notes

### Auto Journal on GR Confirmation

When a Goods Receipt is confirmed, the system automatically creates a journal entry:

**Debit**: Persediaan Barang (Inventory Asset)  
**Credit**: GR Clearing (Hutang Dagang)

**Amount**: Sum of (qty_received × unit_cost) for all lines

### WAC Calculation

Weighted Average Cost is recalculated on GR confirmation using:

```
WAC_new = (current_value + incoming_cost) / (current_qty + incoming_qty)
```

Where:
- `current_value` = current stock qty × current WAC
- `incoming_cost` = qty_received × unit_cost
- `current_qty` = current stock balance
- `incoming_qty` = qty_received

### Inventory Ledger

All stock movements are recorded in the `inventory_ledger` table with:
- `transaction_type`: GR
- `reference_type`: GR
- `reference_id`: Goods Receipt ID
- `reference_number`: GR number
- `qty_in`: qty_received
- `qty_out`: 0
- `unit_cost`: New WAC
- `running_qty`: New stock balance
- `running_cost`: New total stock value

**Important**: Ledger entries are append-only and cannot be updated or deleted (BR-INV-002).

---

## Testing

Run controller tests:

```bash
npm test -- src/modules/purchase/controllers/purchase-controllers.spec.ts --runInBand
```

All endpoints are tested with:
- RBAC permission enforcement
- Request/response validation
- Service method invocation
- Error handling

---

## Implementation Status

✅ Task 9.9: REST API endpoints untuk PR, PO, GR dengan RBAC guard - **COMPLETED**

All endpoints implemented with:
- JWT authentication via `JwtAuthGuard`
- RBAC permission enforcement via `RbacGuard` and `@RequirePermissions` decorator
- Standard API response envelope
- Comprehensive error handling
- Full test coverage
