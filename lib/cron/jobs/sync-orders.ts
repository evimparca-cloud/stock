import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';

/**
 * Tüm aktif pazaryerlerinden siparişleri çek
 */
export async function syncAllOrders() {
  console.log('🛒 Starting order synchronization...');

  try {
    // Aktif pazaryerleri al
    const marketplaces = await prisma.marketplace.findMany({
      where: { isActive: true },
    });

    if (marketplaces.length === 0) {
      console.log('ℹ️  No active marketplaces found');
      return;
    }

    let totalImported = 0;
    let totalSkipped = 0;
    const results: Array<{ 
      marketplace: string; 
      imported: number; 
      skipped: number; 
      error?: string 
    }> = [];

    // Son 24 saat için siparişleri çek
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = new Date();

    for (const marketplace of marketplaces) {
      try {
        console.log(`🔄 Fetching orders from ${marketplace.name}...`);

        // Marketplace service oluştur
        const service = MarketplaceFactory.createService(marketplace.name, {
          apiKey: marketplace.apiKey || '',
          apiSecret: marketplace.apiSecret || '',
        });

        // Siparişleri çek
        const marketplaceOrders = await service.getOrders(startDate, endDate);

        if (marketplaceOrders.length === 0) {
          console.log(`ℹ️  No new orders from ${marketplace.name}`);
          results.push({
            marketplace: marketplace.name,
            imported: 0,
            skipped: 0,
          });
          continue;
        }

        let imported = 0;
        let skipped = 0;

        // Her siparişi işle
        for (const mpOrder of marketplaceOrders) {
          try {
            // Sipariş zaten var mı kontrol et
            const existingOrder = await prisma.order.findUnique({
              where: { marketplaceOrderId: mpOrder.orderNumber },
            });

            if (existingOrder) {
              skipped++;
              continue;
            }

            // Sipariş kalemlerini eşleştir
            const orderItems: Array<{
              productMappingId: string;
              quantity: number;
              price: number;
            }> = [];

            for (const item of mpOrder.items) {
              const mapping = await prisma.productMapping.findFirst({
                where: {
                  marketplaceId: marketplace.id,
                  remoteSku: item.sku,
                },
              });

              if (!mapping) {
                console.warn(`⚠️  Mapping not found for SKU: ${item.sku}`);
                continue;
              }

              orderItems.push({
                productMappingId: mapping.id,
                quantity: item.quantity,
                price: item.price,
              });
            }

            if (orderItems.length === 0) {
              console.warn(`⚠️  No valid items for order ${mpOrder.orderNumber}`);
              continue;
            }

            // Siparişi oluştur
            await prisma.$transaction(async (tx) => {
              await tx.order.create({
                data: {
                  marketplaceOrderId: mpOrder.orderNumber,
                  marketplaceId: marketplace.id,
                  totalAmount: mpOrder.totalAmount,
                  status: 'PENDING',
                  customerInfo: mpOrder.customer,
                  orderDate: mpOrder.orderDate,
                  items: {
                    create: orderItems,
                  },
                },
              });

              // Stok düşür
              for (const item of orderItems) {
                const mapping = await tx.productMapping.findUnique({
                  where: { id: item.productMappingId },
                });

                if (mapping?.syncStock) {
                  await tx.product.update({
                    where: { id: mapping.productId },
                    data: {
                      stockQuantity: {
                        decrement: item.quantity,
                      },
                    },
                  });
                }
              }
            });

            imported++;
          } catch (error) {
            console.error(`❌ Error processing order ${mpOrder.orderNumber}:`, error);
          }
        }

        totalImported += imported;
        totalSkipped += skipped;

        results.push({
          marketplace: marketplace.name,
          imported,
          skipped,
        });

        console.log(`✅ ${marketplace.name}: ${imported} imported, ${skipped} skipped`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          marketplace: marketplace.name,
          imported: 0,
          skipped: 0,
          error: errorMessage,
        });
        console.error(`❌ Error syncing orders from ${marketplace.name}:`, error);
      }
    }

    console.log(`✅ Order sync completed: ${totalImported} imported, ${totalSkipped} skipped`);
    return results;
  } catch (error) {
    console.error('❌ Order sync failed:', error);
    throw error;
  }
}
