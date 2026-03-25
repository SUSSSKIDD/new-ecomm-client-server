import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { name: { contains: 'test far', mode: 'insensitive' } },
  });
  console.log('--- PRODUCTS MATCHING "test far" ---');
  console.log(JSON.stringify(products, null, 2));

  const settings = await prisma.$queryRaw`SELECT * FROM "_prisma_migrations" LIMIT 1`; // Just checking connection
  console.log('--- DB CONNECTION OK ---');
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
