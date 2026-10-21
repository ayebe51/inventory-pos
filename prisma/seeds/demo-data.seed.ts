import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedDemoData(prisma: PrismaClient) {
  console.log('🌱 [Demo Seed] Memulai seeding data enterprise lengkap (semua modul)...');

  // =========================================================================
  // 1. CABANG & GUDANG (BRANCHES & WAREHOUSES)
  // =========================================================================
  console.log('  🏢 1. Seeding Cabang & Gudang...');

  // Pastikan HQ ada
  let hqBranch = await prisma.branch.findFirst({ where: { code: 'HQ' } });
  if (!hqBranch) {
    hqBranch = await prisma.branch.create({
      data: {
        code: 'HQ',
        name: 'Headquarters & Distribution Center',
        type: 'MAIN',
        address: 'Gedung Kiro Tower Lt. 12, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan',
        is_active: true,
      },
    });
  } else {
    await prisma.branch.update({
      where: { id: hqBranch.id },
      data: {
        name: 'Headquarters & Distribution Center',
        address: 'Gedung Kiro Tower Lt. 12, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan',
      },
    });
  }

  // Cabang Senopati
  const senopatiBranch = await prisma.branch.upsert({
    where: { code: 'BR-SENOPATI' },
    update: {
      name: 'Kiro Cafe & Roastery Senopati',
      parent_id: hqBranch.id,
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      type: 'STORE',
      is_active: true,
    },
    create: {
      code: 'BR-SENOPATI',
      name: 'Kiro Cafe & Roastery Senopati',
      parent_id: hqBranch.id,
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      type: 'STORE',
      is_active: true,
    },
  });

  // Cabang PIK
  const pikBranch = await prisma.branch.upsert({
    where: { code: 'BR-PIK' },
    update: {
      name: 'Kiro Store & Experience PIK',
      parent_id: hqBranch.id,
      address: 'Rukan Golf Island Blok A No. 12, Pantai Indah Kapuk, Jakarta Utara',
      type: 'STORE',
      is_active: true,
    },
    create: {
      code: 'BR-PIK',
      name: 'Kiro Store & Experience PIK',
      parent_id: hqBranch.id,
      address: 'Rukan Golf Island Blok A No. 12, Pantai Indah Kapuk, Jakarta Utara',
      type: 'STORE',
      is_active: true,
    },
  });

  // Gudang Utama / Cakung
  let hqWarehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-HQ' } });
  if (!hqWarehouse) {
    hqWarehouse = await prisma.warehouse.create({
      data: {
        code: 'WH-HQ',
        name: 'Gudang Pusat Logistik Cakung',
        branch_id: hqBranch.id,
        address: 'Kawasan Industri Pulogadung Blok B No. 8, Jakarta Timur',
        is_active: true,
      },
    });
  } else {
    await prisma.warehouse.update({
      where: { id: hqWarehouse.id },
      data: {
        name: 'Gudang Pusat Logistik Cakung',
        branch_id: hqBranch.id,
        address: 'Kawasan Industri Pulogadung Blok B No. 8, Jakarta Timur',
      },
    });
  }

  // Gudang Senopati
  let senopatiWarehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-SENOPATI' } });
  if (!senopatiWarehouse) {
    senopatiWarehouse = await prisma.warehouse.create({
      data: {
        code: 'WH-SENOPATI',
        name: 'Gudang Toko Senopati',
        branch_id: senopatiBranch.id,
        address: 'Jl. Senopati No. 45 Lt. 2, Jakarta Selatan',
        is_active: true,
      },
    });
  }

  // Gudang PIK
  let pikWarehouse = await prisma.warehouse.findFirst({ where: { code: 'WH-PIK' } });
  if (!pikWarehouse) {
    pikWarehouse = await prisma.warehouse.create({
      data: {
        code: 'WH-PIK',
        name: 'Gudang Toko PIK',
        branch_id: pikBranch.id,
        address: 'Rukan Golf Island Blok A No. 12 Lt. 2, PIK',
        is_active: true,
      },
    });
  }

  console.log('    ✓ Cabang (HQ, Senopati, PIK) & Gudang (Cakung, Senopati, PIK) siap.');

  // =========================================================================
  // 2. MASTER DATA: UOM, BRAND, KATEGORI
  // =========================================================================
  console.log('  📦 2. Seeding UOM, Brand, Kategori...');

  // UOMs
  const uomsData = [
    { code: 'PCS', name: 'Pieces', symbol: 'pcs' },
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'GR', name: 'Gram', symbol: 'g' },
    { code: 'LTR', name: 'Liter', symbol: 'L' },
    { code: 'BTL', name: 'Botol', symbol: 'btl' },
    { code: 'PACK', name: 'Pack', symbol: 'pck' },
    { code: 'BOX', name: 'Box / Dus', symbol: 'box' },
    { code: 'CUP', name: 'Cup Saji', symbol: 'cup' },
  ];

  const uomMap = new Map<string, string>();
  for (const u of uomsData) {
    const res = await prisma.unitOfMeasure.upsert({
      where: { code: u.code },
      update: { name: u.name, symbol: u.symbol, is_active: true },
      create: { code: u.code, name: u.name, symbol: u.symbol, is_active: true },
    });
    uomMap.set(u.code, res.id);
  }

  // Brands
  const brandsData = [
    { code: 'BRD-KIRO', name: 'Kiro Specialty Roastery' },
    { code: 'BRD-OATSIDE', name: 'Oatside Dairy' },
    { code: 'BRD-MONIN', name: 'Monin France' },
    { code: 'BRD-GREENFIELDS', name: 'Greenfields Fresh' },
    { code: 'BRD-TOFFIN', name: 'Toffin Machinery & Tools' },
    { code: 'BRD-HARNEY', name: 'Harney & Sons Teas' },
  ];

  const brandMap = new Map<string, string>();
  for (const b of brandsData) {
    const res = await prisma.brand.upsert({
      where: { code: b.code },
      update: { name: b.name, is_active: true },
      create: { code: b.code, name: b.name, is_active: true },
    });
    brandMap.set(b.code, res.id);
  }

  // Categories
  let catFood = await prisma.category.findUnique({ where: { code: 'CAT-FOOD' } });
  if (!catFood) {
    catFood = await prisma.category.create({
      data: { code: 'CAT-FOOD', name: 'Food & Beverage', level: 1, is_active: true },
    });
  }

  const subCategoriesData = [
    { code: 'CAT-COFFEE', name: 'Specialty Coffee Beans', level: 2, parent_id: catFood.id },
    { code: 'CAT-DAIRY', name: 'Milk & Plant-Based Dairy', level: 2, parent_id: catFood.id },
    { code: 'CAT-SYRUP', name: 'Artisan Flavored Syrups', level: 2, parent_id: catFood.id },
    { code: 'CAT-TEA', name: 'Artisan Tea & Powder', level: 2, parent_id: catFood.id },
    { code: 'CAT-PASTRY', name: 'Fresh Bakery & Pastry', level: 2, parent_id: catFood.id },
    { code: 'CAT-PACKAGING', name: 'Eco Packaging & Cups', level: 2, parent_id: catFood.id },
    { code: 'CAT-EQUIPMENT', name: 'Barista Tools & Merchandise', level: 1, parent_id: null },
  ];

  const categoryMap = new Map<string, string>();
  categoryMap.set('CAT-FOOD', catFood.id);

  for (const c of subCategoriesData) {
    const res = await prisma.category.upsert({
      where: { code: c.code },
      update: { name: c.name, level: c.level, parent_id: c.parent_id, is_active: true },
      create: { code: c.code, name: c.name, level: c.level, parent_id: c.parent_id, is_active: true },
    });
    categoryMap.set(c.code, res.id);
  }

  console.log('    ✓ UOM, Brand, dan Kategori berhasil di-seed.');

  // =========================================================================
  // 3. MASTER DATA: PRODUK (16 PRODUK SPESIFIK F&B / COFFEE SHOP)
  // =========================================================================
  console.log('  ☕ 3. Seeding Produk Katalog...');

  const productsData = [
    {
      code: 'PROD-ESP-BLEND',
      name: 'Kiro Signature Espresso Blend 1kg',
      barcode: '8991001001011',
      category_id: categoryMap.get('CAT-COFFEE')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('KG')!,
      standard_cost: 140000,
      selling_price: 260000,
      min_selling_price: 220000,
      reorder_point: 20,
      reorder_qty: 50,
      description: 'Blend 70% Arabica Aceh Gayo & 30% Robusta Dampit, dark chocolate & brown sugar notes.',
    },
    {
      code: 'PROD-ETH-YIRG',
      name: 'Ethiopia Yirgacheffe Washed 250g',
      barcode: '8991001001028',
      category_id: categoryMap.get('CAT-COFFEE')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PACK')!,
      standard_cost: 75000,
      selling_price: 135000,
      min_selling_price: 115000,
      reorder_point: 15,
      reorder_qty: 30,
      description: 'Floral jasmine, bergamot, lemon zest, delicate tea-like body.',
    },
    {
      code: 'PROD-ACEH-GAYO',
      name: 'Aceh Gayo Wine Process 250g',
      barcode: '8991001001035',
      category_id: categoryMap.get('CAT-COFFEE')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PACK')!,
      standard_cost: 65000,
      selling_price: 120000,
      min_selling_price: 100000,
      reorder_point: 10,
      reorder_qty: 25,
      description: 'Fermentasi anaerobic, deep winey aroma, red grape & cherry notes.',
    },
    {
      code: 'PROD-OAT-BAR',
      name: 'Oatside Barista Blend 1L',
      barcode: '8991001002018',
      category_id: categoryMap.get('CAT-DAIRY')!,
      brand_id: brandMap.get('BRD-OATSIDE'),
      uom_id: uomMap.get('BTL')!,
      uom_purchase_id: uomMap.get('BOX')!,
      standard_cost: 32000,
      selling_price: 48000,
      min_selling_price: 42000,
      reorder_point: 50,
      reorder_qty: 120,
      description: 'Plant-based oat milk premium khusus barista, micro-foam lembut.',
    },
    {
      code: 'PROD-GF-FRESH',
      name: 'Greenfields Fresh Milk Pasteurized 1L',
      barcode: '8991001002025',
      category_id: categoryMap.get('CAT-DAIRY')!,
      brand_id: brandMap.get('BRD-GREENFIELDS'),
      uom_id: uomMap.get('BTL')!,
      uom_purchase_id: uomMap.get('BOX')!,
      standard_cost: 24000,
      selling_price: 35000,
      min_selling_price: 30000,
      reorder_point: 40,
      reorder_qty: 100,
      description: 'Susu sapi murni pasteurisasi segar dari peternakan Malang.',
    },
    {
      code: 'PROD-MON-VAN',
      name: 'Monin Vanilla Syrup 700ml',
      barcode: '8991001003015',
      category_id: categoryMap.get('CAT-SYRUP')!,
      brand_id: brandMap.get('BRD-MONIN'),
      uom_id: uomMap.get('BTL')!,
      standard_cost: 125000,
      selling_price: 185000,
      min_selling_price: 160000,
      reorder_point: 8,
      reorder_qty: 20,
      description: 'Pure vanilla extract dari Madagascar, aroma manis elegan.',
    },
    {
      code: 'PROD-MON-CAR',
      name: 'Monin Salted Caramel Syrup 700ml',
      barcode: '8991001003022',
      category_id: categoryMap.get('CAT-SYRUP')!,
      brand_id: brandMap.get('BRD-MONIN'),
      uom_id: uomMap.get('BTL')!,
      standard_cost: 125000,
      selling_price: 185000,
      min_selling_price: 160000,
      reorder_point: 8,
      reorder_qty: 20,
      description: 'Kombinasi karamel gurih dengan garam laut Mediterania.',
    },
    {
      code: 'PROD-MATCHA-UJI',
      name: 'Ceremonial Uji Matcha Powder 500g',
      barcode: '8991001004012',
      category_id: categoryMap.get('CAT-TEA')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PACK')!,
      standard_cost: 210000,
      selling_price: 380000,
      min_selling_price: 320000,
      reorder_point: 5,
      reorder_qty: 15,
      description: 'First harvest stone-ground matcha dari Kyoto Uji, warna hijau vibrant.',
    },
    {
      code: 'PROD-EARL-GREY',
      name: 'Harney & Sons Earl Grey Supreme 20 Sachets',
      barcode: '8991001004029',
      category_id: categoryMap.get('CAT-TEA')!,
      brand_id: brandMap.get('BRD-HARNEY'),
      uom_id: uomMap.get('BOX')!,
      standard_cost: 85000,
      selling_price: 155000,
      min_selling_price: 135000,
      reorder_point: 6,
      reorder_qty: 18,
      description: 'Black tea blend with Silver Tips & high grade bergamot oil.',
    },
    {
      code: 'PROD-CROISSANT',
      name: 'Butter Croissant Artisan (Fresh Daily)',
      barcode: '8991001005019',
      category_id: categoryMap.get('CAT-PASTRY')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PCS')!,
      standard_cost: 12000,
      selling_price: 28000,
      min_selling_price: 22000,
      reorder_point: 10,
      reorder_qty: 30,
      description: 'French butter croissant lapis keemasan, renyah di luar lembut di dalam.',
    },
    {
      code: 'PROD-PAIN-CHOC',
      name: 'Pain Au Chocolat French Style',
      barcode: '8991001005026',
      category_id: categoryMap.get('CAT-PASTRY')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PCS')!,
      standard_cost: 15000,
      selling_price: 32000,
      min_selling_price: 26000,
      reorder_point: 10,
      reorder_qty: 30,
      description: 'Pastry renyah dengan isian dual Belgian dark chocolate batons.',
    },
    {
      code: 'PROD-CUP-HOT-8',
      name: 'Double Wall Hot Cup 8oz (Pack 50pcs)',
      barcode: '8991001006016',
      category_id: categoryMap.get('CAT-PACKAGING')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PACK')!,
      standard_cost: 38000,
      selling_price: 65000,
      min_selling_price: 55000,
      reorder_point: 25,
      reorder_qty: 50,
      description: 'Gelas kopi panas kraft ramah lingkungan, double wall tahan panas.',
    },
    {
      code: 'PROD-CUP-COLD-16',
      name: 'Clear PET Cold Cup 16oz + Straw (Pack 50pcs)',
      barcode: '8991001006023',
      category_id: categoryMap.get('CAT-PACKAGING')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PACK')!,
      standard_cost: 45000,
      selling_price: 75000,
      min_selling_price: 65000,
      reorder_point: 25,
      reorder_qty: 50,
      description: 'Gelas dingin transparan bening tebal food-grade lengkap dengan sedotan.',
    },
    {
      code: 'PROD-TUMBLER-SS',
      name: 'Kiro Matte Black Stainless Tumbler 500ml',
      barcode: '8991001007013',
      category_id: categoryMap.get('CAT-EQUIPMENT')!,
      brand_id: brandMap.get('BRD-KIRO'),
      uom_id: uomMap.get('PCS')!,
      standard_cost: 95000,
      selling_price: 195000,
      min_selling_price: 170000,
      reorder_point: 8,
      reorder_qty: 15,
      description: 'Tumbler vakum insulasi SUS 316, menjaga dingin 12 jam, panas 8 jam.',
    },
    {
      code: 'PROD-DRIP-SCALE',
      name: 'Precision Barista Digital Scale w/ Timer',
      barcode: '8991001007020',
      category_id: categoryMap.get('CAT-EQUIPMENT')!,
      brand_id: brandMap.get('BRD-TOFFIN'),
      uom_id: uomMap.get('PCS')!,
      standard_cost: 210000,
      selling_price: 360000,
      min_selling_price: 310000,
      reorder_point: 5,
      reorder_qty: 10,
      description: 'Timbangan digital akurasi 0.1g dengan built-in auto timer dan display LED.',
    },
    {
      code: 'PROD-V60-DRIPPER',
      name: 'Ceramic V60 Coffee Dripper 02 White',
      barcode: '8991001007037',
      category_id: categoryMap.get('CAT-EQUIPMENT')!,
      brand_id: brandMap.get('BRD-TOFFIN'),
      uom_id: uomMap.get('PCS')!,
      standard_cost: 110000,
      selling_price: 195000,
      min_selling_price: 165000,
      reorder_point: 6,
      reorder_qty: 12,
      description: 'Dripper keramik Arita spiral ribs untuk ekstraksi manual brew optimal.',
    },
  ];

  const productMap = new Map<string, any>();
  for (const p of productsData) {
    const res = await prisma.product.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        barcode: p.barcode,
        category_id: p.category_id,
        brand_id: p.brand_id,
        uom_id: p.uom_id,
        uom_purchase_id: p.uom_purchase_id ?? p.uom_id,
        uom_sales_id: p.uom_id,
        standard_cost: p.standard_cost,
        selling_price: p.selling_price,
        min_selling_price: p.min_selling_price,
        reorder_point: p.reorder_point,
        reorder_qty: p.reorder_qty,
        description: p.description,
        is_active: true,
      },
      create: {
        code: p.code,
        name: p.name,
        barcode: p.barcode,
        category_id: p.category_id,
        brand_id: p.brand_id,
        uom_id: p.uom_id,
        uom_purchase_id: p.uom_purchase_id ?? p.uom_id,
        uom_sales_id: p.uom_id,
        standard_cost: p.standard_cost,
        selling_price: p.selling_price,
        min_selling_price: p.min_selling_price,
        reorder_point: p.reorder_point,
        reorder_qty: p.reorder_qty,
        description: p.description,
        is_active: true,
      },
    });
    productMap.set(p.code, res);
  }
  console.log(`    ✓ ${productsData.length} produk katalog berhasil di-seed.`);

  // =========================================================================
  // 4. USERS & ROLES
  // =========================================================================
  console.log('  👥 4. Seeding Staff Enterprise Users...');

  const passwordHash = await bcrypt.hash('Staff@123456', 10);
  const staffUsersData = [
    {
      email: 'finance.manager@example.com',
      full_name: 'Siti Rahmawati, SE, Ak.',
      role_name: 'Finance_Manager',
      branch_id: hqBranch.id,
    },
    {
      email: 'warehouse.manager@example.com',
      full_name: 'Budi Santoso',
      role_name: 'Warehouse_Manager',
      branch_id: hqBranch.id,
    },
    {
      email: 'supervisor@example.com',
      full_name: 'Hendri Kurniawan',
      role_name: 'Supervisor',
      branch_id: senopatiBranch.id,
    },
    {
      email: 'barista.senopati@example.com',
      full_name: 'Dimas Pratama (Head Barista Senopati)',
      role_name: 'Cashier',
      branch_id: senopatiBranch.id,
    },
    {
      email: 'barista.pik@example.com',
      full_name: 'Ayu Lestari (Barista PIK)',
      role_name: 'Cashier',
      branch_id: pikBranch.id,
    },
  ];

  const userMap = new Map<string, any>();
  const adminUser = (await prisma.user.findFirst({ where: { email: 'admin@example.com' } }))!;
  if (adminUser) userMap.set('admin', adminUser);

  for (const u of staffUsersData) {
    let user = await prisma.user.findFirst({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          full_name: u.full_name,
          password_hash: passwordHash,
          branch_id: u.branch_id,
          is_active: true,
          mfa_enabled: false,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { full_name: u.full_name, branch_id: u.branch_id, is_active: true },
      });
    }

    const role = await prisma.role.findFirst({ where: { name: u.role_name } });
    if (role) {
      const userRole = await prisma.userRole.findFirst({
        where: { user_id: user.id, role_id: role.id },
      });
      if (!userRole) {
        await prisma.userRole.create({
          data: { user_id: user.id, role_id: role.id, branch_id: u.branch_id },
        });
      }
    }
    userMap.set(u.email, user);
  }

  // Fallbacks (all non-null)
  const cashierUser =
    userMap.get('barista.senopati@example.com') ??
    (await prisma.user.findFirst({ where: { email: 'cashier@example.com' } })) ??
    adminUser;
  const purchasingUser =
    (await prisma.user.findFirst({ where: { email: 'purchasing@example.com' } })) ?? adminUser;
  const warehouseUser = userMap.get('warehouse.manager@example.com') ?? adminUser;
  const financeUser = userMap.get('finance.manager@example.com') ?? adminUser;
  const supervisorUser = userMap.get('supervisor@example.com') ?? adminUser;

  console.log('    ✓ Staff enterprise users (Finance, Warehouse, Supervisor, Barista) siap.');

  // =========================================================================
  // 5. SUPPLIERS & CUSTOMERS
  // =========================================================================
  console.log('  🤝 5. Seeding Pemasok & Pelanggan...');

  const suppliersData = [
    {
      code: 'SUPP-001',
      name: 'PT Indofood Sukses Makmur Tbk',
      email: 'sales@indofood.co.id',
      phone: '021-57958822',
      address: 'Sudirman Plaza, Indofood Tower Lt. 27, Jakarta Selatan',
      payment_terms_days: 30,
    },
    {
      code: 'SUPP-002',
      name: 'PT Unilever Indonesia Tbk',
      email: 'b2b.orders@unilever.com',
      phone: '021-5262112',
      address: 'Grha Unilever, BSD City, Tangerang',
      payment_terms_days: 30,
    },
    {
      code: 'SUPP-003',
      name: 'PT Toffin Indonesia Utama',
      email: 'info@toffin.id',
      phone: '021-5882299',
      address: 'Jl. Pluit Permai Raya No. 18, Jakarta Utara',
      payment_terms_days: 14,
    },
    {
      code: 'SUPP-004',
      name: 'PT Agro Sumber Kopi Nusantara',
      email: 'agrokopi@nusantara.id',
      phone: '0812-9988-7711',
      address: 'Kawasan Perkebunan Takengon, Aceh Tengah',
      payment_terms_days: 14,
    },
    {
      code: 'SUPP-005',
      name: 'PT Kemasan Lestari Abadi',
      email: 'order@kemasanlestari.com',
      phone: '021-89831122',
      address: 'Kawasan Industri Jababeka 2 Blok C-10, Cikarang',
      payment_terms_days: 30,
    },
  ];

  const supplierMap = new Map<string, any>();
  for (const s of suppliersData) {
    const res = await prisma.supplier.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        payment_terms_days: s.payment_terms_days,
        is_active: true,
      },
      create: {
        code: s.code,
        name: s.name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        payment_terms_days: s.payment_terms_days,
        is_active: true,
      },
    });
    supplierMap.set(s.code, res);
  }

  const customersData = [
    {
      code: 'CUST-001',
      name: 'PT Surya Gemilang Utama (Kopi Kenangan Group)',
      email: 'procurement@suryagemilang.id',
      phone: '021-7278901',
      address: 'Jl. Gandaria I No. 14, Kebayoran Baru, Jakarta Selatan',
      credit_limit: 100000000,
    },
    {
      code: 'CUST-002',
      name: 'CV Makmur Sejahtera Distributor',
      email: 'makmur.dist@gmail.com',
      phone: '021-8899771',
      address: 'Ruko Boulevard Kelapa Gading Blok LB-1 No. 5, Jakarta Utara',
      credit_limit: 50000000,
    },
    {
      code: 'CUST-003',
      name: 'Toko Sumber Rejeki Retail',
      email: 'sumberrejeki@yahoo.co.id',
      phone: '0813-1122-3344',
      address: 'Pasar Mayestik Lantai Dasar Blok B-22, Jakarta Selatan',
      credit_limit: 25000000,
    },
    {
      code: 'CUST-004',
      name: 'PT Nusantara Jaya Hotel & Resort',
      email: 'fb.director@nusantarajaya.co.id',
      phone: '021-5255555',
      address: 'Jl. MH Thamrin No. 1, Menteng, Jakarta Pusat',
      credit_limit: 150000000,
    },
    {
      code: 'CUST-005',
      name: 'Kopi Sore Hari Cafe',
      email: 'owner@kopisorehari.com',
      phone: '0811-2233-4455',
      address: 'Jl. Panglima Polim V No. 8, Jakarta Selatan',
      credit_limit: 30000000,
    },
    {
      code: 'CUST-006',
      name: 'Daily Roast Boutique Studio',
      email: 'hello@dailyroast.co',
      phone: '0812-4455-6677',
      address: 'Pantai Indah Kapuk 2 Boulevard No. 88, Tangerang',
      credit_limit: 40000000,
    },
  ];

  const customerMap = new Map<string, any>();
  for (const c of customersData) {
    const res = await prisma.customer.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        credit_limit: c.credit_limit,
        is_active: true,
      },
      create: {
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        credit_limit: c.credit_limit,
        is_active: true,
      },
    });
    customerMap.set(c.code, res);
  }

  console.log('    ✓ 5 Pemasok & 6 Pelanggan B2B/Retail siap.');

  // =========================================================================
  // 6. PRICE LISTS (DAFTAR HARGA GROSIR & RETAIL)
  // =========================================================================
  console.log('  🏷️ 6. Seeding Daftar Harga (Price Lists)...');

  const priceListsData = [
    { code: 'PL-RETAIL', name: 'Daftar Harga Retail Toko Reguler', discountFactor: 1.0 },
    { code: 'PL-WHOLESALE', name: 'Daftar Harga Grosir Kafe Mitra (Diskon 15%)', discountFactor: 0.85 },
    { code: 'PL-VIP', name: 'Daftar Harga Member VIP Gold (Diskon 10%)', discountFactor: 0.9 },
  ];

  for (const pl of priceListsData) {
    const priceList = await prisma.priceList.upsert({
      where: { code: pl.code },
      update: { name: pl.name, is_active: true },
      create: {
        code: pl.code,
        name: pl.name,
        valid_from: new Date('2026-01-01'),
        is_active: true,
      },
    });

    for (const p of productsData) {
      const prod = productMap.get(p.code);
      if (!prod) continue;
      const unitPrice = Math.round(p.selling_price * pl.discountFactor);
      await prisma.priceListItem.upsert({
        where: {
          price_list_id_product_id: {
            price_list_id: priceList.id,
            product_id: prod.id,
          },
        },
        update: { unit_price: unitPrice },
        create: {
          price_list_id: priceList.id,
          product_id: prod.id,
          unit_price: unitPrice,
        },
      });
    }
  }

  console.log('    ✓ 3 Price List (Retail, Wholesale, VIP) siap dengan item lengkap.');

  // =========================================================================
  // 7. INVENTORI & STOK (INVENTORY LEDGER DI 3 GUDANG)
  // =========================================================================
  console.log('  📊 7. Seeding Stok Fisik & Kartu Stok (Inventory Ledger)...');

  // Bersihkan ledger inisialisasi lama yang bertipe SEED_INITIAL jika ada
  await prisma.inventoryLedger.deleteMany({
    where: { reference_type: 'SEED_INITIAL' },
  });

  const baseDate = new Date('2026-10-01T08:00:00Z');

  // Distribusi stok di 3 Gudang:
  // - Gudang Cakung (WH-HQ): Stok logistik melimpah
  // - Gudang Senopati (WH-SENOPATI): Stok gerai kafe harian, dengan 2 produk LOW STOCK (<= 5)
  // - Gudang PIK (WH-PIK): Stok gerai retail seimbang
  const stockAllocations = [
    // [ProductCode, WH_HQ_Qty, WH_Senopati_Qty, WH_PIK_Qty]
    ['PROD-ESP-BLEND', 150, 25, 20],
    ['PROD-ETH-YIRG', 80, 12, 15],
    ['PROD-ACEH-GAYO', 70, 10, 12],
    ['PROD-OAT-BAR', 200, 35, 30],
    ['PROD-GF-FRESH', 180, 30, 25],
    ['PROD-MON-VAN', 40, 8, 6],
    ['PROD-MON-CAR', 40, 8, 6],
    ['PROD-MATCHA-UJI', 30, 6, 5],
    ['PROD-EARL-GREY', 50, 8, 8],
    ['PROD-CROISSANT', 50, 20, 15],
    ['PROD-PAIN-CHOC', 50, 20, 15],
    ['PROD-CUP-HOT-8', 100, 30, 25],
    ['PROD-CUP-COLD-16', 100, 30, 25],
    ['PROD-TUMBLER-SS', 25, 3, 5], // LOW STOCK di Senopati (3 <= 5)
    ['PROD-DRIP-SCALE', 15, 2, 4], // LOW STOCK di Senopati (2 <= 5)
    ['PROD-V60-DRIPPER', 20, 6, 5],
  ];

  for (const [prodCode, hqQty, senoQty, pikQty] of stockAllocations as [string, number, number, number][]) {
    const prod = productMap.get(prodCode);
    if (!prod) continue;

    const unitCost = Number(prod.standard_cost);

    // 1. Gudang Cakung
    await prisma.inventoryLedger.create({
      data: {
        product_id: prod.id,
        warehouse_id: hqWarehouse.id,
        transaction_type: 'GOODS_RECEIPT',
        reference_type: 'SEED_INITIAL',
        reference_id: hqWarehouse.id,
        reference_number: `INIT-${prodCode}-HQ`,
        movement_date: baseDate,
        qty_in: hqQty,
        qty_out: 0,
        unit_cost: unitCost,
        total_cost: hqQty * unitCost,
        running_qty: hqQty,
        running_cost: hqQty * unitCost,
        created_by: warehouseUser.id,
        notes: 'Initial enterprise stock allocation - Gudang Pusat Cakung',
      },
    });

    // 2. Gudang Senopati
    await prisma.inventoryLedger.create({
      data: {
        product_id: prod.id,
        warehouse_id: senopatiWarehouse.id,
        transaction_type: 'GOODS_RECEIPT',
        reference_type: 'SEED_INITIAL',
        reference_id: senopatiWarehouse.id,
        reference_number: `INIT-${prodCode}-SENO`,
        movement_date: baseDate,
        qty_in: senoQty,
        qty_out: 0,
        unit_cost: unitCost,
        total_cost: senoQty * unitCost,
        running_qty: senoQty,
        running_cost: senoQty * unitCost,
        created_by: warehouseUser.id,
        notes: 'Initial enterprise stock allocation - Gudang Senopati',
      },
    });

    // 3. Gudang PIK
    await prisma.inventoryLedger.create({
      data: {
        product_id: prod.id,
        warehouse_id: pikWarehouse.id,
        transaction_type: 'GOODS_RECEIPT',
        reference_type: 'SEED_INITIAL',
        reference_id: pikWarehouse.id,
        reference_number: `INIT-${prodCode}-PIK`,
        movement_date: baseDate,
        qty_in: pikQty,
        qty_out: 0,
        unit_cost: unitCost,
        total_cost: pikQty * unitCost,
        running_qty: pikQty,
        running_cost: pikQty * unitCost,
        created_by: warehouseUser.id,
        notes: 'Initial enterprise stock allocation - Gudang PIK',
      },
    });
  }

  console.log('    ✓ Stok awal di-seed pada 3 gudang dengan 2 produk berstatus Low Stock Alert (<= 5).');

  // =========================================================================
  // 8. INTER-WAREHOUSE STOCK TRANSFERS, OPNAME, ADJUSTMENT
  // =========================================================================
  console.log('  🚚 8. Seeding Stock Transfer, Opname & Adjustment...');

  // Stock Transfer 1: COMPLETED (Cakung -> Senopati)
  const transfer1 = await prisma.stockTransfer.upsert({
    where: { transfer_number: 'TRF-20261015-001' },
    update: { status: 'COMPLETED' },
    create: {
      transfer_number: 'TRF-20261015-001',
      from_warehouse_id: hqWarehouse.id,
      to_warehouse_id: senopatiWarehouse.id,
      status: 'COMPLETED',
      transfer_date: new Date('2026-10-15T09:00:00Z'),
      notes: 'Restock mingguan biji kopi & oat milk untuk Cafe Senopati',
      approved_by: warehouseUser.id,
      approved_at: new Date('2026-10-15T09:30:00Z'),
      created_by: warehouseUser.id,
    },
  });

  await prisma.stockTransferLine.deleteMany({ where: { transfer_id: transfer1.id } });
  await prisma.stockTransferLine.createMany({
    data: [
      {
        transfer_id: transfer1.id,
        product_id: productMap.get('PROD-ESP-BLEND')!.id,
        qty: 30,
        uom_id: uomMap.get('KG')!,
        unit_cost: 140000,
        notes: 'Kiro Signature Espresso Blend 1kg',
      },
      {
        transfer_id: transfer1.id,
        product_id: productMap.get('PROD-OAT-BAR')!.id,
        qty: 40,
        uom_id: uomMap.get('BTL')!,
        unit_cost: 32000,
        notes: 'Oatside Barista Blend 1L',
      },
    ],
  });

  // Stock Transfer 2: IN_TRANSIT (Cakung -> PIK)
  const transfer2 = await prisma.stockTransfer.upsert({
    where: { transfer_number: 'TRF-20261019-002' },
    update: { status: 'IN_TRANSIT' },
    create: {
      transfer_number: 'TRF-20261019-002',
      from_warehouse_id: hqWarehouse.id,
      to_warehouse_id: pikWarehouse.id,
      status: 'IN_TRANSIT',
      transfer_date: new Date('2026-10-19T14:00:00Z'),
      notes: 'Pengiriman bahan baku & sirup gerai PIK via kurir logistik',
      approved_by: warehouseUser.id,
      approved_at: new Date('2026-10-19T14:30:00Z'),
      created_by: warehouseUser.id,
    },
  });

  await prisma.stockTransferLine.deleteMany({ where: { transfer_id: transfer2.id } });
  await prisma.stockTransferLine.createMany({
    data: [
      {
        transfer_id: transfer2.id,
        product_id: productMap.get('PROD-ETH-YIRG')!.id,
        qty: 15,
        uom_id: uomMap.get('PACK')!,
        unit_cost: 75000,
      },
      {
        transfer_id: transfer2.id,
        product_id: productMap.get('PROD-MON-VAN')!.id,
        qty: 10,
        uom_id: uomMap.get('BTL')!,
        unit_cost: 125000,
      },
    ],
  });

  // Stock Opname: COMPLETED with Variance
  const opname1 = await prisma.stockOpname.upsert({
    where: { opname_number: 'OPN-20260930-01' },
    update: { status: 'FINALIZED' },
    create: {
      opname_number: 'OPN-20260930-01',
      warehouse_id: senopatiWarehouse.id,
      status: 'FINALIZED',
      initiated_by: warehouseUser.id,
      initiated_at: new Date('2026-09-30T17:00:00Z'),
      finalized_by: warehouseUser.id,
      finalized_at: new Date('2026-09-30T21:00:00Z'),
      notes: 'Stock opname akhir bulan September 2026 di Toko Senopati',
    },
  });

  await prisma.stockOpnameLine.deleteMany({ where: { opname_id: opname1.id } });
  await prisma.stockOpnameLine.createMany({
    data: [
      {
        opname_id: opname1.id,
        product_id: productMap.get('PROD-OAT-BAR')!.id,
        qty_system: 35,
        qty_counted: 35,
        qty_difference: 0,
        status: 'MATCHED',
      },
      {
        opname_id: opname1.id,
        product_id: productMap.get('PROD-ESP-BLEND')!.id,
        qty_system: 25,
        qty_counted: 24,
        qty_difference: -1,
        status: 'VARIANCE',
        recount_reason: '1 pack bocor terkena cutter saat buka kardus pengiriman',
      },
    ],
  });

  // Stock Adjustment: APPROVED
  const adj1 = await prisma.stockAdjustment.upsert({
    where: { adjustment_number: 'ADJ-20260930-01' },
    update: { status: 'APPROVED' },
    create: {
      adjustment_number: 'ADJ-20260930-01',
      warehouse_id: senopatiWarehouse.id,
      adjustment_date: new Date('2026-09-30T21:30:00Z'),
      reason: 'Penyesuaian selisih stock opname akhir September (spoilage)',
      status: 'APPROVED',
      approved_by: supervisorUser.id,
      approved_at: new Date('2026-09-30T22:00:00Z'),
      created_by: warehouseUser.id,
    },
  });

  await prisma.stockAdjustmentLine.deleteMany({ where: { adjustment_id: adj1.id } });
  await prisma.stockAdjustmentLine.create({
    data: {
      adjustment_id: adj1.id,
      product_id: productMap.get('PROD-ESP-BLEND')!.id,
      uom_id: uomMap.get('KG')!,
      qty_system: 25,
      qty_actual: 24,
      qty_difference: -1,
      unit_cost: 140000,
      notes: 'Kerusakan kemasan',
    },
  });

  console.log('    ✓ Stock Transfer, Stock Opname, dan Stock Adjustment siap.');

  // =========================================================================
  // 9. SHIFT KASIR & TRANSAKSI POS (MENGISI TREN PENJUALAN 7 HARI + HARI INI)
  // =========================================================================
  console.log('  🛒 9. Seeding Shift Kasir & Transaksi POS (7 Hari Terakhir & Hari Ini)...');

  // Dapatkan payment methods
  const cashPm = await prisma.paymentMethod.findUnique({ where: { code: 'CSH' } });
  const cardPm = await prisma.paymentMethod.findUnique({ where: { code: 'CRD' } });
  const trfPm = await prisma.paymentMethod.findUnique({ where: { code: 'TRF' } });

  // Bersihkan transaksi POS dan shift demo sebelumnya
  const oldDemoShifts = await prisma.shift.findMany({
    where: { shift_number: { startsWith: 'SHF-DEMO-' } },
  });
  if (oldDemoShifts.length > 0) {
    const shiftIds = oldDemoShifts.map((s) => s.id);
    const oldTx = await prisma.posTransaction.findMany({
      where: { shift_id: { in: shiftIds } },
      select: { id: true },
    });
    const txIds = oldTx.map((t) => t.id);
    await prisma.posPayment.deleteMany({ where: { transaction_id: { in: txIds } } });
    await prisma.posTransactionLine.deleteMany({ where: { transaction_id: { in: txIds } } });
    await prisma.posTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.shift.deleteMany({ where: { id: { in: shiftIds } } });
  }

  // Generate 7 hari shift ke belakang + 1 shift hari ini (2026-10-15 s.d. 2026-10-21)
  const shiftDates = [
    { dayOffset: 6, code: '20261015', dateStr: '2026-10-15', isOpen: false, txCount: 6 },
    { dayOffset: 5, code: '20261016', dateStr: '2026-10-16', isOpen: false, txCount: 7 },
    { dayOffset: 4, code: '20261017', dateStr: '2026-10-17', isOpen: false, txCount: 8 },
    { dayOffset: 3, code: '20261018', dateStr: '2026-10-18', isOpen: false, txCount: 9 },
    { dayOffset: 2, code: '20261019', dateStr: '2026-10-19', isOpen: false, txCount: 6 },
    { dayOffset: 1, code: '20261020', dateStr: '2026-10-20', isOpen: false, txCount: 8 },
    { dayOffset: 0, code: '20261021', dateStr: '2026-10-21', isOpen: true, txCount: 4 }, // HARI INI: OPEN
  ];

  let globalTxCounter = 1;

  for (const s of shiftDates) {
    const shiftStart = new Date(`${s.dateStr}T07:30:00Z`);
    const shiftEnd = s.isOpen ? null : new Date(`${s.dateStr}T21:30:00Z`);

    const shift = await prisma.shift.create({
      data: {
        shift_number: `SHF-DEMO-${s.code}-01`,
        cashier_id: cashierUser.id,
        branch_id: senopatiBranch.id,
        warehouse_id: senopatiWarehouse.id,
        status: s.isOpen ? 'OPEN' : 'CLOSED',
        opened_at: shiftStart,
        closed_at: shiftEnd,
        opening_balance: 500000,
        expected_balance: s.isOpen ? null : 2850000,
        closing_balance: s.isOpen ? null : 2850000,
        difference: s.isOpen ? null : 0,
      },
    });

    // Buat transaksi untuk shift ini
    for (let i = 1; i <= s.txCount; i++) {
      const txHour = 8 + Math.floor(i * 1.5);
      const txMinute = (i * 13) % 60;
      const txTime = new Date(`${s.dateStr}T${String(txHour).padStart(2, '0')}:${String(txMinute).padStart(2, '0')}:00Z`);

      // Pilih 1-3 produk secara variatif
      const basketChoices = [
        [
          { prod: productMap.get('PROD-CROISSANT')!, qty: 2 },
          { prod: productMap.get('PROD-OAT-BAR')!, qty: 1 },
        ],
        [
          { prod: productMap.get('PROD-ETH-YIRG')!, qty: 1 },
          { prod: productMap.get('PROD-PAIN-CHOC')!, qty: 1 },
        ],
        [
          { prod: productMap.get('PROD-ACEH-GAYO')!, qty: 2 },
          { prod: productMap.get('PROD-CUP-COLD-16')!, qty: 1 },
        ],
        [
          { prod: productMap.get('PROD-ESP-BLEND')!, qty: 1 },
          { prod: productMap.get('PROD-MON-VAN')!, qty: 1 },
        ],
        [
          { prod: productMap.get('PROD-MATCHA-UJI')!, qty: 1 },
          { prod: productMap.get('PROD-CROISSANT')!, qty: 1 },
        ],
      ];

      const currentBasket = basketChoices[i % basketChoices.length];
      let subtotal = 0;
      const linesData = currentBasket.map((item) => {
        const lineTotal = Number(item.prod.selling_price) * item.qty;
        subtotal += lineTotal;
        return {
          product_id: item.prod.id,
          qty: item.qty,
          uom_id: item.prod.uom_id,
          unit_price: Number(item.prod.selling_price),
          discount_pct: 0,
          discount_amount: 0,
          tax_pct: 11,
          tax_amount: Math.round(lineTotal * 0.11),
          line_total: lineTotal,
        };
      });

      const taxAmount = Math.round(subtotal * 0.11);
      const totalAmount = subtotal + taxAmount;
      const pmChoice = i % 3 === 0 ? trfPm : i % 3 === 1 ? cardPm : cashPm;
      const paidAmount = pmChoice?.code === 'CSH' ? Math.ceil(totalAmount / 50000) * 50000 : totalAmount;
      const changeAmount = paidAmount - totalAmount;

      const txNumber = `POS-${s.code}-${String(globalTxCounter++).padStart(4, '0')}`;

      const posTx = await prisma.posTransaction.create({
        data: {
          transaction_number: txNumber,
          shift_id: shift.id,
          cashier_id: cashierUser.id,
          customer_id: i % 2 === 0 ? customerMap.get('CUST-005')?.id : null,
          transaction_date: txTime,
          status: 'COMPLETED',
          subtotal: subtotal,
          discount_amount: 0,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          change_amount: changeAmount,
          lines: {
            create: linesData,
          },
        },
      });

      if (pmChoice) {
        await prisma.posPayment.create({
          data: {
            transaction_id: posTx.id,
            payment_method_id: pmChoice.id,
            amount: totalAmount,
            reference_number: pmChoice.code === 'CSH' ? null : `REF-${s.code}-${posTx.id.slice(0, 8)}`,
          },
        });
      }
    }
  }

  console.log(`    ✓ ${shiftDates.length} Shift & puluhan transaksi POS berhasil di-seed (Trend 7 hari terisi penuh).`);

  // =========================================================================
  // 10. B2B SALES ORDERS, DELIVERY ORDERS & SALES RETURNS
  // =========================================================================
  console.log('  📋 10. Seeding B2B Sales Orders, DO & Sales Returns...');

  // Bersihkan data turunan SO lama agar tidak melanggar foreign key
  await prisma.salesReturnLine.deleteMany({});
  await prisma.salesReturn.deleteMany({});
  await prisma.deliveryOrder.deleteMany({});
  await prisma.salesOrderLine.deleteMany({
    where: { sales_order: { so_number: { in: ['SO-20261005-001', 'SO-20261012-002', 'SO-20261020-003'] } } },
  });

  // SO 1: DELIVERED (PT Surya Gemilang)
  const so1 = await prisma.salesOrder.upsert({
    where: { so_number: 'SO-20261005-001' },
    update: { status: 'DELIVERED' },
    create: {
      so_number: 'SO-20261005-001',
      customer_id: customerMap.get('CUST-001')!.id,
      branch_id: hqBranch.id,
      warehouse_id: hqWarehouse.id,
      status: 'DELIVERED',
      order_date: new Date('2026-10-05T10:00:00Z'),
      expected_delivery_date: new Date('2026-10-06T15:00:00Z'),
      subtotal: 13000000,
      tax_amount: 1430000,
      total_amount: 14430000,
      notes: 'Pesanan bulanan 50kg Espresso Blend & 50 Btl Oatside untuk Kopi Kenangan Group',
      approved_by: supervisorUser.id,
      approved_at: new Date('2026-10-05T11:00:00Z'),
      created_by: cashierUser.id,
    },
  });

  await prisma.salesOrderLine.deleteMany({ where: { so_id: so1.id } });
  await prisma.salesOrderLine.createMany({
    data: [
      {
        so_id: so1.id,
        product_id: productMap.get('PROD-ESP-BLEND')!.id,
        qty_ordered: 50,
        qty_delivered: 50,
        uom_id: uomMap.get('KG')!,
        unit_price: 220000, // Harga grosir
        tax_pct: 11,
        line_total: 11000000,
      },
      {
        so_id: so1.id,
        product_id: productMap.get('PROD-OAT-BAR')!.id,
        qty_ordered: 50,
        qty_delivered: 50,
        uom_id: uomMap.get('BTL')!,
        unit_price: 40000,
        tax_pct: 11,
        line_total: 2000000,
      },
    ],
  });

  // DO 1 untuk SO 1
  await prisma.deliveryOrder.upsert({
    where: { do_number: 'DO-20261006-001' },
    update: { status: 'CONFIRMED' },
    create: {
      do_number: 'DO-20261006-001',
      so_id: so1.id,
      warehouse_id: hqWarehouse.id,
      status: 'CONFIRMED',
      delivery_date: new Date('2026-10-06T14:00:00Z'),
      notes: 'Diterima oleh Bpk. Anton (Logistik Surya Gemilang)',
      confirmed_by: warehouseUser.id,
      confirmed_at: new Date('2026-10-06T16:00:00Z'),
      created_by: warehouseUser.id,
    },
  });

  // SO 2: CONFIRMED (CV Makmur Sejahtera)
  const so2 = await prisma.salesOrder.upsert({
    where: { so_number: 'SO-20261012-002' },
    update: { status: 'CONFIRMED' },
    create: {
      so_number: 'SO-20261012-002',
      customer_id: customerMap.get('CUST-002')!.id,
      branch_id: hqBranch.id,
      warehouse_id: hqWarehouse.id,
      status: 'CONFIRMED',
      order_date: new Date('2026-10-12T09:30:00Z'),
      expected_delivery_date: new Date('2026-10-14T12:00:00Z'),
      subtotal: 7400000,
      tax_amount: 814000,
      total_amount: 8214000,
      approved_by: supervisorUser.id,
      approved_at: new Date('2026-10-12T10:00:00Z'),
      created_by: cashierUser.id,
    },
  });

  await prisma.salesOrderLine.deleteMany({ where: { so_id: so2.id } });
  await prisma.salesOrderLine.createMany({
    data: [
      {
        so_id: so2.id,
        product_id: productMap.get('PROD-ESP-BLEND')!.id,
        qty_ordered: 20,
        qty_delivered: 0,
        uom_id: uomMap.get('KG')!,
        unit_price: 230000,
        tax_pct: 11,
        line_total: 4600000,
      },
      {
        so_id: so2.id,
        product_id: productMap.get('PROD-ETH-YIRG')!.id,
        qty_ordered: 20,
        qty_delivered: 0,
        uom_id: uomMap.get('PACK')!,
        unit_price: 140000,
        tax_pct: 11,
        line_total: 2800000,
      },
    ],
  });

  // SO 3: DRAFT (Daily Roast Boutique)
  const so3 = await prisma.salesOrder.upsert({
    where: { so_number: 'SO-20261020-003' },
    update: { status: 'DRAFT' },
    create: {
      so_number: 'SO-20261020-003',
      customer_id: customerMap.get('CUST-006')!.id,
      branch_id: pikBranch.id,
      warehouse_id: pikWarehouse.id,
      status: 'DRAFT',
      order_date: new Date('2026-10-20T16:00:00Z'),
      subtotal: 4200000,
      tax_amount: 462000,
      total_amount: 4662000,
      created_by: cashierUser.id,
      notes: 'Order sampel single origin & matcha untuk menu musim gugur',
    },
  });

  await prisma.salesOrderLine.deleteMany({ where: { so_id: so3.id } });
  await prisma.salesOrderLine.create({
    data: {
      so_id: so3.id,
      product_id: productMap.get('PROD-MATCHA-UJI')!.id,
      qty_ordered: 10,
      qty_delivered: 0,
      uom_id: uomMap.get('PACK')!,
      unit_price: 350000,
      tax_pct: 11,
      line_total: 3500000,
    },
  });

  // Sales Return
  const sr1 = await prisma.salesReturn.upsert({
    where: { return_number: 'SR-20261008-001' },
    update: { status: 'APPROVED' },
    create: {
      return_number: 'SR-20261008-001',
      reference_type: 'SALES_ORDER',
      reference_id: so1.id,
      customer_id: customerMap.get('CUST-001')!.id,
      warehouse_id: hqWarehouse.id,
      return_date: new Date('2026-10-08T11:00:00Z'),
      reason: '2 kg kemasan biji kopi robek saat proses handling ekspedisi',
      status: 'APPROVED',
      total_amount: 488400,
      approved_by: supervisorUser.id,
      approved_at: new Date('2026-10-08T13:00:00Z'),
      created_by: cashierUser.id,
    },
  });

  await prisma.salesReturnLine.deleteMany({ where: { return_id: sr1.id } });
  await prisma.salesReturnLine.create({
    data: {
      return_id: sr1.id,
      product_id: productMap.get('PROD-ESP-BLEND')!.id,
      qty: 2,
      uom_id: uomMap.get('KG')!,
      unit_price: 220000,
      unit_cost: 140000,
      line_total: 440000,
    },
  });

  console.log('    ✓ Sales Orders, Delivery Order, dan Sales Return siap.');

  // =========================================================================
  // 11. PROCUREMENT: PURCHASE REQUESTS, ORDERS, GOODS RECEIPTS & RETURNS
  // =========================================================================
  console.log('  📑 11. Seeding Pengadaan (Purchase Request, PO, GR, Retur)...');

  // Bersihkan data turunan PO & PR lama agar tidak melanggar foreign key
  await prisma.purchaseReturnLine.deleteMany({});
  await prisma.purchaseReturn.deleteMany({});
  await prisma.goodsReceiptLine.deleteMany({});
  await prisma.goodsReceipt.deleteMany({});
  await prisma.purchaseOrderLine.deleteMany({
    where: { purchase_order: { po_number: 'PO-20261001-001' } },
  });
  await prisma.purchaseRequestLine.deleteMany({
    where: { purchase_request: { pr_number: 'PR-20261010-001' } },
  });

  // PR 1: APPROVED
  const pr1 = await prisma.purchaseRequest.upsert({
    where: { pr_number: 'PR-20261010-001' },
    update: { status: 'APPROVED' },
    create: {
      pr_number: 'PR-20261010-001',
      branch_id: senopatiBranch.id,
      warehouse_id: senopatiWarehouse.id,
      status: 'APPROVED',
      requested_by: cashierUser.id,
      notes: 'Permintaan restock biji kopi & oat milk Cafe Senopati jelang weekend',
    },
  });

  await prisma.purchaseRequestLine.createMany({
    data: [
      {
        pr_id: pr1.id,
        product_id: productMap.get('PROD-ESP-BLEND')!.id,
        qty_requested: 20,
        uom_id: uomMap.get('KG')!,
        estimated_price: 140000,
      },
      {
        pr_id: pr1.id,
        product_id: productMap.get('PROD-OAT-BAR')!.id,
        qty_requested: 30,
        uom_id: uomMap.get('BTL')!,
        estimated_price: 32000,
      },
    ],
  });

  // PO 1: COMPLETED (Green Beans Specialty)
  const po1 = await prisma.purchaseOrder.upsert({
    where: { po_number: 'PO-20261001-001' },
    update: { status: 'COMPLETED' },
    create: {
      po_number: 'PO-20261001-001',
      supplier_id: supplierMap.get('SUPP-004')!.id,
      branch_id: hqBranch.id,
      warehouse_id: hqWarehouse.id,
      status: 'COMPLETED',
      order_date: new Date('2026-10-01T08:30:00Z'),
      expected_delivery_date: new Date('2026-10-03T17:00:00Z'),
      subtotal: 25000000,
      tax_amount: 2750000,
      total_amount: 27750000,
      approved_by: adminUser?.id,
      approved_at: new Date('2026-10-01T09:00:00Z'),
      notes: 'Pengadaan 200kg Green Beans Specialty Aceh Gayo & Flores Bajawa',
      created_by: purchasingUser.id,
    },
  });

  const po1Line = await prisma.purchaseOrderLine.create({
    data: {
      po_id: po1.id,
      product_id: productMap.get('PROD-ACEH-GAYO')!.id,
      qty_ordered: 200,
      qty_received: 200,
      uom_id: uomMap.get('KG')!,
      unit_price: 125000,
      tax_pct: 11,
      tax_amount: 2750000,
      line_total: 25000000,
      line_status: 'RECEIVED',
    },
  });

  // Goods Receipt untuk PO 1
  const gr1 = await prisma.goodsReceipt.upsert({
    where: { gr_number: 'GR-20261003-001' },
    update: { status: 'CONFIRMED' },
    create: {
      gr_number: 'GR-20261003-001',
      po_id: po1.id,
      supplier_id: supplierMap.get('SUPP-004')!.id,
      warehouse_id: hqWarehouse.id,
      status: 'CONFIRMED',
      receipt_date: new Date('2026-10-03T14:00:00Z'),
      notes: 'Diterima utuh tanpa cacat karung rami',
      confirmed_by: warehouseUser.id,
      confirmed_at: new Date('2026-10-03T15:00:00Z'),
      created_by: warehouseUser.id,
    },
  });

  await prisma.goodsReceiptLine.create({
    data: {
      gr_id: gr1.id,
      po_line_id: po1Line.id,
      product_id: productMap.get('PROD-ACEH-GAYO')!.id,
      qty_received: 200,
      uom_id: uomMap.get('KG')!,
      unit_cost: 125000,
      total_cost: 25000000,
      batch_number: 'BATCH-AG-202610',
    },
  });

  // Purchase Return
  const prRet1 = await prisma.purchaseReturn.upsert({
    where: { return_number: 'PRET-20261014-001' },
    update: { status: 'CONFIRMED' },
    create: {
      return_number: 'PRET-20261014-001',
      supplier_id: supplierMap.get('SUPP-005')!.id,
      branch_id: hqBranch.id,
      warehouse_id: hqWarehouse.id,
      return_date: new Date('2026-10-14T11:00:00Z'),
      reason: '1 Dus Hot Cup cetakan logo miring / reject sablon',
      total_amount: 1900000,
      status: 'CONFIRMED',
      created_by: warehouseUser.id,
    },
  });

  await prisma.purchaseReturnLine.create({
    data: {
      return_id: prRet1.id,
      product_id: productMap.get('PROD-CUP-HOT-8')!.id,
      qty: 50,
      uom_id: uomMap.get('PACK')!,
      unit_cost: 38000,
      line_total: 1900000,
    },
  });

  console.log('    ✓ Pengadaan (PR, PO, GR, Purchase Return) siap.');

  // =========================================================================
  // 12. INVOICING (PIUTANG USAHA & HUTANG USAHA)
  // =========================================================================
  console.log('  🧾 12. Seeding Faktur (Invoices AR & AP)...');

  // Bersihkan invoice demo sebelumnya jika ada
  await prisma.bankStatement.deleteMany({});
  await prisma.bankReconciliation.deleteMany({});
  await prisma.invoiceAllocation.deleteMany({});
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});

  // 1. AR INVOICES (Penjualan / Piutang Pelanggan)
  // INV-AR 1: PAID (Rp 14.430.000)
  const invAr1 = await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AR-20261006-001',
      invoice_type: 'SALES',
      reference_type: 'SALES_ORDER',
      reference_id: so1.id,
      customer_id: customerMap.get('CUST-001')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-10-06T10:00:00Z'),
      due_date: new Date('2026-11-05T23:59:59Z'),
      status: 'PAID',
      subtotal: 13000000,
      tax_amount: 1430000,
      total_amount: 14430000,
      paid_amount: 14430000,
      outstanding_amount: 0,
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-06T11:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Kiro Signature Espresso Blend 1kg (50kg)',
            qty: 50,
            unit_price: 220000,
            line_total: 11000000,
          },
          {
            description: 'Oatside Barista Blend 1L (50 Btl)',
            qty: 50,
            unit_price: 40000,
            line_total: 2000000,
          },
        ],
      },
    },
  });

  // INV-AR 2: PARTIAL (Total Rp 8.214.000, Paid Rp 4.000.000, Outstanding Rp 4.214.000)
  const invAr2 = await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AR-20261013-002',
      invoice_type: 'SALES',
      reference_type: 'SALES_ORDER',
      reference_id: so2.id,
      customer_id: customerMap.get('CUST-002')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-10-13T10:00:00Z'),
      due_date: new Date('2026-11-12T23:59:59Z'),
      status: 'PARTIAL',
      subtotal: 7400000,
      tax_amount: 814000,
      total_amount: 8214000,
      paid_amount: 4000000,
      outstanding_amount: 4214000,
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-13T11:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Kiro Signature Espresso Blend 1kg (20kg)',
            qty: 20,
            unit_price: 230000,
            line_total: 4600000,
          },
          {
            description: 'Ethiopia Yirgacheffe Washed 250g (20 Pack)',
            qty: 20,
            unit_price: 140000,
            line_total: 2800000,
          },
        ],
      },
    },
  });

  // INV-AR 3: POSTED / UNPAID (Toko Sumber Rejeki, Rp 5.800.000)
  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AR-20261016-003',
      invoice_type: 'SALES',
      reference_type: 'SALES_ORDER',
      reference_id: so2.id,
      customer_id: customerMap.get('CUST-003')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-10-16T09:00:00Z'),
      due_date: new Date('2026-11-15T23:59:59Z'),
      status: 'POSTED',
      subtotal: 5225225,
      tax_amount: 574775,
      total_amount: 5800000,
      paid_amount: 0,
      outstanding_amount: 5800000,
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-16T10:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Retail Coffee & Syrup Supplies',
            qty: 1,
            unit_price: 5225225,
            line_total: 5225225,
          },
        ],
      },
    },
  });

  // INV-AR 4: OVERDUE (Nusantara Jaya, jatuh tempo 10 Oktober 2026, Rp 9.500.000)
  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AR-20260910-004',
      invoice_type: 'SALES',
      reference_type: 'SALES_ORDER',
      reference_id: so1.id,
      customer_id: customerMap.get('CUST-004')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-09-10T09:00:00Z'),
      due_date: new Date('2026-10-10T23:59:59Z'),
      status: 'POSTED',
      subtotal: 8558558,
      tax_amount: 941442,
      total_amount: 9500000,
      paid_amount: 0,
      outstanding_amount: 9500000,
      posted_by: financeUser.id,
      posted_at: new Date('2026-09-10T10:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Hospitality Bulk Coffee Supply - Sept 2026',
            qty: 1,
            unit_price: 8558558,
            line_total: 8558558,
          },
        ],
      },
    },
  });

  // 2. AP INVOICES (Pembelian / Hutang ke Pemasok)
  // INV-AP 1: PAID (PT Agro Sumber Kopi, Rp 27.750.000)
  const invAp1 = await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AP-20261002-001',
      invoice_type: 'PURCHASE',
      reference_type: 'PURCHASE_ORDER',
      reference_id: po1.id,
      supplier_id: supplierMap.get('SUPP-004')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-10-02T10:00:00Z'),
      due_date: new Date('2026-11-01T23:59:59Z'),
      status: 'PAID',
      subtotal: 25000000,
      tax_amount: 2750000,
      total_amount: 27750000,
      paid_amount: 27750000,
      outstanding_amount: 0,
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-02T11:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Pengadaan 200kg Green Beans Specialty',
            qty: 200,
            unit_price: 125000,
            line_total: 25000000,
          },
        ],
      },
    },
  });

  // INV-AP 2: POSTED / OUTSTANDING (PT Toffin, Rp 18.500.000)
  const invAp2 = await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AP-20261010-002',
      invoice_type: 'PURCHASE',
      reference_type: 'PURCHASE_ORDER',
      reference_id: po1.id,
      supplier_id: supplierMap.get('SUPP-003')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-10-10T10:00:00Z'),
      due_date: new Date('2026-11-09T23:59:59Z'),
      status: 'PARTIAL',
      subtotal: 16666667,
      tax_amount: 1833333,
      total_amount: 18500000,
      paid_amount: 10000000,
      outstanding_amount: 8500000,
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-10T11:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Barista Tools, Digital Scales & Drippers',
            qty: 1,
            unit_price: 16666667,
            line_total: 16666667,
          },
        ],
      },
    },
  });

  // INV-AP 3: OVERDUE (PT Kemasan Lestari, jatuh tempo 15 Okt, Rp 6.400.000)
  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-AP-20260915-003',
      invoice_type: 'PURCHASE',
      reference_type: 'PURCHASE_ORDER',
      reference_id: po1.id,
      supplier_id: supplierMap.get('SUPP-005')!.id,
      branch_id: hqBranch.id,
      invoice_date: new Date('2026-09-15T09:00:00Z'),
      due_date: new Date('2026-10-15T23:59:59Z'),
      status: 'POSTED',
      subtotal: 5765766,
      tax_amount: 634234,
      total_amount: 6400000,
      paid_amount: 0,
      outstanding_amount: 6400000,
      posted_by: financeUser.id,
      posted_at: new Date('2026-09-15T10:00:00Z'),
      created_by: financeUser.id,
      lines: {
        create: [
          {
            description: 'Kemasan Gelas Kraft & Cold Cup Sablon',
            qty: 1,
            unit_price: 5765766,
            line_total: 5765766,
          },
        ],
      },
    },
  });

  console.log('    ✓ Faktur Penjualan (AR) & Pembelian (AP) lengkap dengan status Lunas, Parsial, & Jatuh Tempo.');

  // =========================================================================
  // 13. PAYMENTS & ALOKASI
  // =========================================================================
  console.log('  💰 13. Seeding Pembayaran & Alokasi Pelunasan...');

  // Payment 1: Penerimaan Piutang dari CUST-001 (Rp 14.430.000)
  const pay1 = await prisma.payment.create({
    data: {
      payment_number: 'PAY-IN-20261007-001',
      payment_type: 'INCOMING',
      customer_id: customerMap.get('CUST-001')!.id,
      branch_id: hqBranch.id,
      payment_date: new Date('2026-10-07T14:30:00Z'),
      payment_method_id: trfPm!.id,
      amount: 14430000,
      status: 'POSTED',
      reference_number: 'BCA-TRF-0091823',
      notes: 'Pelunasan faktur INV-AR-20261006-001 via transfer BCA',
      approved_by: financeUser.id,
      approved_at: new Date('2026-10-07T15:00:00Z'),
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-07T15:00:00Z'),
      created_by: financeUser.id,
    },
  });

  await prisma.invoiceAllocation.create({
    data: {
      invoice_id: invAr1.id,
      payment_id: pay1.id,
      allocated_amount: 14430000,
      allocated_at: new Date('2026-10-07T15:00:00Z'),
      created_by: financeUser.id,
    },
  });

  // Payment 2: Penerimaan Parsial dari CUST-002 (Rp 4.000.000)
  const pay2 = await prisma.payment.create({
    data: {
      payment_number: 'PAY-IN-20261014-002',
      payment_type: 'INCOMING',
      customer_id: customerMap.get('CUST-002')!.id,
      branch_id: hqBranch.id,
      payment_date: new Date('2026-10-14T10:15:00Z'),
      payment_method_id: trfPm!.id,
      amount: 4000000,
      status: 'POSTED',
      reference_number: 'BCA-TRF-0094582',
      notes: 'Pembayaran DP 50% pesanan biji kopi CV Makmur',
      approved_by: financeUser.id,
      approved_at: new Date('2026-10-14T11:00:00Z'),
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-14T11:00:00Z'),
      created_by: financeUser.id,
    },
  });

  await prisma.invoiceAllocation.create({
    data: {
      invoice_id: invAr2.id,
      payment_id: pay2.id,
      allocated_amount: 4000000,
      allocated_at: new Date('2026-10-14T11:00:00Z'),
      created_by: financeUser.id,
    },
  });

  // Payment 3: Pembayaran Hutang ke Supplier SUPP-004 (Rp 27.750.000)
  const pay3 = await prisma.payment.create({
    data: {
      payment_number: 'PAY-OUT-20261003-001',
      payment_type: 'OUTGOING',
      supplier_id: supplierMap.get('SUPP-004')!.id,
      branch_id: hqBranch.id,
      payment_date: new Date('2026-10-03T16:00:00Z'),
      payment_method_id: trfPm!.id,
      amount: 27750000,
      status: 'POSTED',
      reference_number: 'KLIKBCA-CORP-4881',
      notes: 'Pelunasan green beans specialty PT Agro Sumber Kopi',
      approved_by: financeUser.id,
      approved_at: new Date('2026-10-03T16:30:00Z'),
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-03T16:30:00Z'),
      created_by: financeUser.id,
    },
  });

  await prisma.invoiceAllocation.create({
    data: {
      invoice_id: invAp1.id,
      payment_id: pay3.id,
      allocated_amount: 27750000,
      allocated_at: new Date('2026-10-03T16:30:00Z'),
      created_by: financeUser.id,
    },
  });

  // Payment 4: Pembayaran Parsial ke Supplier SUPP-003 (Rp 10.000.000)
  const pay4 = await prisma.payment.create({
    data: {
      payment_number: 'PAY-OUT-20261011-002',
      payment_type: 'OUTGOING',
      supplier_id: supplierMap.get('SUPP-003')!.id,
      branch_id: hqBranch.id,
      payment_date: new Date('2026-10-11T14:00:00Z'),
      payment_method_id: trfPm!.id,
      amount: 10000000,
      status: 'POSTED',
      reference_number: 'KLIKBCA-CORP-5120',
      notes: 'Pembayaran termin 1 peralatan barista PT Toffin',
      approved_by: financeUser.id,
      approved_at: new Date('2026-10-11T14:30:00Z'),
      posted_by: financeUser.id,
      posted_at: new Date('2026-10-11T14:30:00Z'),
      created_by: financeUser.id,
    },
  });

  await prisma.invoiceAllocation.create({
    data: {
      invoice_id: invAp2.id,
      payment_id: pay4.id,
      allocated_amount: 10000000,
      allocated_at: new Date('2026-10-11T14:30:00Z'),
      created_by: financeUser.id,
    },
  });

  console.log('    ✓ Pembayaran Masuk & Keluar berhasil dialokasikan ke faktur terkait.');

  // =========================================================================
  // 14. FIXED ASSETS (ASET TETAP)
  // =========================================================================
  console.log('  🏭 14. Seeding Manajemen Aset Tetap (Fixed Assets)...');

  const assetAccount = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.203.000' } }); // Peralatan Kantor
  const vehicleAccount = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.204.000' } }); // Kendaraan
  const depExpenseAccount = await prisma.chartOfAccount.findUnique({ where: { account_code: '6.103.000' } }); // Beban Penyusutan
  const accumDepAccount = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.205.000' } }); // Akumulasi Penyusutan

  if (assetAccount && depExpenseAccount && accumDepAccount) {
    const fixedAssetsData = [
      {
        code: 'AST-LMPB-01',
        name: 'La Marzocco Linea PB 2-Group Espresso Machine (Senopati)',
        purchase_date: new Date('2025-01-15'),
        purchase_price: 185000000,
        salvage_value: 20000000,
        useful_life_months: 60,
        accumulated_depreciation: 57750000,
        branch_id: senopatiBranch.id,
        asset_account_id: assetAccount.id,
      },
      {
        code: 'AST-MK43-01',
        name: 'Mahlkönig EK43 Allround Coffee Grinder (Senopati)',
        purchase_date: new Date('2025-01-20'),
        purchase_price: 48000000,
        salvage_value: 5000000,
        useful_life_months: 60,
        accumulated_depreciation: 15050000,
        branch_id: senopatiBranch.id,
        asset_account_id: assetAccount.id,
      },
      {
        code: 'AST-POS-SENO-01',
        name: 'Apple iPad Pro 11" M2 + Stand & Thermal Printer POS',
        purchase_date: new Date('2025-06-01'),
        purchase_price: 24000000,
        salvage_value: 2000000,
        useful_life_months: 36,
        accumulated_depreciation: 9777777,
        branch_id: senopatiBranch.id,
        asset_account_id: assetAccount.id,
      },
      {
        code: 'AST-MTR-01',
        name: 'Honda Beat Street 2024 (Armada Operasional Logistik)',
        purchase_date: new Date('2025-03-10'),
        purchase_price: 19500000,
        salvage_value: 3000000,
        useful_life_months: 48,
        accumulated_depreciation: 6531250,
        branch_id: hqBranch.id,
        asset_account_id: vehicleAccount ? vehicleAccount.id : assetAccount.id,
      },
    ];

    for (const fa of fixedAssetsData) {
      await prisma.fixedAsset.upsert({
        where: { code: fa.code },
        update: {
          name: fa.name,
          purchase_price: fa.purchase_price,
          accumulated_depreciation: fa.accumulated_depreciation,
          branch_id: fa.branch_id,
        },
        create: {
          code: fa.code,
          name: fa.name,
          purchase_date: fa.purchase_date,
          purchase_price: fa.purchase_price,
          salvage_value: fa.salvage_value,
          useful_life_months: fa.useful_life_months,
          accumulated_depreciation: fa.accumulated_depreciation,
          status: 'ACTIVE',
          branch_id: fa.branch_id,
          asset_account_id: fa.asset_account_id,
          depreciation_expense_account_id: depExpenseAccount.id,
          accum_depreciation_account_id: accumDepAccount.id,
        },
      });
    }
    console.log('    ✓ 4 Unit Aset Tetap (Mesin Espresso, Grinder, iPad POS, Motor) berhasil di-seed.');
  }

  // =========================================================================
  // 15. BANK STATEMENTS & REKONSILIASI BANK
  // =========================================================================
  console.log('  🏦 15. Seeding Rekening Koran & Rekonsiliasi Bank...');

  const bankAccount = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.101.003' } });
  const periodOct = await prisma.fiscalPeriod.findFirst({ where: { year: 2026, month: 10 } });

  if (bankAccount && periodOct) {
    await prisma.bankStatement.deleteMany({ where: { bank_account_id: bankAccount.id } });
    await prisma.bankReconciliation.deleteMany({ where: { bank_account_id: bankAccount.id } });

    // Rekonsiliasi Bank Oktober 2026
    const bankRecon = await prisma.bankReconciliation.create({
      data: {
        bank_account_id: bankAccount.id,
        period_id: periodOct.id,
        status: 'IN_PROGRESS',
        reconciled_by: financeUser.id,
        notes: 'Rekonsiliasi mutasi Bank BCA Rekening Utama periode Oktober 2026',
      },
    });

    // Bank Statement Lines
    await prisma.bankStatement.createMany({
      data: [
        {
          bank_account_id: bankAccount.id,
          statement_date: new Date('2026-10-03T16:15:00Z'),
          reference_number: 'BCA-DB-99012',
          description: 'TRF KLIKBCA-CORP-4881 KE PT AGRO SUMBER KOPI',
          amount: 27750000,
          transaction_type: 'DEBIT',
          is_matched: true,
          matched_payment_id: pay3.id,
          matched_at: new Date('2026-10-03T17:00:00Z'),
        },
        {
          bank_account_id: bankAccount.id,
          statement_date: new Date('2026-10-07T14:45:00Z'),
          reference_number: 'BCA-CR-88231',
          description: 'TRF DR PT SURYA GEMILANG UTAMA / INV-AR-001',
          amount: 14430000,
          transaction_type: 'CREDIT',
          is_matched: true,
          matched_payment_id: pay1.id,
          matched_at: new Date('2026-10-07T15:30:00Z'),
        },
        {
          bank_account_id: bankAccount.id,
          statement_date: new Date('2026-10-11T14:20:00Z'),
          reference_number: 'BCA-DB-99451',
          description: 'TRF KLIKBCA-CORP-5120 KE PT TOFFIN UTAMA',
          amount: 10000000,
          transaction_type: 'DEBIT',
          is_matched: true,
          matched_payment_id: pay4.id,
          matched_at: new Date('2026-10-11T15:00:00Z'),
        },
        {
          bank_account_id: bankAccount.id,
          statement_date: new Date('2026-10-14T10:30:00Z'),
          reference_number: 'BCA-CR-88542',
          description: 'TRF DR CV MAKMUR SEJAHTERA / PELUNASAN DP',
          amount: 4000000,
          transaction_type: 'CREDIT',
          is_matched: true,
          matched_payment_id: pay2.id,
          matched_at: new Date('2026-10-14T11:30:00Z'),
        },
        {
          bank_account_id: bankAccount.id,
          statement_date: new Date('2026-10-20T22:00:00Z'),
          reference_number: 'BCA-CR-90114',
          description: 'SETTLEMENT MERCHANT EDC BCA POS SENOPATI',
          amount: 8650000,
          transaction_type: 'CREDIT',
          is_matched: false,
        },
      ],
    });

    console.log('    ✓ Rekonsiliasi Bank & 5 Mutasi Rekening Koran siap.');
  }

  // =========================================================================
  // 16. GENERAL LEDGER: JURNAL UMUM BERIMBANG (DEBIT = CREDIT)
  // =========================================================================
  console.log('  📖 16. Seeding Jurnal Umum Buku Besar (Balanced Double-Entry)...');

  // Cari akun-akun COA terkait
  const kasKecil = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.101.001' } });
  const bankUtama = await prisma.chartOfAccount.findUnique({ where: { account_code: '1.101.003' } });
  const modalDisetor = await prisma.chartOfAccount.findUnique({ where: { account_code: '3.101.000' } });
  const bebanListrik = await prisma.chartOfAccount.findUnique({ where: { account_code: '6.102.001' } });
  const bebanInternet = await prisma.chartOfAccount.findUnique({ where: { account_code: '6.102.003' } });

  const periodJan = await prisma.fiscalPeriod.findFirst({ where: { year: 2026, month: 1 } });
  const periodSep = await prisma.fiscalPeriod.findFirst({ where: { year: 2026, month: 9 } });

  if (kasKecil && bankUtama && modalDisetor && periodJan && periodSep && periodOct && assetAccount) {
    // 1. Jurnal Modal Awal & Saldo Kas Pembukaan (Rp 750.000.000)
    // Debit Bank Rp 500jt, Kas Kecil Rp 20jt, Peralatan Rp 230jt | Credit Modal Rp 750jt
    await prisma.journalEntry.upsert({
      where: { je_number: 'JE-20260101-001' },
      update: { status: 'POSTED' },
      create: {
        je_number: 'JE-20260101-001',
        entry_date: new Date('2026-01-01T08:00:00Z'),
        period_id: periodJan.id,
        reference_type: 'CAPITAL_INJECTION',
        reference_id: hqBranch.id,
        reference_number: 'MODAL-AWAL-2026',
        description: 'Setoran modal awal pemilik usaha & pembukaan kas dan bank',
        total_debit: 750000000,
        total_credit: 750000000,
        status: 'POSTED',
        posted_by: financeUser.id,
        posted_at: new Date('2026-01-01T09:00:00Z'),
        created_by: financeUser.id,
        lines: {
          create: [
            {
              line_number: 1,
              account_id: bankUtama.id,
              debit: 500000000,
              credit: 0,
              description: 'Penempatan Rekening Giro Utama BCA',
            },
            {
              line_number: 2,
              account_id: kasKecil.id,
              debit: 20000000,
              credit: 0,
              description: 'Kas Kecil Kasir Operasional Gerai',
            },
            {
              line_number: 3,
              account_id: assetAccount.id,
              debit: 230000000,
              credit: 0,
              description: 'Peralatan Mesin Espresso & Grinder Awal',
            },
            {
              line_number: 4,
              account_id: modalDisetor.id,
              debit: 0,
              credit: 750000000,
              description: 'Modal Disetor Pemilik',
            },
          ],
        },
      },
    });

    // 2. Jurnal Beban Utilitas Operasional Toko (Oktober 2026)
    if (bebanListrik && bebanInternet) {
      await prisma.journalEntry.upsert({
        where: { je_number: 'JE-20261010-002' },
        update: { status: 'POSTED' },
        create: {
          je_number: 'JE-20261010-002',
          entry_date: new Date('2026-10-10T11:00:00Z'),
          period_id: periodOct.id,
          reference_type: 'EXPENSE_PAYMENT',
          reference_id: senopatiBranch.id,
          reference_number: 'UTIL-202610-01',
          description: 'Pembayaran tagihan listrik PLN & internet IndiHome Senopati',
          total_debit: 4750000,
          total_credit: 4750000,
          status: 'POSTED',
          posted_by: financeUser.id,
          posted_at: new Date('2026-10-10T12:00:00Z'),
          created_by: financeUser.id,
          lines: {
            create: [
              {
                line_number: 1,
                account_id: bebanListrik.id,
                debit: 3500000,
                credit: 0,
                description: 'Beban Listrik Gerai Senopati Okt 2026',
              },
              {
                line_number: 2,
                account_id: bebanInternet.id,
                debit: 1250000,
                credit: 0,
                description: 'Beban Internet Dedicated POS Senopati Okt 2026',
              },
              {
                line_number: 3,
                account_id: bankUtama.id,
                debit: 0,
                credit: 4750000,
                description: 'Pembayaran via Bank BCA Rekening Utama',
              },
            ],
          },
        },
      });
    }

    // 3. Jurnal Penyusutan Aset Akhir September 2026
    if (depExpenseAccount && accumDepAccount) {
      await prisma.journalEntry.upsert({
        where: { je_number: 'JE-20260930-003' },
        update: { status: 'POSTED' },
        create: {
          je_number: 'JE-20260930-003',
          entry_date: new Date('2026-09-30T23:59:00Z'),
          period_id: periodSep.id,
          reference_type: 'DEPRECIATION',
          reference_id: hqBranch.id,
          reference_number: 'DEP-2026-09',
          description: 'Pencatatan beban penyusutan mesin dan peralatan kafe bulan September',
          total_debit: 4500000,
          total_credit: 4500000,
          status: 'POSTED',
          posted_by: financeUser.id,
          posted_at: new Date('2026-09-30T23:59:00Z'),
          created_by: financeUser.id,
          lines: {
            create: [
              {
                line_number: 1,
                account_id: depExpenseAccount.id,
                debit: 4500000,
                credit: 0,
                description: 'Beban Penyusutan Peralatan & Mesin',
              },
              {
                line_number: 2,
                account_id: accumDepAccount.id,
                debit: 0,
                credit: 4500000,
                description: 'Akumulasi Penyusutan Peralatan & Mesin',
              },
            ],
          },
        },
      });
    }

    console.log('    ✓ Jurnal umum buku besar berimbang (Double-Entry Debit = Credit) siap.');
  }

  // =========================================================================
  // 17. ALUR PERSETUJUAN (APPROVAL REQUESTS & STEPS)
  // =========================================================================
  console.log('  ✅ 17. Seeding Alur Persetujuan (Approval Workflows)...');

  await prisma.approvalRequestStep.deleteMany({});
  await prisma.approvalRequest.deleteMany({});

  // Approval 1: APPROVED (Purchase Order Nilai Tinggi)
  const app1 = await prisma.approvalRequest.create({
    data: {
      document_type: 'PURCHASE_ORDER',
      document_id: po1.id,
      document_number: po1.po_number,
      amount: po1.total_amount,
      approval_level: 1,
      status: 'APPROVED',
      submitted_by: purchasingUser.id,
      submitted_at: new Date('2026-10-01T08:45:00Z'),
      notes: 'PO pengadaan biji kopi specialty green beans di atas batas plafon Rp 20.000.000',
    },
  });

  await prisma.approvalRequestStep.create({
    data: {
      request_id: app1.id,
      step_number: 1,
      approver_id: adminUser?.id ?? purchasingUser.id,
      status: 'APPROVED',
      decision_at: new Date('2026-10-01T09:00:00Z'),
      notes: 'Disetujui sesuai kuota persediaan Q4',
    },
  });

  // Approval 2: PENDING (Sales Order Nilai Besar CUST-002)
  const app2 = await prisma.approvalRequest.create({
    data: {
      document_type: 'SALES_ORDER',
      document_id: so2.id,
      document_number: so2.so_number,
      amount: so2.total_amount,
      approval_level: 1,
      status: 'PENDING',
      submitted_by: cashierUser.id,
      submitted_at: new Date('2026-10-12T09:45:00Z'),
      notes: 'Persetujuan term of payment 30 hari untuk pelanggan CV Makmur Sejahtera',
    },
  });

  await prisma.approvalRequestStep.create({
    data: {
      request_id: app2.id,
      step_number: 1,
      approver_id: supervisorUser.id,
      status: 'PENDING',
      notes: 'Menunggu verifikasi riwayat kelancaran pembayaran',
    },
  });

  console.log('    ✓ Alur persetujuan (Approved & Pending) siap.');

  // =========================================================================
  // 18. AUDIT LOG ENTERPRISE (UNTUK HALAMAN AUDIT & RECENT ACTIVITIES)
  // =========================================================================
  console.log('  🔍 18. Seeding Jejak Audit (Audit Logs Enterprise)...');

  const now = new Date('2026-10-21T08:00:00Z');
  const auditEntries = [
    {
      user_id: cashierUser.id,
      action: 'CREATE',
      entity_type: 'PosTransaction',
      entity_id: senopatiWarehouse.id,
      data_after: { transaction_number: 'POS-20261021-0004', amount: 320000 },
      created_at: new Date('2026-10-21T07:45:00Z'),
    },
    {
      user_id: cashierUser.id,
      action: 'CREATE',
      entity_type: 'Shift',
      entity_id: senopatiWarehouse.id,
      data_after: { shift_number: 'SHF-DEMO-20261021-01', opening_balance: 500000 },
      created_at: new Date('2026-10-21T07:30:00Z'),
    },
    {
      user_id: warehouseUser.id,
      action: 'CREATE',
      entity_type: 'StockOpname',
      entity_id: senopatiWarehouse.id,
      data_after: { opname_number: 'OPN-20260930-01', status: 'FINALIZED' },
      created_at: new Date('2026-10-20T17:15:00Z'),
    },
    {
      user_id: financeUser.id,
      action: 'CREATE',
      entity_type: 'Payment',
      entity_id: hqBranch.id,
      data_after: { payment_number: 'PAY-IN-20261014-002', amount: 4000000 },
      created_at: new Date('2026-10-20T14:30:00Z'),
    },
    {
      user_id: purchasingUser.id,
      action: 'UPDATE',
      entity_type: 'PurchaseOrder',
      entity_id: po1.id,
      data_after: { po_number: po1.po_number, status: 'COMPLETED' },
      created_at: new Date('2026-10-19T11:20:00Z'),
    },
    {
      user_id: warehouseUser.id,
      action: 'CREATE',
      entity_type: 'StockTransfer',
      entity_id: transfer2.id,
      data_after: { transfer_number: transfer2.transfer_number, status: 'IN_TRANSIT' },
      created_at: new Date('2026-10-19T09:00:00Z'),
    },
    {
      user_id: financeUser.id,
      action: 'POST',
      entity_type: 'Invoice',
      entity_id: invAr2.id,
      data_after: { invoice_number: invAr2.invoice_number, status: 'PARTIAL' },
      created_at: new Date('2026-10-18T10:00:00Z'),
    },
    {
      user_id: supervisorUser.id,
      action: 'APPROVE',
      entity_type: 'SalesOrder',
      entity_id: so2.id,
      data_after: { so_number: so2.so_number, status: 'CONFIRMED' },
      created_at: new Date('2026-10-17T15:45:00Z'),
    },
  ];

  for (const log of auditEntries) {
    await prisma.auditLog.create({
      data: {
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        data_after: log.data_after,
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KiroERP-Client/1.0',
        created_at: log.created_at,
      },
    });
  }

  console.log('    ✓ Jejak audit aktivitas terintegrasi dengan widget Recent Activities.');
  console.log('🎉 [Demo Seed] SELESAI! Seluruh modul aplikasi kini terisi data nyata yang saling terhubung.');
}
