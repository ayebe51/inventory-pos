-- Migration: Accounting Tables
-- Task 2.7: journal_entries, journal_entry_lines, auto_journal_templates
--
-- Business Rules enforced:
--   BR-ACC-001: Journal entry must balance: |SUM(debit) - SUM(credit)| <= 0.01 (service layer / journal engine)
--   BR-ACC-002: No transactions in CLOSED fiscal period (service layer / period manager)
--   BR-ACC-005: COA with journal history cannot be hard-deleted (service layer)
--   BR-ACC-006: is_header=true accounts cannot be used in journal lines (service layer)
--   BR-ACC-007: Fiscal periods must be closed in sequential order (service layer)
--   SOD enforcement: journal reversal requires JOURNAL.REVERSE permission (service layer)

-- ============================================================
-- TABLE: journal_entries
-- Double-entry general ledger header.
-- je_number format: JE-YYYYMM-XXXXX
-- Status: DRAFT → POSTED → REVERSED
-- is_auto_generated = true for system-generated journals (GR, POS, etc.)
-- reversed_by references another journal_entry (the reversal JE)
-- posted_by / posted_at set when status moves to POSTED (immutable after)
-- ============================================================
CREATE TABLE "journal_entries" (
    "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
    "je_number"        VARCHAR(30)   NOT NULL,
    "entry_date"       TIMESTAMPTZ   NOT NULL,
    "period_id"        UUID          NOT NULL,
    "reference_type"   VARCHAR(30)   NOT NULL,
    "reference_id"     UUID          NOT NULL,
    "reference_number" VARCHAR(50)   NOT NULL,
    "description"      VARCHAR(500)  NOT NULL,
    "total_debit"      DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_credit"     DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status"           VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    "is_auto_generated" BOOLEAN      NOT NULL DEFAULT FALSE,
    "reversed_by"      UUID,
    "reversed_at"      TIMESTAMPTZ,
    "posted_by"        UUID,
    "posted_at"        TIMESTAMPTZ,
    "created_by"       UUID          NOT NULL,
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "journal_entries_pkey"         PRIMARY KEY ("id"),
    CONSTRAINT "journal_entries_status_ck"    CHECK ("status" IN ('DRAFT', 'POSTED', 'REVERSED')),
    CONSTRAINT "journal_entries_debit_ck"     CHECK ("total_debit" >= 0),
    CONSTRAINT "journal_entries_credit_ck"    CHECK ("total_credit" >= 0),
    -- description must not be blank
    CONSTRAINT "journal_entries_desc_ck"      CHECK (trim("description") <> ''),
    -- reference_type must not be blank
    CONSTRAINT "journal_entries_ref_type_ck"  CHECK (trim("reference_type") <> ''),
    -- posted fields must be consistent
    CONSTRAINT "journal_entries_posted_ck" CHECK (
        ("posted_by" IS NULL AND "posted_at" IS NULL) OR
        ("posted_by" IS NOT NULL AND "posted_at" IS NOT NULL)
    ),
    -- reversal fields must be consistent
    CONSTRAINT "journal_entries_reversal_ck" CHECK (
        ("reversed_by" IS NULL AND "reversed_at" IS NULL) OR
        ("reversed_by" IS NOT NULL AND "reversed_at" IS NOT NULL)
    ),
    -- a REVERSED journal must have reversed_by set; DRAFT/POSTED must not
    CONSTRAINT "journal_entries_status_reversal_ck" CHECK (
        ("status" = 'REVERSED' AND "reversed_by" IS NOT NULL) OR
        ("status" <> 'REVERSED' AND "reversed_by" IS NULL)
    ),
    -- a POSTED journal must have posted_by set; DRAFT must not
    CONSTRAINT "journal_entries_status_posted_ck" CHECK (
        ("status" IN ('POSTED', 'REVERSED') AND "posted_by" IS NOT NULL) OR
        ("status" = 'DRAFT' AND "posted_by" IS NULL)
    )
);

CREATE UNIQUE INDEX "journal_entries_je_number_key"
    ON "journal_entries"("je_number");

-- Most common query: all journal entries for a period (trial balance, period closing)
CREATE INDEX "idx_journal_entries_period_status"
    ON "journal_entries"("period_id", "status");

-- Lookup by source document (e.g. find JE for a specific GR or POS transaction)
CREATE INDEX "idx_journal_entries_reference"
    ON "journal_entries"("reference_type", "reference_id");

-- Chronological listing / reporting
CREATE INDEX "idx_journal_entries_entry_date"
    ON "journal_entries"("entry_date" DESC);

-- Auto-generated journals (for audit / reconciliation)
CREATE INDEX "idx_journal_entries_auto_generated"
    ON "journal_entries"("is_auto_generated", "entry_date" DESC)
    WHERE "is_auto_generated" = TRUE;

-- Active (non-reversed) journals for reporting
CREATE INDEX "idx_journal_entries_active"
    ON "journal_entries"("period_id", "entry_date" DESC)
    WHERE "status" = 'POSTED';

-- ============================================================
-- TABLE: journal_entry_lines
-- Individual debit/credit lines for a journal entry.
-- Constraints:
--   - debit >= 0, credit >= 0
--   - NOT (debit > 0 AND credit > 0) — a line is either debit or credit, never both
--   - account must not be is_header=true (enforced at service layer, BR-ACC-006)
-- NO updated_at — lines are immutable once the JE is posted.
-- ============================================================
CREATE TABLE "journal_entry_lines" (
    "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
    "je_id"          UUID          NOT NULL,
    "line_number"    INTEGER       NOT NULL,
    "account_id"     UUID          NOT NULL,
    "cost_center_id" UUID,
    "description"    VARCHAR(500),
    "debit"          DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit"         DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "journal_entry_lines_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "journal_entry_lines_debit_ck"    CHECK ("debit" >= 0),
    CONSTRAINT "journal_entry_lines_credit_ck"   CHECK ("credit" >= 0),
    -- A line must be either debit or credit, not both (double-entry integrity)
    CONSTRAINT "journal_entry_lines_side_ck"     CHECK (NOT ("debit" > 0 AND "credit" > 0)),
    -- At least one side must be non-zero
    CONSTRAINT "journal_entry_lines_nonzero_ck"  CHECK ("debit" > 0 OR "credit" > 0),
    -- line_number must be positive
    CONSTRAINT "journal_entry_lines_linenum_ck"  CHECK ("line_number" > 0),
    -- Each line number must be unique within a journal entry
    CONSTRAINT "journal_entry_lines_unique_line" UNIQUE ("je_id", "line_number")
    -- NO updated_at — journal lines are immutable once created
);

-- Primary lookup: all lines for a journal entry (always needed when reading a JE)
CREATE INDEX "idx_journal_entry_lines_je_id"
    ON "journal_entry_lines"("je_id");

-- Account-level queries: trial balance, account ledger, account history
-- (design.md specifies this index explicitly)
CREATE INDEX "idx_journal_entry_lines_account_je"
    ON "journal_entry_lines"("account_id", "je_id");

-- Cost center reporting
CREATE INDEX "idx_journal_entry_lines_cost_center"
    ON "journal_entry_lines"("cost_center_id")
    WHERE "cost_center_id" IS NOT NULL;

-- ============================================================
-- TABLE: auto_journal_templates
-- Defines the default debit/credit account pair for each of the
-- 20 auto-journal event types (design.md § Auto Journal Events).
-- event_type is unique — one template per event.
-- Templates are seeded at deployment; is_active allows disabling
-- without deleting (e.g. if a COA account is replaced).
-- ============================================================
CREATE TABLE "auto_journal_templates" (
    "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
    "event_type"        VARCHAR(50) NOT NULL,
    "description"       VARCHAR(200) NOT NULL,
    "debit_account_id"  UUID        NOT NULL,
    "credit_account_id" UUID        NOT NULL,
    "is_active"         BOOLEAN     NOT NULL DEFAULT TRUE,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "auto_journal_templates_pkey"         PRIMARY KEY ("id"),
    -- One template per event type
    CONSTRAINT "auto_journal_templates_event_unique" UNIQUE ("event_type"),
    -- event_type must not be blank
    CONSTRAINT "auto_journal_templates_event_ck"     CHECK (trim("event_type") <> ''),
    -- description must not be blank
    CONSTRAINT "auto_journal_templates_desc_ck"      CHECK (trim("description") <> ''),
    -- debit and credit accounts must differ (a template cannot debit and credit the same account)
    CONSTRAINT "auto_journal_templates_accounts_ck"  CHECK ("debit_account_id" <> "credit_account_id"),
    -- event_type must be one of the 20 defined event types
    CONSTRAINT "auto_journal_templates_type_ck" CHECK ("event_type" IN (
        'GOODS_RECEIPT',
        'SUPPLIER_INVOICE',
        'PURCHASE_PAYMENT',
        'SALES_INVOICE',
        'SALES_INVOICE_COGS',
        'POS_SALE',
        'POS_SALE_COGS',
        'SALES_RETURN',
        'SALES_RETURN_STOCK',
        'PAYMENT_RECEIPT',
        'STOCK_ADJUSTMENT_POSITIVE',
        'STOCK_ADJUSTMENT_NEGATIVE',
        'STOCK_OPNAME_SURPLUS',
        'STOCK_OPNAME_DEFICIT',
        'PERIOD_CLOSING_REVENUE',
        'PERIOD_CLOSING_EXPENSE',
        'PERIOD_CLOSING_NET',
        'DEPRECIATION',
        'BANK_RECONCILIATION_ADJ',
        'WRITE_OFF_AR'
    ))
);

-- Active templates lookup (used by journal engine on every business event)
CREATE INDEX "idx_auto_journal_templates_active"
    ON "auto_journal_templates"("event_type")
    WHERE "is_active" = TRUE;

-- ============================================================
-- FOREIGN KEYS: journal_entries
-- ============================================================
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "fiscal_periods"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Self-referential FK: reversed_by points to the reversal JE
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_reversed_by_fkey"
    FOREIGN KEY ("reversed_by") REFERENCES "journal_entries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_posted_by_fkey"
    FOREIGN KEY ("posted_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: journal_entry_lines
-- ============================================================
ALTER TABLE "journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_je_id_fkey"
    FOREIGN KEY ("je_id") REFERENCES "journal_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- cost_center_id references chart_of_accounts (cost centre accounts)
ALTER TABLE "journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_cost_center_id_fkey"
    FOREIGN KEY ("cost_center_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: auto_journal_templates
-- ============================================================
ALTER TABLE "auto_journal_templates"
    ADD CONSTRAINT "auto_journal_templates_debit_account_id_fkey"
    FOREIGN KEY ("debit_account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auto_journal_templates"
    ADD CONSTRAINT "auto_journal_templates_credit_account_id_fkey"
    FOREIGN KEY ("credit_account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
