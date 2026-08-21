# Release Notes - v1.0.0 (Release Candidate)

Welcome to the v1.0.0 Release Candidate of the **Enterprise Inventory + POS + Finance** system!
This release focuses on application hardening, eliminating regression bugs, completing the frontend/backend integration, and stabilizing core workflows to prepare the software for User Acceptance Testing (UAT) and Production environments.

## Highlights
- **Production Ready Stability**: Addressed over a dozen regressions in core domains (P2P, O2C, Inventory).
- **Hardened Type Validation**: API boundary type validations (Zod coercion for pagination) strictly enforce expected data types across all modules to prevent runtime crashes.
- **Robust POS Processing**: Enhanced the POS module to ensure correct product identification, unit of measure mapping, and transaction payload formatting to seamlessly match backend validations.
- **Clean Aesthetic Overhaul**: Updated typography weighting for a thicker, cleaner corporate aesthetic (`font-weight: 500`).
- **Complete End-to-End Test Passing**: Ensured Backend unit/integration tests (`jest`) pass successfully with full Prisma seed support.

## Core Flow Improvements

### Order-to-Cash (O2C)
- Fixed missing `/api/v1` prefix across frontend routes to properly bind React UI workflows to backend API controllers.
- `SalesOrderPage`: Added active data-binding for Warehouses, accurately sending UUIDs for branch and warehouse identification to meet strict UUID validation.
- `POSPage`: Fixed cart payload generation to include correctly formatted UOM (Unit of Measure) and Version fields.

### Procure-to-Pay (P2P)
- `PurchaseRequestPage`, `PurchaseOrderPage`, `GoodsReceiptPage`: Fixed endpoint routing.
- Fixed an issue where the Goods Receipt URL routed incorrectly by creating an exact fallback router map within `App.tsx`.

### Inventory Movements
- `StockTransferPage`: Updated URL paths to match the server implementation (`/api/v1/inventory/stock-transfers`) and integrated fallback UOM formatting.
- `StockOpnamePage`: Corrected JS template literal rendering bug preventing backend routing for count recording and finalization.

### Security and Governance
- Improved Session Safety: Frontend explicit logout triggers proper JWT invalidation at the API level via `POST /api/v1/auth/logout`.
- Correctly seeded standard and special Role-Based Access Control (RBAC) schemas across standard operational accounts via `prisma/seed.ts`.

## Known Issues
- Currently, `branch_id` mappings on Sales Orders fetch the first available branch. Future feature iterations should tie branch assignment strictly to the user's role/session or allow explicit selection.

## Next Steps
- Begin UAT Phase with end users.
- Migrate Database to Staging/Production environments using `prisma migrate deploy`.
- Validate Nginx and SSL reverse proxies in the deployment pipeline.
