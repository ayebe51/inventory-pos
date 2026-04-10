-- Migration: Governance Tables
-- Task 2.8: audit_logs (immutable), approval_requests, approval_request_steps
--
-- Business Rules enforced:
--   UU Kearsipan: audit_logs are immutable — NO updated_at, NO deleted_at
--   SOD-001: PO creator cannot be PO approver (service layer)
--   SOD-002: Payment creator cannot be payment approver (service layer)
--   SOD-003: Cashier cannot void their own POS transaction (service layer)
--   Approval thresholds: Level 1 < 5jt (Supervisor), Level 2 5-50jt (Finance_Manager), Level 3 > 50jt (Owner)

-- ============================================================
-- TABLE: audit_logs
-- Immutable audit trail for all CREATE, UPDATE, DELETE, APPROVE,
-- VOID, POST, and REVERSE operations.
--
-- CRITICAL: NO updated_at, NO deleted_at — records are append-only
-- per UU Kearsipan and BR-ACC requirements.
-- Written in the same DB transaction as the business operation
-- (atomicity guaranteed at service layer).
--
-- action values: CREATE, UPDATE, DELETE, APPROVE, REJECT, VOID,
--                POST, REVERSE, LOGIN, LOGOUT
-- ============================================================
CREATE TABLE "audit_logs" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"     UUID         NOT NULL,
    "action"      VARCHAR(50)  NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id"   UUID         NOT NULL,
    "data_before" JSONB,
    "data_after"  JSONB,
    "ip_address"  VARCHAR(45),
    "user_agent"  VARCHAR(500),
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    -- NO updated_at — immutable
    -- NO deleted_at — immutable

    CONSTRAINT "audit_logs_pkey"        PRIMARY KEY ("id"),
    -- action must be a known operation type
    CONSTRAINT "audit_logs_action_ck"   CHECK ("action" IN (
        'CREATE', 'UPDATE', 'DELETE',
        'APPROVE', 'REJECT',
        'VOID', 'POST', 'REVERSE',
        'LOGIN', 'LOGOUT'
    )),
    -- entity_type must not be blank
    CONSTRAINT "audit_logs_entity_ck"   CHECK (trim("entity_type") <> ''),
    -- action must not be blank (redundant with CHECK above, but explicit)
    CONSTRAINT "audit_logs_action_ne_ck" CHECK (trim("action") <> ''),
    -- ip_address format: IPv4 (max 15) or IPv6 (max 45) — length already capped by VARCHAR(45)
    -- At least one of data_before or data_after should be present for mutation actions
    -- (not enforced at DB level to allow flexibility for LOGIN/LOGOUT events)
    CONSTRAINT "audit_logs_ip_ck" CHECK (
        "ip_address" IS NULL OR length(trim("ip_address")) > 0
    )
);

-- Primary lookup: all audit events for a specific entity (e.g. show history of PO-202501-00001)
CREATE INDEX "idx_audit_logs_entity"
    ON "audit_logs"("entity_type", "entity_id");

-- User activity timeline (e.g. what did user X do today?)
CREATE INDEX "idx_audit_logs_user_date"
    ON "audit_logs"("user_id", "created_at" DESC);

-- Chronological audit feed (admin / auditor view)
CREATE INDEX "idx_audit_logs_created_at"
    ON "audit_logs"("created_at" DESC);

-- Filter by action type (e.g. find all VOID events)
CREATE INDEX "idx_audit_logs_action"
    ON "audit_logs"("action", "created_at" DESC);

-- ============================================================
-- TABLE: approval_requests
-- Header record for a document submitted for approval.
-- One approval_request per document submission.
--
-- document_type: PO, PAYMENT, etc.
-- approval_level: 1 (< 5jt), 2 (5-50jt), 3 (> 50jt)
-- status: PENDING → APPROVED | REJECTED
-- ============================================================
CREATE TABLE "approval_requests" (
    "id"              UUID          NOT NULL DEFAULT gen_random_uuid(),
    "document_type"   VARCHAR(50)   NOT NULL,
    "document_id"     UUID          NOT NULL,
    "document_number" VARCHAR(50)   NOT NULL,
    "amount"          DECIMAL(18,2),
    "approval_level"  INTEGER       NOT NULL,
    "status"          VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    "submitted_by"    UUID          NOT NULL,
    "submitted_at"    TIMESTAMPTZ   NOT NULL,
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT "approval_requests_pkey"           PRIMARY KEY ("id"),
    CONSTRAINT "approval_requests_status_ck"      CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "approval_requests_level_ck"       CHECK ("approval_level" IN (1, 2, 3)),
    CONSTRAINT "approval_requests_amount_ck"      CHECK ("amount" IS NULL OR "amount" >= 0),
    CONSTRAINT "approval_requests_doc_type_ck"    CHECK (trim("document_type") <> ''),
    CONSTRAINT "approval_requests_doc_number_ck"  CHECK (trim("document_number") <> '')
);

-- Find all pending approvals for a specific document (e.g. is this PO awaiting approval?)
CREATE INDEX "idx_approval_requests_document"
    ON "approval_requests"("document_type", "document_id");

-- Approval queue: all pending requests (approver dashboard)
CREATE INDEX "idx_approval_requests_pending"
    ON "approval_requests"("status", "submitted_at" DESC)
    WHERE "status" = 'PENDING';

-- Approval history by submitter
CREATE INDEX "idx_approval_requests_submitted_by"
    ON "approval_requests"("submitted_by", "submitted_at" DESC);

-- ============================================================
-- TABLE: approval_request_steps
-- Individual approver step within an approval_request.
-- Each step represents one approver's decision.
--
-- step_number: sequential order (1, 2, 3 …)
-- status: PENDING → APPROVED | REJECTED
-- decision_at: set when approver makes a decision
-- ============================================================
CREATE TABLE "approval_request_steps" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "request_id"  UUID        NOT NULL,
    "step_number" INTEGER     NOT NULL,
    "approver_id" UUID        NOT NULL,
    "status"      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "decision_at" TIMESTAMPTZ,
    "notes"       TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "approval_request_steps_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "approval_request_steps_status_ck"   CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT "approval_request_steps_stepnum_ck"  CHECK ("step_number" > 0),
    -- decision_at must be set when status is not PENDING
    CONSTRAINT "approval_request_steps_decision_ck" CHECK (
        ("status" = 'PENDING' AND "decision_at" IS NULL) OR
        ("status" <> 'PENDING' AND "decision_at" IS NOT NULL)
    ),
    -- Each step number must be unique within a request
    CONSTRAINT "approval_request_steps_unique_step" UNIQUE ("request_id", "step_number")
);

-- All steps for a given approval request (always needed when processing approval)
CREATE INDEX "idx_approval_request_steps_request"
    ON "approval_request_steps"("request_id", "step_number");

-- Approver's pending action queue (what does this approver need to decide?)
CREATE INDEX "idx_approval_request_steps_approver_pending"
    ON "approval_request_steps"("approver_id", "status")
    WHERE "status" = 'PENDING';

-- ============================================================
-- FOREIGN KEYS: audit_logs
-- ============================================================
ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: approval_requests
-- ============================================================
ALTER TABLE "approval_requests"
    ADD CONSTRAINT "approval_requests_submitted_by_fkey"
    FOREIGN KEY ("submitted_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- FOREIGN KEYS: approval_request_steps
-- ============================================================
ALTER TABLE "approval_request_steps"
    ADD CONSTRAINT "approval_request_steps_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_request_steps"
    ADD CONSTRAINT "approval_request_steps_approver_id_fkey"
    FOREIGN KEY ("approver_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
