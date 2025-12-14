const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
    try {
        console.log('🔐 Creating admin user...');

        // Hash password
        const hashedPassword = await bcrypt.hash('Selim4458!', 10);

        // Create admin user
        const admin = await prisma.user.create({
            data: {
                email: 'parcaevim@gmail.com',
                password: hashedPassword,
                name: 'Admin',
                role: 'ADMIN',
                emailVerified: new Date(),
            },
        });

        console.log('✅ Admin user created successfully!');
        console.log('📧 Email:', admin.email);
        console.log('👤 Role:', admin.role);
        console.log('🆔 ID:', admin.id);

    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
