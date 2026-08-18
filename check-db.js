const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      include: {
        user_roles: {
          include: {
            role: true
          }
        }
      }
    });
    console.log('Total users found in database:', users.length);
    for (const u of users) {
      const isMatch = await bcrypt.compare('Admin@123456', u.password_hash);
      console.log(`User: ${u.email} | Active: ${u.is_active} | MFA: ${u.mfa_enabled} | Password Match (Admin@123456): ${isMatch} | Roles: ${u.user_roles.map(r => r.role.name).join(', ')}`);
    }
  } catch (err) {
    console.error('Error fetching users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
