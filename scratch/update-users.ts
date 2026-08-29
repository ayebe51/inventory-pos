import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const neonUrl = 'postgresql://neondb_owner:npg_6VBIl7bKOtpP@ep-billowing-sky-azwuaq0h-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: neonUrl,
    },
  },
});

async function main() {
  const branch = await prisma.branch.findFirst();
  const passwordHash = await bcrypt.hash('admin123', 12);

  const sysAdminRole = await prisma.role.findFirst({ where: { name: 'Sys_Admin' } });
  const ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
  const cashierRole = await prisma.role.findFirst({ where: { name: 'Cashier' } });

  // 1. Update admin@example.com to have Sys_Admin role (direct login without MFA blocking)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password_hash: passwordHash,
      is_active: true,
      mfa_enabled: false,
    },
    create: {
      email: 'admin@example.com',
      password_hash: passwordHash,
      full_name: 'Administrator',
      is_active: true,
      mfa_enabled: false,
      branch_id: branch?.id,
    },
  });

  if (sysAdminRole) {
    await prisma.userRole.deleteMany({ where: { user_id: admin.id } });
    await prisma.userRole.create({
      data: {
        user_id: admin.id,
        role_id: sysAdminRole.id,
        branch_id: branch?.id,
      },
    });
    if (ownerRole) {
      await prisma.userRole.create({
        data: {
          user_id: admin.id,
          role_id: ownerRole.id,
          branch_id: branch?.id,
        },
      });
    }
  }

  // 2. Add cashier demo user
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@example.com' },
    update: {
      password_hash: passwordHash,
      is_active: true,
      mfa_enabled: false,
    },
    create: {
      email: 'cashier@example.com',
      password_hash: passwordHash,
      full_name: 'Kasir Utama',
      is_active: true,
      mfa_enabled: false,
      branch_id: branch?.id,
    },
  });

  if (cashierRole) {
    await prisma.userRole.deleteMany({ where: { user_id: cashier.id } });
    await prisma.userRole.create({
      data: {
        user_id: cashier.id,
        role_id: cashierRole.id,
        branch_id: branch?.id,
      },
    });
  }

  console.log('✅ Users successfully updated in Neon:');
  console.log('1. admin@example.com / admin123 (Administrator / Owner)');
  console.log('2. cashier@example.com / admin123 (Cashier POS)');
}

main().finally(() => prisma.$disconnect());
