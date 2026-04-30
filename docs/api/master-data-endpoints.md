# Master Data REST API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header and enforce RBAC permissions.

Base URL: `/api/v1/master-data`

## Products

### Create Product
- **Endpoint**: `POST /api/v1/master-data/products`
- **Permission**: `INVENTORY.CREATE`
- **Request Body**:
```json
{
  "code": "string (max 50 chars, unique)",
  "barcode": "string (optional)",
  "name": "string (max 200 chars)",
  "description": "string (optional)",
  "category_id": "UUID",
  "brand_id": "UUID (optional)",
  "uom_id": "UUID",
  "uom_purchase_id": "UUID (optional)",
  "uom_sales_id": "UUID (optional)",
  "cost_method": "WAC | FIFO",
  "standard_cost": "number (>= 0)",
  "selling_price": "number (>= 0)",
  "min_selling_price": "number (>= 0)",
  "reorder_point": "number (>= 0)",
  "reorder_qty": "number (>= 0)",
  "max_stock": "number (optional)",
  "is_serialized": "boolean",
  "is_batch_tracked": "boolean",
  "is_active": "boolean",
  "tax_category": "string (optional)",
  "weight": "number (optional)",
  "volume": "number (optional)",
  "image_url": "string (optional)",
  "notes": "string (optional)"
}
```
- **Response**: `APIResponse<Product>`

### Search Products
- **Endpoint**: `GET /api/v1/master-data/products`
- **Permission**: `INVENTORY.READ`
- **Query Parameters**:
  - `code`: string (optional) - Filter by product code (partial match)
  - `name`: string (optional) - Filter by product name (partial match)
  - `category_id`: UUID (optional) - Filter by category
  - `brand_id`: UUID (optional) - Filter by brand
  - `is_active`: boolean (optional) - Filter by active status
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<Product>`

### Get Product by ID
- **Endpoint**: `GET /api/v1/master-data/products/:id`
- **Permission**: `INVENTORY.READ`
- **Response**: `APIResponse<Product>`

### Update Product
- **Endpoint**: `PATCH /api/v1/master-data/products/:id`
- **Permission**: `INVENTORY.UPDATE`
- **Request Body**: Partial product fields (same as create)
- **Response**: `APIResponse<Product>`

### Deactivate Product (Soft Delete)
- **Endpoint**: `DELETE /api/v1/master-data/products/:id`
- **Permission**: `INVENTORY.DELETE`
- **Response**: `APIResponse<null>`

---

## Customers

### Create Customer
- **Endpoint**: `POST /api/v1/master-data/customers`
- **Permission**: `SALES.CREATE`
- **Request Body**:
```json
{
  "code": "string (unique)",
  "name": "string",
  "email": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "credit_limit": "number (>= 0)",
  "is_active": "boolean"
}
```
- **Response**: `APIResponse<Customer>`

### Search Customers
- **Endpoint**: `GET /api/v1/master-data/customers`
- **Permission**: `SALES.READ`
- **Query Parameters**:
  - `code`: string (optional) - Filter by customer code (partial match)
  - `name`: string (optional) - Filter by customer name (partial match)
  - `is_active`: boolean (optional) - Filter by active status
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<Customer>`

### Get Customer by ID
- **Endpoint**: `GET /api/v1/master-data/customers/:id`
- **Permission**: `SALES.READ`
- **Response**: `APIResponse<Customer>`

### Get Remaining Credit
- **Endpoint**: `GET /api/v1/master-data/customers/:id/credit`
- **Permission**: `SALES.READ`
- **Response**: `APIResponse<{ remaining_credit: number }>`

### Update Customer
- **Endpoint**: `PATCH /api/v1/master-data/customers/:id`
- **Permission**: `SALES.UPDATE`
- **Request Body**: Partial customer fields (same as create)
- **Response**: `APIResponse<Customer>`

### Deactivate Customer (Soft Delete)
- **Endpoint**: `DELETE /api/v1/master-data/customers/:id`
- **Permission**: `SALES.DELETE`
- **Response**: `APIResponse<null>`

---

## Suppliers

### Create Supplier
- **Endpoint**: `POST /api/v1/master-data/suppliers`
- **Permission**: `PURCHASE.CREATE`
- **Request Body**:
```json
{
  "code": "string (unique)",
  "name": "string",
  "email": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "payment_terms_days": "number (>= 0)",
  "is_active": "boolean"
}
```
- **Response**: `APIResponse<Supplier>`

### Search Suppliers
- **Endpoint**: `GET /api/v1/master-data/suppliers`
- **Permission**: `PURCHASE.READ`
- **Query Parameters**:
  - `code`: string (optional) - Filter by supplier code (partial match)
  - `name`: string (optional) - Filter by supplier name (partial match)
  - `is_active`: boolean (optional) - Filter by active status
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<Supplier>`

### Get Supplier by ID
- **Endpoint**: `GET /api/v1/master-data/suppliers/:id`
- **Permission**: `PURCHASE.READ`
- **Response**: `APIResponse<Supplier>`

### Update Supplier
- **Endpoint**: `PATCH /api/v1/master-data/suppliers/:id`
- **Permission**: `PURCHASE.UPDATE`
- **Request Body**: Partial supplier fields (same as create)
- **Response**: `APIResponse<Supplier>`

### Deactivate Supplier (Soft Delete)
- **Endpoint**: `DELETE /api/v1/master-data/suppliers/:id`
- **Permission**: `PURCHASE.DELETE`
- **Response**: `APIResponse<null>`

---

## Price Lists

### Create Price List
- **Endpoint**: `POST /api/v1/master-data/price-lists`
- **Permission**: `SALES.CREATE`
- **Request Body**:
```json
{
  "code": "string (unique)",
  "name": "string",
  "customer_id": "UUID (optional, null for general price list)",
  "valid_from": "Date (ISO format)",
  "valid_to": "Date (optional, ISO format)",
  "is_active": "boolean"
}
```
- **Response**: `APIResponse<PriceList>`

### Search Price Lists
- **Endpoint**: `GET /api/v1/master-data/price-lists`
- **Permission**: `SALES.READ`
- **Query Parameters**:
  - `customer_id`: UUID | 'null' (optional) - Filter by customer (use 'null' for general price lists)
  - `is_active`: boolean (optional) - Filter by active status
  - `search`: string (optional) - Search in code and name
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<PriceList>`

### Get Price List by ID
- **Endpoint**: `GET /api/v1/master-data/price-lists/:id`
- **Permission**: `SALES.READ`
- **Response**: `APIResponse<PriceList>`

### Get Active Price
- **Endpoint**: `GET /api/v1/master-data/price-lists/active-price`
- **Permission**: `SALES.READ`
- **Query Parameters**:
  - `product_id`: UUID (required)
  - `customer_id`: UUID (optional)
  - `date`: Date (optional, ISO format, defaults to current date)
- **Response**: `APIResponse<PriceResult>`
- **PriceResult**:
```json
{
  "price": "number",
  "price_list_id": "UUID | null",
  "source": "PRICE_LIST_CUSTOMER | PRICE_LIST_GENERAL | PRODUCT_DEFAULT"
}
```

### Update Price List
- **Endpoint**: `PATCH /api/v1/master-data/price-lists/:id`
- **Permission**: `SALES.UPDATE`
- **Request Body**: Partial price list fields (same as create)
- **Response**: `APIResponse<PriceList>`

### Update Prices (Upsert Price Items)
- **Endpoint**: `POST /api/v1/master-data/price-lists/:id/prices`
- **Permission**: `SALES.UPDATE`
- **Request Body**:
```json
{
  "items": [
    {
      "product_id": "UUID",
      "unit_price": "number (>= 0)"
    }
  ]
}
```
- **Response**: `APIResponse<null>`

### Deactivate Price List (Soft Delete)
- **Endpoint**: `DELETE /api/v1/master-data/price-lists/:id`
- **Permission**: `SALES.DELETE`
- **Response**: `APIResponse<null>`

---

## Warehouses

### Create Warehouse
- **Endpoint**: `POST /api/v1/warehouses`
- **Permission**: `INVENTORY.CREATE` or `ADMIN.SETTINGS`
- **Request Body**:
```json
{
  "code": "string (unique per branch)",
  "name": "string",
  "branch_id": "UUID",
  "address": "string (optional)",
  "is_active": "boolean"
}
```
- **Response**: `APIResponse<Warehouse>`

### Search Warehouses
- **Endpoint**: `GET /api/v1/warehouses`
- **Permission**: `INVENTORY.READ`
- **Query Parameters**:
  - `branch_id`: UUID (optional) - Filter by branch
  - `is_active`: boolean (optional) - Filter by active status
  - `is_locked`: boolean (optional) - Filter by locked status
  - `search`: string (optional) - Search in code and name
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<Warehouse>`

### Get Warehouse by ID
- **Endpoint**: `GET /api/v1/warehouses/:id`
- **Permission**: `INVENTORY.READ`
- **Response**: `APIResponse<Warehouse>`

### Update Warehouse
- **Endpoint**: `PATCH /api/v1/warehouses/:id`
- **Permission**: `INVENTORY.UPDATE`
- **Request Body**: Partial warehouse fields (same as create)
- **Response**: `APIResponse<Warehouse>`

### Deactivate Warehouse
- **Endpoint**: `DELETE /api/v1/warehouses/:id`
- **Permission**: `INVENTORY.DELETE`
- **Response**: `APIResponse<null>`

### Lock Warehouse (for Stock Opname)
- **Endpoint**: `POST /api/v1/warehouses/:id/lock`
- **Permission**: `STOCK.OPNAME`
- **Request Body**:
```json
{
  "reason": "string (required)"
}
```
- **Response**: `APIResponse<null>`

### Unlock Warehouse
- **Endpoint**: `POST /api/v1/warehouses/:id/unlock`
- **Permission**: `STOCK.OPNAME`
- **Response**: `APIResponse<null>`

---

## Chart of Accounts (COA)

### Create COA Account
- **Endpoint**: `POST /api/v1/master-data/coa`
- **Permission**: `ACCOUNTING.CREATE`
- **Request Body**:
```json
{
  "account_code": "string (format: X.XXX.XXX, unique)",
  "account_name": "string",
  "account_type": "ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE | COGS | OTHER_INCOME | OTHER_EXPENSE",
  "account_category": "string (optional)",
  "parent_id": "UUID (optional)",
  "is_header": "boolean",
  "normal_balance": "DEBIT | CREDIT",
  "is_active": "boolean",
  "branch_id": "UUID (optional, null for all branches)"
}
```
- **Response**: `APIResponse<ChartOfAccount>`

### Search COA Accounts
- **Endpoint**: `GET /api/v1/master-data/coa`
- **Permission**: `ACCOUNTING.READ`
- **Query Parameters**:
  - `account_type`: AccountType (optional)
  - `is_header`: boolean (optional)
  - `is_active`: boolean (optional)
  - `parent_id`: UUID (optional)
  - `branch_id`: UUID (optional)
  - `search`: string (optional) - Search in code and name
  - `page`: number (default: 1)
  - `per_page`: number (default: 20)
- **Response**: `PaginatedResponse<ChartOfAccount>`

### Get COA Tree
- **Endpoint**: `GET /api/v1/master-data/coa/tree`
- **Permission**: `ACCOUNTING.READ`
- **Query Parameters**:
  - `branchId`: UUID (optional) - Filter by branch
- **Response**: `APIResponse<ChartOfAccountNode[]>`

### Get COA Account by ID
- **Endpoint**: `GET /api/v1/master-data/coa/:id`
- **Permission**: `ACCOUNTING.READ`
- **Response**: `APIResponse<ChartOfAccount & { children: ChartOfAccount[] }>`

### Update COA Account
- **Endpoint**: `PATCH /api/v1/master-data/coa/:id`
- **Permission**: `ACCOUNTING.UPDATE`
- **Request Body**: Partial COA fields (same as create)
- **Response**: `APIResponse<ChartOfAccount>`
- **Note**: Cannot change account_type if account has journal history (BR-ACC-005)

### Soft Delete COA Account
- **Endpoint**: `DELETE /api/v1/master-data/coa/:id`
- **Permission**: `ACCOUNTING.DELETE`
- **Response**: `APIResponse<null>`
- **Note**: 
  - System accounts (is_system=true) cannot be deleted
  - Accounts with journal history can only be soft-deleted (BR-ACC-005)

---

## Organization Hierarchy

### Create Head Office
- **Endpoint**: `POST /api/v1/organization/head-offices`
- **Permission**: `ADMIN.SETTINGS`
- **Request Body**:
```json
{
  "code": "string (unique)",
  "name": "string",
  "address": "string (optional)"
}
```
- **Response**: `APIResponse<Branch>`

### Create Branch
- **Endpoint**: `POST /api/v1/organization/branches`
- **Permission**: `ADMIN.SETTINGS`
- **Request Body**:
```json
{
  "code": "string (unique)",
  "name": "string",
  "parent_id": "UUID (Head Office or Branch)",
  "address": "string (optional)"
}
```
- **Response**: `APIResponse<Branch>`

### Get Organization Hierarchy
- **Endpoint**: `GET /api/v1/organization/hierarchy`
- **Permission**: None (authenticated users only)
- **Query Parameters**:
  - `branchId`: UUID (optional) - Get subtree starting from this branch
- **Response**: `APIResponse<BranchNode[]>`

### Get Children of a Node
- **Endpoint**: `GET /api/v1/organization/:id/children`
- **Permission**: None (authenticated users only)
- **Response**: `APIResponse<Branch[]>`

---

## Standard Response Formats

### Success Response
```json
{
  "success": true,
  "data": <T>,
  "message": "string (optional)"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [<T>],
  "message": "string (optional)",
  "meta": {
    "page": "number",
    "per_page": "number",
    "total": "number",
    "total_pages": "number"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ErrorCode",
    "message": "string",
    "details": {
      "field": ["error messages"]
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | No permission for this action |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `BUSINESS_RULE_VIOLATION` | 422 | Business rule violated |
| `CONFLICT` | 409 | Unique constraint violation |
| `INTERNAL_ERROR` | 500 | Server error |

## Caching

All master data endpoints use Redis caching with TTL of 5 minutes:
- Cache is automatically invalidated on CREATE, UPDATE, DELETE operations
- Cache keys follow pattern: `{entity}:{id}` or `{entity}:tree:{branchId}`
- Active price resolution is cached per `(product_id, customer_id, date)` combination

## Audit Trail

All mutating operations (CREATE, UPDATE, DELETE) are automatically logged to the audit trail with:
- User ID
- Action type
- Entity type and ID
- Before/after snapshots
- Timestamp
- IP address and user agent

Audit logs are immutable and recorded in the same database transaction as the business operation.
