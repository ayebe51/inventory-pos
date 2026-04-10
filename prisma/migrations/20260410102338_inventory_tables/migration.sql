-- Migration: Inventory Tables
-- Task 2.4: inventory_ledger (append-only), stock_transfers, stock_transfer_lines,
--           stock_adjustments, stock_adjustment_lines, stock_opnames, stock_opname_lines
--
-- Business Rules enforced:
--   BR-INV-001: Stock cannot go negative (enforced at service layer)
--   BR-INV-002: inventory_ledger is append-only — NO updated_at, NO deleted_at
--   BR-INV-003: average_cost >= 0
--   BR-INV-005: Locked warehouse cannot receive/release stock (service layer)
--   BR-INV-008: In-transit stock cannot be sold (service layer)

-- ============================================================
-- TABLE: inventory_ledger
-- CRITICAL: Append-only — NO updated_at, NO deleted_at (BR-INV-002)
-- balance = SUM(qty_in) - SUM(qty_out) per (product_id, warehouse_id)
-- transaction_type: GR, SO, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT, OPNAME,
--                   RETURN_IN, RETURN_OUT
-- ============================================================
CREATE TABLE "inventory_ledger" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "product_id"       UUID          NOT NULL,
    "warehouse_id"     UUID          NOT NULL,
    "transaction_type" VARCHAR(30)   NOT NULL,
    "reference_type"   VARCHAR(30)   NOT NULL,
    "reference_id"     UUID          NOT NULL,
    "reference_number" VARCHAR(50)   NOT NULL,
    "movement_date"    TIMESTAMPTZ   NOT NULL,
    "qty_in"           DECIMAL(18,4) NOT NULL DEFAULT 0,
    "qty_out"          DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unit_cost"        DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_cost"       DECIMAL(18,2) NOT NULL DEFAULT 0,
    "running_qty"      DECIMAL(18,4) NOT NULL DEFAULT 0,
    "running_cost"     DECIMAL(18,2) NOT NULL DEFAULT 0,
    "batch_number"     VARCHAR(100),
    "serial_number"    VARCHAR(100),
    "notes"            TEXT,
    "created_by"       UUID          NOT NULL,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- NO updated_at — append-only ledger (BR-INV-002)
    -- NO deleted_at — append-only ledger (BR-INV-002)

    CONSTRAINT "inventory_ledger_pkey"                PRIMARY KEY ("id"),
    CONSTRAINT "inventory_ledger_transaction_type_ck" CHECK ("transaction_type" IN (
        'GR', 'SO', 'TRANSFER_IN', 'TRANSFER_OUT',
        'ADJUSTMENT', 'OPNAME', 'RETURN_IN', 'RETURN_OUT'
    )),
    CONSTRAINT "inventory_ledger_qty_in_ck"           CHECK ("qty_in" >= 0),
    CONSTRAINT "inventory_ledger_qty_out_ck"          CHECK ("qty_out" >= 0),
    CONSTRAINT "inventory_ledger_unit_cost_ck"        CHECK ("unit_cost" >= 0),
    CONSTRAINT "inventory_ledger_total_cost_ck"       CHECK ("total_cost" >= 0),
    -- Exactly one of qty_in or qty_out must be > 0 (not both, not neither)
    CONSTRAINT "inventory_ledger_qty_direction_ck"    CHECK (
        ("qty_in" > 0 AND "qty_out" = 0) OR
        ("qty_out" > 0 AND "qty_in" = 0)
    )
);

-- Primary query pattern: balance per (product, warehouse)
CREATE INDEX "idx_inv_ledger_product_warehouse"
    ON "inventory_ledger"("product_id", "warehouse_id");

-- Reference lookup (e.g. find all ledger entries for a GR)
CREATE INDEX "idx_inv_ledger_reference"
    ON "inventory_ledger"("reference_type", "reference_id");

-- Time-based queries (movement history, running balance)
CREATE INDEX "idx_inv_ledger_date"
    ON "inventory_ledger"("movement_date" DESC);

-- ============================================================
-- TABLE: stock_transfers
-- Format nomor: TO-YYYYMM-XXXXX
-- Status: DRAFT → IN_TRANSIT → COMPLETED | CANCELLED
-- Pessimistic locking (SELECT FOR UPDATE NOWAIT) at service layer
-- Total stock (from + to) must not change after transfer (BR-INV)
-- ============================================================
CREATE TABLE "stock_transfers" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "transfer_number"   VARCHAR(30) NOT NULL,
    "from_warehouse_id" UUID        NOT NULL,
    "to_warehouse_id"   UUID        NOT NULL,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "transfer_date"     TIMESTAMPTZ NOT NULL,
    "notes"             TEXT,
    "approved_by"       UUID,
    "approved_at"       TIMESTAMPTZ,
    "created_by"        UUID        NOT NULL,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"        TIMESTAMPTZ,

    CONSTRAINT "stock_transfers_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "stock_transfers_status_ck"         CHECK ("status" IN (
        'DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'
    )),
    -- Cannot transfer to the same warehouse
    CONSTRAINT "stock_transfers_diff_warehouse_ck" CHECK (
        "from_warehouse_id" <> "to_warehouse_id"
    )
);

CREATE UNIQUE INDEX "stock_transfers_transfer_number_key"
    ON "stock_transfers"("transfer_number");

CREATE INDEX "idx_stock_transfers_from_warehouse"
    ON "stock_transfers"("from_warehouse_id", "status");

CREATE INDEX "idx_stock_transfers_to_warehouse"
    ON "stock_transfers"("to_warehouse_id", "status");

-- ============================================================
-- TABLE: stock_transfer_lines
-- ============================================================
CREATE TABLE "stock_transfer_lines" (
    "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
    "transfer_id" UUID          NOT NULL,
    "product_id"  UUID          NOT NULL,
    "qty"         DECIMAL(18,4) NOT NULL,
    "uom_id"      UUID          NOT NULL,
    "unit_cost"   DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes"       TEXT,
    "created_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "stock_transfer_lines_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "stock_transfer_lines_qty_ck"    CHECK ("qty" > 0),
    CONSTRAINT "stock_transfer_lines_cost_ck"   CHECK ("unit_cost" >= 0)
);

CREATE INDEX "idx_stock_transfer_lines_transfer_id"
    ON "stock_transfer_lines"("transfer_id");

-- ============================================================
-- TABLE: stock_adjustments
-- Format nomor: SA-YYYYMM-XXXXX
-- Status: DRAFT → APPROVED → POSTED | CANCELLED
-- Requires STOCK.ADJUST permission + mandatory reason (BR-INV)
-- Triggers auto journal (Stock Adjustment +/-) on post
-- ============================================================
CREATE TABLE "stock_adjustments" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "adjustment_number" VARCHAR(30) NOT NULL,
    "warehouse_id"      UUID        NOT NULL,
    "adjustment_date"   TIMESTAMPTZ NOT NULL,
    "reason"            VARCHAR(200) NOT NULL,
    "notes"             TEXT,
    "status"            VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "approved_by"       UUID,
    "approved_at"       TIMESTAMPTZ,
    "created_by"        UUID        NOT NULL,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"        TIMESTAMPTZ,

    CONSTRAINT "stock_adjustments_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "stock_adjustments_status_ck" CHECK ("status" IN (
        'DRAFT', 'APPROVED', 'POSTED', 'CANCELLED'
    )),
    -- reason is mandatory (non-empty) — belt-and-suspenders alongside NOT NULL
    CONSTRAINT "stock_adjustments_reason_ck" CHECK (trim("reason") <> '')
);

CREATE UNIQUE INDEX "stock_adjustments_adjustment_number_key"
    ON "stock_adjustments"("adjustment_number");

CREATE INDEX "idx_stock_adjustments_warehouse"
    ON "stock_adjustments"("warehouse_id", "status");

-- ============================================================
-- TABLE: stock_adjustment_lines
-- qty_difference = qty_actual - qty_system (positive = surplus, negative = deficit)
-- ============================================================
CREATE TABLE "stock_adjustment_lines" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "adjustment_id"  UUID          NOT NULL,
    "product_id"     UUID          NOT NULL,
    "uom_id"         UUID          NOT NULL,
    "qty_system"     DECIMAL(18,4) NOT NULL,
    "qty_actual"     DECIMAL(18,4) NOT NULL,
    "qty_difference" DECIMAL(18,4) NOT NULL,
    "unit_cost"      DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes"          TEXT,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "stock_adjustment_lines_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "stock_adjustment_lines_cost_ck"   CHECK ("unit_cost" >= 0),
    CONSTRAINT "stock_adjustment_lines_qty_sys_ck" CHECK ("qty_system" >= 0),
    CONSTRAINT "stock_adjustment_lines_qty_act_ck" CHECK ("qty_actual" >= 0),
    -- qty_difference must equal qty_actual - qty_system
    CONSTRAINT "stock_adjustment_lines_diff_ck"   CHECK (
        "qty_difference" = "qty_actual" - "qty_system"
    )
);

CREATE INDEX "idx_stock_adjustment_lines_adjustment_id"
    ON "stock_adjustment_lines"("adjustment_id");

-- ============================================================
-- TABLE: stock_opnames
-- Format nomor: SO-YYYYMM-XXXXX
-- Status: INITIATED → IN_PROGRESS → COMPLETED
-- Locks warehouse on initiate, unlocks on finalize (BR-INV-005)
-- Finalize creates stock_adjustment + posts to inventory_ledger + auto journal
-- ============================================================
CREATE TABLE "stock_opnames" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "opname_number" VARCHAR(30) NOT NULL,
    "warehouse_id"  UUID        NOT NULL,
    "status"        VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    "initiated_by"  UUID        NOT NULL,
    "initiated_at"  TIMESTAMPTZ NOT NULL,
    "finalized_by"  UUID,
    "finalized_at"  TIMESTAMPTZ,
    "notes"         TEXT,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "stock_opnames_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "stock_opnames_status_ck" CHECK ("status" IN (
        'INITIATED', 'IN_PROGRESS', 'COMPLETED'
    )),
    -- finalized_by and finalized_at must both be set or both null
    CONSTRAINT "stock_opnames_finalize_ck" CHECK (
        ("finalized_by" IS NULL AND "finalized_at" IS NULL) OR
        ("finalized_by" IS NOT NULL AND "finalized_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "stock_opnames_opname_number_key"
    ON "stock_opnames"("opname_number");

CREATE INDEX "idx_stock_opnames_warehouse"
    ON "stock_opnames"("warehouse_id", "status");

-- ============================================================
-- TABLE: stock_opname_lines
-- status: PENDING → COUNTED → RECOUNT → FINALIZED
-- qty_difference = qty_counted - qty_system (nullable until counted)
-- ============================================================
CREATE TABLE "stock_opname_lines" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "opname_id"      UUID          NOT NULL,
    "product_id"     UUID          NOT NULL,
    "qty_system"     DECIMAL(18,4) NOT NULL,
    "qty_counted"    DECIMAL(18,4),
    "qty_difference" DECIMAL(18,4),
    "status"         VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    "recount_reason" TEXT,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "stock_opname_lines_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "stock_opname_lines_status_ck" CHECK ("status" IN (
        'PENDING', 'COUNTED', 'RECOUNT', 'FINALIZED'
    )),
    CONSTRAINT "stock_opname_lines_qty_sys_ck" CHECK ("qty_system" >= 0),
    CONSTRAINT "stock_opname_lines_qty_cnt_ck" CHECK ("qty_counted" IS NULL OR "qty_counted" >= 0),
    -- When counted, difference must equal qty_counted - qty_system
    CONSTRAINT "stock_opname_lines_diff_ck"   CHECK (
        "qty_difference" IS NULL OR
        "qty_difference" = "qty_counted" - "qty_system"
    )
);

CREATE INDEX "idx_stock_opname_lines_opname_id"
    ON "stock_opname_lines"("opname_id");

-- ============================================================
-- FOREIGN KEYS: inventory_ledger
-- ============================================================
ALTER TABLE "inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_ledger"
    ADD CONSTRAINT "inventory_ledger_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_transfers
-- ============================================================
ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey"
    FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey"
    FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_transfer_lines
-- ============================================================
ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey"
    FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfer_lines"
    ADD CONSTRAINT "stock_transfer_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_adjustments
-- ============================================================
ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_adjustment_lines
-- ============================================================
ALTER TABLE "stock_adjustment_lines"
    ADD CONSTRAINT "stock_adjustment_lines_adjustment_id_fkey"
    FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_adjustment_lines"
    ADD CONSTRAINT "stock_adjustment_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_adjustment_lines"
    ADD CONSTRAINT "stock_adjustment_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_opnames
-- ============================================================
ALTER TABLE "stock_opnames"
    ADD CONSTRAINT "stock_opnames_warehouse_id_fkey"
    FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_opnames"
    ADD CONSTRAINT "stock_opnames_initiated_by_fkey"
    FOREIGN KEY ("initiated_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_opnames"
    ADD CONSTRAINT "stock_opnames_finalized_by_fkey"
    FOREIGN KEY ("finalized_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: stock_opname_lines
-- ============================================================
ALTER TABLE "stock_opname_lines"
    ADD CONSTRAINT "stock_opname_lines_opname_id_fkey"
    FOREIGN KEY ("opname_id") REFERENCES "stock_opnames"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_opname_lines"
    ADD CONSTRAINT "stock_opname_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
