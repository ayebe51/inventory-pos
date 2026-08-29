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

async function testAuth() {
  const user = await prisma.user.findFirst({
    where: { email: 'admin@example.com', deleted_at: null },
    include: {
      user_roles: {
        include: { role: true },
      },
    },
  });

  console.log('User found in Neon:', user?.email, 'isActive:', user?.is_active);
  console.log('Roles in Neon:', user?.user_roles.map(r => r.role.name));
  
  if (user) {
    const match = await bcrypt.compare('admin123', user.password_hash);
    console.log('Password admin123 match:', match);
  }
}

testAuth().finally(() => prisma.$disconnect());
