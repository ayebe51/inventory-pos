-- Migration: Master Data Tables
-- Task 2.2: categories, brands, units_of_measure, products, customers, suppliers,
--           price_lists, price_list_items, chart_of_accounts, fiscal_periods, payment_methods

-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE "categories" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"       VARCHAR(50)  NOT NULL,
    "name"       VARCHAR(200) NOT NULL,
    "parent_id"  UUID,
    "level"      INTEGER      NOT NULL DEFAULT 1,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- TABLE: brands
-- ============================================================
CREATE TABLE "brands" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"       VARCHAR(50)  NOT NULL,
    "name"       VARCHAR(200) NOT NULL,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- ============================================================
-- TABLE: units_of_measure
-- ============================================================
CREATE TABLE "units_of_measure" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "code"       VARCHAR(20) NOT NULL,
    "name"       VARCHAR(100) NOT NULL,
    "symbol"     VARCHAR(20) NOT NULL,
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- ============================================================
-- TABLE: products
-- Design spec: code max 50, name max 200, standard_cost >= 0,
--              selling_price >= 0, min_selling_price >= 0 (BR-SAL-002 floor price)
-- ============================================================
CREATE TABLE "products" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"              VARCHAR(50)  NOT NULL,
    "barcode"           VARCHAR(100),
    "name"              VARCHAR(200) NOT NULL,
    "description"       TEXT,
    "category_id"       UUID         NOT NULL,
    "brand_id"          UUID,
    "uom_id"            UUID         NOT NULL,
    "uom_purchase_id"   UUID,
    "uom_sales_id"      UUID,
    "cost_method"       VARCHAR(10)  NOT NULL DEFAULT 'WAC',
    "standard_cost"     DECIMAL(18,4) NOT NULL DEFAULT 0,
    "selling_price"     DECIMAL(18,4) NOT NULL DEFAULT 0,
    "min_selling_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_point"     DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reorder_qty"       DECIMAL(18,4) NOT NULL DEFAULT 0,
    "max_stock"         DECIMAL(18,4),
    "is_serialized"     BOOLEAN      NOT NULL DEFAULT false,
    "is_batch_tracked"  BOOLEAN      NOT NULL DEFAULT false,
    "is_active"         BOOLEAN      NOT NULL DEFAULT true,
    "tax_category"      VARCHAR(50),
    "weight"            DECIMAL(10,4),
    "volume"            DECIMAL(10,4),
    "image_url"         VARCHAR(500),
    "notes"             TEXT,
    "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"        TIMESTAMPTZ,

    CONSTRAINT "products_pkey"              PRIMARY KEY ("id"),
    CONSTRAINT "products_standard_cost_ck"  CHECK ("standard_cost" >= 0),
    CONSTRAINT "products_selling_price_ck"  CHECK ("selling_price" >= 0),
    CONSTRAINT "products_min_price_ck"      CHECK ("min_selling_price" >= 0),
    CONSTRAINT "products_cost_method_ck"    CHECK ("cost_method" IN ('WAC', 'FIFO'))
);

CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
-- Partial index for active product lookups (most common query path)
CREATE INDEX "idx_products_active" ON "products"("code", "name")
    WHERE "deleted_at" IS NULL AND "is_active" = true;

ALTER TABLE "products"
    ADD CONSTRAINT "products_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
    ADD CONSTRAINT "products_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
    ADD CONSTRAINT "products_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
    ADD CONSTRAINT "products_uom_purchase_id_fkey"
    FOREIGN KEY ("uom_purchase_id") REFERENCES "units_of_measure"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
    ADD CONSTRAINT "products_uom_sales_id_fkey"
    FOREIGN KEY ("uom_sales_id") REFERENCES "units_of_measure"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- TABLE: customers
-- ============================================================
CREATE TABLE "customers" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"                VARCHAR(50)  NOT NULL,
    "name"                VARCHAR(200) NOT NULL,
    "email"               VARCHAR(200),
    "phone"               VARCHAR(30),
    "address"             TEXT,
    "credit_limit"        DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstanding_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_active"           BOOLEAN      NOT NULL DEFAULT true,
    "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"          TIMESTAMPTZ,

    CONSTRAINT "customers_pkey"             PRIMARY KEY ("id"),
    CONSTRAINT "customers_credit_limit_ck"  CHECK ("credit_limit" >= 0)
);

CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- ============================================================
-- TABLE: suppliers
-- ============================================================
CREATE TABLE "suppliers" (
    "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
    "code"               VARCHAR(50)  NOT NULL,
    "name"               VARCHAR(200) NOT NULL,
    "email"              VARCHAR(200),
    "phone"              VARCHAR(30),
    "address"            TEXT,
    "payment_terms_days" INTEGER      NOT NULL DEFAULT 30,
    "is_active"          BOOLEAN      NOT NULL DEFAULT true,
    "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "deleted_at"         TIMESTAMPTZ,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- ============================================================
-- TABLE: price_lists
-- ============================================================
CREATE TABLE "price_lists" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "code"        VARCHAR(50) NOT NULL,
    "name"        VARCHAR(200) NOT NULL,
    "customer_id" UUID,
    "valid_from"  TIMESTAMPTZ NOT NULL,
    "valid_to"    TIMESTAMPTZ,
    "is_active"   BOOLEAN     NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"  TIMESTAMPTZ,

    CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "price_lists_code_key" ON "price_lists"("code");

ALTER TABLE "price_lists"
    ADD CONSTRAINT "price_lists_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- TABLE: price_list_items
-- ============================================================
CREATE TABLE "price_list_items" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "price_list_id" UUID         NOT NULL,
    "product_id"    UUID         NOT NULL,
    "unit_price"    DECIMAL(18,4) NOT NULL,
    "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_list_items_unit_price_ck" CHECK ("unit_price" >= 0)
);

CREATE UNIQUE INDEX "price_list_items_price_list_id_product_id_key"
    ON "price_list_items"("price_list_id", "product_id");

ALTER TABLE "price_list_items"
    ADD CONSTRAINT "price_list_items_price_list_id_fkey"
    FOREIGN KEY ("price_list_id") REFERENCES "price_lists"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_list_items"
    ADD CONSTRAINT "price_list_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- TABLE: chart_of_accounts
-- Design spec: hierarki 5 level, format kode X.XXX.XXX
--              is_header=true tidak bisa diposting (BR-ACC-006)
--              soft delete only jika ada journal history (BR-ACC-005)
-- ============================================================
CREATE TABLE "chart_of_accounts" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "account_code"     VARCHAR(20) NOT NULL,
    "account_name"     VARCHAR(200) NOT NULL,
    "account_type"     VARCHAR(30) NOT NULL,
    "account_category" VARCHAR(100),
    "parent_id"        UUID,
    "level"            INTEGER     NOT NULL DEFAULT 1,
    "is_header"        BOOLEAN     NOT NULL DEFAULT false,
    "normal_balance"   VARCHAR(10) NOT NULL,
    "is_active"        BOOLEAN     NOT NULL DEFAULT true,
    "is_system"        BOOLEAN     NOT NULL DEFAULT false,
    "branch_id"        UUID,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    "deleted_at"       TIMESTAMPTZ,

    CONSTRAINT "chart_of_accounts_pkey"             PRIMARY KEY ("id"),
    CONSTRAINT "chart_of_accounts_level_ck"         CHECK ("level" BETWEEN 1 AND 5),
    CONSTRAINT "chart_of_accounts_account_type_ck"  CHECK ("account_type" IN (
        'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE',
        'COGS', 'OTHER_INCOME', 'OTHER_EXPENSE'
    )),
    CONSTRAINT "chart_of_accounts_normal_balance_ck" CHECK ("normal_balance" IN ('DEBIT', 'CREDIT'))
);

CREATE UNIQUE INDEX "chart_of_accounts_account_code_key" ON "chart_of_accounts"("account_code");

ALTER TABLE "chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- TABLE: fiscal_periods
-- Design spec: status DRAFT → OPEN → CLOSED, ditutup berurutan (BR-ACC-007)
-- ============================================================
CREATE TABLE "fiscal_periods" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "period_name" VARCHAR(100) NOT NULL,
    "year"        INTEGER      NOT NULL,
    "month"       INTEGER      NOT NULL,
    "start_date"  TIMESTAMPTZ  NOT NULL,
    "end_date"    TIMESTAMPTZ  NOT NULL,
    "status"      VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    "closed_by"   UUID,
    "closed_at"   TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "fiscal_periods_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "fiscal_periods_month_ck"   CHECK ("month" BETWEEN 1 AND 12),
    CONSTRAINT "fiscal_periods_status_ck"  CHECK ("status" IN ('DRAFT', 'OPEN', 'CLOSED')),
    CONSTRAINT "fiscal_periods_dates_ck"   CHECK ("end_date" > "start_date")
);

-- Enforce one period per year/month (BR-ACC-007 sequential closing)
CREATE UNIQUE INDEX "fiscal_periods_year_month_key" ON "fiscal_periods"("year", "month");

ALTER TABLE "fiscal_periods"
    ADD CONSTRAINT "fiscal_periods_closed_by_fkey"
    FOREIGN KEY ("closed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- TABLE: payment_methods
-- ============================================================
CREATE TABLE "payment_methods" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "code"       VARCHAR(20) NOT NULL,
    "name"       VARCHAR(100) NOT NULL,
    "type"       VARCHAR(20) NOT NULL,
    "account_id" UUID,
    "is_active"  BOOLEAN     NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "payment_methods_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "payment_methods_type_ck" CHECK ("type" IN ('CASH', 'CARD', 'TRANSFER', 'EDC', 'OTHER'))
);

CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

ALTER TABLE "payment_methods"
    ADD CONSTRAINT "payment_methods_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
