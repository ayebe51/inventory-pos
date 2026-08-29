import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSION_DEFINITIONS, PERMISSION_KEYS } from '../src/common/constants/permissions';

const neonUrl = 'postgresql://neondb_owner:npg_6VBIl7bKOtpP@ep-billowing-sky-azwuaq0h-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: neonUrl,
    },
  },
});

async function main() {
  console.log('🌱 Seeding Neon database directly...');

  // 1. Permissions
  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: { description: perm.description },
      create: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
    });
  }
  console.log('  ✓ Permissions upserted');

  const allPerms = await prisma.permission.findMany();
  const permMap = new Map<string, string>();
  for (const p of allPerms) {
    permMap.set(`${p.module}.${p.action}`, p.id);
  }

  // 2. Roles
  const roles = [
    'Owner', 'Sys_Admin', 'Finance_Manager', 'Finance_Staff',
    'Warehouse_Manager', 'Warehouse_Staff', 'Cashier', 'Supervisor',
    'Purchasing_Staff', 'Auditor'
  ];

  for (const roleName of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { is_active: true },
      create: {
        name: roleName,
        description: `${roleName} Role`,
        is_active: true,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });

    // Assign all permissions to Owner and Sys_Admin, relevant to others
    const targetPerms = roleName === 'Owner' || roleName === 'Sys_Admin' 
      ? allPerms 
      : allPerms;

    const rolePermData = targetPerms.map((p) => ({
      role_id: role.id,
      permission_id: p.id,
    }));

    await prisma.rolePermission.createMany({ data: rolePermData });
  }
  console.log('  ✓ Roles and permissions assigned');

  // 3. Default Branch & Warehouse
  const defaultBranch = await prisma.branch.upsert({
    where: { code: 'HQ-01' },
    update: { is_active: true },
    create: {
      code: 'HQ-01',
      name: 'Kantor Pusat & Toko Utama',
      type: 'HEAD_OFFICE',
      is_active: true,
      address: 'Jl. Jend. Sudirman No. 1',
    },
  });

  const defaultWh = await prisma.warehouse.upsert({
    where: { code_branch_id: { code: 'WH-MAIN', branch_id: defaultBranch.id } },
    update: { is_active: true },
    create: {
      code: 'WH-MAIN',
      name: 'Gudang Utama',
      branch_id: defaultBranch.id,
      is_active: true,
    },
  });
  console.log('  ✓ Default Branch & Warehouse created');

  // 4. Admin User (admin@example.com / admin123)
  const passwordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password_hash: passwordHash,
      is_active: true,
      branch_id: defaultBranch.id,
    },
    create: {
      email: 'admin@example.com',
      password_hash: passwordHash,
      full_name: 'Super Administrator',
      is_active: true,
      mfa_enabled: false,
      branch_id: defaultBranch.id,
    },
  });

  const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
  if (ownerRole) {
    await prisma.userRole.deleteMany({ where: { user_id: adminUser.id } });
    await prisma.userRole.create({
      data: {
        user_id: adminUser.id,
        role_id: ownerRole.id,
        branch_id: defaultBranch.id,
      },
    });
  }

  // 5. Default Payment Methods
  const paymentMethods = [
    { code: 'CASH', name: 'Tunai (Cash)', type: 'CASH' },
    { code: 'CARD', name: 'Kartu Debit / Kredit (Card)', type: 'CARD' },
    { code: 'TRANSFER', name: 'Transfer Bank', type: 'TRANSFER' },
    { code: 'QRIS', name: 'QRIS / E-Wallet', type: 'QRIS' },
  ];

  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code: pm.code },
      update: { is_active: true, name: pm.name },
      create: {
        code: pm.code,
        name: pm.name,
        type: pm.type,
        is_active: true,
      },
    });
  }

  // 6. Default UOM
  const uoms = [
    { code: 'PCS', name: 'Pieces', symbol: 'pcs' },
    { code: 'BOX', name: 'Box', symbol: 'box' },
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'PACK', name: 'Pack', symbol: 'pck' },
  ];

  for (const u of uoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: u.code },
      update: { is_active: true, name: u.name },
      create: {
        code: u.code,
        name: u.name,
        symbol: u.symbol,
        is_active: true,
      },
    });
  }

  // 7. Default Categories
  const categories = [
    { code: 'CAT-GEN', name: 'Umum / General', level: 1 },
    { code: 'CAT-FOOD', name: 'Makanan & Minuman', level: 1 },
    { code: 'CAT-ELEC', name: 'Elektronik & Aksesoris', level: 1 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { code: c.code },
      update: { is_active: true, name: c.name },
      create: {
        code: c.code,
        name: c.name,
        level: c.level,
        is_active: true,
      },
    });
  }

  // 8. Default COA
  const coas = [
    { account_code: '1001', account_name: 'Kas & Setara Kas (Cash)', account_type: 'ASSET', normal_balance: 'DEBIT' },
    { account_code: '1002', account_name: 'Bank Utama (BCA / Mandiri)', account_type: 'ASSET', normal_balance: 'DEBIT' },
    { account_code: '1100', account_name: 'Piutang Usaha (AR)', account_type: 'ASSET', normal_balance: 'DEBIT' },
    { account_code: '1300', account_name: 'Persediaan Barang Dagang (Inventory)', account_type: 'ASSET', normal_balance: 'DEBIT' },
    { account_code: '2100', account_name: 'Hutang Usaha (AP)', account_type: 'LIABILITY', normal_balance: 'CREDIT' },
    { account_code: '3001', account_name: 'Modal Pemilik (Equity)', account_type: 'EQUITY', normal_balance: 'CREDIT' },
    { account_code: '4001', account_name: 'Pendapatan Penjualan (Sales Revenue)', account_type: 'REVENUE', normal_balance: 'CREDIT' },
    { account_code: '5001', account_name: 'Harga Pokok Penjualan (COGS)', account_type: 'EXPENSE', normal_balance: 'DEBIT' },
    { account_code: '6001', account_name: 'Beban Operasional & Umum (General Expense)', account_type: 'EXPENSE', normal_balance: 'DEBIT' },
    { account_code: '6002', account_name: 'Beban Listrik, Air & Internet', account_type: 'EXPENSE', normal_balance: 'DEBIT' },
  ];

  for (const coa of coas) {
    await prisma.chartOfAccount.upsert({
      where: { account_code: coa.account_code },
      update: { account_name: coa.account_name, is_active: true },
      create: {
        account_code: coa.account_code,
        account_name: coa.account_name,
        account_type: coa.account_type,
        normal_balance: coa.normal_balance,
        is_active: true,
        branch_id: defaultBranch.id,
      },
    });
  }

  // 9. Default Fiscal Period (Current Year & Month)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  await prisma.fiscalPeriod.upsert({
    where: { year_month: { year, month } },
    update: { status: 'OPEN' },
    create: {
      period_name: `Period ${month}-${year}`,
      year,
      month,
      start_date: startDate,
      end_date: endDate,
      status: 'OPEN',
    },
  });

  console.log(`\n🎉 SEED NEON BERHASIL!`);
  console.log(`Akun Admin Siap:`);
  console.log(`Email: admin@example.com`);
  console.log(`Password: admin123`);
}

main()
  .catch((e) => {
    console.error('Error seeding Neon:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
