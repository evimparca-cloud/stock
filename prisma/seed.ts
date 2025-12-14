import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Environment'tan admin bilgileri
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!@#';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Super Admin';

async function createSuperAdmin() {
  console.log('👤 Super Admin kontrolü...');
  
  // Admin kullanıcı var mı kontrol et
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'admin' }
  });
  
  if (existingAdmin) {
    console.log(`✅ Super Admin zaten mevcut: ${existingAdmin.email}`);
    return existingAdmin;
  }
  
  // Şifreyi hashle
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
  
  // Admin kullanıcı oluştur
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      password: hashedPassword,
      role: 'admin',
      emailVerified: new Date(),
    }
  });
  
  console.log(`✅ Super Admin oluşturuldu: ${admin.email}`);
  console.log(`🔐 Şifre: ${ADMIN_PASSWORD}`);
  console.log(`⚠️  ÖNEMLİ: İlk girişten sonra şifrenizi değiştirin!`);
  
  return admin;
}

async function main() {
  console.log('🌱 Seeding database...');
  
  // Super Admin oluştur (en önce)
  await createSuperAdmin();

  // Önce mevcut verileri temizle
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productMapping.deleteMany();
  await prisma.product.deleteMany();
  await prisma.marketplace.deleteMany();

  // Pazaryerleri oluştur
  console.log('📦 Creating marketplaces...');
  const trendyol = await prisma.marketplace.create({
    data: {
      name: 'Trendyol',
      apiKey: 'trendyol-api-key-demo',
      apiSecret: 'trendyol-api-secret-demo',
      isActive: true,
    },
  });

  const hepsiburada = await prisma.marketplace.create({
    data: {
      name: 'Hepsiburada',
      apiKey: 'hepsiburada-api-key-demo',
      apiSecret: 'hepsiburada-api-secret-demo',
      isActive: true,
    },
  });

  const amazon = await prisma.marketplace.create({
    data: {
      name: 'Amazon TR',
      apiKey: 'amazon-api-key-demo',
      apiSecret: 'amazon-api-secret-demo',
      isActive: true,
    },
  });

  console.log('✅ Marketplaces created');

  // Ürünler oluştur
  console.log('📦 Creating products...');
  const products = await Promise.all([
    prisma.product.create({
      data: {
        sku: 'LAPTOP-001',
        name: 'Dell XPS 13 Laptop',
        stockQuantity: 50,
        price: 25999.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'MOUSE-001',
        name: 'Logitech MX Master 3',
        stockQuantity: 100,
        price: 1299.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'KEYBOARD-001',
        name: 'Keychron K2 Mechanical Keyboard',
        stockQuantity: 75,
        price: 899.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'MONITOR-001',
        name: 'LG UltraWide 34" Monitor',
        stockQuantity: 30,
        price: 8999.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'HEADPHONE-001',
        name: 'Sony WH-1000XM5 Headphones',
        stockQuantity: 8,
        price: 4999.99,
      },
    }),
    prisma.product.create({
      data: {
        sku: 'WEBCAM-001',
        name: 'Logitech C920 HD Webcam',
        stockQuantity: 5,
        price: 799.99,
      },
    }),
  ]);

  console.log('✅ Products created');

  // Ürün eşleştirmeleri oluştur
  console.log('📦 Creating product mappings...');
  const mappings = [];

  // Laptop - Tüm pazaryerlerinde
  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[0].id,
        marketplaceId: trendyol.id,
        remoteSku: 'TY-LAPTOP-XPS13',
        remoteProductId: 'TY-987654321',
        syncStock: true,
      },
    })
  );

  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[0].id,
        marketplaceId: hepsiburada.id,
        remoteSku: 'HB-LAPTOP-XPS13',
        remoteProductId: 'HB-123456789',
        syncStock: true,
      },
    })
  );

  // Mouse - Trendyol ve Amazon
  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[1].id,
        marketplaceId: trendyol.id,
        remoteSku: 'TY-MOUSE-MX3',
        remoteProductId: 'TY-111222333',
        syncStock: true,
      },
    })
  );

  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[1].id,
        marketplaceId: amazon.id,
        remoteSku: 'AMZ-MOUSE-MX3',
        remoteProductId: 'B08XXXXXXX',
        syncStock: true,
      },
    })
  );

  // Keyboard - Hepsiburada
  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[2].id,
        marketplaceId: hepsiburada.id,
        remoteSku: 'HB-KEYBOARD-K2',
        remoteProductId: 'HB-444555666',
        syncStock: true,
      },
    })
  );

  // Monitor - Trendyol
  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[3].id,
        marketplaceId: trendyol.id,
        remoteSku: 'TY-MONITOR-LG34',
        remoteProductId: 'TY-777888999',
        syncStock: true,
      },
    })
  );

  // Headphones - Amazon
  mappings.push(
    await prisma.productMapping.create({
      data: {
        productId: products[4].id,
        marketplaceId: amazon.id,
        remoteSku: 'AMZ-HEADPHONE-SONY',
        remoteProductId: 'B09XXXXXXX',
        syncStock: true,
      },
    })
  );

  console.log('✅ Product mappings created');

  // Siparişler oluştur
  console.log('📦 Creating orders...');

  // Sipariş 1 - Trendyol (Laptop)
  const order1 = await prisma.order.create({
    data: {
      marketplaceOrderId: 'TY-ORDER-2025-001',
      marketplaceId: trendyol.id,
      totalAmount: 51999.98,
      status: 'DELIVERED',
      customerInfo: {
        name: 'Ahmet Yılmaz',
        email: 'ahmet@example.com',
        phone: '05001234567',
        address: 'İstanbul, Türkiye',
      },
      orderDate: new Date('2025-11-15'),
      items: {
        create: [
          {
            productMappingId: mappings[0].id,
            quantity: 2,
            price: 25999.99,
          },
        ],
      },
    },
  });

  // Sipariş 2 - Hepsiburada (Keyboard + Laptop)
  const order2 = await prisma.order.create({
    data: {
      marketplaceOrderId: 'HB-ORDER-2025-002',
      marketplaceId: hepsiburada.id,
      totalAmount: 26899.98,
      status: 'SHIPPED',
      customerInfo: {
        name: 'Ayşe Demir',
        email: 'ayse@example.com',
        phone: '05009876543',
        address: 'Ankara, Türkiye',
      },
      orderDate: new Date('2025-11-18'),
      items: {
        create: [
          {
            productMappingId: mappings[1].id,
            quantity: 1,
            price: 25999.99,
          },
          {
            productMappingId: mappings[4].id,
            quantity: 1,
            price: 899.99,
          },
        ],
      },
    },
  });

  // Sipariş 3 - Amazon (Mouse)
  const order3 = await prisma.order.create({
    data: {
      marketplaceOrderId: 'AMZ-ORDER-2025-003',
      marketplaceId: amazon.id,
      totalAmount: 2599.98,
      status: 'PROCESSING',
      customerInfo: {
        name: 'Mehmet Kaya',
        email: 'mehmet@example.com',
        phone: '05551234567',
        address: 'İzmir, Türkiye',
      },
      orderDate: new Date('2025-11-19'),
      items: {
        create: [
          {
            productMappingId: mappings[3].id,
            quantity: 2,
            price: 1299.99,
          },
        ],
      },
    },
  });

  // Sipariş 4 - Trendyol (Monitor + Mouse)
  const order4 = await prisma.order.create({
    data: {
      marketplaceOrderId: 'TY-ORDER-2025-004',
      marketplaceId: trendyol.id,
      totalAmount: 10299.98,
      status: 'PENDING',
      customerInfo: {
        name: 'Fatma Şahin',
        email: 'fatma@example.com',
        phone: '05321234567',
        address: 'Bursa, Türkiye',
      },
      orderDate: new Date('2025-11-20'),
      items: {
        create: [
          {
            productMappingId: mappings[5].id,
            quantity: 1,
            price: 8999.99,
          },
          {
            productMappingId: mappings[2].id,
            quantity: 1,
            price: 1299.99,
          },
        ],
      },
    },
  });

  console.log('✅ Orders created');

  // Stokları güncelle (siparişler için)
  await prisma.product.update({
    where: { id: products[0].id },
    data: { stockQuantity: { decrement: 4 } }, // 2 + 1 + 1 = 4 laptop satıldı
  });

  await prisma.product.update({
    where: { id: products[1].id },
    data: { stockQuantity: { decrement: 3 } }, // 2 + 1 = 3 mouse satıldı
  });

  await prisma.product.update({
    where: { id: products[2].id },
    data: { stockQuantity: { decrement: 1 } }, // 1 keyboard satıldı
  });

  await prisma.product.update({
    where: { id: products[3].id },
    data: { stockQuantity: { decrement: 1 } }, // 1 monitor satıldı
  });

  console.log('✅ Stock quantities updated');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - ${3} Marketplaces`);
  console.log(`   - ${products.length} Products`);
  console.log(`   - ${mappings.length} Product Mappings`);
  console.log(`   - ${4} Orders`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
