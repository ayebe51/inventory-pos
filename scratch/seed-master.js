const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const branch = await prisma.branch.findFirst();
    if (!branch) {
      console.log('No branch found');
      return;
    }
    console.log('Using Branch:', branch.name, branch.id);

    const custCount = await prisma.customer.count();
    if (custCount === 0) {
      await prisma.customer.createMany({
        data: [
          { code: 'CUST-001', name: 'PT Surya Gemilang Utama', phone: '081234567890', email: 'budi@suryagemilang.co.id', address: 'Jl. Sudirman No. 102, Jakarta', credit_limit: 50000000, outstanding_balance: 12500000 },
          { code: 'CUST-002', name: 'CV Makmur Sejahtera', phone: '081987654321', email: 'siti@makmur.com', address: 'Jl. Gatot Subroto No. 45, Jakarta', credit_limit: 25000000, outstanding_balance: 0 },
          { code: 'CUST-003', name: 'Toko Sumber Rejeki', phone: '085678901234', email: 'ahmad@sumberrejeki.id', address: 'Jl. Malioboro No. 12, Yogyakarta', credit_limit: 10000000, outstanding_balance: 3200000 },
          { code: 'CUST-004', name: 'PT Nusantara Jaya', phone: '082134567891', email: 'rina@nusantarajaya.co.id', address: 'Jl. Pemuda No. 88, Surabaya', credit_limit: 75000000, outstanding_balance: 45000000 }
        ]
      });
      console.log('✅ Seeded 4 customers');
    } else {
      console.log(`Customers already exist: ${custCount}`);
    }

    const suppCount = await prisma.supplier.count();
    if (suppCount === 0) {
      await prisma.supplier.createMany({
        data: [
          { code: 'SUPP-001', name: 'PT Indofood Sukses Makmur Tbk', phone: '021-5550192', email: 'sales@indofood.co.id', address: 'Indofood Tower, Jakarta', payment_terms_days: 30 },
          { code: 'SUPP-002', name: 'PT Unilever Indonesia Tbk', phone: '021-5550193', email: 'order@unilever.co.id', address: 'BSD Green Office Park, Tangerang', payment_terms_days: 45 },
          { code: 'SUPP-003', name: 'PT Samsung Electronics Indonesia', phone: '021-5550194', email: 'b2b@samsung.com', address: 'One Pacific Place, Jakarta', payment_terms_days: 30 }
        ]
      });
      console.log('✅ Seeded 3 suppliers');
    } else {
      console.log(`Suppliers already exist: ${suppCount}`);
    }

    const whCount = await prisma.warehouse.count();
    if (whCount === 0) {
      await prisma.warehouse.createMany({
        data: [
          { code: 'WH-MAIN', name: 'Gudang Utama Jakarta', branch_id: branch.id, address: 'Jl. Industri Raya No. 45, Jakarta Barat', is_active: true, is_locked: false },
          { code: 'WH-RETAIL', name: 'Gudang Display POS Store', branch_id: branch.id, address: 'Mall Central Lt. 1, Jakarta Pusat', is_active: true, is_locked: false },
          { code: 'WH-TRANSIT', name: 'Gudang Transit Surabaya', branch_id: branch.id, address: 'Jl. Raya Rungkut No. 12, Surabaya', is_active: true, is_locked: false }
        ]
      });
      console.log('✅ Seeded 3 warehouses');
    } else {
      console.log(`Warehouses already exist: ${whCount}`);
    }

    const catCount = await prisma.category.count();
    if (catCount === 0) {
      await prisma.category.createMany({
        data: [
          { code: 'CAT-ELEC', name: 'Electronics & Gadgets' },
          { code: 'CAT-FOOD', name: 'Food & Beverage' },
          { code: 'CAT-FASH', name: 'Apparel & Fashion' },
          { code: 'CAT-OFFICE', name: 'Office Supplies' }
        ]
      });
      console.log('✅ Seeded 4 categories');
    } else {
      console.log(`Categories already exist: ${catCount}`);
    }

  } catch (err) {
    console.error('Error seeding master data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
