const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const branch = await prisma.branch.findFirst();
  const warehouse = await prisma.warehouse.findFirst();
  console.log('branch:', branch?.id);
  console.log('warehouse:', warehouse?.id);
}
main().finally(() => prisma.$disconnect());
