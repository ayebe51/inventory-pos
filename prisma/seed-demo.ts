import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { seedDemoData } from './seeds/demo-data.seed';

const prisma = new PrismaClient();

async function main() {
  await seedDemoData(prisma);
}

main()
  .catch((e) => {
    console.error('❌ Demo Seed Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
