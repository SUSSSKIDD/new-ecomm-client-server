import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

async function main() {
    console.log('Clearing existing mock data (optional)...');
    try {
        await prisma.smsTemplate.deleteMany({});
        await prisma.smsLog.deleteMany({});
        await prisma.storeManager.deleteMany({});
        await prisma.store.deleteMany({});
    } catch (e) { }

    // Hardcoded PIN for managers
    const managerPinHash = await bcrypt.hash('1234', 10);
    const deliveryPin = '1234';

    const storesToCreate = [
        { type: 'GROCERY', name: 'Main Grocery Store', code: 'GY-1', phone: '+919000000001', mgr: 'Grocery Manager' },
        { type: 'PIZZA_TOWN', name: 'Downtown Pizza', code: 'PZ-1', phone: '+919000000002', mgr: 'Pizza Manager' },
        { type: 'AUTO_SERVICE', name: 'Quick Auto Service', code: 'AUTO-1', phone: '+919000000003', mgr: 'Auto Manager' },
        { type: 'DROP_IN_FACTORY', name: 'City Print Factory', code: 'PF-1', phone: '+919000000004', mgr: 'Print Manager' },
        { type: 'AUTO_PARTS_SHOP', name: 'Spare Parts Hub', code: 'AUTO-2', phone: '+919000000005', mgr: 'Parts Manager' },
        { type: 'HEALTH_SERVICE', name: 'Plus Health Clinic', code: 'HS-1', phone: '+919000000006', mgr: 'Health Manager' },
    ];

    console.log('Creating stores and managers...');
    for (const s of storesToCreate) {
        const store = await prisma.store.create({
            data: {
                name: s.name,
                pincode: '110001',
                lat: 28.6139,
                lng: 77.2090,
                address: `${s.name} Address, New Delhi`,
                storeType: s.type,
                storeCode: s.code,
            }
        });

        await prisma.storeManager.create({
            data: {
                name: s.mgr,
                phone: s.phone,
                pinHash: managerPinHash,
                storeId: store.id,
            }
        });
        console.log(`Created Store [${s.code}] and Manager [${s.phone}]`);
    }

    console.log('Creating delivery persons...');
    for (let i = 1; i <= 5; i++) {
        const phone = `+91800000000${i}`;
        await prisma.deliveryPerson.create({
            data: {
                name: `Delivery Guy ${i}`,
                phone: phone,
                pin: deliveryPin,
                status: 'DUTY_OFF',
                isActive: true,
            }
        });
        console.log(`Created Delivery Person [${phone}]`);
    }

    console.log('Creating SMS templates...');
    await prisma.smsTemplate.create({
        data: {
            name: 'OTP Verification',
            key: 'otp_verification',
            content: '##OTP## is the OTP for signing into NEYOKART. Please do not share it with anyone.',
            variables: ['OTP'],
            msg91FlowId: '69bfac455b90308046079ba4',
            type: 'OTP',
        },
    });

    console.log('Seeding complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
