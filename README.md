# Enterprise Inventory + POS + Finance

Sistem informasi manajemen enterprise berbasis web untuk industri retail distribusi Indonesia.

## Monorepo Structure

```
apps/
├── backend/    # NestJS API (Node.js 20+, TypeScript, Prisma)
└── frontend/   # React 18+ (TypeScript, Ant Design, Zustand)

packages/
└── shared/     # Shared types & utilities
```

## Tech Stack

- **Backend**: NestJS, TypeScript, Prisma, PostgreSQL 15+, Redis 7+
- **Frontend**: React 18+, TypeScript, Ant Design, Apache ECharts, Zustand
- **Auth**: JWT + MFA
- **Architecture**: Domain-Driven Design (DDD), 9 bounded domains

## Core Modules

- Master Data (Product, Customer, Supplier, COA, Warehouse)
- Purchase / Procurement (PR → PO → Goods Receipt → 3-way matching)
- Inventory (Multi-warehouse, append-only ledger, WAC/FIFO)
- POS / Sales (Shift kasir, Sales Order B2B, retur)
- Invoicing & Payment (AR/AP, bank reconciliation)
- Accounting & Finance (Double-entry GL, auto journal, fiscal period)
- Reporting & Analytics (PSAK, aging, executive dashboard)
- Governance (RBAC, audit trail, approval matrix, SOD)
