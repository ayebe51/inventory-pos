-- Migration: Branch Hierarchy
-- Task 8.4: Add parent_id and type to branches for Head Office → Branch hierarchy

ALTER TABLE "branches"
    ADD COLUMN "parent_id" UUID,
    ADD COLUMN "type"      VARCHAR(20) NOT NULL DEFAULT 'BRANCH';

-- Self-referential FK: branch.parent_id → branches.id
ALTER TABLE "branches"
    ADD CONSTRAINT "branches_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraint: type must be HEAD_OFFICE or BRANCH
ALTER TABLE "branches"
    ADD CONSTRAINT "branches_type_ck"
    CHECK ("type" IN ('HEAD_OFFICE', 'BRANCH'));

-- Index for hierarchy queries
CREATE INDEX "idx_branches_parent_id" ON "branches"("parent_id");
CREATE INDEX "idx_branches_type" ON "branches"("type");
