-- Migration: Sales / POS Tables
-- Task 2.5: shifts, pos_transactions, pos_transaction_lines, pos_payments,
--           sales_orders, sales_order_lines, delivery_orders,
--           sales_returns, sales_return_lines
--
-- Business Rules enforced:
--   BR-SAL-001: Cashier must open shift before POS transaction (service layer)
--   BR-SAL-002: Unit price >= min_selling_price unless PRICE.OVERRIDE (service layer)
--   BR-SAL-003: Credit limit check before SO approval (service layer)
--   BR-SAL-004: POS void only by Supervisor with POS.VOID permission (service layer)
--   SOD-003:    Cashier cannot void their own transaction (service layer)
--   BR-INV-001: Stock check before adding POS line (service layer)

-- ============================================================
-- TABLE: shifts
-- Status: OPEN → CLOSED | AUTO_CLOSED
-- One active shift per cashier at a time (BR-SAL-001)
-- force_closed_by + force_close_reason set when Supervisor force-closes
-- ============================================================
CREATE TABLE "shifts" (
    "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
    "shift_number"       VARCHAR(30)   NOT NULL,
    "cashier_id"         UUID          NOT NULL,
    "branch_id"          UUID          NOT NULL,
    "warehouse_id"       UUID          NOT NULL,
    "status"             VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    "opened_at"          TIMESTAMPTZ   NOT NULL,
    "closed_at"          TIMESTAMPTZ,
    "opening_balance"    DECIMAL(18,2) NOT NULL DEFAULT 0,
    "closing_balance"    DECIMAL(18,2),
    "expected_balance"   DECIMAL(18,2),
    "difference"         DECIMAL(18,2),
    "force_closed_by"    UUID,
    "force_close_reason" TEXT,
    "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "shifts_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "shifts_status_ck" CHECK ("status" IN ('OPEN', 'CLOSED', 'AUTO_CLOSED')),
    CONSTRAINT "shifts_opening_balance_ck" CHECK ("opening_balance" >= 0),
    -- closing fields must be consistent: all set or all null
    CONSTRAINT "shifts_close_ck" CHECK (
        ("closed_at" IS NULL AND "closing_balance" IS NULL) OR
        ("closed_at" IS NOT NULL AND "closing_balance" IS NOT NULL)
    ),
    -- force-close fields must be consistent
    CONSTRAINT "shifts_force_close_ck" CHECK (
        ("force_closed_by" IS NULL AND "force_close_reason" IS NULL) OR
        ("force_closed_by" IS NOT NULL AND "force_close_reason" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "shifts_shift_number_key"
    ON "shifts"("shift_number");

-- Enforce only one OPEN shift per cashier (BR-SAL-001)
CREATE UNIQUE INDEX "shifts_cashier_open_unique"
    ON "shifts"("cashier_id")
    WHERE "status" = 'OPEN';

CREATE INDEX "idx_shifts_cashier_status"
    ON "shifts"("cashier_id", "status");

CREATE INDEX "idx_shifts_branch_status"
    ON "shifts"("branch_id", "status");

-- ============================================================
-- TABLE: pos_transactions
-- Status: OPEN → HELD | COMPLETED | VOIDED
-- Optimistic locking via version field (concurrency strategy)
-- transaction_number format: POS-YYYYMMDD-XXXXX
-- ============================================================
CREATE TABLE "pos_transactions" (
    "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
    "transaction_number" VARCHAR(40)   NOT NULL,
    "shift_id"           UUID          NOT NULL,
    "cashier_id"         UUID          NOT NULL,
    "customer_id"        UUID,
    "transaction_date"   TIMESTAMPTZ   NOT NULL,
    "status"             VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    "subtotal"           DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount"    DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount"         DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount"       DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "change_amount"      DECIMAL(18,2) NOT NULL DEFAULT 0,
    "void_reason"        TEXT,
    "voided_by"          UUID,
    "voided_at"          TIMESTAMPTZ,
    "version"            INTEGER       NOT NULL DEFAULT 0,
    "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "pos_transactions_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "pos_transactions_status_ck" CHECK ("status" IN (
        'OPEN', 'HELD', 'COMPLETED', 'VOIDED'
    )),
    CONSTRAINT "pos_transactions_subtotal_ck"      CHECK ("subtotal" >= 0),
    CONSTRAINT "pos_transactions_discount_ck"      CHECK ("discount_amount" >= 0),
    CONSTRAINT "pos_transactions_tax_ck"           CHECK ("tax_amount" >= 0),
    CONSTRAINT "pos_transactions_total_ck"         CHECK ("total_amount" >= 0),
    CONSTRAINT "pos_transactions_paid_ck"          CHECK ("paid_amount" >= 0),
    CONSTRAINT "pos_transactions_change_ck"        CHECK ("change_amount" >= 0),
    -- void fields must be consistent (SOD-003 enforced at service layer)
    CONSTRAINT "pos_transactions_void_ck" CHECK (
        ("voided_by" IS NULL AND "voided_at" IS NULL AND "void_reason" IS NULL) OR
        ("voided_by" IS NOT NULL AND "voided_at" IS NOT NULL AND "void_reason" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "pos_transactions_transaction_number_key"
    ON "pos_transactions"("transaction_number");

-- Shift-level queries (shift report, active transactions)
CREATE INDEX "idx_pos_shift_status"
    ON "pos_transactions"("shift_id", "status");

-- Time-based queries (daily sales, reporting)
CREATE INDEX "idx_pos_date"
    ON "pos_transactions"("transaction_date" DESC);

-- Customer transaction history
CREATE INDEX "idx_pos_customer"
    ON "pos_transactions"("customer_id", "transaction_date" DESC)
    WHERE "customer_id" IS NOT NULL;

-- ============================================================
-- TABLE: pos_transaction_lines
-- unit_price >= min_selling_price unless price_override = true (BR-SAL-002)
-- price_override_by must be set when price_override = true
-- ============================================================
CREATE TABLE "pos_transaction_lines" (
    "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id"    UUID          NOT NULL,
    "product_id"        UUID          NOT NULL,
    "qty"               DECIMAL(18,4) NOT NULL,
    "uom_id"            UUID          NOT NULL,
    "unit_price"        DECIMAL(18,4) NOT NULL,
    "price_override"    BOOLEAN       NOT NULL DEFAULT FALSE,
    "price_override_by" UUID,
    "discount_pct"      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "discount_amount"   DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_pct"           DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "tax_amount"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_total"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "pos_transaction_lines_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "pos_transaction_lines_qty_ck"       CHECK ("qty" > 0),
    CONSTRAINT "pos_transaction_lines_price_ck"     CHECK ("unit_price" >= 0),
    CONSTRAINT "pos_transaction_lines_discount_ck"  CHECK ("discount_pct" BETWEEN 0 AND 100),
    CONSTRAINT "pos_transaction_lines_tax_ck"       CHECK ("tax_pct" >= 0),
    CONSTRAINT "pos_transaction_lines_total_ck"     CHECK ("line_total" >= 0),
    -- price_override_by must be set when override is true (BR-SAL-002)
    CONSTRAINT "pos_transaction_lines_override_ck"  CHECK (
        (NOT "price_override") OR
        ("price_override" AND "price_override_by" IS NOT NULL)
    )
);

CREATE INDEX "idx_pos_transaction_lines_transaction_id"
    ON "pos_transaction_lines"("transaction_id");

CREATE INDEX "idx_pos_transaction_lines_product_id"
    ON "pos_transaction_lines"("product_id");

-- ============================================================
-- TABLE: pos_payments
-- Multi-payment method per transaction (cash, card, transfer, EDC)
-- Total payments >= total_amount validated at service layer
-- ============================================================
CREATE TABLE "pos_payments" (
    "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id"    UUID          NOT NULL,
    "payment_method_id" UUID          NOT NULL,
    "amount"            DECIMAL(18,2) NOT NULL,
    "reference_number"  VARCHAR(100),
    "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "pos_payments_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "pos_payments_amount_ck" CHECK ("amount" > 0)
);

CREATE INDEX "idx_pos_payments_transaction_id"
    ON "pos_payments"("transaction_id");

-- ============================================================
-- TABLE: sales_orders
-- Status: DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_FULFILLED
--         → FULLY_FULFILLED → CLOSED | CANCELLED
-- Credit limit check before approval (BR-SAL-003)
-- ============================================================
CREATE TABLE "sales_orders" (
    "id"                     UUID          NOT NULL DEFAULT gen_random_uuid(),
    "so_number"              VARCHAR(30)   NOT NULL,
    "customer_id"            UUID          NOT NULL,
    "branch_id"              UUID          NOT NULL,
    "warehouse_id"           UUID          NOT NULL,
    "status"                 VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
    "order_date"             TIMESTAMPTZ   NOT NULL,
    "expected_delivery_date" TIMESTAMPTZ,
    "subtotal"               DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount_amount"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount"             DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount"           DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes"                  TEXT,
    "approved_by"            UUID,
    "approved_at"            TIMESTAMPTZ,
    "created_by"             UUID          NOT NULL,
    "created_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "deleted_at"             TIMESTAMPTZ,

    CONSTRAINT "sales_orders_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "sales_orders_status_ck" CHECK ("status" IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
        'PARTIALLY_FULFILLED', 'FULLY_FULFILLED',
        'CLOSED', 'CANCELLED'
    )),
    CONSTRAINT "sales_orders_subtotal_ck"  CHECK ("subtotal" >= 0),
    CONSTRAINT "sales_orders_discount_ck"  CHECK ("discount_amount" >= 0),
    CONSTRAINT "sales_orders_tax_ck"       CHECK ("tax_amount" >= 0),
    CONSTRAINT "sales_orders_total_ck"     CHECK ("total_amount" >= 0),
    -- approval fields must be consistent
    CONSTRAINT "sales_orders_approval_ck" CHECK (
        ("approved_by" IS NULL AND "approved_at" IS NULL) OR
        ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "sales_orders_so_number_key"
    ON "sales_orders"("so_number");

CREATE INDEX "idx_sales_orders_customer_status"
    ON "sales_orders"("customer_id", "status");

CREATE INDEX "idx_sales_orders_branch_status"
    ON "sales_orders"("branch_id", "status");

CREATE INDEX "idx_sales_orders_order_date"
    ON "sales_orders"("order_date" DESC);

-- Partial index for active records
CREATE INDEX "idx_sales_orders_active"
    ON "sales_orders"("customer_id", "order_date" DESC)
    WHERE "deleted_at" IS NULL;

-- ============================================================
-- TABLE: sales_order_lines
-- qty_delivered tracks fulfillment progress
-- line_status: OPEN → PARTIAL → CLOSED
-- ============================================================
CREATE TABLE "sales_order_lines" (
    "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
    "so_id"         UUID          NOT NULL,
    "product_id"    UUID          NOT NULL,
    "qty_ordered"   DECIMAL(18,4) NOT NULL,
    "qty_delivered" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom_id"        UUID          NOT NULL,
    "unit_price"    DECIMAL(18,4) NOT NULL,
    "discount_pct"  DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "tax_pct"       DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "line_total"    DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "sales_order_lines_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "sales_order_lines_qty_ordered_ck" CHECK ("qty_ordered" > 0),
    CONSTRAINT "sales_order_lines_qty_delivered_ck" CHECK ("qty_delivered" >= 0),
    CONSTRAINT "sales_order_lines_price_ck"      CHECK ("unit_price" >= 0),
    CONSTRAINT "sales_order_lines_discount_ck"   CHECK ("discount_pct" BETWEEN 0 AND 100),
    CONSTRAINT "sales_order_lines_tax_ck"        CHECK ("tax_pct" >= 0),
    CONSTRAINT "sales_order_lines_total_ck"      CHECK ("line_total" >= 0),
    -- Cannot deliver more than ordered
    CONSTRAINT "sales_order_lines_delivery_ck"   CHECK ("qty_delivered" <= "qty_ordered")
);

CREATE INDEX "idx_sales_order_lines_so_id"
    ON "sales_order_lines"("so_id");

-- ============================================================
-- TABLE: delivery_orders
-- Status: DRAFT → CONFIRMED → CANCELLED
-- Reduces stock in inventory_ledger on confirm
-- ============================================================
CREATE TABLE "delivery_orders" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "do_number"     VARCHAR(30) NOT NULL,
    "so_id"         UUID        NOT NULL,
    "warehouse_id"  UUID        NOT NULL,
    "status"        VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "delivery_date" TIMESTAMPTZ NOT NULL,
    "notes"         TEXT,
    "confirmed_by"  UUID,
    "confirmed_at"  TIMESTAMPTZ,
    "created_by"    UUID        NOT NULL,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"    TIMESTAMPTZ,

    CONSTRAINT "delivery_orders_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "delivery_orders_status_ck" CHECK ("status" IN (
        'DRAFT', 'CONFIRMED', 'CANCELLED'
    )),
    -- confirmation fields must be consistent
    CONSTRAINT "delivery_orders_confirm_ck" CHECK (
        ("confirmed_by" IS NULL AND "confirmed_at" IS NULL) OR
        ("confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "delivery_orders_do_number_key"
    ON "delivery_orders"("do_number");

CREATE INDEX "idx_delivery_orders_so_id"
    ON "delivery_orders"("so_id", "status");

CREATE INDEX "idx_delivery_orders_warehouse"
    ON "delivery_orders"("warehouse_id", "delivery_date" DESC);

-- ============================================================
-- TABLE: sales_returns
-- reference_type: POS | SO (references original transaction)
-- Status: DRAFT → APPROVED → POSTED | CANCELLED
-- Triggers auto journal: Sales Return + Sales Return Stock (service layer)
-- ============================================================
CREATE TABLE "sales_returns" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "return_number"  VARCHAR(30)   NOT NULL,
    "reference_type" VARCHAR(30)   NOT NULL,
    "reference_id"   UUID          NOT NULL,
    "customer_id"    UUID          NOT NULL,
    "warehouse_id"   UUID          NOT NULL,
    "return_date"    TIMESTAMPTZ   NOT NULL,
    "reason"         VARCHAR(200)  NOT NULL,
    "status"         VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    "total_amount"   DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes"          TEXT,
    "approved_by"    UUID,
    "approved_at"    TIMESTAMPTZ,
    "created_by"     UUID          NOT NULL,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "deleted_at"     TIMESTAMPTZ,

    CONSTRAINT "sales_returns_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "sales_returns_status_ck"       CHECK ("status" IN (
        'DRAFT', 'APPROVED', 'POSTED', 'CANCELLED'
    )),
    CONSTRAINT "sales_returns_ref_type_ck"     CHECK ("reference_type" IN ('POS', 'SO')),
    CONSTRAINT "sales_returns_total_ck"        CHECK ("total_amount" >= 0),
    CONSTRAINT "sales_returns_reason_ck"       CHECK (trim("reason") <> ''),
    -- approval fields must be consistent
    CONSTRAINT "sales_returns_approval_ck" CHECK (
        ("approved_by" IS NULL AND "approved_at" IS NULL) OR
        ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "sales_returns_return_number_key"
    ON "sales_returns"("return_number");

CREATE INDEX "idx_sales_returns_customer"
    ON "sales_returns"("customer_id", "status");

CREATE INDEX "idx_sales_returns_reference"
    ON "sales_returns"("reference_type", "reference_id");

-- ============================================================
-- TABLE: sales_return_lines
-- unit_cost used for COGS reversal journal (Sales Return Stock)
-- ============================================================
CREATE TABLE "sales_return_lines" (
    "id"         UUID          NOT NULL DEFAULT gen_random_uuid(),
    "return_id"  UUID          NOT NULL,
    "product_id" UUID          NOT NULL,
    "qty"        DECIMAL(18,4) NOT NULL,
    "uom_id"     UUID          NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "unit_cost"  DECIMAL(18,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "sales_return_lines_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "sales_return_lines_qty_ck"     CHECK ("qty" > 0),
    CONSTRAINT "sales_return_lines_price_ck"   CHECK ("unit_price" >= 0),
    CONSTRAINT "sales_return_lines_cost_ck"    CHECK ("unit_cost" >= 0),
    CONSTRAINT "sales_return_lines_total_ck"   CHECK ("line_total" >= 0)
);

CREATE INDEX "idx_sales_return_lines_return_id"
    ON "sales_return_lines"("return_id");

-- ============================================================
-- FOREIGN KEYS: shifts
-- ============================================================
ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_cashier_id_fkey"
    FOREIGN KEY ("cashier_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_force_closed_by_fkey"
    FOREIGN KEY ("force_closed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: pos_transactions
-- ============================================================
ALTER TABLE "pos_transactions"
    ADD CONSTRAINT "pos_transactions_shift_id_fkey"
    FOREIGN KEY ("shift_id") REFERENCES "shifts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_transactions"
    ADD CONSTRAINT "pos_transactions_cashier_id_fkey"
    FOREIGN KEY ("cashier_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_transactions"
    ADD CONSTRAINT "pos_transactions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_transactions"
    ADD CONSTRAINT "pos_transactions_voided_by_fkey"
    FOREIGN KEY ("voided_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: pos_transaction_lines
-- ============================================================
ALTER TABLE "pos_transaction_lines"
    ADD CONSTRAINT "pos_transaction_lines_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "pos_transactions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_transaction_lines"
    ADD CONSTRAINT "pos_transaction_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_transaction_lines"
    ADD CONSTRAINT "pos_transaction_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_transaction_lines"
    ADD CONSTRAINT "pos_transaction_lines_price_override_by_fkey"
    FOREIGN KEY ("price_override_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: pos_payments
-- ============================================================
ALTER TABLE "pos_payments"
    ADD CONSTRAINT "pos_payments_transaction_id_fkey"
    FOREIGN KEY ("transaction_id") REFERENCES "pos_transactions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_payments"
    ADD CONSTRAINT "pos_payments_payment_method_id_fkey"
    FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: sales_orders
-- ============================================================
ALTER TABLE "sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
    ADD CONSTRAINT "sales_orders_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
    ADD CONSTRAINT "sales_orders_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
    ADD CONSTRAINT "sales_orders_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
    ADD CONSTRAINT "sales_orders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: sales_order_lines
-- ============================================================
ALTER TABLE "sales_order_lines"
    ADD CONSTRAINT "sales_order_lines_so_id_fkey"
    FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_order_lines"
    ADD CONSTRAINT "sales_order_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_order_lines"
    ADD CONSTRAINT "sales_order_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: delivery_orders
-- ============================================================
ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_so_id_fkey"
    FOREIGN KEY ("so_id") REFERENCES "sales_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_confirmed_by_fkey"
    FOREIGN KEY ("confirmed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: sales_returns
-- ============================================================
ALTER TABLE "sales_returns"
    ADD CONSTRAINT "sales_returns_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns"
    ADD CONSTRAINT "sales_returns_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_returns"
    ADD CONSTRAINT "sales_returns_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sales_returns"
    ADD CONSTRAINT "sales_returns_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: sales_return_lines
-- ============================================================
ALTER TABLE "sales_return_lines"
    ADD CONSTRAINT "sales_return_lines_return_id_fkey"
    FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sales_return_lines"
    ADD CONSTRAINT "sales_return_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_return_lines"
    ADD CONSTRAINT "sales_return_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
