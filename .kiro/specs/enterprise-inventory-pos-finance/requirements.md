# Dokumen Persyaratan: Enterprise Inventory + POS + Finance

## Pendahuluan

Sistem informasi manajemen enterprise berbasis web untuk industri retail distribusi Indonesia yang mengintegrasikan modul Inventory, Point of Sale (POS), Purchase/Procurement, Invoicing & Payment, Accounts Receivable/Payable (AR/AP), Accounting & Finance, serta Reporting & Analytics dalam satu platform terpadu.

Sistem mendukung struktur organisasi multi-cabang dan multi-gudang dengan hierarki Head Office → Branch → Warehouse → Outlet/POS Counter, mematuhi regulasi akuntansi Indonesia (PSAK, PPN 11%, PPh, UU Kearsipan), dan mampu menangani 200 concurrent users dengan 100 concurrent POS transactions.

Dokumen ini menurunkan persyaratan fungsional dan non-fungsional dari desain teknis yang telah disetujui, mencakup 9 domain bisnis: Master Data, Purchase/Procurement, Inventory, Sales/POS, Invoicing & Payment, Accounting, Reporting, Governance, dan Non-Fungsional.

## Glosarium

- **System**: Sistem Enterprise Inventory + POS + Finance secara keseluruhan
- **Auth_Service**: Layanan autentikasi dan otorisasi berbasis JWT
- **RBAC_Service**: Layanan Role-Based Access Control dengan granular permission
- **Audit_Service**: Layanan pencatatan audit trail yang immutable
- **Numbering_Service**: Layanan penomoran dokumen otomatis
- **Journal_Engine**: Mesin auto journal double-entry
- **Approval_Engine**: Mesin approval matrix berbasis threshold
- **Period_Manager**: Manajer fiscal period dan period locking
- **Master_Data_Module**: Modul pengelolaan data referensi (produk, customer, supplier, COA, dll)
- **Purchase_Module**: Modul pengadaan (PR, PO, GR)
- **Inventory_Module**: Modul manajemen stok dengan append-only ledger
- **POS_Module**: Modul Point of Sale dan Sales Order
- **Invoice_Module**: Modul invoicing dan payment
- **Accounting_Module**: Modul general ledger dan penutupan periode
- **Reporting_Module**: Modul laporan keuangan dan operasional
- **Governance_Module**: Modul RBAC, audit trail, dan approval
- **WAC**: Weighted Average Cost - metode kalkulasi biaya rata-rata tertimbang
- **FIFO**: First In First Out - metode kalkulasi biaya masuk pertama keluar pertama
- **GR**: Goods Receipt - penerimaan barang dari supplier
- **PO**: Purchase Order - pesanan pembelian ke supplier
- **PR**: Purchase Request - permintaan pembelian internal
- **COA**: Chart of Accounts - daftar akun akuntansi
- **GL**: General Ledger - buku besar akuntansi
- **AR**: Accounts Receivable - piutang dagang
- **AP**: Accounts Payable - hutang dagang
- **PPN**: Pajak Pertambahan Nilai (11% sesuai regulasi Indonesia)
- **PSAK**: Pernyataan Standar Akuntansi Keuangan Indonesia
- **SOD**: Separation of Duties - pemisahan tugas untuk kontrol internal
- **MFA**: Multi-Factor Authentication
- **JWT**: JSON Web Token untuk autentikasi stateless
- **UUID**: Universally Unique Identifier sebagai primary key
- **Soft_Delete**: Penghapusan logis menggunakan field deleted_at
- **Append_Only_Ledger**: Ledger yang hanya bisa ditambah, tidak bisa diubah atau dihapus
- **Floor_Price**: Harga minimum penjualan (min_selling_price) yang tidak boleh dilanggar tanpa override
- **Shift**: Sesi kerja kasir dengan opening dan closing balance
- **Stock_Opname**: Proses penghitungan fisik stok untuk rekonsiliasi
- **Fiscal_Period**: Periode akuntansi (bulanan) yang bisa dibuka dan ditutup
- **Double_Entry**: Sistem pencatatan akuntansi di mana setiap transaksi memiliki debit dan kredit yang sama
- **Trial_Balance**: Neraca saldo yang menampilkan saldo semua akun
- **Head_Office**: Kantor pusat dalam hierarki organisasi
- **Branch**: Cabang dalam hierarki organisasi di bawah Head_Office
- **Warehouse**: Gudang dalam hierarki organisasi di bawah Branch
- **Outlet**: Counter POS dalam hierarki organisasi di bawah Branch
- **Owner**: Persona pemilik bisnis dengan akses penuh ke laporan dan approval tertinggi
- **Sys_Admin**: Persona administrator sistem dengan akses manajemen user dan konfigurasi
- **Finance_Manager**: Persona manajer keuangan dengan akses approval dan penutupan periode
- **Finance_Staff**: Persona staf keuangan dengan akses operasional keuangan
- **Warehouse_Manager**: Persona manajer gudang dengan akses manajemen stok
- **Warehouse_Staff**: Persona staf gudang dengan akses operasional gudang
- **Cashier**: Persona kasir dengan akses transaksi POS
- **Supervisor**: Persona supervisor dengan akses void transaksi dan override harga
- **Purchasing_Staff**: Persona staf pembelian dengan akses pembuatan PO
- **Auditor**: Persona auditor dengan akses read-only ke semua laporan keuangan


## Persyaratan

### Persyaratan 1: Fondasi Sistem dan Autentikasi

**User Story:** Sebagai pengguna sistem, saya ingin dapat login dengan aman dan mengakses fitur sesuai peran saya, sehingga data bisnis terlindungi dan setiap aksi dapat dipertanggungjawabkan.

#### Kriteria Penerimaan

1. WHEN pengguna mengirimkan kredensial yang valid, THE Auth_Service SHALL mengeluarkan access token JWT dengan masa berlaku 15 menit dan refresh token dengan masa berlaku 7 hari
2. WHEN pengguna mengirimkan kredensial yang tidak valid, THE Auth_Service SHALL menolak login dan mengembalikan pesan error tanpa mengungkap detail internal
3. WHEN access token kadaluarsa, THE Auth_Service SHALL mengizinkan pembaruan token menggunakan refresh token yang masih valid
4. WHEN pengguna mengubah password, THE Auth_Service SHALL membatalkan semua sesi aktif pengguna tersebut
5. WHERE pengguna memiliki peran Owner, Finance_Manager, atau Auditor, THE Auth_Service SHALL mewajibkan verifikasi MFA sebelum akses diberikan
6. THE Auth_Service SHALL menyimpan password menggunakan bcrypt dengan cost factor minimum 12
7. WHEN pengguna mengakses endpoint yang memerlukan permission tertentu, THE RBAC_Service SHALL memvalidasi bahwa pengguna memiliki permission tersebut sebelum memproses permintaan
8. IF pengguna tidak memiliki permission yang diperlukan, THEN THE RBAC_Service SHALL mengembalikan HTTP 403 dengan error code FORBIDDEN
9. THE RBAC_Service SHALL mendukung format permission MODULE.ACTION dengan modul: PURCHASE, INVENTORY, SALES, POS, INVOICE, PAYMENT, ACCOUNTING, REPORT, ADMIN
10. THE Audit_Service SHALL mencatat setiap operasi CREATE, UPDATE, DELETE, APPROVE, VOID, POST, dan REVERSE beserta user_id, timestamp, IP address, dan snapshot data sebelum dan sesudah perubahan
11. THE Audit_Service SHALL menyimpan audit log secara immutable tanpa field updated_at atau deleted_at
12. WHEN operasi mutasi dilakukan, THE Audit_Service SHALL mencatat log dalam transaksi database yang sama sehingga log tidak bisa ada tanpa operasi yang berhasil

### Persyaratan 2: Master Data

**User Story:** Sebagai pengguna sistem, saya ingin mengelola data referensi (produk, customer, supplier, COA, gudang) secara terpusat, sehingga semua modul menggunakan data yang konsisten dan akurat.

#### Kriteria Penerimaan

1. WHEN produk baru dibuat, THE Master_Data_Module SHALL menghasilkan UUID unik sebagai primary key dan memvalidasi bahwa kode produk unik di seluruh sistem
2. WHEN produk dicari dengan filter, THE Master_Data_Module SHALL mengembalikan hanya produk yang memenuhi semua kriteria filter yang diberikan
3. WHEN produk dinonaktifkan (soft delete), THE Master_Data_Module SHALL mengisi field deleted_at dengan timestamp saat ini dan tidak menghapus data secara fisik
4. THE Master_Data_Module SHALL memvalidasi bahwa setiap produk memiliki kode maksimal 50 karakter, nama maksimal 200 karakter, standard_cost >= 0, selling_price >= 0, dan min_selling_price >= 0
5. WHEN harga aktif diminta untuk kombinasi produk, customer, dan tanggal tertentu, THE Master_Data_Module SHALL mengembalikan harga dari price list yang berlaku pada tanggal tersebut
6. THE Master_Data_Module SHALL mendukung hierarki organisasi: Head_Office → Branch → Warehouse → Outlet dengan relasi parent-child yang valid
7. WHEN warehouse dibuat, THE Master_Data_Module SHALL memvalidasi bahwa kode warehouse unik dalam satu branch
8. THE Master_Data_Module SHALL mendukung Chart of Accounts dengan hierarki maksimal 5 level dan format kode akun X.XXX.XXX
9. WHEN akun COA yang berstatus is_header=true digunakan dalam journal line, THE Master_Data_Module SHALL menolak dengan pesan error yang jelas
10. THE Numbering_Service SHALL menghasilkan nomor dokumen unik sesuai format yang terdefinisi untuk setiap jenis dokumen (PR-YYYYMM-XXXXX, PO-YYYYMM-XXXXX, GR-YYYYMM-XXXXX, dst)
11. IF terjadi race condition pada penomoran dokumen, THEN THE Numbering_Service SHALL menggunakan database constraint untuk memastikan keunikan dan melakukan retry otomatis

### Persyaratan 3: Purchase / Procurement

**User Story:** Sebagai Purchasing_Staff, saya ingin mengelola siklus pengadaan dari Purchase Request hingga Goods Receipt, sehingga proses pembelian terdokumentasi, terotorisasi, dan terintegrasi dengan stok dan akuntansi.

#### Kriteria Penerimaan

1. WHEN Purchase Request dibuat, THE Purchase_Module SHALL menghasilkan nomor PR unik dengan format PR-YYYYMM-XXXXX dan menyimpan status awal DRAFT
2. WHEN Purchase Order disubmit untuk approval, THE Purchase_Module SHALL menentukan level approval berdasarkan total amount: Level 1 untuk amount < Rp 5.000.000 (Supervisor), Level 2 untuk Rp 5.000.000 - Rp 50.000.000 (Finance_Manager), Level 3 untuk > Rp 50.000.000 (Owner)
3. WHEN Purchase Order diapprove, THE Approval_Engine SHALL memvalidasi bahwa approver memiliki permission PURCHASE.APPROVE dan sesuai dengan level approval yang diperlukan
4. IF pembuat PO dan approver adalah orang yang sama, THEN THE Approval_Engine SHALL menolak approval tersebut sesuai aturan SOD-001
5. WHEN Purchase Order di-reject, THE Purchase_Module SHALL menyimpan alasan penolakan dan mengizinkan revisi untuk kembali ke status DRAFT
6. WHEN Purchase Order di-cancel, THE Purchase_Module SHALL memvalidasi bahwa belum ada Goods Receipt yang dikonfirmasi untuk PO tersebut
7. WHEN Goods Receipt dibuat dari Purchase Order, THE Purchase_Module SHALL memvalidasi bahwa qty yang diterima tidak melebihi qty yang dipesan dikali (1 + toleransi over-receipt)
8. IF qty yang diterima melebihi batas toleransi, THEN THE Purchase_Module SHALL menolak penerimaan dengan error code BUSINESS_RULE_VIOLATION kecuali ada kebijakan over-receipt yang diaktifkan
9. WHEN Goods Receipt dikonfirmasi, THE Purchase_Module SHALL memperbarui qty_received pada setiap baris PO dan mengubah status PO menjadi PARTIALLY_RECEIVED atau FULLY_RECEIVED sesuai kondisi
10. WHEN Goods Receipt dikonfirmasi, THE Journal_Engine SHALL secara otomatis membuat journal entry: Debit Persediaan Barang, Credit GR Clearing, dengan nilai = qty_received * unit_cost
11. WHEN Goods Receipt dikonfirmasi, THE Inventory_Module SHALL menghitung ulang Weighted Average Cost menggunakan formula: WAC_baru = (nilai_stok_lama + nilai_masuk_baru) / (qty_stok_lama + qty_masuk_baru)
12. THE Purchase_Module SHALL mendukung 3-way matching antara PO qty, GR qty, dan supplier invoice qty dalam batas toleransi yang dikonfigurasi
13. IF supplier invoice melebihi PO amount lebih dari 5%, THEN THE Purchase_Module SHALL menolak pembuatan supplier invoice tersebut

### Persyaratan 4: Inventory Management

**User Story:** Sebagai Warehouse_Manager, saya ingin mengelola stok barang secara akurat dengan audit trail lengkap, sehingga posisi stok selalu dapat diandalkan dan setiap pergerakan dapat ditelusuri.

#### Kriteria Penerimaan

1. WHEN pergerakan stok terjadi (GR, penjualan, transfer, adjustment), THE Inventory_Module SHALL mencatat entri baru di inventory_ledger secara append-only tanpa mengubah atau menghapus entri yang sudah ada
2. THE Inventory_Module SHALL menghitung saldo stok menggunakan formula: balance = SUM(qty_in) - SUM(qty_out) dari inventory_ledger per kombinasi (product_id, warehouse_id)
3. IF saldo stok akan menjadi negatif akibat suatu transaksi, THEN THE Inventory_Module SHALL menolak transaksi tersebut dengan error code INSUFFICIENT_STOCK kecuali mode backorder diaktifkan
4. WHEN transfer stok antar gudang dilakukan, THE Inventory_Module SHALL mengurangi stok di gudang asal dan menambah stok di gudang tujuan dalam satu transaksi database yang atomik
5. THE Inventory_Module SHALL memastikan total stok (gudang asal + gudang tujuan) tidak berubah setelah transfer selesai
6. WHEN warehouse dikunci untuk stock opname, THE Inventory_Module SHALL menolak semua pergerakan stok masuk maupun keluar dari warehouse tersebut
7. WHEN stock opname diinisiasi, THE Inventory_Module SHALL mengunci warehouse terkait dan mencatat user yang mengunci beserta alasannya
8. WHEN hasil penghitungan opname disubmit, THE Inventory_Module SHALL menghitung selisih antara qty sistem dan qty fisik untuk setiap produk
9. WHEN stock opname diselesaikan (finalize), THE Inventory_Module SHALL membuat stock adjustment untuk semua selisih, memposting ke inventory ledger, membuat auto journal, dan membuka kembali warehouse
10. WHEN stock adjustment dibuat, THE Inventory_Module SHALL memvalidasi bahwa user memiliki permission STOCK.ADJUST dan adjustment memiliki alasan yang tercatat
11. THE Inventory_Module SHALL mendukung status stok: Available, Reserved, Committed, Damaged, Quarantine, dan Frozen/Locked
12. WHEN stok dalam status In-Transit, THE Inventory_Module SHALL mencegah penjualan stok tersebut sampai diterima di gudang tujuan
13. THE Inventory_Module SHALL mendukung pelacakan batch number dan serial number untuk produk yang memerlukan

### Persyaratan 5: Sales / Point of Sale

**User Story:** Sebagai Cashier, saya ingin memproses transaksi penjualan ritel dengan cepat dan akurat, sehingga pelanggan terlayani dengan baik dan setiap transaksi terintegrasi dengan stok dan akuntansi.

#### Kriteria Penerimaan

1. WHEN kasir membuka shift, THE POS_Module SHALL mencatat opening balance, waktu buka, dan cashier_id, serta menghasilkan shift_id unik
2. IF kasir mencoba membuka shift baru sementara shift sebelumnya masih aktif, THEN THE POS_Module SHALL menolak dengan pesan "Shift sebelumnya belum ditutup"
3. WHEN item ditambahkan ke transaksi POS, THE POS_Module SHALL memverifikasi ketersediaan stok di gudang yang terkait dengan outlet tersebut
4. IF stok tidak mencukupi untuk item yang ditambahkan, THEN THE POS_Module SHALL menolak penambahan item dengan error code INSUFFICIENT_STOCK
5. WHEN harga item di transaksi POS lebih rendah dari floor price produk, THE POS_Module SHALL menolak transaksi kecuali user yang melakukan override memiliki permission PRICE.OVERRIDE
6. WHEN diskon melebihi batas yang dikonfigurasi, THE POS_Module SHALL memerlukan otorisasi dari user dengan permission DISCOUNT.OVERRIDE
7. WHEN pembayaran diproses, THE POS_Module SHALL memvalidasi bahwa total pembayaran dari semua metode >= total amount transaksi
8. WHEN transaksi POS selesai (COMPLETED), THE POS_Module SHALL mengurangi stok di inventory ledger, membuat auto journal penerimaan kas dan COGS, serta menghitung kembalian
9. WHEN transaksi POS selesai, THE Journal_Engine SHALL membuat dua journal entry: (1) Debit Kas/Bank/EDC, Credit Pendapatan Penjualan + PPN Keluaran; (2) Debit HPP, Credit Persediaan Barang
10. WHEN void transaksi diminta, THE POS_Module SHALL memvalidasi bahwa user yang melakukan void memiliki permission POS.VOID (Supervisor)
11. IF kasir mencoba void transaksinya sendiri, THEN THE POS_Module SHALL menolak sesuai aturan SOD-003
12. WHEN kasir menutup shift, THE POS_Module SHALL menghasilkan shift report yang mencakup total transaksi, total per metode pembayaran, dan selisih kas
13. THE POS_Module SHALL mendukung multi-metode pembayaran dalam satu transaksi (tunai, kartu, transfer, EDC)
14. THE POS_Module SHALL mendukung fitur hold dan resume transaksi
15. WHEN Supervisor melakukan force-close shift yang lupa ditutup kasir, THE POS_Module SHALL mencatat shift sebagai AUTO_CLOSED beserta alasan dan user yang melakukan force-close

### Persyaratan 6: Sales Order (B2B)

**User Story:** Sebagai Finance_Staff, saya ingin mengelola pesanan penjualan B2B dengan credit limit check dan fulfillment tracking, sehingga piutang terkontrol dan pengiriman terdokumentasi.

#### Kriteria Penerimaan

1. WHEN Sales Order dibuat untuk customer, THE POS_Module SHALL memverifikasi bahwa total SO tidak melebihi credit limit customer yang tersisa
2. IF credit limit customer terlampaui, THEN THE POS_Module SHALL menolak pembuatan SO dengan pesan yang menyebutkan sisa credit limit
3. WHEN Sales Order diapprove, THE POS_Module SHALL mengubah status menjadi APPROVED dan mengizinkan proses fulfillment
4. WHEN Sales Order di-fulfill, THE POS_Module SHALL membuat Delivery Order dan mengurangi stok di gudang yang ditentukan
5. WHEN retur penjualan dibuat, THE POS_Module SHALL memvalidasi bahwa retur mereferensikan transaksi penjualan asal yang valid
6. WHEN retur penjualan dikonfirmasi, THE Journal_Engine SHALL membuat auto journal: Debit Retur Penjualan + PPN Keluaran, Credit Piutang/Kas; dan Debit Persediaan Barang, Credit HPP


### Persyaratan 7: Invoicing & Payment (AR/AP)

**User Story:** Sebagai Finance_Staff, saya ingin mengelola siklus invoice dan pembayaran secara lengkap termasuk partial payment, overpayment, dan alokasi multi-invoice, sehingga posisi piutang dan hutang selalu akurat dan terintegrasi dengan akuntansi.

#### Kriteria Penerimaan

1. WHEN sales invoice dibuat dari Sales Order atau POS, THE Invoice_Module SHALL menghasilkan nomor invoice unik dengan format INV-YYYYMM-XXXXX dan menyimpan status awal DRAFT
2. WHEN invoice diposting (post), THE Invoice_Module SHALL mengubah status menjadi OPEN dan THE Journal_Engine SHALL secara otomatis membuat journal entry: Debit Piutang Dagang, Credit Pendapatan Penjualan + PPN Keluaran
3. WHEN purchase invoice dibuat dari Goods Receipt, THE Invoice_Module SHALL memvalidasi bahwa total invoice tidak melebihi total PO amount lebih dari 5% sesuai aturan BR-PUR-008
4. IF total purchase invoice melebihi PO amount lebih dari 5%, THEN THE Invoice_Module SHALL menolak pembuatan invoice dengan error code BUSINESS_RULE_VIOLATION
5. WHEN pembayaran parsial diterima untuk invoice, THE Invoice_Module SHALL mengalokasikan pembayaran ke invoice, mengurangi outstanding balance, dan mengubah status invoice menjadi PARTIAL
6. WHEN total pembayaran mencapai nilai invoice, THE Invoice_Module SHALL mengubah status invoice menjadi PAID secara otomatis
7. WHEN satu pembayaran dialokasikan ke beberapa invoice sekaligus, THE Invoice_Module SHALL memastikan total alokasi tidak melebihi jumlah pembayaran yang tersedia
8. IF total alokasi melebihi jumlah pembayaran, THEN THE Invoice_Module SHALL menolak alokasi dengan error code VALIDATION_ERROR
9. WHEN overpayment terjadi (pembayaran melebihi nilai invoice), THE Invoice_Module SHALL mencatat selisih sebagai uang muka customer (advance payment) yang bisa dialokasikan ke invoice berikutnya
10. WHEN tanggal jatuh tempo invoice terlampaui dan invoice belum lunas, THE Invoice_Module SHALL mengubah status invoice menjadi OVERDUE secara otomatis
11. WHEN payment receipt dibuat untuk AR, THE Invoice_Module SHALL menghasilkan nomor dengan format RCV-YYYYMM-XXXXX dan THE Journal_Engine SHALL membuat journal: Debit Kas/Bank, Credit Piutang Dagang
12. WHEN payment voucher dibuat untuk AP, THE Invoice_Module SHALL menghasilkan nomor dengan format PV-YYYYMM-XXXXX dan THE Journal_Engine SHALL membuat journal: Debit Hutang Dagang, Credit Kas/Bank
13. WHEN payment disubmit untuk approval, THE Approval_Engine SHALL memvalidasi bahwa approver memiliki permission PAYMENT.APPROVE dan bukan pembuat payment yang sama sesuai aturan SOD-002
14. IF pembuat payment dan approver adalah orang yang sama, THEN THE Approval_Engine SHALL menolak approval sesuai aturan SOD-002
15. WHEN payment yang sudah diposting perlu dibatalkan, THE Invoice_Module SHALL membuat payment reversal yang mereferensikan payment asal dan THE Journal_Engine SHALL membuat journal pembalik
16. WHEN bank statement diimpor, THE Invoice_Module SHALL mencoba mencocokkan (auto-match) transaksi bank dengan payment yang ada berdasarkan jumlah dan tanggal
17. WHEN rekonsiliasi bank diselesaikan, THE Invoice_Module SHALL mencatat semua item yang sudah dicocokkan dan mengidentifikasi item yang belum cocok (outstanding items)
18. WHEN invoice ditulis-hapus (write-off), THE Invoice_Module SHALL memvalidasi bahwa user memiliki permission INVOICE.WRITE_OFF dan THE Journal_Engine SHALL membuat journal: Debit Beban Piutang Tak Tertagih, Credit Piutang Dagang
19. THE Invoice_Module SHALL mendukung status invoice: DRAFT, OPEN, PARTIAL, PAID, OVERDUE, DISPUTED, CANCELLED, WRITTEN_OFF
20. THE Invoice_Module SHALL mendukung status payment: DRAFT, PENDING_APPROVAL, APPROVED, POSTED, RECONCILED, REVERSED

### Persyaratan 8: Accounting & General Ledger

**User Story:** Sebagai Finance_Manager, saya ingin sistem akuntansi double-entry yang otomatis dan andal dengan manajemen fiscal period yang ketat, sehingga laporan keuangan selalu akurat, dapat diaudit, dan mematuhi standar PSAK Indonesia.

#### Kriteria Penerimaan

1. WHEN journal entry dibuat secara manual, THE Accounting_Module SHALL memvalidasi bahwa total debit sama dengan total credit (selisih <= Rp 0,01 untuk toleransi pembulatan) sebelum memperbolehkan posting
2. IF total debit tidak sama dengan total credit, THEN THE Accounting_Module SHALL menolak posting dengan error code BUSINESS_RULE_VIOLATION dan pesan yang menyebutkan nilai selisih sesuai aturan BR-ACC-001
3. WHEN event bisnis terjadi (GR, POS sale, sales invoice, purchase invoice, payment, stock adjustment, stock opname, sales return, period closing), THE Journal_Engine SHALL secara otomatis membuat journal entry yang sesuai dengan template yang terdefinisi untuk setiap event
4. IF auto journal gagal dibuat setelah transaksi bisnis berhasil, THEN THE Journal_Engine SHALL melakukan rollback seluruh transaksi dan mengembalikan error sehingga transaksi bisnis dan journal selalu konsisten
5. THE Accounting_Module SHALL mendukung Chart of Accounts dengan tipe akun: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COGS, OTHER_INCOME, OTHER_EXPENSE dan hierarki maksimal 5 level
6. WHEN akun COA yang berstatus is_header=true digunakan dalam journal line, THE Accounting_Module SHALL menolak dengan error code VALIDATION_ERROR sesuai aturan BR-ACC-006
7. WHEN fiscal period baru dibuat, THE Period_Manager SHALL memvalidasi bahwa period tidak tumpang tindih dengan period yang sudah ada dan mengikuti urutan kalender
8. WHEN transaksi diposting ke fiscal period yang sudah ditutup, THE Period_Manager SHALL menolak dengan error code PERIOD_LOCKED sesuai aturan BR-ACC-002
9. WHEN Finance_Manager memulai proses penutupan period, THE Period_Manager SHALL memverifikasi checklist wajib: tidak ada open invoice, tidak ada pending payment, semua journal balance, bank reconciliation selesai, dan stock opname selesai
10. IF salah satu item checklist belum selesai, THEN THE Period_Manager SHALL menolak penutupan period dan menampilkan daftar item yang belum selesai
11. WHEN period berhasil ditutup, THE Period_Manager SHALL mengubah status period menjadi CLOSED, memposting closing entries (transfer revenue/expense ke ikhtisar laba rugi), dan membuka period berikutnya secara otomatis
12. WHEN journal reversal diminta, THE Accounting_Module SHALL memvalidasi bahwa user memiliki permission JOURNAL.REVERSE dan journal asal dalam status POSTED
13. WHEN journal reversal dibuat, THE Accounting_Module SHALL membuat journal baru dengan debit dan credit yang dibalik dari journal asal, mereferensikan journal asal, dan mengubah status journal asal menjadi REVERSED
14. THE Accounting_Module SHALL mendukung reversal journal di period yang berbeda dari journal asal (reversal menggunakan tanggal di period aktif)
15. WHEN akun COA yang sudah memiliki journal history dihapus, THE Accounting_Module SHALL menolak penghapusan fisik dan hanya mengizinkan soft delete sesuai aturan BR-ACC-005
16. THE Journal_Engine SHALL mendukung minimal 20 jenis event auto journal: Goods Receipt, Supplier Invoice, Purchase Payment, Sales Invoice, Sales Invoice COGS, POS Sale, POS Sale COGS, Sales Return, Sales Return Stock, Payment Receipt, Stock Adjustment Positif, Stock Adjustment Negatif, Stock Opname Surplus, Stock Opname Defisit, Period Closing Revenue, Period Closing Expense, Period Closing Net, Depreciation, Bank Reconciliation Adjustment, Write-off AR
17. WHEN journal entry diposting, THE Accounting_Module SHALL mencatat posted_by dan posted_at dan mengubah status menjadi POSTED sehingga tidak bisa diubah lagi
18. THE Accounting_Module SHALL memastikan fiscal period ditutup secara berurutan; period yang lebih lama harus ditutup sebelum period yang lebih baru sesuai aturan BR-ACC-007

### Persyaratan 9: Reporting & Analytics

**User Story:** Sebagai Owner dan Finance_Manager, saya ingin mengakses laporan keuangan dan operasional yang akurat dan real-time, sehingga dapat membuat keputusan bisnis berdasarkan data yang dapat diandalkan.

#### Kriteria Penerimaan

1. WHEN executive dashboard diminta oleh pengguna dengan permission REPORT.EXECUTIVE, THE Reporting_Module SHALL mengembalikan data ringkasan: total penjualan, total pembelian, posisi kas, piutang outstanding, hutang outstanding, dan top 5 produk terlaris untuk periode yang dipilih
2. WHEN trial balance diminta untuk suatu fiscal period, THE Reporting_Module SHALL mengembalikan saldo semua akun aktif dengan total debit sama dengan total credit
3. WHEN income statement (laporan laba rugi) diminta, THE Reporting_Module SHALL menghitung pendapatan, HPP, laba kotor, beban operasional, dan laba bersih untuk periode yang dipilih
4. WHEN balance sheet (neraca) diminta, THE Reporting_Module SHALL menampilkan posisi aset, liabilitas, dan ekuitas pada tanggal yang dipilih dengan total aset sama dengan total liabilitas ditambah ekuitas
5. WHEN cash flow statement diminta, THE Reporting_Module SHALL mengklasifikasikan arus kas ke dalam tiga kategori: aktivitas operasi, investasi, dan pendanaan untuk periode yang dipilih
6. WHEN AR aging report diminta, THE Reporting_Module SHALL mengklasifikasikan piutang outstanding ke dalam bucket umur: Current (belum jatuh tempo), 1-30 hari, 31-60 hari, 61-90 hari, dan > 90 hari berdasarkan tanggal jatuh tempo
7. WHEN AP aging report diminta, THE Reporting_Module SHALL mengklasifikasikan hutang outstanding ke dalam bucket umur yang sama dengan AR aging: Current, 1-30 hari, 31-60 hari, 61-90 hari, dan > 90 hari
8. WHEN stock position report diminta, THE Reporting_Module SHALL menampilkan saldo stok per produk per gudang yang konsisten dengan perhitungan SUM(qty_in) - SUM(qty_out) dari inventory ledger
9. WHEN stock movement report diminta, THE Reporting_Module SHALL menampilkan semua pergerakan stok (masuk, keluar, transfer, adjustment) untuk produk dan periode yang dipilih beserta running balance
10. WHEN sales report diminta, THE Reporting_Module SHALL menampilkan ringkasan penjualan per produk, per customer, per cabang, dan per periode dengan nilai penjualan, HPP, dan margin
11. WHEN shift report diminta, THE Reporting_Module SHALL menampilkan total transaksi, total per metode pembayaran, opening balance, closing balance, dan selisih kas untuk shift yang dipilih
12. WHEN laporan diekspor dengan parameter format=xlsx, THE Reporting_Module SHALL menghasilkan file Microsoft Excel yang valid dengan data yang sama dengan tampilan di layar
13. WHEN laporan diekspor dengan parameter format=pdf, THE Reporting_Module SHALL menghasilkan file PDF yang valid dengan header perusahaan, tanggal cetak, dan nomor halaman
14. THE Reporting_Module SHALL mengambil data dari read replica database untuk menghindari beban pada database utama
15. WHEN laporan keuangan diminta oleh pengguna tanpa permission REPORT.FINANCIAL, THE Reporting_Module SHALL menolak dengan HTTP 403
16. WHEN executive dashboard diminta oleh pengguna tanpa permission REPORT.EXECUTIVE, THE Reporting_Module SHALL menolak dengan HTTP 403
17. WHEN laporan diminta dengan filter branch_id, THE Reporting_Module SHALL mengembalikan hanya data dari cabang yang dipilih dan cabang di bawahnya dalam hierarki organisasi

### Persyaratan 10: Governance & Audit Trail

**User Story:** Sebagai Sys_Admin dan Auditor, saya ingin sistem governance yang ketat dengan RBAC granular, audit trail immutable, dan enforcement separation of duties, sehingga setiap aksi dapat dipertanggungjawabkan dan risiko fraud dapat diminimalkan.

#### Kriteria Penerimaan

1. THE RBAC_Service SHALL mendukung format permission MODULE.ACTION dengan modul: PURCHASE, INVENTORY, SALES, POS, INVOICE, PAYMENT, ACCOUNTING, REPORT, ADMIN dan aksi standar: READ, CREATE, UPDATE, DELETE, APPROVE, VOID, POST, LOCK, EXPORT, IMPORT
2. THE RBAC_Service SHALL mendukung permission khusus: PRICE.OVERRIDE, DISCOUNT.OVERRIDE, STOCK.ADJUST, STOCK.OPNAME, PERIOD.CLOSE, JOURNAL.REVERSE, REPORT.FINANCIAL, REPORT.EXECUTIVE, ADMIN.SETTINGS, ADMIN.USER
3. WHEN user mengakses endpoint yang memerlukan permission tertentu, THE RBAC_Service SHALL memvalidasi permission sebelum memproses permintaan dan mengembalikan HTTP 403 jika tidak memiliki permission
4. WHEN role baru dibuat, THE RBAC_Service SHALL memvalidasi bahwa nama role unik dan mengizinkan assignment permission secara granular per role
5. WHEN user di-assign ke role, THE RBAC_Service SHALL mengaktifkan semua permission yang dimiliki role tersebut untuk user tersebut
6. WHEN operasi CREATE, UPDATE, DELETE, APPROVE, VOID, POST, atau REVERSE dilakukan, THE Audit_Service SHALL mencatat audit log yang berisi: user_id, action, entity_type, entity_id, snapshot data sebelum perubahan, snapshot data sesudah perubahan, IP address, user agent, dan timestamp
7. THE Audit_Service SHALL menyimpan audit log secara immutable tanpa field updated_at atau deleted_at sehingga log tidak bisa diubah atau dihapus
8. WHEN audit log dicatat, THE Audit_Service SHALL melakukannya dalam transaksi database yang sama dengan operasi bisnis sehingga log tidak bisa ada tanpa operasi yang berhasil
9. WHEN Auditor mengakses audit trail, THE Audit_Service SHALL mengembalikan log yang dapat difilter berdasarkan user, action, entity_type, entity_id, dan rentang tanggal
10. WHEN pembuat PO dan approver PO adalah orang yang sama, THE Approval_Engine SHALL menolak approval sesuai aturan SOD-001
11. WHEN pembuat payment dan approver payment adalah orang yang sama, THE Approval_Engine SHALL menolak approval sesuai aturan SOD-002
12. WHEN kasir mencoba void transaksinya sendiri, THE POS_Module SHALL menolak sesuai aturan SOD-003
13. WHEN Finance_Staff mencoba menutup fiscal period, THE Period_Manager SHALL menolak karena hanya Finance_Manager yang memiliki permission PERIOD.CLOSE sesuai aturan SOD-004
14. WHEN Warehouse_Staff mencoba melakukan stock adjustment, THE Inventory_Module SHALL menolak karena hanya Warehouse_Manager yang memiliki permission STOCK.ADJUST sesuai aturan SOD-005
15. WHEN Auditor mencoba melakukan operasi CREATE, UPDATE, atau DELETE, THE RBAC_Service SHALL menolak karena Auditor hanya memiliki permission READ sesuai aturan SOD-006
16. WHEN fiscal period ditutup, THE Period_Manager SHALL mengunci semua transaksi di period tersebut sehingga tidak ada modifikasi yang bisa dilakukan
17. IF transaksi mencoba diposting ke period yang sudah ditutup, THEN THE Period_Manager SHALL menolak dengan error code PERIOD_LOCKED beserta informasi period yang terkunci
18. WHEN approval matrix dikonfigurasi, THE Approval_Engine SHALL mendukung multi-level approval berdasarkan threshold amount dan jenis dokumen
19. WHEN approval request kadaluarsa tanpa tindakan, THE Approval_Engine SHALL melakukan eskalasi ke level approver berikutnya secara otomatis
20. THE Governance_Module SHALL memastikan bahwa setiap dokumen yang memerlukan approval tidak bisa diproses lebih lanjut sebelum mendapatkan approval dari semua level yang diperlukan

### Persyaratan 11: Non-Fungsional

**User Story:** Sebagai pengguna sistem, saya ingin sistem yang cepat, aman, dan selalu tersedia, sehingga operasional bisnis tidak terganggu dan data bisnis terlindungi sesuai standar keamanan enterprise.

#### Kriteria Penerimaan

1. WHEN pengguna memuat halaman UI, THE System SHALL menampilkan halaman dalam waktu kurang dari 3 detik pada koneksi broadband standar
2. WHEN API read untuk single record dipanggil, THE System SHALL mengembalikan respons dalam waktu kurang dari 500ms di bawah beban normal
3. WHEN API read untuk list atau data terpaginasi dipanggil, THE System SHALL mengembalikan respons dalam waktu kurang dari 1 detik di bawah beban normal
4. WHEN API write (CREATE, UPDATE, POST) dipanggil, THE System SHALL menyelesaikan operasi dalam waktu kurang dari 2 detik di bawah beban normal
5. WHEN laporan keuangan atau operasional diminta, THE Reporting_Module SHALL menghasilkan laporan dalam waktu kurang dari 10 detik untuk data hingga 12 bulan
6. WHEN transaksi POS diproses, THE POS_Module SHALL menyelesaikan transaksi dalam waktu kurang dari 1 detik untuk memberikan pengalaman kasir yang lancar
7. THE System SHALL mendukung minimal 200 concurrent users tanpa degradasi performa yang signifikan
8. THE System SHALL mendukung minimal 100 concurrent POS transactions secara bersamaan
9. THE System SHALL memiliki availability minimal 99,5% uptime yang diukur secara bulanan (maksimal downtime 3,6 jam per bulan)
10. WHEN terjadi kegagalan sistem, THE System SHALL dapat dipulihkan dalam waktu kurang dari 4 jam (RTO < 4 jam)
11. WHEN terjadi kegagalan sistem, THE System SHALL memastikan kehilangan data tidak lebih dari 1 jam terakhir (RPO < 1 jam) melalui mekanisme backup berkala
12. THE Auth_Service SHALL menggunakan JWT dengan masa berlaku access token 15 menit dan refresh token 7 hari
13. THE Auth_Service SHALL menyimpan password menggunakan bcrypt dengan cost factor minimum 12
14. WHERE pengguna memiliki peran Owner, Finance_Manager, atau Auditor, THE Auth_Service SHALL mewajibkan verifikasi MFA (Multi-Factor Authentication) sebelum akses diberikan
15. THE System SHALL menerapkan HTTPS untuk semua komunikasi antara client dan server
16. THE System SHALL mendukung browser: Google Chrome versi 100 ke atas, Mozilla Firefox versi 100 ke atas, dan Microsoft Edge versi 100 ke atas
17. WHEN laporan diekspor, THE Reporting_Module SHALL mendukung format: JSON (untuk integrasi API), XLSX (Microsoft Excel), dan PDF
18. THE System SHALL menerapkan rate limiting pada endpoint autentikasi untuk mencegah brute force attack
19. WHEN sesi pengguna tidak aktif selama lebih dari 30 menit, THE Auth_Service SHALL mengakhiri sesi dan mewajibkan login ulang
20. THE System SHALL menggunakan soft delete (field deleted_at) untuk semua entitas sehingga data historis tidak pernah dihapus secara fisik dari database
