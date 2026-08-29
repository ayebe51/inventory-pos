import { PrismaClient, Prisma } from '@prisma/client';

const neonUrl = 'postgresql://neondb_owner:npg_6VBIl7bKOtpP@ep-billowing-sky-azwuaq0h-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: neonUrl,
    },
  },
});

async function main() {
  console.log('🌱 Seeding sample Customers, Suppliers, and Products to Neon...');

  const warehouse = await prisma.warehouse.findFirst();
  const category = await prisma.category.findFirst();
  const uom = await prisma.unitOfMeasure.findFirst({ where: { code: 'PCS' } });
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@example.com' } });

  // 1. Customers
  const customers = [
    {
      code: 'CUST-GENERAL',
      name: 'Pelanggan Umum (Walk-in Customer)',
      email: 'general@customer.local',
      phone: '081000000000',
      address: 'Walk-in / Kasir',
      credit_limit: new Prisma.Decimal(0),
    },
    {
      code: 'CUST-001',
      name: 'PT Sinar Abadi Sentosa',
      email: 'finance@sinarabadi.com',
      phone: '081234567890',
      address: 'Jl. Sudirman No. 45, Jakarta',
      credit_limit: new Prisma.Decimal(50000000),
    },
    {
      code: 'CUST-002',
      name: 'Toko Berkah Mandiri',
      email: 'owner@tokoberkah.com',
      phone: '081987654321',
      address: 'Jl. Gatot Subroto No. 12, Bandung',
      credit_limit: new Prisma.Decimal(20000000),
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { code: c.code },
      update: { name: c.name, is_active: true },
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
  }
  console.log('  ✓ Customers seeded (including Pelanggan Umum)');

  // 2. Suppliers
  const suppliers = [
    {
      code: 'SUPP-001',
      name: 'PT Distributor Utama Perkasa',
      email: 'sales@distributorutama.com',
      phone: '0215551234',
      address: 'Kawasan Industri Pulogadung Blok A',
    },
    {
      code: 'SUPP-002',
      name: 'CV Sumber Pangan Makmur',
      email: 'order@sumberpangan.co.id',
      phone: '0215555678',
      address: 'Jl. Daan Mogot Km. 11, Jakarta Barat',
    },
  ];

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, is_active: true },
      create: {
        code: s.code,
        name: s.name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        is_active: true,
      },
    });
  }
  console.log('  ✓ Suppliers seeded');

  // 3. Products & Stock
  if (category && uom && warehouse && adminUser) {
    const products = [
      { code: 'PRD-001', name: 'Kopi Arabika Premium 250g', barcode: '8991001001', cost: 35000, price: 55000, initial_stock: 100 },
      { code: 'PRD-002', name: 'Teh Celup Melati 50s', barcode: '8991001002', cost: 12000, price: 18000, initial_stock: 150 },
      { code: 'PRD-003', name: 'Buku Catatan Hardcover A5', barcode: '8991001003', cost: 20000, price: 35000, initial_stock: 80 },
      { code: 'PRD-004', name: 'Pulpen Gel Hitam 0.5mm', barcode: '8991001004', cost: 3500, price: 6000, initial_stock: 300 },
      { code: 'PRD-005', name: 'Snack Biskuit Cokelat', barcode: '8991001005', cost: 8000, price: 12500, initial_stock: 200 },
    ];

    for (const p of products) {
      const prod = await prisma.product.upsert({
        where: { code: p.code },
        update: {
          name: p.name,
          is_active: true,
          standard_cost: new Prisma.Decimal(p.cost),
          selling_price: new Prisma.Decimal(p.price),
        },
        create: {
          code: p.code,
          name: p.name,
          barcode: p.barcode,
          category_id: category.id,
          uom_id: uom.id,
          standard_cost: new Prisma.Decimal(p.cost),
          selling_price: new Prisma.Decimal(p.price),
          min_selling_price: new Prisma.Decimal(p.cost),
          reorder_point: new Prisma.Decimal(10),
          reorder_qty: new Prisma.Decimal(50),
          is_active: true,
        },
      });

      // Inventory Ledger entry
      const existingLedger = await prisma.inventoryLedger.findFirst({
        where: { product_id: prod.id, warehouse_id: warehouse.id },
      });

      if (!existingLedger) {
        await prisma.inventoryLedger.create({
          data: {
            product_id: prod.id,
            warehouse_id: warehouse.id,
            transaction_type: 'INITIAL_STOCK',
            reference_type: 'INITIAL',
            reference_id: prod.id,
            reference_number: `INIT-${p.code}`,
            movement_date: new Date(),
            qty_in: new Prisma.Decimal(p.initial_stock),
            qty_out: new Prisma.Decimal(0),
            unit_cost: new Prisma.Decimal(p.cost),
            total_cost: new Prisma.Decimal(p.cost * p.initial_stock),
            running_qty: new Prisma.Decimal(p.initial_stock),
            running_cost: new Prisma.Decimal(p.cost * p.initial_stock),
            created_by: adminUser.id,
          },
        });
      }
    }
    console.log('  ✓ Sample Products, Pricing, and Stock seeded');
  }

  console.log('🎉 SEEDING DATA SAMPLE SELESAI!');
}

main().finally(() => prisma.$disconnect());
