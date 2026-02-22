import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const deliveryPersons = await prisma.deliveryPerson.findMany({
        take: 5
    });
    console.log(JSON.stringify(deliveryPersons, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
