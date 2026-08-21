# Purchase Module

## Overview

The Purchase Module manages the complete procurement cycle from Purchase Request (PR) through Purchase Order (PO) to Goods Receipt (GR), with integrated RBAC permission enforcement, approval workflows, and automatic accounting journal entries.

## Features

### Purchase Request (PR)
- Create, update, and manage purchase requests
- Submit for approval workflow
- Approve/reject with permission validation
- Status tracking: DRAFT → SUBMITTED → APPROVED/REJECTED → CANCELLED

### Purchase Order (PO)
- Create POs from PRs or standalone
- Multi-level approval matrix based on amount thresholds
- State machine: DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED/FULLY_RECEIVED → CLOSED
- SOD-001 enforcement: Creator cannot approve their own PO
- 3-way matching validation (BR-PUR-003)

### Goods Receipt (GR)
- Create GRs from approved POs
- Validate quantities against PO with tolerance (BR-PUR-003)
- Confirm GR with automatic:
  - PO line qty_received updates
  - PO status updates
  - Inventory ledger entries (append-only)
  - WAC recalculation
  - Auto journal entries (Debit Inventory, Credit GR Clearing)
- All operations atomic (single DB transaction)

## Architecture

```
Controllers (REST API)
    ↓
Services (Business Logic)
    ↓
Domain Services (Shared)
    ├── AuditService (immutable audit trail)
    ├── NumberingService (document numbering)
    ├── JournalEngine (auto double-entry)
    └── PeriodManager (fiscal period validation)
    ↓
Prisma (Database)
```

## File Structure

```
src/modules/purchase/
├── controllers/
│   ├── purchase-request.controller.ts    # PR REST API endpoints
│   ├── purchase-order.controller.ts      # PO REST API endpoints
│   ├── goods-receipt.controller.ts       # GR REST API endpoints
│   ├── purchase-controllers.spec.ts      # Controller tests
│   └── index.ts
├── services/
│   ├── purchase-request.service.ts       # PR business logic
│   ├── purchase-order.service.ts         # PO business logic
│   ├── goods-receipt.service.ts          # GR business logic
│   └── three-way-matching.service.ts     # 3-way matching validation
├── dto/
│   ├── purchase-request.dto.ts           # PR DTOs with Zod schemas
│   ├── purchase-order.dto.ts             # PO DTOs with Zod schemas
│   └── goods-receipt.dto.ts              # GR DTOs
├── interfaces/
│   └── purchase.interfaces.ts            # TypeScript interfaces
├── purchase.module.ts                    # NestJS module configuration
└── README.md                             # This file
```

## API Endpoints

### Purchase Request
- `POST /api/v1/purchase-requests` - Create PR (PURCHASE.CREATE)
- `GET /api/v1/purchase-requests` - Search PRs (PURCHASE.READ)
- `GET /api/v1/purchase-requests/:id` - Get PR by ID (PURCHASE.READ)
- `PUT /api/v1/purchase-requests/:id` - Update PR (PURCHASE.UPDATE)
- `PUT /api/v1/purchase-requests/:id/submit` - Submit for approval (PURCHASE.CREATE)
- `PUT /api/v1/purchase-requests/:id/approve` - Approve PR (PURCHASE.APPROVE)
- `PUT /api/v1/purchase-requests/:id/reject` - Reject PR (PURCHASE.APPROVE)
- `PUT /api/v1/purchase-requests/:id/cancel` - Cancel PR (PURCHASE.DELETE)
- `DELETE /api/v1/purchase-requests/:id` - Delete PR (PURCHASE.DELETE)

### Purchase Order
- `POST /api/v1/purchase-orders` - Create PO (PURCHASE.CREATE)
- `GET /api/v1/purchase-orders/:id` - Get PO by ID (PURCHASE.READ)
- `PUT /api/v1/purchase-orders/:id/submit` - Submit for approval (PURCHASE.CREATE)
- `PUT /api/v1/purchase-orders/:id/approve` - Approve PO (PURCHASE.APPROVE)
- `PUT /api/v1/purchase-orders/:id/reject` - Reject PO (PURCHASE.APPROVE)
- `PUT /api/v1/purchase-orders/:id/revise` - Revise rejected PO (PURCHASE.UPDATE)
- `PUT /api/v1/purchase-orders/:id/cancel` - Cancel PO (PURCHASE.DELETE)
- `PUT /api/v1/purchase-orders/:id/close` - Close PO (PURCHASE.UPDATE)
- `POST /api/v1/purchase-orders/:id/goods-receipts` - Create GR from PO (INVENTORY.CREATE)

### Goods Receipt
- `POST /api/v1/goods-receipts` - Create GR (INVENTORY.CREATE)
- `GET /api/v1/goods-receipts` - Search GRs (INVENTORY.READ)
- `GET /api/v1/goods-receipts/:id` - Get GR by ID (INVENTORY.READ)
- `PUT /api/v1/goods-receipts/:id/confirm` - Confirm GR (INVENTORY.UPDATE)
- `GET /api/v1/goods-receipts/by-po/:poId` - Get GRs by PO (INVENTORY.READ)
- `PUT /api/v1/goods-receipts/:id/cancel` - Cancel GR (INVENTORY.DELETE)

See [docs/api/purchase-endpoints.md](../../../docs/api/purchase-endpoints.md) for detailed API documentation.

## RBAC Permissions

All endpoints are protected by JWT authentication and RBAC permission checks:

| Permission | Description | Personas |
|------------|-------------|----------|
| `PURCHASE.CREATE` | Create and submit PRs/POs | Purchasing_Staff, Finance_Staff |
| `PURCHASE.READ` | View PRs/POs | All purchase users |
| `PURCHASE.UPDATE` | Update PRs/POs | Purchasing_Staff, Finance_Staff |
| `PURCHASE.APPROVE` | Approve PRs/POs | Supervisor, Finance_Manager, Owner |
| `PURCHASE.DELETE` | Cancel/delete PRs/POs | Finance_Manager, Owner |
| `INVENTORY.CREATE` | Create GRs | Warehouse_Staff, Warehouse_Manager |
| `INVENTORY.READ` | View GRs | All inventory users |
| `INVENTORY.UPDATE` | Confirm GRs | Warehouse_Manager |
| `INVENTORY.DELETE` | Cancel GRs | Warehouse_Manager |

## Approval Matrix

Purchase Orders require approval based on total amount (including tax):

| Level | Threshold | Approver | Permission |
|-------|-----------|----------|------------|
| 1 | < Rp 5,000,000 | Supervisor | PURCHASE.APPROVE |
| 2 | Rp 5,000,000 - Rp 50,000,000 | Finance Manager | PURCHASE.APPROVE |
| 3 | > Rp 50,000,000 | Owner/Director | PURCHASE.APPROVE |

## Business Rules

### BR-PUR-003: Over-Receipt Validation
Goods Receipt quantity cannot exceed Purchase Order quantity × (1 + tolerance).

Default tolerance: 5% (configurable)

```typescript
max_allowed_qty = qty_ordered × 1.05
```

### BR-PUR-007: Approval Threshold
Approval level is determined by total PO amount including tax.

### BR-PUR-008: Invoice Amount Validation
Supplier invoice cannot exceed PO amount + 5%.

### SOD-001: Separation of Duties
PO creator cannot be the approver of the same PO.

## Integration Points

### Inventory Module
- Records inventory ledger entries on GR confirmation (append-only)
- Calculates Weighted Average Cost (WAC)
- Updates stock balances

### Accounting Module
- Auto-generates journal entries on GR confirmation
- Validates fiscal period is OPEN (BR-ACC-002)
- Ensures journal balance (BR-ACC-001)

### Audit Module
- Records all CREATE, UPDATE, DELETE, APPROVE operations
- Immutable audit trail with before/after snapshots

### Numbering Service
- Generates unique document numbers:
  - PR: `PR-YYYYMM-XXXXX`
  - PO: `PO-YYYYMM-XXXXX`
  - GR: `GR-YYYYMM-XXXXX`

## Testing

Run all purchase module tests:

```bash
npm test -- src/modules/purchase --runInBand
```

Run controller tests only:

```bash
npm test -- src/modules/purchase/controllers/purchase-controllers.spec.ts --runInBand
```

Run service tests:

```bash
npm test -- src/modules/purchase/services --runInBand
```

## Development

### Adding New Endpoints

1. Add method to service interface in `interfaces/purchase.interfaces.ts`
2. Implement method in service class
3. Add controller method with `@RequirePermissions` decorator
4. Add DTO validation schema if needed
5. Write tests in `controllers/purchase-controllers.spec.ts`
6. Update API documentation in `docs/api/purchase-endpoints.md`

### Example Controller Method

```typescript
@Put(':id/custom-action')
@RequirePermissions('PURCHASE.CUSTOM')
@HttpCode(HttpStatus.OK)
async customAction(
  @Param('id') id: UUID,
  @Body() body: CustomDTO,
  @Request() req: AuthRequest,
): Promise<APIResponse<PurchaseOrder>> {
  const userId = req.user.sub as UUID;
  const result = await this.poService.customAction(id, body, userId);
  return successResponse(result, 'Custom action completed');
}
```

## Dependencies

- **NestJS**: Web framework
- **Prisma**: ORM for database access
- **Zod**: Runtime type validation
- **JWT**: Authentication
- **fast-check**: Property-based testing

## Related Modules

- **Master Data Module**: Products, Suppliers, Warehouses, UOMs
- **Inventory Module**: Stock management, ledger, WAC calculation
- **Accounting Module**: Journal entries, fiscal periods
- **Governance Module**: RBAC, audit trail, approval matrix

## Status

✅ **Task 9.9 Completed**: REST API endpoints untuk PR, PO, GR dengan RBAC guard

All endpoints implemented with:
- JWT authentication
- RBAC permission enforcement
- Standard API response envelope
- Comprehensive error handling
- Full test coverage (16 tests passing)
- Complete API documentation

## Next Steps

- Task 9.10: Unit test state machine PO dan property-based test untuk approval threshold
- Task 10.x: Inventory Module implementation
- Integration testing for full purchase cycle (PR → PO → GR → Invoice → Payment → Journal)
