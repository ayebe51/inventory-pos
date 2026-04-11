// Load .env before anything else so DATABASE_URL is available
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ── Permission definitions ────────────────────────────────────────────────────

const STANDARD_PERMISSIONS: Array<{ module: string; action: string; description: string }> = [
  // PURCHASE
  { module: 'PURCHASE', action: 'READ', description: 'View purchase documents' },
  { module: 'PURCHASE', action: 'CREATE', description: 'Create purchase requests and orders' },
  { module: 'PURCHASE', action: 'UPDATE', description: 'Update purchase documents' },
  { module: 'PURCHASE', action: 'DELETE', description: 'Delete purchase documents' },
  { module: 'PURCHASE', action: 'APPROVE', description: 'Approve purchase orders' },
  { module: 'PURCHASE', action: 'IMPORT', description: 'Import purchase data' },
  { module: 'PURCHASE', action: 'EXPORT', description: 'Export purchase data' },
  // INVENTORY
  { module: 'INVENTORY', action: 'READ', description: 'View inventory data' },
  { module: 'INVENTORY', action: 'CREATE', description: 'Create inventory records' },
  { module: 'INVENTORY', action: 'UPDATE', description: 'Update inventory records' },
  { module: 'INVENTORY', action: 'DELETE', description: 'Delete inventory records' },
  { module: 'INVENTORY', action: 'LOCK', description: 'Lock/unlock warehouses' },
  { module: 'INVENTORY', action: 'EXPORT', description: 'Export inventory data' },
  // SALES
  { module: 'SALES', action: 'READ', description: 'View sales documents' },
  { module: 'SALES', action: 'CREATE', description: 'Create sales orders' },
  { module: 'SALES', action: 'UPDATE', description: 'Update sales documents' },
  { module: 'SALES', action: 'DELETE', description: 'Delete sales documents' },
  { module: 'SALES', action: 'APPROVE', description: 'Approve sales orders' },
  { module: 'SALES', action: 'EXPORT', description: 'Export sales data' },
  // POS
  { module: 'POS', action: 'READ', description: 'View POS transactions' },
  { module: 'POS', action: 'CREATE', description: 'Create POS transactions' },
  { module: 'POS', action: 'VOID', description: 'Void POS transactions (Supervisor only)' },
  { module: 'POS', action: 'EXPORT', description: 'Export POS data' },
  // INVOICE
  { module: 'INVOICE', action: 'READ', description: 'View invoices' },
  { module: 'INVOICE', action: 'CREATE', description: 'Create invoices' },
  { module: 'INVOICE', action: 'UPDATE', description: 'Update invoices' },
  { module: 'INVOICE', action: 'DELETE', description: 'Delete draft invoices' },
  { module: 'INVOICE', action: 'POST', description: 'Post invoices' },
  { module: 'INVOICE', action: 'EXPORT', description: 'Export invoice data' },
  // PAYMENT
  { module: 'PAYMENT', action: 'READ', description: 'View payments' },
  { module: 'PAYMENT', action: 'CREATE', description: 'Create payments' },
  { module: 'PAYMENT', action: 'UPDATE', description: 'Update payments' },
  { module: 'PAYMENT', action: 'APPROVE', description: 'Approve payments (SOD-002 enforced)' },
  { module: 'PAYMENT', action: 'POST', description: 'Post payments' },
  { module: 'PAYMENT', action: 'EXPORT', description: 'Export payment data' },
  // ACCOUNTING
  { module: 'ACCOUNTING', action: 'READ', description: 'View journal entries and COA' },
  { module: 'ACCOUNTING', action: 'CREATE', description: 'Create manual journal entries' },
  { module: 'ACCOUNTING', action: 'UPDATE', description: 'Update draft journal entries' },
  { module: 'ACCOUNTING', action: 'POST', description: 'Post journal entries' },
  { module: 'ACCOUNTING', action: 'EXPORT', description: 'Export accounting data' },
  // REPORT
  { module: 'REPORT', action: 'READ', description: 'View basic reports' },
  { module: 'REPORT', action: 'EXPORT', description: 'Export reports' },
  // ADMIN
  { module: 'ADMIN', action: 'READ', description: 'View admin settings' },
  { module: 'ADMIN', action: 'CREATE', description: 'Create admin records' },
  { module: 'ADMIN', action: 'UPDATE', description: 'Update admin settings' },
  { module: 'ADMIN', action: 'DELETE', description: 'Delete admin records' },
];

const SPECIAL_PERMISSIONS: Array<{ module: string; action: string; description: string }> = [
  { module: 'PRICE', action: 'OVERRIDE', description: 'Override selling price below floor price' },
  { module: 'DISCOUNT', action: 'OVERRIDE', description: 'Override discount beyond configured limit' },
  { module: 'STOCK', action: 'ADJUST', description: 'Perform manual stock adjustments' },
  { module: 'STOCK', action: 'OPNAME', description: 'Initiate and finalize stock opname' },
  { module: 'PERIOD', action: 'CLOSE', description: 'Close fiscal periods' },
  { module: 'JOURNAL', action: 'REVERSE', description: 'Reverse posted journal entries' },
  { module: 'REPORT', action: 'FINANCIAL', description: 'Access financial reports (P&L, Balance Sheet, etc.)' },
  { module: 'REPORT', action: 'EXECUTIVE', description: 'Access executive dashboard' },
  { module: 'ADMIN', action: 'SETTINGS', description: 'Modify system settings' },
  { module: 'ADMIN', action: 'USER', description: 'Manage users and roles' },
  { module: 'INVOICE', action: 'WRITE_OFF', description: 'Write off uncollectible AR invoices' },
];

// ── Role → Permission mapping ─────────────────────────────────────────────────

type PermKey = string; // "MODULE.ACTION"

const ROLE_PERMISSIONS: Record<string, PermKey[]> = {
  Owner: [
    // Full read + approve across all modules
    'PURCHASE.READ', 'PURCHASE.APPROVE', 'PURCHASE.EXPORT',
    'INVENTORY.READ', 'INVENTORY.EXPORT',
    'SALES.READ', 'SALES.APPROVE', 'SALES.EXPORT',
    'POS.READ', 'POS.EXPORT',
    'INVOICE.READ', 'INVOICE.POST', 'INVOICE.EXPORT', 'INVOICE.WRITE_OFF',
    'PAYMENT.READ', 'PAYMENT.APPROVE', 'PAYMENT.EXPORT',
    'ACCOUNTING.READ', 'ACCOUNTING.POST', 'ACCOUNTING.EXPORT',
    'REPORT.READ', 'REPORT.EXPORT',
    'REPORT.FINANCIAL', 'REPORT.EXECUTIVE',
    'JOURNAL.REVERSE',
    'PERIOD.CLOSE',
    'ADMIN.READ',
  ],

  Sys_Admin: [
    'ADMIN.READ', 'ADMIN.CREATE', 'ADMIN.UPDATE', 'ADMIN.DELETE',
    'ADMIN.SETTINGS', 'ADMIN.USER',
    // Read-only access to all modules for support purposes
    'PURCHASE.READ', 'INVENTORY.READ', 'SALES.READ', 'POS.READ',
    'INVOICE.READ', 'PAYMENT.READ', 'ACCOUNTING.READ', 'REPORT.READ',
  ],

  Finance_Manager: [
    'PURCHASE.READ', 'PURCHASE.APPROVE', 'PURCHASE.EXPORT',
    'INVENTORY.READ', 'INVENTORY.EXPORT',
    'SALES.READ', 'SALES.APPROVE', 'SALES.EXPORT',
    'POS.READ', 'POS.EXPORT',
    'INVOICE.READ', 'INVOICE.CREATE', 'INVOICE.UPDATE', 'INVOICE.POST',
    'INVOICE.EXPORT', 'INVOICE.WRITE_OFF',
    'PAYMENT.READ', 'PAYMENT.CREATE', 'PAYMENT.APPROVE', 'PAYMENT.POST', 'PAYMENT.EXPORT',
    'ACCOUNTING.READ', 'ACCOUNTING.CREATE', 'ACCOUNTING.UPDATE', 'ACCOUNTING.POST', 'ACCOUNTING.EXPORT',
    'REPORT.READ', 'REPORT.EXPORT',
    'REPORT.FINANCIAL', 'REPORT.EXECUTIVE',
    'JOURNAL.REVERSE',
    'PERIOD.CLOSE',
  ],

  Finance_Staff: [
    'PURCHASE.READ',
    'INVENTORY.READ',
    'SALES.READ',
    'POS.READ',
    'INVOICE.READ', 'INVOICE.CREATE', 'INVOICE.UPDATE', 'INVOICE.POST', 'INVOICE.EXPORT',
    'PAYMENT.READ', 'PAYMENT.CREATE', 'PAYMENT.POST', 'PAYMENT.EXPORT',
    'ACCOUNTING.READ', 'ACCOUNTING.CREATE', 'ACCOUNTING.UPDATE', 'ACCOUNTING.EXPORT',
    'REPORT.READ', 'REPORT.EXPORT', 'REPORT.FINANCIAL',
  ],

  Warehouse_Manager: [
    'PURCHASE.READ',
    'INVENTORY.READ', 'INVENTORY.CREATE', 'INVENTORY.UPDATE', 'INVENTORY.LOCK', 'INVENTORY.EXPORT',
    'SALES.READ',
    'POS.READ',
    'REPORT.READ',
    'STOCK.ADJUST', 'STOCK.OPNAME',
  ],

  Warehouse_Staff: [
    'PURCHASE.READ',
    'INVENTORY.READ', 'INVENTORY.CREATE', 'INVENTORY.UPDATE',
    'SALES.READ',
    'POS.READ',
  ],

  Cashier: [
    'POS.READ', 'POS.CREATE',
    'INVENTORY.READ',
    'SALES.READ',
  ],

  Supervisor: [
    'POS.READ', 'POS.CREATE', 'POS.VOID',
    'INVENTORY.READ',
    'SALES.READ', 'SALES.APPROVE',
    'PURCHASE.READ', 'PURCHASE.APPROVE', // Level 1 approval (< Rp 5jt)
    'REPORT.READ',
    'PRICE.OVERRIDE', 'DISCOUNT.OVERRIDE',
  ],

  Purchasing_Staff: [
    'PURCHASE.READ', 'PURCHASE.CREATE', 'PURCHASE.UPDATE', 'PURCHASE.EXPORT',
    'INVENTORY.READ',
    'SALES.READ',
    'REPORT.READ',
  ],

  Auditor: [
    'PURCHASE.READ', 'PURCHASE.EXPORT',
    'INVENTORY.READ', 'INVENTORY.EXPORT',
    'SALES.READ', 'SALES.EXPORT',
    'POS.READ', 'POS.EXPORT',
    'INVOICE.READ', 'INVOICE.EXPORT',
    'PAYMENT.READ', 'PAYMENT.EXPORT',
    'ACCOUNTING.READ', 'ACCOUNTING.EXPORT',
    'REPORT.READ', 'REPORT.EXPORT', 'REPORT.FINANCIAL',
    'ADMIN.READ',
  ],
};

// ── Seed function ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding roles and permissions...');

  // 1. Upsert all permissions
  const allPermDefs = [...STANDARD_PERMISSIONS, ...SPECIAL_PERMISSIONS];

  for (const perm of allPermDefs) {
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
  console.log(`  ✓ Upserted ${allPermDefs.length} permissions`);

  // 2. Build a lookup map: "MODULE.ACTION" → permission id
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map<string, string>();
  for (const p of allPerms) {
    permMap.set(`${p.module}.${p.action}`, p.id);
  }

  // 3. Upsert roles and assign permissions
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { is_active: true },
      create: {
        name: roleName,
        description: getRoleDescription(roleName),
        is_active: true,
      },
    });

    // Remove existing role_permissions and re-create (idempotent)
    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });

    const rolePermData = permKeys
      .map((key) => {
        const permId = permMap.get(key);
        if (!permId) {
          console.warn(`  ⚠ Permission not found: ${key} (role: ${roleName})`);
          return null;
        }
        return { role_id: role.id, permission_id: permId };
      })
      .filter((x): x is { role_id: string; permission_id: string } => x !== null);

    await prisma.rolePermission.createMany({ data: rolePermData });
    console.log(`  ✓ Role "${roleName}": ${rolePermData.length} permissions assigned`);
  }

  // 4. Seed a default admin user (Owner) for initial system access
  const defaultAdminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const defaultAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';

  const existingAdmin = await prisma.user.findFirst({
    where: { email: defaultAdminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);
    const adminUser = await prisma.user.create({
      data: {
        email: defaultAdminEmail,
        password_hash: passwordHash,
        full_name: 'System Administrator',
        is_active: true,
        mfa_enabled: false,
      },
    });

    const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (ownerRole) {
      await prisma.userRole.create({
        data: { user_id: adminUser.id, role_id: ownerRole.id },
      });
    }

    console.log(`  ✓ Default admin user created: ${defaultAdminEmail}`);
    console.log(`  ⚠ Change the default password immediately after first login!`);
  } else {
    console.log(`  ℹ Admin user already exists: ${defaultAdminEmail}`);
  }

  console.log('✅ Seed completed successfully');
}

function getRoleDescription(roleName: string): string {
  const descriptions: Record<string, string> = {
    Owner: 'Business owner with full access to reports and highest-level approvals',
    Sys_Admin: 'System administrator with user management and configuration access',
    Finance_Manager: 'Finance manager with approval authority, period closing, and journal reversal',
    Finance_Staff: 'Finance staff with operational finance access and financial reports',
    Warehouse_Manager: 'Warehouse manager with inventory adjustment and stock opname authority',
    Warehouse_Staff: 'Warehouse staff with operational inventory access',
    Cashier: 'Cashier with POS transaction access within an open shift',
    Supervisor: 'Supervisor with POS void, price override, and Level 1 PO approval authority',
    Purchasing_Staff: 'Purchasing staff with purchase request and order creation access',
    Auditor: 'Auditor with read-only access to all financial reports and documents',
  };
  return descriptions[roleName] ?? roleName;
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
