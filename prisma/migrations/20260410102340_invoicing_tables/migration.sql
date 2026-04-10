-- Migration: Invoicing Tables
-- Task 2.6: invoices, invoice_lines, invoice_allocations,
--           payments, payment_allocations, bank_statements, bank_reconciliations
--
-- Business Rules enforced:
--   BR-PUR-008: Supplier invoice cannot exceed PO amount + 5% (service layer)
--   BR-ACC-001: Journal balance debit = credit (service layer / journal engine)
--   SOD-002:    Payment creator cannot be approver (service layer)
--   BR-ACC-008: Bank reconciliation must complete before period closing (service layer)

-- ============================================================
-- TABLE: invoices
-- invoice_type: SALES | PURCHASE
-- Status: DRAFT → OPEN → PARTIAL | PAID | OVERDUE | DISPUTED | CANCELLED → WRITTEN_OFF
-- invoice_number format: INV-YYYYMM-XXXXX
-- posted_by / posted_at set when status moves to OPEN
-- ============================================================
CREATE TABLE "invoices" (
    "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
    "invoice_number"     VARCHAR(30)   NOT NULL,
    "invoice_type"       VARCHAR(20)   NOT NULL,
    "reference_type"     VARCHAR(30)   NOT NULL,
    "reference_id"       UUID          NOT NULL,
    "customer_id"        UUID,
    "supplier_id"        UUID,
    "branch_id"          UUID          NOT NULL,
    "invoice_date"       TIMESTAMPTZ   NOT NULL,
    "due_date"           TIMESTAMPTZ   NOT NULL,
    "status"             VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    "subtotal"           DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax_amount"         DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_amount"       DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid_amount"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes"              TEXT,
    "posted_by"          UUID,
    "posted_at"          TIMESTAMPTZ,
    "created_by"         UUID          NOT NULL,
    "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "deleted_at"         TIMESTAMPTZ,

    CONSTRAINT "invoices_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "invoices_type_ck"       CHECK ("invoice_type" IN ('SALES', 'PURCHASE')),
    CONSTRAINT "invoices_status_ck"     CHECK ("status" IN (
        'DRAFT', 'OPEN', 'PARTIAL', 'PAID', 'OVERDUE',
        'DISPUTED', 'CANCELLED', 'WRITTEN_OFF'
    )),
    CONSTRAINT "invoices_subtotal_ck"      CHECK ("subtotal" >= 0),
    CONSTRAINT "invoices_tax_ck"           CHECK ("tax_amount" >= 0),
    CONSTRAINT "invoices_total_ck"         CHECK ("total_amount" >= 0),
    CONSTRAINT "invoices_paid_ck"          CHECK ("paid_amount" >= 0),
    CONSTRAINT "invoices_outstanding_ck"   CHECK ("outstanding_amount" >= 0),
    -- paid_amount cannot exceed total_amount
    CONSTRAINT "invoices_paid_lte_total_ck" CHECK ("paid_amount" <= "total_amount"),
    -- outstanding = total - paid (enforced at service layer; DB check for non-negative)
    -- SALES invoice must have customer; PURCHASE invoice must have supplier
    CONSTRAINT "invoices_party_ck" CHECK (
        ("invoice_type" = 'SALES'    AND "customer_id" IS NOT NULL) OR
        ("invoice_type" = 'PURCHASE' AND "supplier_id" IS NOT NULL)
    ),
    -- posted fields must be consistent
    CONSTRAINT "invoices_posted_ck" CHECK (
        ("posted_by" IS NULL AND "posted_at" IS NULL) OR
        ("posted_by" IS NOT NULL AND "posted_at" IS NOT NULL)
    ),
    -- due_date must be >= invoice_date
    CONSTRAINT "invoices_due_date_ck" CHECK ("due_date" >= "invoice_date")
);

CREATE UNIQUE INDEX "invoices_invoice_number_key"
    ON "invoices"("invoice_number");

-- AR aging / outstanding queries
CREATE INDEX "idx_invoices_customer_status"
    ON "invoices"("customer_id", "status")
    WHERE "customer_id" IS NOT NULL;

-- AP aging / outstanding queries
CREATE INDEX "idx_invoices_supplier_status"
    ON "invoices"("supplier_id", "status")
    WHERE "supplier_id" IS NOT NULL;

-- Overdue detection (scheduled job)
CREATE INDEX "idx_invoices_due_date_status"
    ON "invoices"("due_date", "status")
    WHERE "status" IN ('OPEN', 'PARTIAL');

-- Branch-level reporting
CREATE INDEX "idx_invoices_branch_date"
    ON "invoices"("branch_id", "invoice_date" DESC);

-- Partial index for active (non-deleted) invoices
CREATE INDEX "idx_invoices_active"
    ON "invoices"("invoice_date" DESC)
    WHERE "deleted_at" IS NULL;

-- ============================================================
-- TABLE: invoice_lines
-- product_id nullable for non-product line items (e.g. freight, service)
-- ============================================================
CREATE TABLE "invoice_lines" (
    "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id"   UUID          NOT NULL,
    "product_id"   UUID,
    "description"  VARCHAR(500)  NOT NULL,
    "qty"          DECIMAL(18,4) NOT NULL DEFAULT 1,
    "unit_price"   DECIMAL(18,4) NOT NULL,
    "discount_pct" DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "tax_pct"      DECIMAL(5,2)  NOT NULL DEFAULT 0,
    "line_total"   DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "invoice_lines_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "invoice_lines_qty_ck"       CHECK ("qty" > 0),
    CONSTRAINT "invoice_lines_price_ck"     CHECK ("unit_price" >= 0),
    CONSTRAINT "invoice_lines_discount_ck"  CHECK ("discount_pct" BETWEEN 0 AND 100),
    CONSTRAINT "invoice_lines_tax_ck"       CHECK ("tax_pct" >= 0),
    CONSTRAINT "invoice_lines_total_ck"     CHECK ("line_total" >= 0),
    CONSTRAINT "invoice_lines_desc_ck"      CHECK (trim("description") <> '')
);

CREATE INDEX "idx_invoice_lines_invoice_id"
    ON "invoice_lines"("invoice_id");

CREATE INDEX "idx_invoice_lines_product_id"
    ON "invoice_lines"("product_id")
    WHERE "product_id" IS NOT NULL;

-- ============================================================
-- TABLE: payments
-- payment_type: RECEIPT (AR) | VOUCHER (AP)
-- Status: DRAFT → PENDING_APPROVAL → APPROVED → POSTED → RECONCILED | REVERSED
-- payment_number format: RCV-YYYYMM-XXXXX (receipt) | PV-YYYYMM-XXXXX (voucher)
-- SOD-002: approved_by must differ from created_by (service layer)
-- ============================================================
CREATE TABLE "payments" (
    "id"                UUID          NOT NULL DEFAULT gen_random_uuid(),
    "payment_number"    VARCHAR(30)   NOT NULL,
    "payment_type"      VARCHAR(20)   NOT NULL,
    "customer_id"       UUID,
    "supplier_id"       UUID,
    "branch_id"         UUID          NOT NULL,
    "payment_date"      TIMESTAMPTZ   NOT NULL,
    "payment_method_id" UUID          NOT NULL,
    "amount"            DECIMAL(18,2) NOT NULL,
    "status"            VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    "reference_number"  VARCHAR(100),
    "notes"             TEXT,
    "approved_by"       UUID,
    "approved_at"       TIMESTAMPTZ,
    "posted_by"         UUID,
    "posted_at"         TIMESTAMPTZ,
    "reversed_by"       UUID,
    "reversed_at"       TIMESTAMPTZ,
    "reversal_reason"   TEXT,
    "created_by"        UUID          NOT NULL,
    "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "deleted_at"        TIMESTAMPTZ,

    CONSTRAINT "payments_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "payments_type_ck"     CHECK ("payment_type" IN ('RECEIPT', 'VOUCHER')),
    CONSTRAINT "payments_status_ck"   CHECK ("status" IN (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'RECONCILED', 'REVERSED'
    )),
    CONSTRAINT "payments_amount_ck"   CHECK ("amount" > 0),
    -- RECEIPT must have customer; VOUCHER must have supplier
    CONSTRAINT "payments_party_ck" CHECK (
        ("payment_type" = 'RECEIPT' AND "customer_id" IS NOT NULL) OR
        ("payment_type" = 'VOUCHER' AND "supplier_id" IS NOT NULL)
    ),
    -- approval fields must be consistent
    CONSTRAINT "payments_approval_ck" CHECK (
        ("approved_by" IS NULL AND "approved_at" IS NULL) OR
        ("approved_by" IS NOT NULL AND "approved_at" IS NOT NULL)
    ),
    -- posted fields must be consistent
    CONSTRAINT "payments_posted_ck" CHECK (
        ("posted_by" IS NULL AND "posted_at" IS NULL) OR
        ("posted_by" IS NOT NULL AND "posted_at" IS NOT NULL)
    ),
    -- reversal fields must be consistent
    CONSTRAINT "payments_reversal_ck" CHECK (
        ("reversed_by" IS NULL AND "reversed_at" IS NULL AND "reversal_reason" IS NULL) OR
        ("reversed_by" IS NOT NULL AND "reversed_at" IS NOT NULL AND "reversal_reason" IS NOT NULL)
    ),
    -- SOD-002: creator cannot approve (enforced at service layer; DB cannot compare rows)
    -- approved_by != created_by enforced in service layer
    CONSTRAINT "payments_sod002_ck" CHECK (
        "approved_by" IS NULL OR "approved_by" <> "created_by"
    )
);

CREATE UNIQUE INDEX "payments_payment_number_key"
    ON "payments"("payment_number");

-- AR payment queries
CREATE INDEX "idx_payments_customer_status"
    ON "payments"("customer_id", "status")
    WHERE "customer_id" IS NOT NULL;

-- AP payment queries
CREATE INDEX "idx_payments_supplier_status"
    ON "payments"("supplier_id", "status")
    WHERE "supplier_id" IS NOT NULL;

-- Branch-level reporting
CREATE INDEX "idx_payments_branch_date"
    ON "payments"("branch_id", "payment_date" DESC);

-- Reconciliation queries
CREATE INDEX "idx_payments_status_date"
    ON "payments"("status", "payment_date" DESC);

-- Partial index for active payments
CREATE INDEX "idx_payments_active"
    ON "payments"("payment_date" DESC)
    WHERE "deleted_at" IS NULL;

-- ============================================================
-- TABLE: payment_allocations
-- Links a payment to one or more invoices (multi-invoice allocation)
-- Total allocated_amount across all allocations for a payment
-- must not exceed payment.amount (enforced at service layer)
-- ============================================================
CREATE TABLE "payment_allocations" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "payment_id"       UUID          NOT NULL,
    "invoice_id"       UUID          NOT NULL,
    "allocated_amount" DECIMAL(18,2) NOT NULL,
    "allocated_at"     TIMESTAMPTZ   NOT NULL,
    "created_by"       UUID          NOT NULL,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "payment_allocations_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "payment_allocations_amount_ck" CHECK ("allocated_amount" > 0),
    -- One allocation record per payment-invoice pair
    CONSTRAINT "payment_allocations_unique_ck" UNIQUE ("payment_id", "invoice_id")
);

CREATE INDEX "idx_payment_allocations_payment_id"
    ON "payment_allocations"("payment_id");

CREATE INDEX "idx_payment_allocations_invoice_id"
    ON "payment_allocations"("invoice_id");

-- ============================================================
-- TABLE: invoice_allocations
-- Mirrors payment_allocations from the invoice perspective.
-- Kept as a separate table to support direct invoice-side queries
-- (e.g. "which payments have been applied to this invoice?").
-- ============================================================
CREATE TABLE "invoice_allocations" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "invoice_id"       UUID          NOT NULL,
    "payment_id"       UUID          NOT NULL,
    "allocated_amount" DECIMAL(18,2) NOT NULL,
    "allocated_at"     TIMESTAMPTZ   NOT NULL,
    "created_by"       UUID          NOT NULL,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "invoice_allocations_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "invoice_allocations_amount_ck" CHECK ("allocated_amount" > 0),
    CONSTRAINT "invoice_allocations_unique_ck" UNIQUE ("invoice_id", "payment_id")
);

CREATE INDEX "idx_invoice_allocations_invoice_id"
    ON "invoice_allocations"("invoice_id");

CREATE INDEX "idx_invoice_allocations_payment_id"
    ON "invoice_allocations"("payment_id");

-- ============================================================
-- TABLE: bank_statements
-- Imported from bank; auto-matched or manually matched to payments
-- transaction_type: CREDIT (money in) | DEBIT (money out)
-- bank_account_id references chart_of_accounts (cash/bank account)
-- ============================================================
CREATE TABLE "bank_statements" (
    "id"                 UUID          NOT NULL DEFAULT gen_random_uuid(),
    "bank_account_id"    UUID          NOT NULL,
    "statement_date"     TIMESTAMPTZ   NOT NULL,
    "reference_number"   VARCHAR(100)  NOT NULL,
    "description"        VARCHAR(500)  NOT NULL,
    "amount"             DECIMAL(18,2) NOT NULL,
    "transaction_type"   VARCHAR(10)   NOT NULL,
    "is_matched"         BOOLEAN       NOT NULL DEFAULT FALSE,
    "matched_payment_id" UUID,
    "matched_at"         TIMESTAMPTZ,
    "created_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "bank_statements_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "bank_statements_type_ck"       CHECK ("transaction_type" IN ('CREDIT', 'DEBIT')),
    CONSTRAINT "bank_statements_amount_ck"     CHECK ("amount" > 0),
    -- matched fields must be consistent
    CONSTRAINT "bank_statements_match_ck" CHECK (
        (NOT "is_matched" AND "matched_payment_id" IS NULL AND "matched_at" IS NULL) OR
        ("is_matched" AND "matched_payment_id" IS NOT NULL AND "matched_at" IS NOT NULL)
    )
);

-- Queries by bank account + date range (reconciliation)
CREATE INDEX "idx_bank_statements_account_date"
    ON "bank_statements"("bank_account_id", "statement_date" DESC);

-- Unmatched items (outstanding items report)
CREATE INDEX "idx_bank_statements_unmatched"
    ON "bank_statements"("bank_account_id", "statement_date" DESC)
    WHERE "is_matched" = FALSE;

-- Auto-match lookup by amount + date
CREATE INDEX "idx_bank_statements_amount_date"
    ON "bank_statements"("amount", "statement_date");

-- ============================================================
-- TABLE: bank_reconciliations
-- One reconciliation record per bank account per fiscal period
-- Status: DRAFT → IN_PROGRESS → COMPLETED
-- Must be COMPLETED before period can be closed (BR-ACC-008)
-- ============================================================
CREATE TABLE "bank_reconciliations" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "bank_account_id" UUID        NOT NULL,
    "period_id"       UUID        NOT NULL,
    "status"          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "reconciled_by"   UUID,
    "reconciled_at"   TIMESTAMPTZ,
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "bank_reconciliations_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "bank_reconciliations_status_ck" CHECK ("status" IN (
        'DRAFT', 'IN_PROGRESS', 'COMPLETED'
    )),
    -- One reconciliation per bank account per period
    CONSTRAINT "bank_reconciliations_unique_ck" UNIQUE ("bank_account_id", "period_id"),
    -- reconciled fields must be consistent
    CONSTRAINT "bank_reconciliations_reconciled_ck" CHECK (
        ("reconciled_by" IS NULL AND "reconciled_at" IS NULL) OR
        ("reconciled_by" IS NOT NULL AND "reconciled_at" IS NOT NULL)
    )
);

CREATE INDEX "idx_bank_reconciliations_account_period"
    ON "bank_reconciliations"("bank_account_id", "period_id");

-- Period closing checklist query
CREATE INDEX "idx_bank_reconciliations_period_status"
    ON "bank_reconciliations"("period_id", "status");

-- ============================================================
-- FOREIGN KEYS: invoices
-- ============================================================
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_posted_by_fkey"
    FOREIGN KEY ("posted_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: invoice_lines
-- ============================================================
ALTER TABLE "invoice_lines"
    ADD CONSTRAINT "invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_lines"
    ADD CONSTRAINT "invoice_lines_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: payments
-- ============================================================
ALTER TABLE "payments"
    ADD CONSTRAINT "payments_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_payment_method_id_fkey"
    FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_posted_by_fkey"
    FOREIGN KEY ("posted_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_reversed_by_fkey"
    FOREIGN KEY ("reversed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: payment_allocations
-- ============================================================
ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
    ADD CONSTRAINT "payment_allocations_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: invoice_allocations
-- ============================================================
ALTER TABLE "invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_allocations"
    ADD CONSTRAINT "invoice_allocations_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: bank_statements
-- ============================================================
ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_statements"
    ADD CONSTRAINT "bank_statements_matched_payment_id_fkey"
    FOREIGN KEY ("matched_payment_id") REFERENCES "payments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: bank_reconciliations
-- ============================================================
ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "fiscal_periods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bank_reconciliations"
    ADD CONSTRAINT "bank_reconciliations_reconciled_by_fkey"
    FOREIGN KEY ("reconciled_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
