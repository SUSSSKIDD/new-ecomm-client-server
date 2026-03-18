import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.smsTemplate.updateMany({
    where: { key: 'otp_verification' },
    data: {
      content: '{{OTP}} is the OTP for logging into NeyoKart. This OTP is valid for 5 Mins. Do not share this with anyone.',
    },
  });
  console.log('Updated OTP template rows:', result.count);
}

main()
  .catch((e) => {
    console.error('Error updating OTP template:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
