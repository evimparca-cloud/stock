import { prisma } from '@/lib/prisma';

/**
 * Düşük stoklu ürünleri kontrol et ve logla
 */
export async function checkLowStock() {
  console.log('⚠️  Checking for low stock products...');

  try {
    const lowStockThreshold = 10; // 10'dan az stok düşük sayılır

    // Düşük stoklu ürünleri bul
    const lowStockProducts = await prisma.product.findMany({
      where: {
        stockQuantity: {
          lt: lowStockThreshold,
        },
      },
      include: {
        mappings: {
          include: {
            marketplace: true,
          },
        },
      },
      orderBy: {
        stockQuantity: 'asc',
      },
    });

    if (lowStockProducts.length === 0) {
      console.log('✅ All products have sufficient stock');
      return {
        lowStockCount: 0,
        products: [],
      };
    }

    console.log(`⚠️  Found ${lowStockProducts.length} products with low stock:`);

    const report = lowStockProducts.map(product => {
      const marketplaces = product.mappings.map(m => m.marketplace.name).join(', ');
      
      console.log(`  - ${product.name} (${product.sku}): ${product.stockQuantity} units`);
      if (marketplaces) {
        console.log(`    Marketplaces: ${marketplaces}`);
      }

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        stockQuantity: product.stockQuantity,
        marketplaces: product.mappings.map(m => m.marketplace.name),
      };
    });

    // TODO: Burada email/SMS bildirimi gönderilebilir
    // await sendLowStockAlert(report);

    return {
      lowStockCount: lowStockProducts.length,
      products: report,
    };
  } catch (error) {
    console.error('❌ Low stock check failed:', error);
    throw error;
  }
}
