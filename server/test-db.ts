import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const riders = await prisma.deliveryPerson.findMany({ select: { name: true, phone: true } });
  console.log('Riders:', riders);
  const managers = await prisma.storeManager.findMany({ select: { name: true, phone: true } });
  console.log('Managers:', managers);
}
main().then(() => prisma.$disconnect());
