import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    tcPr.append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>'))

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def create_complete_proposal_docx(output_path):
    doc = Document()

    # Setup Page Margins (1 inch / 72pt)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
        # Header & Footer setup
        footer = section.footer
        f_p = footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        f_run = f_p.add_run("Proposal Penawaran Lisensi Sistem Terpadu: Inventory + POS + Finance | Dokumen Resmi")
        f_run.font.name = 'Calibri'
        f_run.font.size = Pt(8.5)
        f_run.font.color.rgb = RGBColor(156, 163, 175)

    PRIMARY = RGBColor(30, 58, 138)     # Deep Navy (#1E3A8A)
    SECONDARY = RGBColor(13, 148, 136) # Teal / Slate Cyan (#0D9488)
    DARK = RGBColor(31, 41, 55)         # Charcoal Dark (#1F2937)
    MUTED = RGBColor(107, 114, 128)     # Gray (#6B7280)
    AMBER = RGBColor(180, 83, 9)        # Amber (#B45309)

    # -------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_doc_id = p_meta.add_run("DOKUMEN PENAWARAN RESMI  |  NO: PROP/EIPF/2026/L-01\n")
    r_doc_id.font.name = 'Calibri'
    r_doc_id.font.size = Pt(9.5)
    r_doc_id.font.bold = True
    r_doc_id.font.color.rgb = SECONDARY

    for _ in range(2):
        doc.add_paragraph()

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(12)
    p_title.paragraph_format.line_spacing = 1.15
    r_title = p_title.add_run("PROPOSAL PENAWARAN LISENSI APLIKASI SISTEM TERPADU:\nENTERPRISE INVENTORY, POS & FINANCIAL GOVERNANCE SYSTEM")
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(22)
    r_sub = p_sub.add_run(
        "Penjualan Lisensi Perangkat Lunak Penuh (Outright Perpetual License). "
        "Sistem Mandiri (On-Premise / Private Cloud), Bebas Biaya Sewa Berlangganan (No SaaS), "
        "Bebas Jumlah Cabang & Pengguna (Unlimited), dengan Kedaulatan Data 100% Milik Perusahaan."
    )
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = DARK

    # Callout box on cover
    cover_box = doc.add_table(rows=1, cols=1)
    cover_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_cell = cover_box.rows[0].cells[0]
    set_cell_background(c_cell, "F0FDF4") # Light Emerald
    set_cell_margins(c_cell, 180, 180, 200, 200)
    c_p = c_cell.paragraphs[0]
    c_r1 = c_p.add_run("✓ SKEMA INVESTASI HAK MILIK SEUMUR HIDUP & TERUJI STANDAR BANK-GRADE\n")
    c_r1.font.bold = True
    c_r1.font.size = Pt(10)
    c_r1.font.color.rgb = RGBColor(22, 101, 52)
    c_r2 = c_p.add_run(
        "Investasi satu kali untuk kepemilikan software seumur hidup. Sistem telah lolos audit keamanan penetrasi otonom "
        "(PentAGI Security Audit) terhadap kebocoran kasir (Anti-IDOR), pencegahan stok minus serentak (Race Condition), "
        "validasi transaksi ketat, dan enkripsi kriptografi tingkat tinggi."
    )
    c_r2.font.size = Pt(9.5)
    c_r2.font.color.rgb = RGBColor(21, 128, 61)

    for _ in range(3):
        doc.add_paragraph()

    # Meta Table at bottom of cover
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Ditujukan Kepada:", "Direksi, Tim Manajemen Eksekutif & Pemilik Perusahaan"),
        ("Model Penawaran:", "Penjualan Lisensi Software Penuh (One-Time Perpetual License)"),
        ("Disusun Oleh:", "Tim Pengembang Solusi Teknologi Informasi"),
        ("Status Aplikasi:", "Production-Ready & Teruji Audit Keamanan Siber")
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.2)
        c2.width = Inches(4.3)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(k)
        r1.font.bold = True
        r1.font.size = Pt(10)
        r1.font.color.rgb = PRIMARY
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(v)
        r2.font.size = Pt(10)
        r2.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 1. EXECUTIVE SUMMARY & MODEL KEPEMILIKAN LISENSI
    # -------------------------------------------------------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(8)
    r_h1 = h1.add_run("1. Ringkasan Eksekutif (Executive Summary)")
    r_h1.font.name = 'Calibri'
    r_h1.font.size = Pt(16)
    r_h1.font.bold = True
    r_h1.font.color.rgb = PRIMARY

    p_body1 = doc.add_paragraph()
    p_body1.paragraph_format.space_after = Pt(8)
    p_body1.paragraph_format.line_spacing = 1.15
    p_body1.add_run(
        "Banyak pelaku bisnis ritel, distribusi, dan perdagangan saat ini merasa terjebak dalam skema sewa perangkat lunak (SaaS). "
        "Sistem SaaS mengenakan tarif per kasir, per cabang, dan per bulan secara berulang selamanya. "
        "Semakin berkembang cabang usaha dan jumlah staf kasir, tagihan bulanan justru melonjak drastis. "
        "Selain itu, basis data transaksi rahasia dan laporan keuangan perusahaan tersimpan di server pihak ketiga yang rawan kebocoran."
    )

    p_body2 = doc.add_paragraph()
    p_body2.paragraph_format.space_after = Pt(14)
    p_body2.paragraph_format.line_spacing = 1.15
    p_body2.add_run(
        "Proposal ini menawarkan solusi strategis berupa PENJUALAN LISENSI PENUH (PERPETUAL SOFTWARE LICENSE). "
        "Sistem terpadu ini mencakup operasional Point of Sale (POS) di kasir, manajemen multi-gudang dan rantai pasok, "
        "hingga pembukuan akuntansi otomatis berpasangan (Double-Entry General Ledger). "
        "Dengan model lisensi putus, perangkat lunak menjadi aset digital milik perusahaan Anda seumur hidup. "
        "Aplikasi dipasang langsung di server lokal kantor (On-Premise) atau Private Cloud milik Anda, "
        "menjamin 100% kedaulatan data finansial, kebebasan ekspansi toko tanpa biaya tambahan, dan efisiensi anggaran jangka panjang."
    )

    # -------------------------------------------------------------
    # 2. KOMPARASI: LISENSI PENUH VS SEWA SAAS
    # -------------------------------------------------------------
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(8)
    r_h2 = h2.add_run("2. Studi Komparasi: Model Lisensi Penuh vs Model Sewa (SaaS)")
    r_h2.font.name = 'Calibri'
    r_h2.font.size = Pt(16)
    r_h2.font.bold = True
    r_h2.font.color.rgb = PRIMARY

    table_comp = doc.add_table(rows=6, cols=3)
    table_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Aspek Analisis", "Model Sewa / Langganan (SaaS)", "Model Lisensi Penuh (Penawaran Kami)"]
    
    for j, text in enumerate(headers):
        cell = table_comp.rows[0].cells[j]
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, 140, 140, 160, 160)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    comp_rows = [
        ("Biaya Perangkat Lunak", "Biaya sewa berulang selamanya. Jika berhenti bayar, akses software langsung dicabut vendor.", "Investasi 1x di awal (One-time Capex). Lisensi berlaku seumur hidup tanpa tagihan sewa bulanan apapun."),
        ("Simulasi Biaya 3 Tahun (5 Toko)", "± Rp 108.000.000,- (asumsi Rp 600rb/toko/bln untuk modul POS + Akuntansi).", "Hanya Rp 35.000.000 - Rp 55.000.000,- sekali bayar. Menghemat puluhan hingga ratusan juta rupiah."),
        ("Kapasitas Cabang & User", "Dibatasi ketat. Ada biaya tambahan setiap kali menambah user kasir atau membuka cabang baru.", "Bebas tanpa batas (Unlimited Outlets & Users). Ekspansi 10 atau 50 cabang baru tanpa biaya lisensi lagi."),
        ("Kedaulatan & Keamanan Data", "Database tersimpan di cloud publik vendor, rentan diintip kompetitor atau bocor.", "100% Data Sovereignty. Database PostgreSQL berada di server internal perusahaan Anda sendiri."),
        ("Ketergantungan Internet", "Jika koneksi internet putus atau server vendor down, operasional kasir berhenti total.", "Mendukung jaringan intranet lokal (LAN). Meja kasir tetap melayani pelanggan saat internet eksternal padam.")
    ]

    for i, row_data in enumerate(comp_rows):
        row = table_comp.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(row_data):
            cell = row.cells[j]
            set_cell_background(cell, bg)
            set_cell_margins(cell, 120, 120, 140, 140)
            p = cell.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 2:
                r.font.color.rgb = RGBColor(15, 118, 110) # Dark teal
            else:
                r.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 3. FITUR DAN MODUL SISTEM LENGKAP
    # -------------------------------------------------------------
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(12)
    h3.paragraph_format.space_after = Pt(8)
    r_h3 = h3.add_run("3. Seluruh Modul Terpadu Termasuk dalam Satu Lisensi")
    r_h3.font.name = 'Calibri'
    r_h3.font.size = Pt(16)
    r_h3.font.bold = True
    r_h3.font.color.rgb = PRIMARY

    p_mod_intro = doc.add_paragraph()
    p_mod_intro.paragraph_format.space_after = Pt(6)
    p_mod_intro.add_run(
        "Lisensi yang Anda beli mencakup **seluruh modul inti sistem** tanpa ada fitur yang dikunci atau dibatasi. "
        "Semua kemampuan berikut langsung aktif dan siap digunakan sejak hari pertama:"
    )

    modules = [
        ("A. Modul Point of Sale (POS) & Kasir Cepat", [
            "Antarmuka kasir ultra-responsif, kompatibel dengan barcode scanner laser, printer thermal struk, dan laci uang otomatis (cash drawer).",
            "Manajemen Shift & Laci Kasir: Wajib input modal kas awal, pencatatan kas kecil (petty cash), dan blind count saat tutup shift.",
            "Multi-Metode Pembayaran: Pembayaran Tunai, QRIS dinamis/statis, EDC Debit/Kredit, Transfer Bank, dan Piutang Jatuh Tempo Pelanggan.",
            "Pencegahan Fraud Kasir: Proteksi void struk berbasis hak akses supervisor, batasan diskon staf maksimal, dan larangan harga minus."
        ]),
        ("B. Modul Manajemen Pergudangan & Inventaris (Multi-Warehouse Engine)", [
            "Multi-Cabang & Multi-Gudang: Tata kelola terpisah antara gudang utama logistik, gudang display toko cabang, maupun gudang retur.",
            "Row-Level Database Locking (Anti-Stok Minus): Menjamin tidak akan pernah terjadi overselling meskipun kasir checkout serentak.",
            "Surat Jalan & Transfer Stok Antar Cabang: Alur mutasi stok antar cabang lengkap dengan status verifikasi terima fisik barang.",
            "Stock Opname Digital: Fitur audit fisik berkala, menghitung selisih persediaan fisik dengan catatan sistem dan auto-adjustment."
        ]),
        ("C. Modul Pengadaan & Rantai Pasok (Purchasing & Supply Chain)", [
            "Purchase Request (PR) & Purchase Order (PO) otomatis saat stok barang mencapai batas minimum pemesanan ulang (Reorder Point).",
            "Penerimaan Barang (Goods Receipt / GR) dengan pencocokan parsial terhadap dokumen pesanan dan faktur pemasok.",
            "Retur Pembelian (Purchase Return) terintegrasi langsung dengan pemotongan hutang dagang supplier (Debit Note)."
        ]),
        ("D. Modul Akuntansi & Tata Kelola Keuangan (Financial Governance)", [
            "Chart of Accounts (COA) Fleksibel: Struktur bagan akun standar akuntansi Indonesia yang dapat disesuaikan dengan kebutuhan perusahaan.",
            "Otomatisasi Jurnal Umum (Double-Entry): Setiap transaksi POS kasir dan mutasi barang langsung membentuk jurnal debit-kredit otomatis.",
            "Laporan Keuangan Real-Time Standar SAK: Laporan Laba Rugi (Income Statement), Neraca Keuangan (Balance Sheet), dan Arus Kas (Cash Flow).",
            "Manajemen Piutang Usaha (AR) & Hutang Usaha (AP): Lengkap dengan tabel umur piutang (Aging Schedule) untuk mengontrol likuiditas.",
            "Rekonsiliasi Bank: Modul pencocokan mutasi rekening koran bank dengan catatan kas internal secara otomatis."
        ]),
        ("E. Modul Keamanan Siber Bank-Grade & Audit Trail (PentAGI Verified)", [
            "Role-Based Access Control (RBAC): Pemisahan wewenang bertingkat (Owner, Finance Manager, Warehouse, Purchasing, Kasir).",
            "Keamanan Terverifikasi PentAGI: Teruji tangguh terhadap serangan IDOR shift kasir, pembobolan otorisasi, dan race condition stok.",
            "Immutable Audit Log: Setiap perubahan data produk, harga jual, transaksi kasir, dan jurnal tersimpan permanen tanpa bisa dihapus staf."
        ])
    ]

    for title, points in modules:
        p_m = doc.add_paragraph()
        p_m.paragraph_format.space_before = Pt(8)
        p_m.paragraph_format.space_after = Pt(2)
        r_m = p_m.add_run(title)
        r_m.font.name = 'Calibri'
        r_m.font.size = Pt(11.5)
        r_m.font.bold = True
        r_m.font.color.rgb = SECONDARY

        for pt in points:
            p_pt = doc.add_paragraph(style='List Bullet')
            p_pt.paragraph_format.space_after = Pt(2)
            p_pt.paragraph_format.line_spacing = 1.15
            r_pt = p_pt.add_run(pt)
            r_pt.font.name = 'Calibri'
            r_pt.font.size = Pt(9.5)
            r_pt.font.color.rgb = DARK

    # -------------------------------------------------------------
    # 4. ARSITEKTUR TEKNOLOGI MODERN
    # -------------------------------------------------------------
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(8)
    r_h4 = h4.add_run("4. Arsitektur Teknologi & Kesiapan Skalabilitas")
    r_h4.font.name = 'Calibri'
    r_h4.font.size = Pt(16)
    r_h4.font.bold = True
    r_h4.font.color.rgb = PRIMARY

    table_tech = doc.add_table(rows=5, cols=3)
    table_tech.alignment = WD_TABLE_ALIGNMENT.CENTER
    tech_headers = ["Komponen Sistem", "Teknologi Enterprise", "Keunggulan bagi Perusahaan Klien"]
    for j, th in enumerate(tech_headers):
        c = table_tech.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 130, 130, 150, 150)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    tech_rows = [
        ("Backend Engine", "NestJS (TypeScript Enterprise)", "Kinerja pemrosesan tinggi, arsitektur modular standar industri, mudah diintegrasikan."),
        ("Frontend Web POS", "React 19 + Vite SPA", "Beban akses halaman ultra cepat (<0.5 detik), tidak membutuhkan komputer kasir berspesifikasi tinggi."),
        ("Relational Database", "PostgreSQL 16 Enterprise", "Standar keamanan perbankan, kepatuhan transaksi ACID, dan keandalan data finansial."),
        ("In-Memory Caching", "Redis 7 High-Speed Store", "Eksekusi session kasir dan proteksi penembakan sistem (rate-limit) dalam hitungan sub-milidetik.")
    ]
    for i, tr in enumerate(tech_rows):
        row = table_tech.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(tr):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 110, 110, 130, 130)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            else:
                r.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 5. STRUKTUR INVESTASI LISENSI & SKEMA PEMBAYARAN
    # -------------------------------------------------------------
    h5 = doc.add_paragraph()
    h5.paragraph_format.space_before = Pt(12)
    h5.paragraph_format.space_after = Pt(8)
    r_h5 = h5.add_run("5. Struktur Investasi Lisensi Penuh & Skema Pembayaran")
    r_h5.font.name = 'Calibri'
    r_h5.font.size = Pt(16)
    r_h5.font.bold = True
    r_h5.font.color.rgb = PRIMARY

    p_inv = doc.add_paragraph()
    p_inv.paragraph_format.space_after = Pt(8)
    p_inv.paragraph_format.line_spacing = 1.15
    p_inv.add_run(
        "Penawaran ini merupakan paket implementasi terpadu hulu-ke-hilir. "
        "Klien memperoleh hak milik lisensi software secara penuh, instalasi di server klien, konfigurasi Chart of Accounts, "
        "migrasi data master, serta pelatihan seluruh staf operasional:"
    )

    table_inv = doc.add_table(rows=7, cols=3)
    table_inv.alignment = WD_TABLE_ALIGNMENT.CENTER
    inv_headers = ["Komponen Pekerjaan", "Uraian & Spesifikasi Deliverable", "Status / Keterangan"]
    for j, ih in enumerate(inv_headers):
        c = table_inv.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 140, 140, 150, 150)
        p = c.paragraphs[0]
        r = p.add_run(ih)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    inv_rows = [
        ("1. Lisensi Software Penuh (Perpetual License)", "Hak penggunaan seumur hidup tanpa biaya sewa SaaS. Bebas tanpa batasan jumlah cabang, toko, user kasir, maupun volume transaksi.", "Termasuk (Hak Milik Penuh)"),
        ("2. Instalasi & Deployment Server", "Instalasi backend NestJS, database PostgreSQL 16, Redis, dan frontend React 19 di server kantor lokal (On-Premise) atau Private Cloud Klien.", "Termasuk (Siap Pakai)"),
        ("3. Setup Akuntansi & Konfigurasi COA", "Penyusunan Chart of Accounts standar, pengaturan saldo awal buku besar, akun kas/bank, dan konfigurasi aturan jurnal otomatis.", "Termasuk (Sesuai SOP Klien)"),
        ("4. Migrasi Data Master Bisnis", "Import dan verifikasi data produk, barcode, harga jual, data pelanggan, supplier, serta saldo awal persediaan barang via template Excel.", "Termasuk (Tervalidasi)"),
        ("5. Pelatihan Staf (Training) & UAT", "Pelatihan langsung untuk seluruh staf kasir, tim gudang, purchasing, serta admin akuntansi hingga berita acara UAT ditandatangani.", "Termasuk (On-site / Online)"),
        ("6. Garansi Bebas Bug Awal (6 Bulan)", "Garansi perbaikan bug teknis secara gratis selama 6 (enam) bulan penuh dan pendampingan operasional intensif pasca Go-Live.", "Termasuk (Gratis Rp 0,-)")
    ]

    for i, ir in enumerate(inv_rows):
        row = table_inv.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(ir):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 110, 110, 130, 130)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 2:
                r.font.bold = True
                r.font.color.rgb = RGBColor(22, 101, 52)
            else:
                r.font.color.rgb = DARK

    # Total Investment Callout
    p_box = doc.add_paragraph()
    p_box.paragraph_format.space_before = Pt(12)
    p_box.paragraph_format.space_after = Pt(10)
    
    t_box = doc.add_table(rows=1, cols=1)
    t_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    t_cell = t_box.rows[0].cells[0]
    set_cell_background(t_cell, "EFF6FF") # Soft Blue
    set_cell_margins(t_cell, 150, 150, 180, 180)
    p_t = t_cell.paragraphs[0]
    r_t1 = p_t.add_run("TOTAL NILAI INVESTASI LISENSI PENUH & IMPLEMENTASI LENGKAP:\n")
    r_t1.font.bold = True
    r_t1.font.size = Pt(11)
    r_t1.font.color.rgb = PRIMARY
    r_t2 = p_t.add_run("Rp 35.000.000,- s/d Rp 55.000.000,- (Sesuai Skala Operasional Klien)\n")
    r_t2.font.bold = True
    r_t2.font.size = Pt(13)
    r_t2.font.color.rgb = AMBER
    r_t3 = p_t.add_run(
        "*Catatan: Investasi satu kali bayar (one-time license fee). Bebas biaya sewa bulanan, bebas royalti per transaksi, "
        "dan bebas biaya pembukaan cabang baru di masa depan."
    )
    r_t3.font.italic = True
    r_t3.font.size = Pt(9)
    r_t3.font.color.rgb = MUTED

    # Tahapan Pembayaran (Term of Payment)
    h5_top = doc.add_paragraph()
    h5_top.paragraph_format.space_before = Pt(8)
    h5_top.paragraph_format.space_after = Pt(4)
    r_top = h5_top.add_run("Tahapan Pembayaran Transparan (Term of Payment / TOP):")
    r_top.font.bold = True
    r_top.font.size = Pt(11)
    r_top.font.color.rgb = PRIMARY

    table_top = doc.add_table(rows=4, cols=3)
    table_top.alignment = WD_TABLE_ALIGNMENT.CENTER
    top_headers = ["Tahap Pembayaran", "Persentase", "Kriteria Penagihan (Milestone Trigger)"]
    for j, th in enumerate(top_headers):
        c = table_top.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 110, 110, 130, 130)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    top_data = [
        ("Tahap I (Uang Muka / DP)", "40%", "Dibayarkan saat penandatanganan lembar persetujuan proposal / kontrak implementasi sebelum instalasi dimulai."),
        ("Tahap II (Progress Setup & Training)", "40%", "Dibayarkan setelah server berhasil diinstal, data master produk selesai dimigrasi, dan pelatihan staf kasir selesai."),
        ("Tahap III (Pelunasan Akhir)", "20%", "Dibayarkan saat sistem resmi beroperasi melayani transaksi nyata (Go-Live) dan penandatanganan Berita Acara Serah Terima (BAST).")
    ]
    for i, td in enumerate(top_data):
        row = table_top.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(td):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 100, 100, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 1:
                r.font.bold = True
                r.font.color.rgb = SECONDARY
            else:
                r.font.color.rgb = DARK

    # -------------------------------------------------------------
    # 6. JADWAL IMPLEMENTASI (ROADMAP 4 MINGGU)
    # -------------------------------------------------------------
    h6 = doc.add_paragraph()
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(8)
    r_h6 = h6.add_run("6. Jadwal Kerja & Roadmap Implementasi (4 Minggu)")
    r_h6.font.name = 'Calibri'
    r_h6.font.size = Pt(16)
    r_h6.font.bold = True
    r_h6.font.color.rgb = PRIMARY

    table_time = doc.add_table(rows=5, cols=4)
    table_time.alignment = WD_TABLE_ALIGNMENT.CENTER
    time_headers = ["Tahapan Milestone", "Durasi", "Aktivitas Utama", "Hasil Nyata (Deliverable)"]
    for j, th in enumerate(time_headers):
        c = table_time.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 120, 120, 140, 140)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    time_rows = [
        ("Tahap 1: Setup Server & COA", "Minggu 1", "Pemasangan sistem di server klien, konfigurasi database, dan setup Chart of Accounts.", "Server Siap & Lingkungan Terkonfigurasi"),
        ("Tahap 2: Migrasi Data Master", "Minggu 2", "Import data master produk, barcode, harga jual, data pelanggan, supplier, dan stok awal.", "Database Lengkap & Tervalidasi"),
        ("Tahap 3: Pelatihan & UAT", "Minggu 3", "Pelatihan staf kasir, tim gudang, serta admin akuntansi. Simulasi transaksi nyata hulu-hilir.", "Berita Acara User Acceptance Test (UAT)"),
        ("Tahap 4: Go-Live & Handover", "Minggu 4", "Peluncuran operasional live di toko, pendampingan transaksi kasir, dan penyerahan sertifikat lisensi.", "Sistem Beroperasi Penuh & Sertifikat Lisensi")
    ]
    for i, tr in enumerate(time_rows):
        row = table_time.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(tr):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 100, 100, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            else:
                r.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 7. GARANSI, PERBAIKAN BUG & LAYANAN PURNA JUAL
    # -------------------------------------------------------------
    h7 = doc.add_paragraph()
    h7.paragraph_format.space_before = Pt(12)
    h7.paragraph_format.space_after = Pt(8)
    r_h7 = h7.add_run("7. Jaminan Garansi Bebas Bug & Standar Layanan Purna Jual")
    r_h7.font.name = 'Calibri'
    r_h7.font.size = Pt(16)
    r_h7.font.bold = True
    r_h7.font.color.rgb = PRIMARY

    p_sla_intro = doc.add_paragraph()
    p_sla_intro.paragraph_format.space_after = Pt(8)
    p_sla_intro.paragraph_format.line_spacing = 1.15
    p_sla_intro.add_run(
        "Untuk memberikan kepastian dan ketenangan pikiran bagi manajemen perusahaan, "
        "kami menyediakan skema garansi dan pemeliharaan purna jual yang jelas, transparan, dan terstruktur:"
    )

    # 7.1 Garansi Awal
    p_g = doc.add_paragraph()
    p_g.paragraph_format.space_before = Pt(4)
    p_g.paragraph_format.space_after = Pt(2)
    r_g = p_g.add_run("A. Garansi Bebas Bug (6 Bulan Pertama — GRATIS)")
    r_g.font.bold = True
    r_g.font.size = Pt(11)
    r_g.font.color.rgb = SECONDARY

    p_gt = doc.add_paragraph()
    p_gt.paragraph_format.space_after = Pt(10)
    p_gt.paragraph_format.line_spacing = 1.15
    p_gt.add_run(
        "Selama 6 (enam) bulan pertama terhitung sejak tanggal Go-Live, seluruh perbaikan terhadap potensi bug teknis, "
        "kesalahan formula sistem, atau kendala operasional diselesaikan secara **CUMA-CUMA (Rp 0,- / GRATIS)**. "
        "Bantuan darurat terhadap kendala kasir direspon dengan target SLA < 1 jam kerja."
    )

    # 7.2 Opsi Pasca Garansi
    p_p = doc.add_paragraph()
    p_p.paragraph_format.space_before = Pt(4)
    p_p.paragraph_format.space_after = Pt(2)
    r_p = p_p.add_run("B. Skema Layanan Pemeliharaan Pasca Masa Garansi (Opsional)")
    r_p.font.bold = True
    r_p.font.size = Pt(11)
    r_p.font.color.rgb = SECONDARY

    p_pt_desc = doc.add_paragraph()
    p_pt_desc.paragraph_format.space_after = Pt(6)
    p_pt_desc.paragraph_format.line_spacing = 1.15
    p_pt_desc.add_run(
        "Setelah masa garansi 6 bulan berakhir, sistem tetap dapat digunakan secara normal tanpa ada kewajiban membayar biaya apapun. "
        "Namun jika klien menghendaki pendampingan teknis jangka panjang, tersedia 2 skema pemeliharaan standar industri:"
    )

    table_maint = doc.add_table(rows=6, cols=3)
    table_maint.alignment = WD_TABLE_ALIGNMENT.CENTER
    maint_headers = ["Opsi Layanan Purna Jual", "Cakupan Layanan", "Standar Biaya Jasa"]
    for j, mh in enumerate(maint_headers):
        c = table_maint.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 120, 120, 140, 140)
        p = c.paragraphs[0]
        r = p.add_run(mh)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    maint_rows = [
        ("Opsi 1: Kontrak Pemeliharaan Tahunan (AMC) — Sangat Direkomendasikan", "Perbaikan bug tanpa batas selama 1 tahun penuh, monitoring kesehatan server & backup berkala, serta bantuan darurat prioritas (<1 jam).", "10% - 15% dari nilai lisensi / tahun (± Rp 4.500.000,- s/d Rp 6.000.000,- / tahun)"),
        ("Opsi 2: Perbaikan Bug Minor (On-Demand / Pay-per-Case)", "Penanganan kendala format print struk, perbaikan layout laporan Excel, penyesuaian teks/label, atau salah input pengguna kasir.", "Rp 300.000,- s/d Rp 500.000,- per penanganan kasus"),
        ("Opsi 3: Perbaikan Bug Major (On-Demand / Pay-per-Case)", "Penanganan selisih formula kalkulasi diskon, kendala koneksi kasir ke database, atau masalah integrasi pembayaran.", "Rp 1.000.000,- s/d Rp 2.000.000,- per penanganan kasus"),
        ("Opsi 4: Pemulihan Bencana (Disaster Recovery)", "Pemulihan basis data akibat listrik padam mendadak, kerusakan hardware server, atau migrasi server darurat.", "Rp 2.500.000,- s/d Rp 4.000.000,- per insiden"),
        ("Opsi 5: Permintaan Fitur Baru (Change Request / CR)", "Klien menghendaki modul baru tambahan atau perubahan alur bisnis kustom di luar cakupan proposal awal.", "Rp 1.000.000,- s/d Rp 1.500.000,- per hari kerja (man-day)")
    ]

    for i, mr in enumerate(maint_rows):
        row = table_maint.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(mr):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 100, 100, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(9)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 2:
                r.font.bold = True
                r.font.color.rgb = AMBER
            else:
                r.font.color.rgb = DARK

    # -------------------------------------------------------------
    # 8. LEMBAR KONFIRMASI & PERSETUJUAN KEMITRAAN
    # -------------------------------------------------------------
    h8 = doc.add_paragraph()
    h8.paragraph_format.space_before = Pt(16)
    h8.paragraph_format.space_after = Pt(8)
    r_h8 = h8.add_run("8. Lembar Konfirmasi & Persetujuan Kemitraan")
    r_h8.font.name = 'Calibri'
    r_h8.font.size = Pt(16)
    r_h8.font.bold = True
    r_h8.font.color.rgb = PRIMARY

    p_close = doc.add_paragraph()
    p_close.paragraph_format.space_after = Pt(16)
    p_close.paragraph_format.line_spacing = 1.15
    p_close.add_run(
        "Demikian proposal penawaran lisensi penuh Sistem Enterprise Inventory, POS & Financial Governance ini kami sampaikan. "
        "Kami siap mendemonstrasikan sistem secara langsung dan mendampingi digitalisasi operasional bisnis perusahaan Anda. "
        "Untuk konfirmasi persetujuan penawaran atau penjadwalan demo aplikasi, silakan menandatangani lembar konfirmasi di bawah ini:"
    )

    table_sign = doc.add_table(rows=5, cols=2)
    table_sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    s_col1, s_col2 = table_sign.rows[0].cells[0], table_sign.rows[0].cells[1]
    s_col1.width = Inches(3.2)
    s_col2.width = Inches(3.2)

    p_s1 = s_col1.paragraphs[0]
    r_s1 = p_s1.add_run("Disetujui Oleh Pihak Klien:\n(Manajemen / Direksi Perusahaan)")
    r_s1.font.bold = True
    r_s1.font.size = Pt(10)
    r_s1.font.color.rgb = PRIMARY

    p_s2 = s_col2.paragraphs[0]
    r_s2 = p_s2.add_run("Diajukan Oleh Pihak Pengembang:\n(Tim Solusi Sistem Enterprise)")
    r_s2.font.bold = True
    r_s2.font.size = Pt(10)
    r_s2.font.color.rgb = PRIMARY

    # Empty rows for signature space
    for r_idx in range(1, 4):
        table_sign.rows[r_idx].cells[0].paragraphs[0].add_run("\n")
        table_sign.rows[r_idx].cells[1].paragraphs[0].add_run("\n")

    p_n1 = table_sign.rows[4].cells[0].paragraphs[0]
    p_n1.add_run("Nama: _________________________\nJabatan: ______________________\nTanggal: ______________________").font.size = Pt(9.5)

    p_n2 = table_sign.rows[4].cells[1].paragraphs[0]
    p_n2.add_run("Nama: _________________________\nJabatan: Solution Architect / Lead\nTanggal: ______________________").font.size = Pt(9.5)

    doc.save(output_path)
    print(f"Complete updated proposal successfully generated at: {output_path}")

if __name__ == '__main__':
    target = os.path.abspath('Proposal_Penawaran_Aplikasi_Enterprise_Inventory_POS.docx')
    create_complete_proposal_docx(target)
