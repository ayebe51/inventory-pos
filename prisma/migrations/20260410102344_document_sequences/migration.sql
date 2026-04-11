-- CreateTable: document_sequences
-- Used by NumberingService for atomic document number generation.
-- PRIMARY KEY (prefix, period) acts as the unique constraint that prevents
-- duplicate sequence entries and enables ON CONFLICT upsert for race-condition safety.

CREATE TABLE "document_sequences" (
    "prefix"     VARCHAR(10)  NOT NULL,
    "period"     VARCHAR(10)  NOT NULL,
    "last_value" BIGINT       NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("prefix", "period")
);

COMMENT ON TABLE "document_sequences" IS
  'Atomic sequence counters for document numbering. Each (prefix, period) pair holds the last issued sequence value. Incremented via INSERT ... ON CONFLICT DO UPDATE to guarantee uniqueness under concurrent load.';
