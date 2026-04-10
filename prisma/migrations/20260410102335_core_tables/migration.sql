-- Migration: Core Tables
-- Task 2.1: branches, warehouses, users, roles, permissions, role_permissions, user_roles

-- ============================================================
-- TABLE: branches
-- ============================================================
CREATE TABLE "branches" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"       VARCHAR(20)  NOT NULL,
    "name"       VARCHAR(200) NOT NULL,
    "address"    TEXT,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- ============================================================
-- TABLE: warehouses
-- ============================================================
CREATE TABLE "warehouses" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"        VARCHAR(20)  NOT NULL,
    "name"        VARCHAR(200) NOT NULL,
    "branch_id"   UUID         NOT NULL,
    "address"     TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "is_locked"   BOOLEAN      NOT NULL DEFAULT false,
    "lock_reason" TEXT,
    "locked_at"   TIMESTAMPTZ,
    "locked_by"   UUID,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- Unique warehouse code per branch (BR-INV-005 support)
CREATE UNIQUE INDEX "warehouses_code_branch_id_key" ON "warehouses"("code", "branch_id");

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE "users" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "email"         VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name"     VARCHAR(200) NOT NULL,
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "mfa_secret"    VARCHAR(100),
    "mfa_enabled"   BOOLEAN      NOT NULL DEFAULT false,
    "branch_id"     UUID,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"    TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ============================================================
-- TABLE: roles
-- ============================================================
CREATE TABLE "roles" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "name"        VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- ============================================================
-- TABLE: permissions
-- ============================================================
CREATE TABLE "permissions" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "module"      VARCHAR(50) NOT NULL,
    "action"      VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: MODULE.ACTION format (e.g. PURCHASE.APPROVE)
CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- ============================================================
-- TABLE: role_permissions
-- ============================================================
CREATE TABLE "role_permissions" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "role_id"       UUID        NOT NULL,
    "permission_id" UUID        NOT NULL,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- ============================================================
-- TABLE: user_roles
-- ============================================================
CREATE TABLE "user_roles" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID        NOT NULL,
    "role_id"    UUID        NOT NULL,
    "branch_id"  UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- A user can only have one instance of a given role
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

-- warehouses.branch_id → branches.id
ALTER TABLE "warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- warehouses.locked_by → users.id (added after users table)
ALTER TABLE "warehouses"
    ADD CONSTRAINT "warehouses_locked_by_fkey"
    FOREIGN KEY ("locked_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- users.branch_id → branches.id
ALTER TABLE "users"
    ADD CONSTRAINT "users_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- role_permissions.role_id → roles.id
ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- role_permissions.permission_id → permissions.id
ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- user_roles.user_id → users.id
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- user_roles.role_id → roles.id
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- user_roles.branch_id → branches.id
ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- SEED: Default permissions (MODULE.ACTION format per RBAC spec)
-- ============================================================
INSERT INTO "permissions" ("id", "module", "action", "description") VALUES
    -- PURCHASE
    (gen_random_uuid(), 'PURCHASE', 'READ',     'View purchase documents'),
    (gen_random_uuid(), 'PURCHASE', 'CREATE',   'Create purchase requests and orders'),
    (gen_random_uuid(), 'PURCHASE', 'UPDATE',   'Edit purchase documents'),
    (gen_random_uuid(), 'PURCHASE', 'DELETE',   'Delete purchase documents'),
    (gen_random_uuid(), 'PURCHASE', 'APPROVE',  'Approve purchase orders'),
    (gen_random_uuid(), 'PURCHASE', 'IMPORT',   'Import purchase data'),
    (gen_random_uuid(), 'PURCHASE', 'EXPORT',   'Export purchase data'),
    -- INVENTORY
    (gen_random_uuid(), 'INVENTORY', 'READ',    'View inventory data'),
    (gen_random_uuid(), 'INVENTORY', 'CREATE',  'Create inventory records'),
    (gen_random_uuid(), 'INVENTORY', 'UPDATE',  'Update inventory records'),
    (gen_random_uuid(), 'INVENTORY', 'DELETE',  'Delete inventory records'),
    (gen_random_uuid(), 'INVENTORY', 'LOCK',    'Lock/unlock warehouses'),
    (gen_random_uuid(), 'INVENTORY', 'EXPORT',  'Export inventory data'),
    -- SALES
    (gen_random_uuid(), 'SALES', 'READ',        'View sales documents'),
    (gen_random_uuid(), 'SALES', 'CREATE',      'Create sales orders'),
    (gen_random_uuid(), 'SALES', 'UPDATE',      'Edit sales documents'),
    (gen_random_uuid(), 'SALES', 'DELETE',      'Delete sales documents'),
    (gen_random_uuid(), 'SALES', 'APPROVE',     'Approve sales orders'),
    (gen_random_uuid(), 'SALES', 'EXPORT',      'Export sales data'),
    -- POS
    (gen_random_uuid(), 'POS', 'READ',          'View POS transactions'),
    (gen_random_uuid(), 'POS', 'CREATE',        'Create POS transactions'),
    (gen_random_uuid(), 'POS', 'VOID',          'Void POS transactions (Supervisor only, SOD-003)'),
    (gen_random_uuid(), 'POS', 'EXPORT',        'Export POS data'),
    -- INVOICE
    (gen_random_uuid(), 'INVOICE', 'READ',      'View invoices'),
    (gen_random_uuid(), 'INVOICE', 'CREATE',    'Create invoices'),
    (gen_random_uuid(), 'INVOICE', 'UPDATE',    'Edit invoices'),
    (gen_random_uuid(), 'INVOICE', 'DELETE',    'Delete invoices'),
    (gen_random_uuid(), 'INVOICE', 'POST',      'Post invoices'),
    (gen_random_uuid(), 'INVOICE', 'EXPORT',    'Export invoice data'),
    -- PAYMENT
    (gen_random_uuid(), 'PAYMENT', 'READ',      'View payments'),
    (gen_random_uuid(), 'PAYMENT', 'CREATE',    'Create payments'),
    (gen_random_uuid(), 'PAYMENT', 'UPDATE',    'Edit payments'),
    (gen_random_uuid(), 'PAYMENT', 'APPROVE',   'Approve payments (SOD-002 enforced)'),
    (gen_random_uuid(), 'PAYMENT', 'POST',      'Post payments'),
    (gen_random_uuid(), 'PAYMENT', 'EXPORT',    'Export payment data'),
    -- ACCOUNTING
    (gen_random_uuid(), 'ACCOUNTING', 'READ',   'View journal entries and COA'),
    (gen_random_uuid(), 'ACCOUNTING', 'CREATE', 'Create manual journal entries'),
    (gen_random_uuid(), 'ACCOUNTING', 'UPDATE', 'Edit draft journal entries'),
    (gen_random_uuid(), 'ACCOUNTING', 'POST',   'Post journal entries'),
    (gen_random_uuid(), 'ACCOUNTING', 'EXPORT', 'Export accounting data'),
    -- REPORT
    (gen_random_uuid(), 'REPORT', 'READ',       'View basic reports'),
    (gen_random_uuid(), 'REPORT', 'EXPORT',     'Export reports'),
    -- ADMIN
    (gen_random_uuid(), 'ADMIN', 'READ',        'View admin settings'),
    (gen_random_uuid(), 'ADMIN', 'CREATE',      'Create admin records'),
    (gen_random_uuid(), 'ADMIN', 'UPDATE',      'Update admin settings'),
    (gen_random_uuid(), 'ADMIN', 'DELETE',      'Delete admin records'),
    -- Special permissions
    (gen_random_uuid(), 'PRICE',     'OVERRIDE',       'Override selling price below floor price'),
    (gen_random_uuid(), 'DISCOUNT',  'OVERRIDE',       'Override discount beyond configured limit'),
    (gen_random_uuid(), 'STOCK',     'ADJUST',         'Perform manual stock adjustments'),
    (gen_random_uuid(), 'STOCK',     'OPNAME',         'Initiate and finalize stock opname'),
    (gen_random_uuid(), 'PERIOD',    'CLOSE',          'Close fiscal periods'),
    (gen_random_uuid(), 'JOURNAL',   'REVERSE',        'Reverse posted journal entries'),
    (gen_random_uuid(), 'REPORT',    'FINANCIAL',      'Access financial reports (P&L, Balance Sheet, etc.)'),
    (gen_random_uuid(), 'REPORT',    'EXECUTIVE',      'Access executive dashboard'),
    (gen_random_uuid(), 'ADMIN',     'SETTINGS',       'Modify system settings'),
    (gen_random_uuid(), 'ADMIN',     'USER',           'Manage users and roles');
