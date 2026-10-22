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
        f_run = f_p.add_run("Proposal Solusi Sistem Terpadu: Inventory + POS + Finance | Konsultasi Solusi Bisnis")
        f_run.font.name = 'Calibri'
        f_run.font.size = Pt(8.5)
        f_run.font.color.rgb = RGBColor(156, 163, 175)

    PRIMARY = RGBColor(30, 58, 138)     # Deep Navy (#1E3A8A)
    SECONDARY = RGBColor(13, 148, 136) # Teal / Slate Cyan (#0D9488)
    DARK = RGBColor(31, 41, 55)         # Charcoal Dark (#1F2937)
    MUTED = RGBColor(107, 114, 128)     # Gray (#6B7280)
    AMBER = RGBColor(180, 83, 9)        # Amber (#B45309)
    GREEN = RGBColor(22, 101, 52)       # Emerald Green (#166534)

    # -------------------------------------------------------------
    # COVER PAGE
    # -------------------------------------------------------------
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_doc_id = p_meta.add_run("DOKUMEN EKSPLORASI SOLUSI BISNIS  |  NO: PROP/EIPF/2026/V2\n")
    r_doc_id.font.name = 'Calibri'
    r_doc_id.font.size = Pt(9.5)
    r_doc_id.font.bold = True
    r_doc_id.font.color.rgb = SECONDARY

    for _ in range(2):
        doc.add_paragraph()

    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(12)
    p_title.paragraph_format.line_spacing = 1.15
    r_title = p_title.add_run("PROPOSAL SOLUSI DIGITALISASI OPERASIONAL BISNIS:\nINTEGRASI POINT OF SALE (POS), MANAJEMEN PERSEDIAAN & TATA KELOLA KEUANGAN MANDIRI")
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(21)
    r_title.font.bold = True
    r_title.font.color.rgb = PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(20)
    r_sub = p_sub.add_run(
        "Modernisasi Sistem Operasional Toko & Rantai Pasok Berbasis Hak Milik Mandiri (One-Time Perpetual License). "
        "Bebas Biaya Sewa Berlangganan Bulanan (No SaaS Fee), Tanpa Biaya Lisensi Tambahan per Kasir/User, "
        "serta Menjamin Kedaulatan Data Finansial 100% Milik Perusahaan Anda."
    )
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(11.5)
    r_sub.font.color.rgb = DARK

    # Callout box on cover
    cover_box = doc.add_table(rows=1, cols=1)
    cover_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    c_cell = cover_box.rows[0].cells[0]
    set_cell_background(c_cell, "F0FDF4") # Light Emerald
    set_cell_margins(c_cell, 180, 180, 200, 200)
    c_p = c_cell.paragraphs[0]
    c_r1 = c_p.add_run("✓ PENDEKATAN KEMITRAAN & JAMINAN NILAI INVESTASI:\n")
    c_r1.font.bold = True
    c_r1.font.size = Pt(10)
    c_r1.font.color.rgb = GREEN
    c_r2 = c_p.add_run(
        "Proposal ini dirancang bukan sekadar untuk menawarkan aplikasi, melainkan sebagai solusi menyeluruh dalam "
        "menghilangkan kebocoran stok, mempercepat layanan kasir, dan mengotomatiskan pembukuan laba rugi. "
        "Investasi satu kali bayar (One-Time Capex) mencakup instalasi di server mandiri, migrasi data bisnis awal, "
        "pelatihan staf hingga lancar, serta jaminan garansi bebas bug."
    )
    c_r2.font.size = Pt(9.5)
    c_r2.font.color.rgb = RGBColor(21, 128, 61)

    for _ in range(3):
        doc.add_paragraph()

    # Meta Table at bottom of cover
    meta_table = doc.add_table(rows=4, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Ditujukan Kepada:", "Direksi, Tim Manajemen Eksekutif & Pemilik Usaha"),
        ("Model Kerjasama:", "Solusi Sistem Mandiri Terpadu & Jasa Implementasi Hulu-ke-Hilir"),
        ("Penyusun Dokumen:", "Tim Konsultan Solusi & Arsitek Sistem Teknologi Informasi"),
        ("Kesiapan Sistem:", "Production-Ready, Teruji Keamanan Siber, & Siap Uji Coba (Live Demo)")
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
    # 1. DIAGNOSA TANTANGAN OPERASIONAL BISNIS
    # -------------------------------------------------------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(8)
    r_h1 = h1.add_run("1. Diagnosa Masalah: Titik Rawan Operasional Ritel & Distribusi")
    r_h1.font.name = 'Calibri'
    r_h1.font.size = Pt(16)
    r_h1.font.bold = True
    r_h1.font.color.rgb = PRIMARY

    p_d_intro = doc.add_paragraph()
    p_d_intro.paragraph_format.space_after = Pt(8)
    p_d_intro.paragraph_format.line_spacing = 1.15
    p_d_intro.add_run(
        "Dalam mengelola operasional ritel, cafe/restoran, toko grosir, maupun distribusi, pemilik bisnis "
        "dan manajemen sering menghadapi 4 (empat) titik kebocoran krusial yang mengikis profitabilitas tanpa disadari:"
    )

    pain_points = [
        ("A. Kebocoran Kasir & Ketidakdisiplinan Laci Kas",
         "Pencatatan modal kas awal sering diabaikan, selisih uang setoran di akhir shift sulit ditelusuri pelakunya, "
         "dan adanya celah kecurangan staf berupa pembatalan struk (void liar) atau pemberian diskon sepihak."),
        ("B. Selisih Persediaan Fisik vs Catatan (Stok Gaib)",
         "Barang hilang atau rusak di gudang baru diketahui berbulan-bulan kemudian saat stok opname tahunan. "
         "Selain itu, kasir sering melakukan 'overselling' (menjual barang yang stok fisiknya sudah habis), "
         "atau toko kehabisan produk best-seller karena tidak adanya sistem peringatan batas pemesanan ulang (Reorder Point)."),
        ("C. Laporan Keuangan Terfragmentasi & Terlambat",
         "Data penjualan tersimpan di aplikasi kasir, mutasi stok dicatat di Excel terpisah, dan bukti faktur pembelian "
         "masih bertumpuk dalam nota manual. Akibatnya, pemilik bisnis baru mengetahui angka laba bersih berhari-hari bahkan "
         "berminggu-minggu setelah akhir bulan."),
        ("D. Jebakan Biaya Sewa Berlangganan (SaaS Lock-in)",
         "Banyak pemilik bisnis merasa terbebani oleh model sewa software (SaaS) komersial yang mengenakan biaya per kasir, "
         "per cabang, dan per bulan. Semakin banyak cabang yang dibuka, biaya sewa melonjak berlipat ganda, sementara data finansial "
         "dan daftar pelanggan rahasia perusahaan tersimpan di cloud publik milik pihak ketiga yang berisiko disandera.")
    ]

    for title, desc in pain_points:
        p_pt = doc.add_paragraph()
        p_pt.paragraph_format.space_before = Pt(4)
        p_pt.paragraph_format.space_after = Pt(2)
        r_pt1 = p_pt.add_run(title + ": ")
        r_pt1.font.bold = True
        r_pt1.font.size = Pt(10)
        r_pt1.font.color.rgb = SECONDARY
        r_pt2 = p_pt.add_run(desc)
        r_pt2.font.size = Pt(9.5)
        r_pt2.font.color.rgb = DARK

    p_sol_box = doc.add_paragraph()
    p_sol_box.paragraph_format.space_before = Pt(8)
    p_sol_box.paragraph_format.space_after = Pt(14)
    r_sol = p_sol_box.add_run(
        "💡 SOLUSI KAMI: Menghadirkan sistem operasional terpadu yang memadukan Point of Sale (POS) ultra-cepat, "
        "manajemen gudang anti-kebocoran, serta akuntansi otomatis berpasangan (Double-Entry GL). "
        "Sistem ini kami serahkan secara penuh sebagai aset digital mandiri milik perusahaan Anda—tanpa tagihan sewa bulanan apapun selamanya."
    )
    r_sol.font.italic = True
    r_sol.font.size = Pt(9.5)
    r_sol.font.color.rgb = PRIMARY

    # -------------------------------------------------------------
    # 2. KOMPARASI: SEWA SAAS VS SISTEM MANDIRI
    # -------------------------------------------------------------
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(10)
    h2.paragraph_format.space_after = Pt(8)
    r_h2 = h2.add_run("2. Analisis Finansial: Model Sewa (SaaS) vs Sistem Mandiri (Hak Milik)")
    r_h2.font.name = 'Calibri'
    r_h2.font.size = Pt(16)
    r_h2.font.bold = True
    r_h2.font.color.rgb = PRIMARY

    table_comp = doc.add_table(rows=6, cols=3)
    table_comp.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Aspek Evaluasi Bisnis", "Model Sewa / Langganan (SaaS)", "Model Sistem Mandiri (Solusi Kami)"]
    
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
        ("Skema Biaya Lisensi", "Biaya sewa berulang selamanya. Jika berhenti bayar, akses software dan data langsung terputus.", "Investasi 1x di awal (One-time Capex). Hak pakai seumur hidup tanpa tagihan sewa bulanan."),
        ("Simulasi Biaya 3 Tahun (3-5 Cabang)", "± Rp 72.000.000,- s/d Rp 120.000.000,- (asumsi Rp 500rb - 800rb/cabang/bulan untuk POS + Akuntansi).", "Jauh lebih hemat puluhan juta rupiah. Sekali bayar untuk seluruh modul terpadu."),
        ("Ekspansi & Tambah Perangkat", "Biaya naik setiap menambah kasir atau toko baru. Dibatasi lisensi per perangkat / per user.", "Tanpa Biaya Lisensi per User. Bebas tambah kasir tanpa biaya sewa tambahan. Pada Paket Enterprise, bebas membuka cabang baru tanpa beli lisensi lagi."),
        ("Kedaulatan & Keamanan Data", "Database disimpan di cloud publik vendor, data omzet dan margin rawan dianalisis pihak luar.", "100% Data Sovereignty. Database berada di server milik perusahaan sendiri, terjaga kerahasiaannya."),
        ("Keandalan Saat Internet Padam", "Bila internet terputus atau server vendor bermasalah, kasir toko berhenti melayani.", "Mendukung jaringan intranet lokal toko (LAN). Meja kasir tetap dapat beroperasi normal.")
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
                r.font.color.rgb = GREEN
                r.font.bold = True
            else:
                r.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 3. PILIHAN PAKET SOLUSI & MATRIKS PEMBEDA FITUR
    # -------------------------------------------------------------
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(12)
    h3.paragraph_format.space_after = Pt(8)
    r_h3 = h3.add_run("3. Pilihan Paket Solusi & Matriks Pembeda Fitur")
    r_h3.font.name = 'Calibri'
    r_h3.font.size = Pt(16)
    r_h3.font.bold = True
    r_h3.font.color.rgb = PRIMARY

    p_p_intro = doc.add_paragraph()
    p_p_intro.paragraph_format.space_after = Pt(8)
    p_p_intro.paragraph_format.line_spacing = 1.15
    p_p_intro.add_run(
        "Agar investasi tepat sasaran sesuai skala bisnis dan anggaran perusahaan Anda, "
        "kami menyediakan 2 (dua) opsi paket implementasi sistem mandiri dengan rincian fitur sebagai berikut:"
    )

    table_pkg = doc.add_table(rows=13, cols=3)
    table_pkg.alignment = WD_TABLE_ALIGNMENT.CENTER
    pkg_headers = ["Fitur & Cakupan Kemampuan", "Paket STARTER\n(Single Outlet / Retail Mandiri)", "Paket ENTERPRISE\n(Multi-Cabang & Rantai Pasok)"]
    
    for j, th in enumerate(pkg_headers):
        c = table_pkg.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 130, 130, 150, 150)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        if j > 0:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    pkg_matrix = [
        ("Model Arsitektur Bisnis", "Toko Tunggal (Single-Store Architecture)", "Jaringan Multi-Cabang (Pusat HQ + Banyak Cabang)"),
        ("Manajemen Gudang (Warehouse)", "1 Gudang Toko Terpadu", "Multi-Gudang (Gudang Pusat, Toko, & Retur)"),
        ("Kasir POS & Shift Laci Uang", "✓ POS Cepat, Struk, Blind Count Shift", "✓ POS Cepat, Struk, Blind Count Shift"),
        ("Proteksi Kebocoran Kasir", "✓ Batasan Akses Kasir Standar", "✓ Otorisasi Void Khusus Supervisor & Limit Diskon"),
        ("Manajemen Persediaan & Stok", "✓ Kartu Stok, Opname, Alert Minimum", "✓ Kartu Stok, Opname, + Transfer Antar Toko (DO)"),
        ("Proteksi Stok Anti-Minus", "Peringatan Stok Sistem", "✓ Row-Level Database Lock (Anti-Overselling)"),
        ("Pengadaan & Pembelian (Purchasing)", "Pencatatan Pembelian & Faktur Supplier", "✓ Siklus Lengkap (PR ➔ PO ➔ Goods Receipt ➔ Retur)"),
        ("Penjualan B2B & Daftar Harga", "Penjualan Kasir Retail", "✓ B2B Sales Order, DO, & Price List (Retail/Grosir/VIP)"),
        ("Modul Akuntansi & Laporan Keuangan", "Rekap Kas Harian & Laba Kotor Toko", "✓ Full General Ledger, COA Standar, Laba Rugi & Neraca SAK"),
        ("Rekonsiliasi Bank & Umur Piutang", "Pencatatan Transfer Manual", "✓ Rekonsiliasi Bank Otomatis & AR/AP Aging Schedule"),
        ("Kapasitas Pengguna & Lisensi User", "Tanpa Biaya per User (Bebas buat user toko)\nDisiapkan untuk tim kasir & pengelola toko", "Tanpa Biaya per User & Cabang (Bebas ekspansi)\nDilengkapi 10+ Hak Akses Berjenjang antar divisi"),
        ("Garansi & Pendampingan Purna Jual", "Garansi Bebas Bug 3 Bulan", "Garansi Bebas Bug 6 Bulan + SLA Prioritas < 1 Jam")
    ]

    for i, row_data in enumerate(pkg_matrix):
        row = table_pkg.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(row_data):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 100, 100, 120, 120)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(8.5)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 1:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r.font.color.rgb = DARK
            elif j == 2:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r.font.bold = True
                r.font.color.rgb = GREEN

    # -------------------------------------------------------------
    # 4. NILAI BISNIS DARI FITUR UTAMA (BUSINESS VALUE)
    # -------------------------------------------------------------
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(8)
    r_h4 = h4.add_run("4. Manfaat Operasional Riil bagi Manajemen Bisnis")
    r_h4.font.name = 'Calibri'
    r_h4.font.size = Pt(16)
    r_h4.font.bold = True
    r_h4.font.color.rgb = PRIMARY

    b_values = [
        ("Kasir Cepat & Tertib (Point of Sale)",
         "Proses checkout pelanggan membutuhkan waktu kurang dari 3 detik. Mendukung scanner barcode dan printer struk thermal. "
         "Kasir diwajibkan menghitung fisik uang tunai saat tutup shift (Blind Count) sebelum melihat angka sistem, sehingga selisih setoran langsung terdeteksi."),
        ("Pengawasan Stok Multi-Gudang & Surat Jalan Resmi",
         "Perpindahan barang antar cabang tercatat resmi melalui Surat Jalan (Delivery Order) dan verifikasi penerimaan fisik. "
         "Fitur stok opname digital memungkinkan penghitungan persediaan harian/mingguan tanpa harus menutup operasional toko."),
        ("Otomatisasi Pembukuan Tanpa Perlu Akuntan Mahal",
         "Setiap ada barang terjual di kasir atau barang masuk dari supplier, sistem secara otomatis membentuk jurnal akuntansi "
         "berpasangan (Debit-Kredit). Laporan Laba Rugi dan Neraca Keuangan perusahaan selalu ter-update secara real-time."),
        ("Audit Trail Permanen & Proteksi Keamanan",
         "Seluruh aktivitas sistem—mulai dari perubahan harga produk, retur barang, pembatalan nota, hingga pembayaran faktur—terekam "
         "dalam log audit permanen yang tidak dapat diedit atau dihapus oleh staf manapun, memberikan rasa aman 100% bagi pemilik usaha.")
    ]

    for title, desc in b_values:
        p_bv = doc.add_paragraph()
        p_bv.paragraph_format.space_before = Pt(4)
        p_bv.paragraph_format.space_after = Pt(2)
        r_bv1 = p_bv.add_run("✓ " + title + ":\n")
        r_bv1.font.bold = True
        r_bv1.font.size = Pt(10)
        r_bv1.font.color.rgb = SECONDARY
        r_bv2 = p_bv.add_run(desc)
        r_bv2.font.size = Pt(9.5)
        r_bv2.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 5. STRUKTUR INVESTASI TRANSPARAN & TAHAPAN IMPLEMENTASI
    # -------------------------------------------------------------
    h5 = doc.add_paragraph()
    h5.paragraph_format.space_before = Pt(12)
    h5.paragraph_format.space_after = Pt(8)
    r_h5 = h5.add_run("5. Struktur Investasi & Skema Pembayaran Bertahap")
    r_h5.font.name = 'Calibri'
    r_h5.font.size = Pt(16)
    r_h5.font.bold = True
    r_h5.font.color.rgb = PRIMARY

    p_inv = doc.add_paragraph()
    p_inv.paragraph_format.space_after = Pt(8)
    p_inv.paragraph_format.line_spacing = 1.15
    p_inv.add_run(
        "Seluruh paket investasi di bawah ini bersifat **sekali bayar (One-Time Fee)** dan sudah merupakan paket terpadu: "
        "mencakup lisensi hak milik sistem seumur hidup, jasa instalasi server, migrasi data awal, pelatihan staf, serta garansi purna jual:"
    )

    # Pricing Table
    table_price = doc.add_table(rows=3, cols=3)
    table_price.alignment = WD_TABLE_ALIGNMENT.CENTER
    pr_headers = ["Pilihan Paket Solusi", "Nilai Investasi (One-Time)", "Cakupan Layanan Implementasi Termasuk"]
    for j, ph in enumerate(pr_headers):
        c = table_price.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 120, 120, 140, 140)
        p = c.paragraphs[0]
        r = p.add_run(ph)
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    price_rows = [
        ("Paket STARTER\n(Toko / Gerai Mandiri)",
         "Rp 16.500.000,-\n(Sekali Bayar)",
         "• Lisensi Hak Milik Toko Tunggal (Single Outlet & Gudang Toko)\n• Bebas buat akun staf & kasir toko (Tanpa biaya lisensi per user)\n• Setup Server Lokal Toko / VPS Standar\n• Impor Master Produk & Stok Awal dari Excel\n• Pelatihan 1 Sesi untuk Tim Kasir & Pengelola Toko\n• Garansi Bebas Bug 3 Bulan Penuh"),
        ("Paket ENTERPRISE\n(Multi-Cabang & Rantai Pasok)",
         "Rp 38.500.000,-\n(Sekali Bayar)",
         "• Lisensi Hak Milik Multi-Cabang & Rantai Pasok Terpadu\n• Bebas buka cabang baru & tambah kasir tanpa beli lisensi lagi\n• Setup Private Cloud / Server Korporat Dedicated\n• Migrasi Data Lengkap Multi-Cabang (Produk, Customer, Supplier, Saldo)\n• Pelatihan Komprehensif per Divisi (Gudang, Kasir, Finance)\n• Garansi Bebas Bug 6 Bulan Penuh + SLA Prioritas < 1 Jam")
    ]

    for i, (p_name, p_cost, p_inc) in enumerate(price_rows):
        row = table_price.rows[i+1]
        bg = "FFFFFF" if i == 0 else "F0FDF4"
        
        c0 = row.cells[0]
        set_cell_background(c0, bg)
        set_cell_margins(c0, 120, 120, 130, 130)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(p_name)
        r0.font.bold = True
        r0.font.size = Pt(9.5)
        r0.font.color.rgb = PRIMARY

        c1 = row.cells[1]
        set_cell_background(c1, bg)
        set_cell_margins(c1, 120, 120, 130, 130)
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r1 = p1.add_run(p_cost)
        r1.font.bold = True
        r1.font.size = Pt(11)
        r1.font.color.rgb = AMBER if i == 0 else GREEN

        c2 = row.cells[2]
        set_cell_background(c2, bg)
        set_cell_margins(c2, 120, 120, 130, 130)
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(p_inc)
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = DARK

    # Tahapan Pembayaran Transparan (Term of Payment)
    h5_top = doc.add_paragraph()
    h5_top.paragraph_format.space_before = Pt(14)
    h5_top.paragraph_format.space_after = Pt(4)
    r_top = h5_top.add_run("Tahapan Pembayaran Berbasis Progres (Term of Payment):")
    r_top.font.bold = True
    r_top.font.size = Pt(11)
    r_top.font.color.rgb = PRIMARY

    table_top = doc.add_table(rows=4, cols=3)
    table_top.alignment = WD_TABLE_ALIGNMENT.CENTER
    top_headers = ["Tahap Pembayaran", "Porsi", "Kriteria Penagihan (Milestone Hasil Nyata)"]
    for j, th in enumerate(top_headers):
        c = table_top.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 100, 100, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    top_data = [
        ("Tahap I (Uang Muka / DP)", "40%", "Dibayarkan saat persetujuan kesepakatan implementasi untuk memulai setup server & konfigurasi awal."),
        ("Tahap II (Progress Setup & Data)", "40%", "Dibayarkan setelah server siap, data produk berhasil dimigrasi, dan staf selesai mengikuti sesi pelatihan."),
        ("Tahap III (Pelunasan Akhir)", "20%", "Dibayarkan setelah sistem beroperasi lancar melayani transaksi nyata di toko (Go-Live) dan serah terima resmi.")
    ]
    for i, td in enumerate(top_data):
        row = table_top.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(td):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 90, 90, 110, 110)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(8.5)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            elif j == 1:
                r.font.bold = True
                r.font.color.rgb = SECONDARY
            else:
                r.font.color.rgb = DARK

    # -------------------------------------------------------------
    # 6. ROADMAP PENGERJAAN & JAMINAN GARANSI
    # -------------------------------------------------------------
    h6 = doc.add_paragraph()
    h6.paragraph_format.space_before = Pt(14)
    h6.paragraph_format.space_after = Pt(6)
    r_h6 = h6.add_run("6. Jadwal Kerja Terarah & Garansi Purna Jual")
    r_h6.font.name = 'Calibri'
    r_h6.font.size = Pt(16)
    r_h6.font.bold = True
    r_h6.font.color.rgb = PRIMARY

    p_road = doc.add_paragraph()
    p_road.paragraph_format.space_after = Pt(6)
    p_road.add_run(
        "Proses implementasi dirancang agar tidak mengganggu operasional toko yang sedang berjalan, "
        "dengan target penyelesaian dalam kurun waktu 2 s/d 4 minggu:"
    )

    table_time = doc.add_table(rows=5, cols=3)
    table_time.alignment = WD_TABLE_ALIGNMENT.CENTER
    time_headers = ["Minggu Pelaksanaan", "Aktivitas Utama", "Hasil Nyata (Deliverables)"]
    for j, th in enumerate(time_headers):
        c = table_time.rows[0].cells[j]
        set_cell_background(c, "1E3A8A")
        set_cell_margins(c, 100, 100, 120, 120)
        p = c.paragraphs[0]
        r = p.add_run(th)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)

    time_rows = [
        ("Minggu 1", "Pemasangan sistem di server, konfigurasi database, dan penyusunan akun COA.", "Server Berjalan & Lingkungan Siap Pakai"),
        ("Minggu 2", "Impor data produk, barcode, harga jual, data pelanggan, supplier, dan stok awal.", "Database Lengkap & Tervalidasi dengan Data Riil"),
        ("Minggu 3", "Pelatihan langsung staf kasir, tim gudang, dan admin. Simulasi transaksi hulu-hilir.", "Seluruh Staf Terlatih & Terampil Menggunakan Sistem"),
        ("Minggu 4", "Peluncuran resmi di toko (Go-Live), pendampingan kasir, dan serah terima dokumen.", "Sistem Beroperasi Penuh Melayani Transaksi Nyata")
    ]
    for i, tr in enumerate(time_rows):
        row = table_time.rows[i+1]
        bg = "F9FAFB" if i % 2 == 1 else "FFFFFF"
        for j, val in enumerate(tr):
            c = row.cells[j]
            set_cell_background(c, bg)
            set_cell_margins(c, 90, 90, 110, 110)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(8.5)
            if j == 0:
                r.font.bold = True
                r.font.color.rgb = PRIMARY
            else:
                r.font.color.rgb = DARK

    doc.add_page_break()

    # -------------------------------------------------------------
    # 7. LOW-FRICTION CALL TO ACTION: UNDANGAN LIVE DEMO
    # -------------------------------------------------------------
    h7 = doc.add_paragraph()
    h7.paragraph_format.space_before = Pt(12)
    h7.paragraph_format.space_after = Pt(8)
    r_h7 = h7.add_run("7. Langkah Selanjutnya: Undangan Sesi Uji Coba (Live Demo)")
    r_h7.font.name = 'Calibri'
    r_h7.font.size = Pt(16)
    r_h7.font.bold = True
    r_h7.font.color.rgb = PRIMARY

    p_cta1 = doc.add_paragraph()
    p_cta1.paragraph_format.space_after = Pt(8)
    p_cta1.paragraph_format.line_spacing = 1.15
    p_cta1.add_run(
        "Memilih sistem operasional bisnis merupakan keputusan strategis bagi masa depan perusahaan Anda. "
        "Kami sangat memahami bahwa manajemen membutuhkan keyakinan penuh sebelum melakukan investasi."
    )

    p_cta2 = doc.add_paragraph()
    p_cta2.paragraph_format.space_after = Pt(12)
    p_cta2.paragraph_format.line_spacing = 1.15
    p_cta2.add_run(
        "Oleh karena itu, kami dengan senang hati mengundang Bapak/Ibu beserta tim kunci untuk menghadiri "
        "**Sesi Pemaparan & Uji Coba Langsung (Live Interactive Demo) selama 30 Menit**. "
        "Dalam sesi ini, kita dapat mensimulasikan alur transaksi kasir, mutasi stok, hingga terbentuknya laporan keuangan "
        "menggunakan contoh data bisnis riil."
    )

    # Callout Box for Zero-Risk Demo
    demo_box = doc.add_table(rows=1, cols=1)
    demo_box.alignment = WD_TABLE_ALIGNMENT.CENTER
    db_cell = demo_box.rows[0].cells[0]
    set_cell_background(db_cell, "EFF6FF") # Soft Blue
    set_cell_margins(db_cell, 150, 150, 180, 180)
    p_db = db_cell.paragraphs[0]
    r_db1 = p_db.add_run("🌟 JAMINAN TANPA RESIKO & TANPA KOMITMEN:\n")
    r_db1.font.bold = True
    r_db1.font.size = Pt(10)
    r_db1.font.color.rgb = PRIMARY
    r_db2 = p_db.add_run(
        "Sesi demo ini bersifat 100% informatif dan gratis. Tidak ada kewajiban ataupun komitmen apapun dari pihak Bapak/Ibu "
        "untuk melakukan pembelian. Tujuannya murni untuk memberikan gambaran nyata bagaimana sistem ini dapat memangkas kebocoran "
        "dan menghemat jam kerja tim operasional Anda."
    )
    r_db2.font.size = Pt(9.5)
    r_db2.font.color.rgb = DARK

    for _ in range(2):
        doc.add_paragraph()

    # Form Konfirmasi Jadwal Demo (Bukan paksaan beli!)
    p_f_title = doc.add_paragraph()
    p_f_title.paragraph_format.space_after = Pt(4)
    r_ft = p_f_title.add_run("Formulir Permintaan Jadwal Sesi Live Demo:")
    r_ft.font.bold = True
    r_ft.font.size = Pt(11)
    r_ft.font.color.rgb = PRIMARY

    table_form = doc.add_table(rows=6, cols=2)
    table_form.alignment = WD_TABLE_ALIGNMENT.CENTER
    form_fields = [
        ("Nama Perusahaan / Usaha", ": __________________________________________________"),
        ("Nama Kontak / PIC", ": __________________________________________________"),
        ("Jabatan", ": __________________________________________________"),
        ("No. WhatsApp / Email", ": __________________________________________________"),
        ("Pilihan Paket yang Diminati", ": [  ] Paket STARTER      [  ] Paket ENTERPRISE"),
        ("Rencana Waktu Sesi Demo", ": Hari/Tanggal: ___________________ Jam: ____________")
    ]
    for i, (k, v) in enumerate(form_fields):
        row = table_form.rows[i]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.4)
        c2.width = Inches(4.1)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(k)
        r1.font.bold = True
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = PRIMARY
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(v)
        r2.font.size = Pt(9.5)
        r2.font.color.rgb = DARK

    for _ in range(2):
        doc.add_paragraph()

    # Contact Info Box
    p_contact = doc.add_paragraph()
    p_contact.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_c1 = p_contact.add_run("Hubungi Tim Kami untuk Koordinasi Jadwal Demo & Konsultasi Kebutuhan:\n")
    r_c1.font.size = Pt(9.5)
    r_c1.font.color.rgb = MUTED
    r_c2 = p_contact.add_run("WhatsApp / Telp: [Nomor Kontak Anda]  |  Email: [Email Bisnis Anda]\n")
    r_c2.font.bold = True
    r_c2.font.size = Pt(10)
    r_c2.font.color.rgb = PRIMARY
    r_c3 = p_contact.add_run("Tersedia untuk Sesi Demo Langsung (On-Site di Kantor Anda) maupun Demo Online (Zoom / Google Meet).")
    r_c3.font.italic = True
    r_c3.font.size = Pt(8.5)
    r_c3.font.color.rgb = MUTED

    doc.save(output_path)
    print(f"Revised elegant proposal successfully generated at: {output_path}")

if __name__ == '__main__':
    target = os.path.abspath('Proposal_Penawaran_Aplikasi_Enterprise_Inventory_POS.docx')
    create_complete_proposal_docx(target)
