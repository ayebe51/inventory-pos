# Tech Stack

## Architecture

- **Pattern**: Domain-Driven Design (DDD) dengan 9 bounded domain
- **API Style**: RESTful API, base URL `/api/v1/`
- **Auth**: JWT (access token 15 menit, refresh token 7 hari) + MFA untuk Owner, Finance_Manager, Auditor

## Backend

- **Runtime**: Node.js 20+
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma
- **Validation**: Zod
- **Auth Libraries**: jsonwebtoken, bcrypt (cost factor minimum 12)
- **Testing**: Jest + `fast-check` (unit & property-based testing)
- **Test runner (single run)**: `jest --runInBand`

## Frontend

- **Framework**: React 18+ (TypeScript)
- **State Management**: Zustand
- **UI Components**: Ant Design
- **Charts**: Apache ECharts
- **HTTP Client**: Axios
- **POS Barcode Scan**: Kamera HP/tablet via `BarcodeDetector API` (native browser) atau `@zxing/browser` sebagai fallback — tidak memerlukan hardware scanner eksternal
- **Browser Support**: Chrome 100+, Firefox 100+, Edge 100+

## Infrastructure

- **Database**: PostgreSQL 15+ (primary write + read replica untuk reporting — WAJIB pakai replica untuk semua query laporan)
- **Cache**: Redis 7+ Cluster (TTL 5 menit untuk master data, invalidasi saat update)
- **File Storage**: S3-compatible (laporan Excel/PDF, attachment)
- **Monitoring**: Application performance monitoring
- **Password Hashing**: bcrypt, cost factor minimum 12
- **Primary Keys**: UUID untuk semua entitas

## API Conventions

**Standard Response Envelope**:
```typescript
interface APIResponse<T> {
  success: boolean
  data: T | null
  message: string
  meta?: { page: number; per_page: number; total: number; total_pages: number }
}
```

**Error Response**:
```typescript
interface APIError {
  success: false
  error: { code: ErrorCode; message: string; details?: Record<string, string[]> }
}
```

**HTTP Status Code Mapping**:

| Situasi | Status | Error Code |
|---------|--------|------------|
| Tidak terautentikasi | 401 | `UNAUTHORIZED` |
| Tidak punya permission | 403 | `FORBIDDEN` |
| Data tidak ditemukan | 404 | `NOT_FOUND` |
| Validasi input gagal | 422 | `VALIDATION_ERROR` |
| Business rule dilanggar | 422 | `BUSINESS_RULE_VIOLATION` |
| Period terkunci | 422 | `PERIOD_LOCKED` |
| Stok tidak cukup | 422 | `INSUFFICIENT_STOCK` |
| Perlu approval | 422 | `APPROVAL_REQUIRED` |
| Konflik data | 409 | `CONFLICT` |
| Error server | 500 | `INTERNAL_ERROR` |

## Critical Data Patterns

- **Inventory Ledger**: Append-only — TIDAK BOLEH ada UPDATE/DELETE (BR-INV-002)
- **Stock Balance**: Selalu dihitung `SUM(qty_in) - SUM(qty_out)` dari ledger per `(product_id, warehouse_id)`
- **Soft Delete**: Gunakan `deleted_at` timestamp — tidak ada hard delete kecuali `is_system = true` yang memblokir sepenuhnya
- **Double-Entry**: `SUM(debit) = SUM(credit)` per journal entry, toleransi <= Rp 0,01 (BR-ACC-001)
- **WAC Formula**: `ROUND((current_value + incoming_cost) / (current_qty + incoming_qty), 4)`
- **Atomicity**: Transaksi bisnis + auto journal HARUS dalam satu DB transaction; rollback keduanya jika gagal
- **Audit Log**: Dicatat dalam transaksi DB yang sama dengan operasi bisnis — immutable, tanpa `updated_at`/`deleted_at`

## Concurrency Strategy

- **POS Transactions**: Optimistic locking dengan version field
- **Stock Updates**: Pessimistic locking (`SELECT FOR UPDATE NOWAIT`) untuk operasi kritis
- **Retry**: Exponential backoff max 3x untuk concurrent stock conflicts
- **Document Numbering**: DB unique constraint + retry otomatis untuk race condition

## Performance SLA

| Operasi | Target |
|---------|--------|
| API read (single record) | < 500ms |
| API read (list/paginated) | < 1 detik |
| API write | < 2 detik |
| POS transaction | < 1 detik |
| Report generation | < 10 detik |

## Document Numbering Formats

| Dokumen | Format | Contoh |
|---------|--------|--------|
| Purchase Request | PR-YYYYMM-XXXXX | PR-202501-00001 |
| Purchase Order | PO-YYYYMM-XXXXX | PO-202501-00001 |
| Goods Receipt | GR-YYYYMM-XXXXX | GR-202501-00001 |
| Sales Invoice | INV-YYYYMM-XXXXX | INV-202501-00001 |
| POS Transaction | POS-YYYYMMDD-XXXXX | POS-20250115-00001 |
| Payment Receipt | RCV-YYYYMM-XXXXX | RCV-202501-00001 |
| Payment Voucher | PV-YYYYMM-XXXXX | PV-202501-00001 |
| Journal Entry | JE-YYYYMM-XXXXX | JE-202501-00001 |
| Stock Adjustment | SA-YYYYMM-XXXXX | SA-202501-00001 |
| Stock Opname | SO-YYYYMM-XXXXX | SO-202501-00001 |
| Credit Note | CN-YYYYMM-XXXXX | CN-202501-00001 |
| Debit Note | DN-YYYYMM-XXXXX | DN-202501-00001 |
| Transfer Order | TO-YYYYMM-XXXXX | TO-202501-00001 |

## Auto Journal Events (20 jenis)

| Event | Debit | Credit |
|-------|-------|--------|
| Goods Receipt | Persediaan Barang | GR Clearing |
| Supplier Invoice | GR Clearing | Hutang Dagang |
| Purchase Payment | Hutang Dagang | Kas/Bank |
| Sales Invoice | Piutang Dagang | Pendapatan + PPN Keluaran |
| Sales Invoice COGS | HPP | Persediaan Barang |
| POS Sale | Kas/EDC/Bank | Pendapatan + PPN Keluaran |
| POS Sale COGS | HPP | Persediaan Barang |
| Sales Return | Retur Penjualan + PPN | Piutang/Kas |
| Sales Return Stock | Persediaan Barang | HPP |
| Payment Receipt | Kas/Bank | Piutang Dagang |
| Stock Adjustment (+) | Persediaan Barang | Selisih Persediaan |
| Stock Adjustment (-) | Selisih Persediaan | Persediaan Barang |
| Stock Opname Surplus | Persediaan Barang | Keuntungan Opname |
| Stock Opname Defisit | Kerugian Opname | Persediaan Barang |
| Period Closing Revenue | Pendapatan | Ikhtisar Laba Rugi |
| Period Closing Expense | Ikhtisar Laba Rugi | Beban |
| Period Closing Net | Ikhtisar Laba Rugi | Laba Ditahan |
| Depreciation | Beban Penyusutan | Akumulasi Penyusutan |
| Bank Reconciliation Adj | Selisih Bank | Kas/Bank |
| Write-off AR | Beban Piutang Tak Tertagih | Piutang Dagang |
