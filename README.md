# Enterprise Inventory + POS + Finance (Kiro ERP)

[![NestJS](https://img.shields.io/badge/NestJS-10.0+-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0+-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0+-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Apache ECharts](https://img.shields.io/badge/ECharts-6.0+-AA344D?logo=apache-echarts&logoColor=white)](https://echarts.apache.org/)

> A full-scale enterprise resource planning (ERP) system tailored for the Indonesian retail and wholesale distribution industry. Combines multi-warehouse inventory management with an append-only valuation ledger (WAC/FIFO), real-time cashier point-of-sale (POS) with shift drawer reconciliation, automated 3-way matching procurement (PR/PO/GR), and PSAK-compliant double-entry accounting.

---

## 1. Executive Overview & Business Context

Indonesian retail distributors operate across multiple branches and decentralized warehouses while needing strict inventory reconciliation and tight cash controls. Discrepancies commonly emerge from:

1. **Inventory Shrinkage & Lagging Valuation**: Unlinked sales and stock transfers leading to negative stock, unapplied cost-of-goods-sold (COGS), or arbitrary manual inventory adjustments.
2. **Cashier Discrepancies**: High-throughput checkout lanes experiencing cash shortages without shift auditing or dual-signature drawer reconciliation.
3. **Disjointed Accounting**: Purchasing and sales operations disconnected from financial ledgers, requiring slow, error-prone end-of-month manual journals.

**Kiro ERP** eliminates these gaps by establishing an **append-only inventory ledger**, strict database transaction boundaries, and automated event-driven general ledger entries for every commercial event.

---

## 2. Visual Demonstration

### Operational Overview & POS Analytics Dashboard
Live executive view featuring real-time daily turnover, bank/cash balances, inventory asset valuation, low-stock SKU alerts, and sales profitability trends.
![Kiro ERP Operational Dashboard](docs/images/dashboard.webp)

---

## 3. Implemented Core Business Modules

### A. Point of Sale & Cashier Operations (`src/modules/pos`)
- **Shift & Drawer Management**: Opening balance verification, mid-shift cash drops, expected cash calculations, and blind count closure with over/short reconciliation.
- **Fast Cashier Checkout**: Barcode scanning, multi-payment tender (Cash, QRIS, Bank Transfer, Split), customer credit limits, and thermal receipt printing.
- **Sales Return Processing**: Validated receipt-based returns with automatic stock restoration and credit memo issuance.

### B. Inventory & Multi-Warehouse Management (`src/modules/inventory`)
- **Append-Only Inventory Ledger**: All stock movements (`IN`, `OUT`, `TRANSFER`, `ADJUSTMENT`) append immutable ledger rows with weighted-average cost (WAC) calculations.
- **Inter-Warehouse Stock Transfers**: Two-phase transit workflows (Shipment from Source -> In-Transit -> Receipt at Destination).
- **Periodic Stock Opname**: Blind cycle counting, variance calculation, and approved discrepancy write-offs.

### C. Procurement & 3-Way Matching (`src/modules/purchase`)
- **Purchase Requisitions (PR)**: Departmental demand aggregation with multi-tier managerial approval thresholds.
- **Purchase Orders (PO)**: Automated vendor communication and delivery date tracking.
- **Goods Receipts (GR)**: Physical warehouse intake verification with automated 3-way matching against PO and supplier invoices before payment release.

### D. Finance & Double-Entry Accounting (`src/modules/accounting`)
- **Chart of Accounts (COA)**: Standardized Indonesian business accounting hierarchy (Assets, Liabilities, Equity, Revenue, COGS, Expenses).
- **Automated Journal Rules**: Commercial events (sales order fulfillment, purchase receipts, supplier payments) automatically trigger balanced dual-entry journals.
- **Fiscal Periods & Lockouts**: Hard fiscal month/year locks preventing retro-active balance manipulation.

### E. Corporate Governance & RBAC (`src/modules/governance`)
- **Separation of Duties (SOD)**: Separation between order creators, receiving clerks, and invoice approvers.
- **Comprehensive Audit Trail**: Immutable logging of entity changes, user IP addresses, timestamps, and previous values.

---

## 4. Application Architecture

Kiro ERP follows a modular **Domain-Driven Design (DDD)** structure within a NestJS monorepo, pairing an event-driven transactional backend with a high-performance React 19 single-page application.

```mermaid
graph TD
    subgraph Frontend["Frontend Layer (React 19 + TypeScript)"]
        UI["Ant Design UI & Lucide Icons"]
        ZUSTAND["Zustand State Stores"]
        REACT_QUERY["TanStack Query (Cache & Sync)"]
        ECHARTS["Apache ECharts Engine"]
    end

    subgraph API_Gateway["NestJS API & Middleware"]
        CONTROLLER["REST Controllers & Swagger"]
        GUARDS["JWT Auth & RBAC Permission Guards"]
        THROTTLE["Rate Limiting & Helmet Security"]
    end

    subgraph Domain_Modules["Bounded Contexts (DDD)"]
        MOD_POS["POS Module<br/>(Shifts & Transactions)"]
        MOD_INV["Inventory Module<br/>(WAC Ledger & Transfers)"]
        MOD_PURCH["Procurement Module<br/>(PR / PO / 3-Way Match)"]
        MOD_ACC["Accounting Module<br/>(Double-Entry GL & COA)"]
        MOD_GOV["Governance Module<br/>(Audit & RBAC)"]
    end

    subgraph Persistence["Storage & Caching Layer"]
        PRISMA["Prisma ORM Client"]
        POSTGRES[(PostgreSQL 15+<br/>Relational & Invariant DB)]
        REDIS[(Redis 7+<br/>Locking & Caching)]
    end

    UI --> CONTROLLER
    ZUSTAND --> CONTROLLER
    REACT_QUERY --> CONTROLLER

    CONTROLLER --> GUARDS
    GUARDS --> THROTTLE
    THROTTLE --> MOD_POS
    THROTTLE --> MOD_INV
    THROTTLE --> MOD_PURCH
    THROTTLE --> MOD_ACC
    THROTTLE --> MOD_GOV

    MOD_POS --> PRISMA
    MOD_INV --> PRISMA
    MOD_PURCH --> PRISMA
    MOD_ACC --> PRISMA
    MOD_GOV --> PRISMA

    PRISMA --> POSTGRES
    MOD_POS --> REDIS
    MOD_INV --> REDIS
```

---

## 5. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend Framework** | [NestJS 10](https://nestjs.com/), Node.js 20+, TypeScript |
| **Database & ORM** | [PostgreSQL 15+](https://www.postgresql.org/), [Prisma ORM 5](https://www.prisma.io/) |
| **Caching & Concurrency** | [Redis 7+](https://redis.io/) (ioredis) for distributed locks and session caches |
| **Frontend Framework** | [React 19](https://react.dev/), [Vite](https://vitejs.dev/), TypeScript |
| **UI & Styling** | [Ant Design 6](https://ant.design/), [Lucide React](https://lucide.dev/), Custom Glassmorphism Theme |
| **Data Visualization** | [Apache ECharts 6](https://echarts.apache.org/) (`echarts-for-react`) |
| **State & Data Fetching** | [Zustand 5](https://github.com/pmndrs/zustand), [TanStack React Query 5](https://tanstack.com/query) |
| **Security & Auth** | Passport.js, JWT, `otplib` (Time-Based One-Time Passwords / MFA), Helmet, Throttler |
| **Document Generation** | PDFMake, ExcelJS, jsPDF |
| **Testing** | Jest (unit/integration), Playwright (E2E browser tests) |

---

## 6. Repository Structure

```
enterprise-inventory-pos/
├── src/
│   ├── modules/
│   │   ├── accounting/     # Chart of Accounts, General Ledger, auto journals
│   │   ├── governance/     # RBAC, audit logging, multi-step approvals
│   │   ├── inventory/      # Append-only stock ledger, transfers, stock opname
│   │   ├── invoicing/      # AR/AP management, payment allocations, bank recon
│   │   ├── master-data/    # Products, suppliers, customers, warehouses
│   │   ├── pos/            # Cashier checkout, shift management, payments
│   │   ├── purchase/       # Requisitions, purchase orders, goods receipts
│   │   └── reporting/      # PSAK financial statements, stock valuation, aging
│   ├── common/             # Global filters, interceptors, decorators, guards
│   ├── config/             # Typed environment and application configuration
│   └── services/           # Prisma and Redis shared service clients
├── frontend/
│   ├── src/
│   │   ├── components/     # Ant Design layout, navbars, metric widgets
│   │   ├── pages/          # Dashboard, POS terminal, inventory tables, accounting
│   │   ├── stores/         # Zustand auth, cart, shift, and UI state stores
│   │   └── services/       # Typed Axios API clients
│   └── public/             # Static assets, web manifests, offline icons
├── prisma/
│   ├── schema.prisma       # Unified 40+ table relational enterprise schema
│   ├── migrations/         # Version-controlled migration history
│   └── seed.ts             # Deterministic seed data with synthetic records
├── docs/                   # Architecture specs, audit reports, images
│   └── images/             # Authentic dashboard screenshots
└── test/                   # Jest unit and E2E integration suites
```

---

## 7. Environment Requirements & Local Setup

### Prerequisites
- **Node.js**: `v20.x` LTS or higher
- **npm**: `v10.x` or higher
- **PostgreSQL 15+** & **Redis 7+** (Local or via Docker)

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ayebe51/inventory-pos.git
   cd inventory-pos
   ```

2. **Install Backend Dependencies**:
   ```bash
   npm install
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Configure Environment Variables**:
   Create `.env` in root with required parameters:
   ```env
   NODE_ENV=development
   PORT=3000
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kiro_pos?schema=public"
   REDIS_HOST=localhost
   REDIS_PORT=6379
   JWT_SECRET="replace-with-a-secure-random-secret-in-production"
   JWT_EXPIRATION="8h"
   THROTTLE_TTL=60
   THROTTLE_LIMIT=100
   ```

5. **Run Prisma Migrations & Seed Data**:
   ```bash
   npx prisma migrate dev
   npm run prisma:seed
   ```
   *Initializes all tables, constraints, default Chart of Accounts, and sample retail inventory.*

6. **Start the NestJS API**:
   ```bash
   npm run start:dev
   ```
   Backend API runs at `http://localhost:3000` (Swagger documentation at `http://localhost:3000/api/docs`).

7. **Start the React Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend SPA runs at `http://localhost:5173`.

---

## 8. Transaction Integrity & Concurrency Safeguards

1. **Append-Only Ledger**: The `InventoryLedger` table does not permit in-place row edits. Every inventory adjustment, sale, or arrival writes a new discrete entry, guaranteeing verifiable stock traceability.
2. **Pessimistic/Optimistic Locking on Shift Drawers**: Checkout transactions verify concurrent shift status using Redis atomic locks, preventing conflicting double-tender submissions.
3. **Double-Entry Balancing Assertion**: All journal entry creations execute inside a database transaction that verifies `SUM(debit) === SUM(credit)` before committing.

---

## 9. Testing & Quality Assurance

```bash
# Run NestJS unit and integration test suite
npm test

# Run E2E API tests
npm run test:e2e

# Run frontend Playwright browser tests
cd frontend && npm run test:e2e
```

---

## 10. Live Demonstration

The production deployment is hosted at:
**[https://inventory-pos-hazel.vercel.app](https://inventory-pos-hazel.vercel.app/)**

> [!NOTE]
> Access to the live workspace requires credentials with multi-branch role permissions. Demonstration access for technical review or recruiter evaluation is available upon inquiry.

---

## 11. Author & Contact

**Ahmad Ayub Nu'man**  
*Full-Stack Developer & Software Engineer*  
- **GitHub**: [@ayebe51](https://github.com/ayebe51)  
- **Email**: [ayb.n1994@gmail.com](mailto:ayb.n1994@gmail.com)  
- **Portfolio**: [https://ahmadayubnuman.netlify.app](https://ahmadayubnuman.netlify.app)

---

## 12. License

This repository is licensed under the [MIT License](LICENSE) (or proprietary commercial license as designated by project stakeholders).
