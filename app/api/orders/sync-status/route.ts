import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { OrderStatus } from '@prisma/client';
import { sendTelegramNotification } from '@/lib/notification';

/**
 * DURUM SENKRONIZASYONU:
 * Local siparişleri Trendyol'dan çekip durumlarını güncelle
 */
export async function POST(request: NextRequest) {
  try {
    const { marketplaceId } = await request.json();

    if (!marketplaceId) {
      return NextResponse.json(
        { success: false, error: 'Marketplace ID gerekli' },
        { status: 400 }
      );
    }

    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace || marketplace.name !== 'Trendyol') {
      return NextResponse.json(
        { success: false, error: 'Geçerli Trendyol marketplace bulunamadı' },
        { status: 404 }
      );
    }

    const trendyolService = new TrendyolService({
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    console.log('📦 Sipariş durumları kontrol ediliyor...');

    // Local'deki tüm siparişleri al (sadece CANCELLED hariç)
    // NOT: DELIVERED dahil edilmeli ki SHIPPED -> DELIVERED geçişi yapılabilsin
    const localOrders = await prisma.order.findMany({
      where: {
        marketplaceId: marketplace.id,
        status: {
          notIn: [OrderStatus.CANCELLED],  // Sadece iptal edilmiş siparişler hariç
        },
      },
      select: {
        id: true,
        marketplaceOrderId: true,
        status: true,
      },
    });

    console.log(`📋 ${localOrders.length} aktif sipariş kontrol edilecek`);

    let updated = 0;
    let unchanged = 0;
    const updates: Array<{ orderNumber: string; oldStatus: string; newStatus: string }> = [];

    // Tüm Trendyol status'lerini kontrol et
    const statusesToCheck = [
      'Awaiting',         // Ödeme onayı bekleyen
      'Created',          // Gönderime hazır
      'Picking',          // Toplamada
      'Invoiced',         // Faturalandı
      'Shipped',          // Kargoya verildi
      'AtCollectionPoint',// PUDO noktasında
      'Delivered',        // Teslim edildi
      'UnDelivered',      // Teslim edilemedi
      'Cancelled',        // İptal edildi
      'UnPacked',         // Paket bölündü
      'Returned'          // İade edildi
    ];

    for (const statusToCheck of statusesToCheck) {
      try {
        const packagesResult = await trendyolService.getShipmentPackages({
          status: statusToCheck,
          page: 0,
          size: 100,
        });

        const packages = packagesResult.content || [];

        for (const pkg of packages) {
          // Local'de bu siparişi bul
          const localOrder = localOrders.find(o => o.marketplaceOrderId === pkg.orderNumber);

          if (!localOrder) continue;

          const newStatus = mapStatus(statusToCheck);

          // Durum değişmiş mi?
          if (localOrder.status !== newStatus) {
            // Eğer CANCELLED durumuna geçiyorsa ve önceden CANCELLED değilse, stokları geri ekle
            if (newStatus === OrderStatus.CANCELLED && localOrder.status !== OrderStatus.CANCELLED) {
              console.log(`🔙 Müşteri iptali tespit edildi: ${pkg.orderNumber}`);

              // Siparişi detaylarıyla birlikte al
              const fullOrder = await prisma.order.findUnique({
                where: { id: localOrder.id },
                include: {
                  items: {
                    include: {
                      productMapping: {
                        include: {
                          product: true
                        }
                      }
                    }
                  }
                }
              });

              if (fullOrder) {
                await prisma.$transaction(async (tx) => {
                  // Stokları geri ekle
                  for (const item of fullOrder.items) {
                    if (item.productMapping.syncStock) {
                      const product = item.productMapping.product;
                      const oldStock = product.stockQuantity;
                      const newStock = oldStock + item.quantity;

                      await tx.product.update({
                        where: { id: product.id },
                        data: { stockQuantity: newStock },
                      });

                      // StockLog kaydet
                      await tx.stockLog.create({
                        data: {
                          productId: product.id,
                          orderId: fullOrder.id,
                          type: 'CANCEL',
                          quantity: item.quantity,
                          oldStock,
                          newStock,
                          reason: 'Müşteri İptali (Trendyol Sync)',
                          reference: fullOrder.marketplaceOrderId,
                          createdBy: 'system',
                        },
                      });

                      console.log(`    📦 Stok geri eklendi: ${product.name} ${oldStock} → ${newStock} (+${item.quantity})`);
                    }
                  }

                  // Durumu güncelle
                  await tx.order.update({
                    where: { id: localOrder.id },
                    data: { status: newStatus },
                  });
                });
              }
            } else {
              // Normal durum güncellemesi
              await prisma.order.update({
                where: { id: localOrder.id },
                data: { status: newStatus },
              });
            }

            updated++;
            updates.push({
              orderNumber: pkg.orderNumber,
              oldStatus: localOrder.status,
              newStatus: newStatus,
            });

            console.log(`  ✅ Güncellendi: ${pkg.orderNumber} (${localOrder.status} → ${newStatus})`);

            // Telegram bildirimi gönder
            try {
              const statusEmojis: Record<string, string> = {
                PENDING: '🆕',
                PROCESSING: '⚙️',
                SHIPPED: '🚚',
                DELIVERED: '✅',
                CANCELLED: '❌',
                REFUNDED: '💰'
              };

              const statusLabels: Record<string, string> = {
                PENDING: 'Beklemede',
                PROCESSING: 'İşleniyor',
                SHIPPED: 'Kargoda',
                DELIVERED: 'Teslim Edildi',
                CANCELLED: 'İptal Edildi',
                REFUNDED: 'İade'
              };

              await sendTelegramNotification({
                type: 'ORDER_STATUS_CHANGE',
                title: '📦 Sipariş Durumu Değişti',
                message: `
🔄 **Sipariş Durumu Güncellendi**

📋 **Sipariş:** #${pkg.orderNumber}
🏪 **Pazaryeri:** ${marketplace.name}

**Durum Değişikliği:**
${statusEmojis[localOrder.status] || '📌'} ${statusLabels[localOrder.status] || localOrder.status}
    ⬇️
${statusEmojis[newStatus] || '📌'} ${statusLabels[newStatus] || newStatus}
                `.trim(),
                severity: 'low',
                timestamp: new Date(),
                metadata: {
                  orderNumber: pkg.orderNumber,
                  marketplace: marketplace.name,
                  oldStatus: localOrder.status,
                  newStatus: newStatus,
                }
              });
            } catch (notifError) {
              // Bildirim hatası senkronizasyonu engellemesin
              console.error('Telegram bildirimi gönderilemedi:', notifError);
            }
          } else {
            unchanged++;
          }
        }
      } catch (error) {
        console.error(`Hata (${statusToCheck}):`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ ${updated} sipariş güncellendi, ${unchanged} değişmedi`,
      updated,
      unchanged,
      total: localOrders.length,
      updates: updates.slice(0, 20), // İlk 20 güncelleme
    });
  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}

function mapStatus(packageStatus: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    'Awaiting': OrderStatus.PENDING,           // Ödeme bekliyor
    'Created': OrderStatus.PENDING,            // Gönderime hazır
    'Picking': OrderStatus.PROCESSING,         // Toplamada
    'Invoiced': OrderStatus.PROCESSING,        // Faturalandı
    'Shipped': OrderStatus.SHIPPED,            // Kargoda
    'AtCollectionPoint': OrderStatus.SHIPPED,  // PUDO noktasında (kargo gibi)
    'Delivered': OrderStatus.DELIVERED,        // Teslim edildi
    'UnDelivered': OrderStatus.PENDING,        // Teslim edilemedi (tekrar denenir)
    'Cancelled': OrderStatus.CANCELLED,        // İptal
    'UnPacked': OrderStatus.PROCESSING,        // Paket bölündü (işlemde)
    'Returned': OrderStatus.REFUNDED,          // İade edildi
  };
  return statusMap[packageStatus] || OrderStatus.PENDING;
}
