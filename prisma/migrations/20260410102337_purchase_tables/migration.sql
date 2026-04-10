-- Migration: Purchase Tables
-- Task 2.3: purchase_requests, purchase_request_lines, purchase_orders,
--           purchase_order_lines, goods_receipts, goods_receipt_lines
--
-- Business Rules enforced:
--   BR-PUR-003: 3-way matching (PO qty, GR qty, Invoice qty within tolerance)
--   BR-PUR-007: Approval threshold based on total_amount including tax
--   BR-PUR-008: Supplier invoice cannot exceed PO amount + 5%
--   SOD-001:    PO creator cannot be the approver (enforced at service layer)

-- ============================================================
-- TABLE: purchase_requests
-- Format nomor: PR-YYYYMM-XXXXX
-- Status: DRAFT → SUBMITTED → APPROVED → CONVERTED / CANCELLED
-- ============================================================
CREATE TABLE "purchase_requests" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "pr_number"    VARCHAR(30)  NOT NULL,
    "branch_id"    UUID         NOT NULL,
    "warehouse_id" UUID         NOT NULL,
    "status"       VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
    "requested_by" UUID         NOT NULL,
    "notes"        TEXT,
    "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"   TIMESTAMPTZ,

    CONSTRAINT "purchase_requests_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "purchase_requests_status_ck" CHECK ("status" IN (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'CONVERTED', 'CANCELLED'
    ))
);

CREATE UNIQUE INDEX "purchase_requests_pr_number_key" ON "purchase_requests"("pr_number");

-- ============================================================
-- TABLE: purchase_request_lines
-- ============================================================
CREATE TABLE "purchase_request_lines" (
    "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
    "pr_id"           UUID          NOT NULL,
    "product_id"      UUID          NOT NULL,
    "qty_requested"   DECIMAL(18,4) NOT NULL,
    "uom_id"          UUID          NOT NULL,
    "estimated_price" DECIMAL(18,4),
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "purchase_request_lines_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "purchase_request_lines_qty_ck"        CHECK ("qty_requested" > 0),
    CONSTRAINT "purchase_request_lines_est_price_ck"  CHECK ("estimated_price" IS NULL OR "estimated_price" >= 0)
);

-- ============================================================
-- TABLE: purchase_orders
-- Format nomor: PO-YYYYMM-XXXXX
-- State machine: DRAFT → PENDING_APPROVAL → APPROVED →
--                PARTIALLY_RECEIVED / FULLY_RECEIVED → CLOSED | CANCELLED
-- approval_level: 1 (< 5jt, Supervisor), 2 (5-50jt, Finance_Manager), 3 (> 50jt, Owner)
-- BR-PUR-007: approval level determined by total_amount including tax
-- SOD-001: created_by ≠ approved_by (enforced at service layer)
-- ============================================================
CREATE TABLE "purchase_orders" (
    "id"                     UUID          NOT NULL DEFAULT gen_random_uuid(),
    "po_number"              VARCHAR(30)   NOT NULL,
    "pr_id"                  UUID,
    "supplier_id"            UUID          NOT NULL,
    "branch_id"              UUID          NOT NULL,
    "warehouse_id"           UUID          NOT NULL,
    "status"                 VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
    "order_date"             TIMESTAMPTZ   NOT NULL,
    "expected_delivery_date" TIMESTAMPTZ,
    "currency"               VARCHAR(10)   NOT NULL DEFAULT 'IDR',
    "exchange_rate"          DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal"               DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount"             DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additional_cost"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount"           DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approval_level"         INTEGER,
    "approved_by"            UUID,
    "approved_at"            TIMESTAMPTZ,
    "notes"                  TEXT,
    "created_by"             UUID          NOT NULL,
    "created_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "deleted_at"             TIMESTAMPTZ,

    CONSTRAINT "purchase_orders_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "purchase_orders_status_ck"       CHECK ("status" IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED',
        'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED', 'CLOSED'
    )),
    CONSTRAINT "purchase_orders_approval_level_ck" CHECK ("approval_level" IS NULL OR "approval_level" IN (1, 2, 3)),
    CONSTRAINT "purchase_orders_subtotal_ck"     CHECK ("subtotal" >= 0),
    CONSTRAINT "purchase_orders_tax_amount_ck"   CHECK ("tax_amount" >= 0),
    CONSTRAINT "purchase_orders_total_amount_ck" CHECK ("total_amount" >= 0),
    CONSTRAINT "purchase_orders_exchange_rate_ck" CHECK ("exchange_rate" > 0),
    -- SOD-001: creator cannot approve their own PO (enforced at service layer too)
    CONSTRAINT "purchase_orders_sod001_ck"       CHECK (
        "approved_by" IS NULL OR "approved_by" <> "created_by"
    )
);

CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");
-- Index for approval workflow queries
CREATE INDEX "idx_purchase_orders_status" ON "purchase_orders"("status", "branch_id");
CREATE INDEX "idx_purchase_orders_supplier" ON "purchase_orders"("supplier_id", "status");

-- ============================================================
-- TABLE: purchase_order_lines
-- BR-PUR-003: qty_received tracked here for 3-way matching
-- line_status: OPEN → PARTIAL → CLOSED
-- ============================================================
CREATE TABLE "purchase_order_lines" (
    "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
    "po_id"           UUID          NOT NULL,
    "product_id"      UUID          NOT NULL,
    "description"     TEXT,
    "qty_ordered"     DECIMAL(18,4) NOT NULL,
    "qty_received"    DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom_id"          UUID          NOT NULL,
    "unit_price"      DECIMAL(18,4) NOT NULL,
    "discount_pct"    DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_pct"         DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "tax_amount"      DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_total"      DECIMAL(18,2) NOT NULL DEFAULT 0,
    "line_status"     VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "purchase_order_lines_pkey"            PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_lines_qty_ordered_ck"  CHECK ("qty_ordered" > 0),
    CONSTRAINT "purchase_order_lines_qty_received_ck" CHECK ("qty_received" >= 0),
    CONSTRAINT "purchase_order_lines_unit_price_ck"   CHECK ("unit_price" >= 0),
    CONSTRAINT "purchase_order_lines_discount_pct_ck" CHECK ("discount_pct" BETWEEN 0 AND 100),
    CONSTRAINT "purchase_order_lines_tax_pct_ck"      CHECK ("tax_pct" BETWEEN 0 AND 100),
    CONSTRAINT "purchase_order_lines_line_status_ck"  CHECK ("line_status" IN ('OPEN', 'PARTIAL', 'CLOSED'))
);

CREATE INDEX "idx_po_lines_po_id" ON "purchase_order_lines"("po_id");
CREATE INDEX "idx_po_lines_product" ON "purchase_order_lines"("product_id");

-- ============================================================
-- TABLE: goods_receipts
-- Format nomor: GR-YYYYMM-XXXXX
-- Status: DRAFT → CONFIRMED
-- BR-PUR-003: GR qty validated against PO qty × (1 + tolerance)
-- ============================================================
CREATE TABLE "goods_receipts" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "gr_number"    VARCHAR(30) NOT NULL,
    "po_id"        UUID        NOT NULL,
    "supplier_id"  UUID        NOT NULL,
    "warehouse_id" UUID        NOT NULL,
    "status"       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "receipt_date" TIMESTAMPTZ NOT NULL,
    "notes"        TEXT,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "created_by"   UUID        NOT NULL,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"   TIMESTAMPTZ,

    CONSTRAINT "goods_receipts_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "goods_receipts_status_ck" CHECK ("status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED'))
);

CREATE UNIQUE INDEX "goods_receipts_gr_number_key" ON "goods_receipts"("gr_number");
CREATE INDEX "idx_goods_receipts_po_id" ON "goods_receipts"("po_id", "status");
CREATE INDEX "idx_goods_receipts_warehouse" ON "goods_receipts"("warehouse_id", "receipt_date" DESC);

-- ============================================================
-- TABLE: goods_receipt_lines
-- BR-PUR-003: qty_received here feeds 3-way matching
-- Triggers WAC recalculation and auto journal on GR confirm
-- ============================================================
CREATE TABLE "goods_receipt_lines" (
    "id"            UUID          NOT NULL DEFAULT gen_random_uuid(),
    "gr_id"         UUID          NOT NULL,
    "po_line_id"    UUID          NOT NULL,
    "product_id"    UUID          NOT NULL,
    "qty_received"  DECIMAL(18,4) NOT NULL,
    "uom_id"        UUID          NOT NULL,
    "unit_cost"     DECIMAL(18,4) NOT NULL,
    "total_cost"    DECIMAL(18,2) NOT NULL,
    "batch_number"  VARCHAR(100),
    "serial_number" VARCHAR(100),
    "notes"         TEXT,
    "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "goods_receipt_lines_pkey"           PRIMARY KEY ("id"),
    CONSTRAINT "goods_receipt_lines_qty_received_ck" CHECK ("qty_received" > 0),
    CONSTRAINT "goods_receipt_lines_unit_cost_ck"   CHECK ("unit_cost" >= 0),
    CONSTRAINT "goods_receipt_lines_total_cost_ck"  CHECK ("total_cost" >= 0)
);

CREATE INDEX "idx_gr_lines_gr_id" ON "goods_receipt_lines"("gr_id");
CREATE INDEX "idx_gr_lines_product" ON "goods_receipt_lines"("product_id");

-- ============================================================
-- FOREIGN KEYS: purchase_requests
-- ============================================================
ALTER TABLE "purchase_requests"
    ADD CONSTRAINT "purchase_requests_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_requests"
    ADD CONSTRAINT "purchase_requests_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_requests"
    ADD CONSTRAINT "purchase_requests_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: purchase_request_lines
-- ============================================================
ALTER TABLE "purchase_request_lines"
    ADD CONSTRAINT "purchase_request_lines_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_request_lines"
    ADD CONSTRAINT "purchase_request_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_request_lines"
    ADD CONSTRAINT "purchase_request_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: purchase_orders
-- ============================================================
ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_pr_id_fkey"
    FOREIGN KEY ("pr_id") REFERENCES "purchase_requests"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: purchase_order_lines
-- ============================================================
ALTER TABLE "purchase_order_lines"
    ADD CONSTRAINT "purchase_order_lines_po_id_fkey"
    FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
    ADD CONSTRAINT "purchase_order_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
    ADD CONSTRAINT "purchase_order_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: goods_receipts
-- ============================================================
ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_po_id_fkey"
    FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_confirmed_by_fkey"
    FOREIGN KEY ("confirmed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "goods_receipts"
    ADD CONSTRAINT "goods_receipts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: goods_receipt_lines
-- ============================================================
ALTER TABLE "goods_receipt_lines"
    ADD CONSTRAINT "goods_receipt_lines_gr_id_fkey"
    FOREIGN KEY ("gr_id") REFERENCES "goods_receipts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_lines"
    ADD CONSTRAINT "goods_receipt_lines_po_line_id_fkey"
    FOREIGN KEY ("po_line_id") REFERENCES "purchase_order_lines"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_lines"
    ADD CONSTRAINT "goods_receipt_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goods_receipt_lines"
    ADD CONSTRAINT "goods_receipt_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
