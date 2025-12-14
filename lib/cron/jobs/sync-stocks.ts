import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';

/**
 * Tüm aktif pazaryerlerine stok senkronizasyonu yap
 */
export async function syncAllStocks() {
  console.log('📦 Starting stock synchronization...');

  try {
    // Aktif pazaryerleri al
    const marketplaces = await prisma.marketplace.findMany({
      where: { isActive: true },
    });

    if (marketplaces.length === 0) {
      console.log('ℹ️  No active marketplaces found');
      return;
    }

    let totalSynced = 0;
    const results: Array<{ marketplace: string; synced: number; error?: string }> = [];

    for (const marketplace of marketplaces) {
      try {
        console.log(`🔄 Syncing stocks for ${marketplace.name}...`);

        // Eşleşmeleri al (syncStock: true olanlar)
        const mappings = await prisma.productMapping.findMany({
          where: {
            marketplaceId: marketplace.id,
            syncStock: true,
          },
          include: {
            product: true,
          },
        });

        if (mappings.length === 0) {
          console.log(`ℹ️  No products to sync for ${marketplace.name}`);
          results.push({
            marketplace: marketplace.name,
            synced: 0,
          });
          continue;
        }

        // Marketplace service oluştur
        const service = MarketplaceFactory.createService(marketplace.name, {
          apiKey: marketplace.apiKey || '',
          apiSecret: marketplace.apiSecret || '',
        });

        // Stok güncellemelerini hazırla
        const stockUpdates = mappings.map(mapping => ({
          sku: mapping.remoteSku,
          quantity: mapping.product.stockQuantity,
        }));

        // Stokları güncelle
        const result = await service.updateStock(stockUpdates);

        if (result.success) {
          totalSynced += mappings.length;
          results.push({
            marketplace: marketplace.name,
            synced: mappings.length,
          });
          console.log(`✅ ${marketplace.name}: ${mappings.length} products synced`);
        } else {
          results.push({
            marketplace: marketplace.name,
            synced: 0,
            error: result.error,
          });
          console.error(`❌ ${marketplace.name}: ${result.error}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          marketplace: marketplace.name,
          synced: 0,
          error: errorMessage,
        });
        console.error(`❌ Error syncing ${marketplace.name}:`, error);
      }
    }

    console.log(`✅ Stock sync completed: ${totalSynced} products synced across ${marketplaces.length} marketplaces`);
    return results;
  } catch (error) {
    console.error('❌ Stock sync failed:', error);
    throw error;
  }
}
