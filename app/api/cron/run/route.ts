import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { telegramNotifications } from '@/lib/telegram-notifications';
import { requireAdmin } from '@/lib/auth-helper';

// Helper: Marketplace service oluştur
async function createMarketplaceService(marketplaceId: string) {
  const marketplace = await prisma.marketplace.findUnique({
    where: { id: marketplaceId },
  });

  if (!marketplace) {
    throw new Error('Pazaryeri bulunamadı');
  }

  if (!marketplace.isActive) {
    throw new Error('Pazaryeri aktif değil');
  }

  return {
    marketplace,
    service: MarketplaceFactory.createService(marketplace.name, {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    }),
  };
}

// POST /api/cron/run - Manuel olarak bir cron job çalıştır
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { jobId } = body;

    console.log('🔄 Running cron job manually:', jobId);

    // Aktif pazaryerlerini al
    const marketplaces = await prisma.marketplace.findMany({
      where: { isActive: true },
    });

    if (marketplaces.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Aktif pazaryeri bulunamadı',
      });
    }

    let results: any[] = [];

    // Job'a göre işlem yap
    switch (jobId) {
      case 'sync-stock':
        console.log('📦 Stok senkronizasyonu başlatılıyor...');

        // Her pazaryeri için stok senkronizasyonu
        for (const marketplace of marketplaces) {
          try {
            console.log(`📦 Stok senkronizasyonu: ${marketplace.name}`);
            const { service } = await createMarketplaceService(marketplace.id);

            // Eşleşmeleri al
            const mappings = await prisma.productMapping.findMany({
              where: {
                marketplaceId: marketplace.id,
                syncStock: true,
              },
              include: { product: true },
            });

            console.log(`📋 ${mappings.length} eşleştirme bulundu (syncStock: true)`);

            if (mappings.length === 0) {
              results.push({
                marketplace: marketplace.name,
                success: true,
                message: 'Senkronize edilecek ürün bulunamadı',
                synced: 0,
              });
              continue;
            }

            // Stok güncellemelerini hazırla
            const stockUpdates = mappings.map(m => ({
              sku: m.remoteSku,
              quantity: m.product.stockQuantity,
            }));

            console.log(`📦 Stok güncelleme verisi:`, stockUpdates);

            // Stokları güncelle
            const result = await service.updateStock(stockUpdates);
            console.log(`✅ Stok güncelleme sonucu:`, result);

            results.push({
              marketplace: marketplace.name,
              ...result,
              synced: result.success ? mappings.length : 0,
            });
          } catch (error) {
            console.error(`❌ Stok senkronizasyon hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'sync-price':
        // Her pazaryeri için fiyat senkronizasyonu
        for (const marketplace of marketplaces) {
          try {
            const { service } = await createMarketplaceService(marketplace.id);

            const mappings = await prisma.productMapping.findMany({
              where: { marketplaceId: marketplace.id },
              include: { product: true },
            });

            if (mappings.length === 0) {
              results.push({
                marketplace: marketplace.name,
                success: true,
                message: 'Senkronize edilecek ürün bulunamadı',
                synced: 0,
              });
              continue;
            }

            const priceUpdates = mappings.map(m => ({
              sku: m.remoteSku,
              price: parseFloat(m.product.price.toString()),
            }));

            const result = await service.updatePrice(priceUpdates);
            results.push({
              marketplace: marketplace.name,
              ...result,
              synced: result.success ? mappings.length : 0,
            });
          } catch (error) {
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'sync-location':
        // Her pazaryeri için lokasyon senkronizasyonu
        for (const marketplace of marketplaces) {
          try {
            console.log(`📍 Lokasyon senkronizasyonu başlatılıyor: ${marketplace.name}`);

            const { service } = await createMarketplaceService(marketplace.id);

            const mappings = await prisma.productMapping.findMany({
              where: { marketplaceId: marketplace.id },
              include: { product: true },
            });

            console.log(`📋 ${mappings.length} eşleştirme bulundu`);

            if (mappings.length === 0) {
              results.push({
                marketplace: marketplace.name,
                success: true,
                message: 'Senkronize edilecek ürün bulunamadı',
                synced: 0,
              });
              continue;
            }

            const locationUpdates = mappings
              .filter(m => m.product.location && m.product.location.trim() !== '')
              .map(m => ({
                sku: m.remoteSku,
                location: m.product.location || '',
                productName: m.product.name,
              }));

            console.log(`📍 ${locationUpdates.length} ürünün lokasyon bilgisi var`);

            if (locationUpdates.length === 0) {
              const emptyLocationCount = mappings.filter(m => !m.product.location || m.product.location.trim() === '').length;
              results.push({
                marketplace: marketplace.name,
                success: true,
                message: `ℹ️ Lokasyon bilgisi olan ürün bulunamadı (${mappings.length} eşleştirme var, ${emptyLocationCount} tanesinde lokasyon boş)`,
                synced: 0,
                total: mappings.length,
              });
              continue;
            }

            // Debug: Her bir lokasyon bilgisini logla
            locationUpdates.forEach(update => {
              console.log(`📦 ${update.productName}: "${update.location}"`);
            });

            // Gerçek lokasyon güncellemesi
            const locationUpdateRequests = locationUpdates.map(update => ({
              sku: update.sku,
              location: update.location,
            }));

            const result = await service.updateLocation?.(locationUpdateRequests);

            if (result) {
              console.log(`✅ Lokasyon güncelleme sonucu:`, result);
              results.push({
                marketplace: marketplace.name,
                ...result,
                synced: result.success ? locationUpdates.length : 0,
                total: locationUpdates.length,
              });
            } else {
              console.log(`⚠️ Service lokasyon güncellemeyi desteklemiyor`);
              results.push({
                marketplace: marketplace.name,
                success: false,
                message: 'Lokasyon güncelleme bu pazaryeri için desteklenmiyor',
                synced: 0,
                total: locationUpdates.length,
              });
            }
          } catch (error) {
            console.error(`❌ Lokasyon senkronizasyon hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'process-orders':
        console.log(`📦 Sipariş çekme & işleme & stok düşürme job'u başlatılıyor: ${jobId}`);

        // sync-simple endpoint'ini kullan (kod tekrarını önle)
        for (const marketplace of marketplaces) {
          try {
            console.log(`📦 Sipariş işleme başlatılıyor: ${marketplace.name}`);

            // sync-simple API'sini çağır (internal API call yerine direct import)
            const { POST } = await import('@/app/api/orders/sync-simple/route');

            const mockRequest = {
              json: async () => ({
                marketplaceId: marketplace.id,
                status: 'Created'
              })
            } as any;

            const response = await POST(mockRequest);
            const result = await response.json();

            console.log(`✅ Sync-simple sonucu:`, result);

            results.push({
              marketplace: marketplace.name,
              success: result.success,
              message: result.message,
              processed: result.processed,
              skipped: result.skipped,
              failed: result.failed,
              total: result.total,
            });
          } catch (error) {
            console.error(`❌ Sipariş işleme hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'process-cancelled-orders':
        // Her pazaryeri için iptal siparişleri çek ve işle
        for (const marketplace of marketplaces) {
          try {
            console.log(`↩️ İptal siparişleri çekiliyor: ${marketplace.name}`);

            const { service } = await createMarketplaceService(marketplace.id);

            // Trendyol'dan iptal siparişleri çek
            const cancelledOrdersFromAPI = await service.getOrders();
            const cancelledOrders = cancelledOrdersFromAPI.filter(order =>
              order.status === 'CANCELLED' || order.status === 'Cancelled'
            );

            console.log(`📊 API'den ${cancelledOrders.length} iptal siparişi bulundu`);

            let processedCount = 0;
            let newCancellations = 0;

            for (const cancelledOrder of cancelledOrders) {
              try {
                // Veritabanında bu sipariş var mı kontrol et
                const existingOrder = await prisma.order.findFirst({
                  where: {
                    marketplaceOrderId: cancelledOrder.orderId,
                    marketplaceId: marketplace.id,
                  }
                });

                if (existingOrder) {
                  // Eğer durum değişmişse güncelle ve bildirim gönder
                  if (existingOrder.status !== 'CANCELLED') {
                    const oldStatus = existingOrder.status;

                    // 🔄 STOK GERİ EKLEME İŞLEMİ
                    console.log(`🔄 Stok geri ekleme başlatılıyor: ${cancelledOrder.orderId}`);

                    // Sipariş kalemlerini bul ve stokları geri ekle
                    const orderItems = await prisma.orderItem.findMany({
                      where: { orderId: existingOrder.id },
                      include: {
                        productMapping: {
                          include: {
                            product: true
                          }
                        }
                      }
                    });

                    let restoredStockCount = 0;

                    for (const item of orderItems) {
                      if (item.productMapping?.product) {
                        const product = item.productMapping.product;
                        const quantity = item.quantity;
                        const oldStock = product.stockQuantity;
                        const newStock = oldStock + quantity;

                        // Ürün stokunu artır
                        await prisma.product.update({
                          where: { id: product.id },
                          data: { stockQuantity: newStock }
                        });

                        // StockLog kaydı oluştur
                        await prisma.stockLog.create({
                          data: {
                            productId: product.id,
                            orderId: existingOrder.id,
                            type: 'RETURN',
                            quantity: quantity,
                            oldStock: oldStock,
                            newStock: newStock,
                            reason: `İptal edilen sipariş stok iadesi: ${cancelledOrder.orderId}`,
                          }
                        });

                        console.log(`  ↗️ ${product.name}: ${oldStock} → ${newStock} (+${quantity})`);
                        restoredStockCount++;
                      }
                    }

                    await prisma.order.update({
                      where: { id: existingOrder.id },
                      data: {
                        status: 'CANCELLED',
                        updatedAt: new Date(),
                      },
                    });

                    console.log(`📝 Sipariş iptal edildi: ${cancelledOrder.orderId} (${oldStatus} -> CANCELLED)`);
                    console.log(`📦 ${restoredStockCount} ürünün stoğu geri eklendi`);

                    // Telegram bildirimi gönder
                    try {
                      await telegramNotifications.notifyOrderStatusChange(
                        cancelledOrder.orderId,
                        marketplace.name,
                        oldStatus,
                        'CANCELLED',
                        `${existingOrder.customerFirstName || ''} ${existingOrder.customerLastName || ''}`.trim() || 'Müşteri'
                      );
                      console.log(`📱 İptal bildirimi gönderildi: ${cancelledOrder.orderId}`);
                    } catch (telegramError) {
                      console.error('📱 Telegram bildirim hatası:', telegramError);
                    }

                    newCancellations++;
                  }
                  processedCount++;
                } else {
                  // Yeni iptal siparişi - direkt CANCELLED olarak kaydet
                  await prisma.order.create({
                    data: {
                      marketplaceOrderId: cancelledOrder.orderId,
                      marketplaceId: marketplace.id,
                      status: 'CANCELLED',
                      totalAmount: cancelledOrder.totalAmount || 0,
                      customerFirstName: cancelledOrder.customer?.name?.split(' ')[0] || 'Müşteri',
                      customerLastName: cancelledOrder.customer?.name?.split(' ').slice(1).join(' ') || '',
                      orderDate: cancelledOrder.orderDate || new Date(),
                    }
                  });

                  console.log(`📝 Yeni iptal siparişi kaydedildi: ${cancelledOrder.orderId}`);

                  // Yeni iptal bildirimi gönder
                  try {
                    await telegramNotifications.notifyOrderCancellation({
                      orderNumber: cancelledOrder.orderId,
                      marketplace: marketplace.name,
                      totalAmount: cancelledOrder.totalAmount || 0,
                      customerName: cancelledOrder.customer?.name || 'Müşteri',
                      orderDate: cancelledOrder.orderDate || new Date(),
                    });
                    console.log(`📱 Yeni iptal bildirimi gönderildi: ${cancelledOrder.orderId}`);
                  } catch (telegramError) {
                    console.error('📱 Telegram bildirim hatası:', telegramError);
                  }

                  processedCount++;
                  newCancellations++;
                }
              } catch (orderError) {
                console.error(`❌ Sipariş işleme hatası ${cancelledOrder.orderId}:`, orderError);
              }
            }

            results.push({
              marketplace: marketplace.name,
              success: true,
              message: `✅ ${processedCount} iptal siparişi işlendi, ${newCancellations} yeni iptal`,
              processed: processedCount,
              newCancellations: newCancellations,
            });
          } catch (error) {
            console.error(`❌ İptal sipariş hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'sync-order-status':
        // Her pazaryeri için sipariş durumu güncelleme
        for (const marketplace of marketplaces) {
          try {
            console.log(`🔄 Sipariş durumları güncelleniyor: ${marketplace.name}`);

            const { service } = await createMarketplaceService(marketplace.id);

            // Bekleyen siparişleri bul
            const pendingOrders = await prisma.order.findMany({
              where: {
                marketplaceId: marketplace.id,
                status: { in: ['PENDING', 'PROCESSING'] as any },
              },
              take: 50, // Daha az sipariş işle
            });

            console.log(`📊 ${pendingOrders.length} bekleyen sipariş bulundu`);

            let updatedCount = 0;

            // Her sipariş için durum kontrol et
            for (const order of pendingOrders) {
              try {
                console.log(`🔍 Kontrol ediliyor: ${order.marketplaceOrderId} (mevcut: ${order.status})`);
                const orderDetails = await service.getOrder(order.marketplaceOrderId);

                if (orderDetails) {
                  console.log(`📥 API yanıtı: ${order.marketplaceOrderId} -> "${orderDetails.status}" (type: ${typeof orderDetails.status})`);
                  console.log(`📋 DB durumu: "${order.status}" (type: ${typeof order.status})`);
                  console.log(`🔍 Eşit mi? ${orderDetails.status === order.status}`);

                  if (orderDetails.status !== order.status) {
                    // Status'u enum'a çevir
                    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
                    const newStatus = validStatuses.includes(orderDetails.status) ? orderDetails.status : 'PROCESSING';

                    console.log(`🔄 Güncelleniyor: ${order.marketplaceOrderId} ${order.status} -> ${newStatus}`);

                    // Eğer CANCELLED durumuna geçiyorsa ve önceden CANCELLED değilse, stokları geri ekle
                    if (newStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
                      console.log(`🔙 Müşteri iptali tespit edildi (cron): ${order.marketplaceOrderId}`);

                      // Siparişi detaylarıyla birlikte al
                      const fullOrder = await prisma.order.findUnique({
                        where: { id: order.id },
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

                      if (fullOrder && fullOrder.items.length > 0) {
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
                                  reason: 'Müşteri İptali (Cron Job)',
                                  reference: fullOrder.marketplaceOrderId,
                                  createdBy: 'system',
                                },
                              });

                              console.log(`    📦 Stok geri eklendi: ${product.name} ${oldStock} → ${newStock} (+${item.quantity})`);
                            }
                          }

                          // Durumu güncelle
                          await tx.order.update({
                            where: { id: order.id },
                            data: {
                              status: newStatus as any,
                              updatedAt: new Date(),
                            },
                          });
                        });
                      } else {
                        // Items yoksa sadece durumu güncelle
                        await prisma.order.update({
                          where: { id: order.id },
                          data: {
                            status: newStatus as any,
                            updatedAt: new Date(),
                          },
                        });
                      }
                    } else {
                      // Normal durum güncellemesi
                      await prisma.order.update({
                        where: { id: order.id },
                        data: {
                          status: newStatus as any,
                          updatedAt: new Date(),
                        },
                      });
                    }

                    updatedCount++;
                    console.log(`✅ Güncellendi: ${order.marketplaceOrderId} -> ${newStatus}`);

                    // Telegram bildirimi gönder
                    try {
                      await telegramNotifications.notifyOrderStatusChange(
                        order.marketplaceOrderId,
                        marketplace.name,
                        order.status,
                        newStatus,
                        'Müşteri'
                      );
                    } catch (telegramError) {
                      console.error('Telegram bildirim hatası:', telegramError);
                    }
                  } else {
                    console.log(`⚪ Değişiklik yok: ${order.marketplaceOrderId} (${order.status})`);
                  }
                } else {
                  console.log(`❌ API yanıt vermedi: ${order.marketplaceOrderId}`);
                }
              } catch (orderError) {
                console.error(`❌ Sipariş detay hatası ${order.marketplaceOrderId}:`, orderError);
              }
            }

            results.push({
              marketplace: marketplace.name,
              success: true,
              message: `✅ ${pendingOrders.length} sipariş kontrol edildi, ${updatedCount} güncellendi`,
              checked: pendingOrders.length,
              updated: updatedCount,
            });
          } catch (error) {
            console.error(`❌ Sipariş durum hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'process-returns':
        // Her pazaryeri için iade paketlerini işle
        for (const marketplace of marketplaces) {
          try {
            console.log(`📦 İade paketleri işleniyor: ${marketplace.name}`);

            const { service } = await createMarketplaceService(marketplace.id);

            // Trendyol'dan tüm iade paketlerini çek (ilk seferde tümü)
            const claimsData = await (service as any).getClaims({
              page: 0,
              size: 50
            });

            const claims = claimsData.content || [];
            console.log(`📊 ${claims.length} yeni iade paketi bulundu`);

            let processedCount = 0;
            let newReturns = 0;

            for (const claim of claims) {
              try {
                // ✅ Trendyol API: id → claimId (geriye uyumlu)
                const currentClaimId = claim.claimId || claim.id;

                // Veritabanında bu iade var mı kontrol et
                const existingReturn = await prisma.returnPackage.findFirst({
                  where: {
                    claimId: currentClaimId,
                    marketplaceId: marketplace.id,
                  }
                });

                if (!existingReturn) {
                  // Yeni iade paketi - kaydet
                  const returnPackage = await prisma.returnPackage.create({
                    data: {
                      claimId: currentClaimId,
                      marketplaceId: marketplace.id,
                      orderNumber: claim.orderNumber,
                      orderDate: claim.orderDate ? new Date(claim.orderDate) : null,
                      claimDate: new Date(claim.claimDate),
                      lastModifiedDate: claim.lastModifiedDate ? new Date(claim.lastModifiedDate) : null,
                      customerFirstName: claim.customerFirstName,
                      customerLastName: claim.customerLastName,
                      cargoTrackingNumber: claim.cargoTrackingNumber,
                      cargoTrackingLink: claim.cargoTrackingLink,
                      cargoSenderNumber: claim.cargoSenderNumber,
                      cargoProviderName: claim.cargoProviderName,
                      orderShipmentPackageId: claim.orderShipmentPackageId?.toString(),
                      orderOutboundPackageId: claim.orderOutboundPackageId?.toString(),
                      status: 'CREATED',
                      rejectedPackageInfo: claim.rejectedpackageinfo || null,
                      replacementPackageInfo: claim.replacementOutboundpackageinfo || null,
                    }
                  });

                  // İade kalemlerini kaydet
                  for (const item of claim.items || []) {
                    for (const claimItem of item.claimItems || []) {
                      await prisma.returnPackageItem.create({
                        data: {
                          returnPackageId: returnPackage.id,
                          claimItemId: claimItem.id,
                          orderLineItemId: claimItem.orderLineItemId?.toString(),
                          productName: item.orderLine?.productName || 'Bilinmeyen Ürün',
                          // ✅ merchantSku → stockCode, vatBaseAmount → vatRate
                          barcode: item.orderLine?.barcode,
                          merchantSku: item.orderLine?.stockCode || item.orderLine?.merchantSku,
                          productColor: item.orderLine?.productColor,
                          productSize: item.orderLine?.productSize,
                          price: item.orderLine?.lineUnitPrice || item.orderLine?.price,
                          vatBaseAmount: item.orderLine?.vatRate || item.orderLine?.vatBaseAmount,
                          salesCampaignId: item.orderLine?.salesCampaignId?.toString(),
                          productCategory: item.orderLine?.productCategory,
                          customerClaimReason: claimItem.customerClaimItemReason || null,
                          trendyolClaimReason: claimItem.trendyolClaimItemReason || null,
                          status: 'CREATED',
                          customerNote: claimItem.customerNote,
                          note: claimItem.note,
                          resolved: claimItem.resolved || false,
                          autoAccepted: claimItem.autoAccepted || false,
                          acceptedBySeller: claimItem.acceptedBySeller || false,
                        }
                      });
                    }
                  }

                  console.log(`📝 Yeni iade paketi kaydedildi: ${currentClaimId} (Sipariş: ${claim.orderNumber})`);

                  // Telegram bildirimi gönder
                  try {
                    const items = (claim.items || []).flatMap((item: any) =>
                      (item.claimItems || []).map((claimItem: any) => ({
                        productName: item.orderLine?.productName || 'Bilinmeyen Ürün',
                        reason: claimItem.customerClaimItemReason?.name || 'Belirtilmemiş',
                        quantity: 1
                      }))
                    );

                    await telegramNotifications.notifyReturnPackage({
                      claimId: currentClaimId,
                      orderNumber: claim.orderNumber,
                      marketplace: marketplace.name,
                      customerName: `${claim.customerFirstName || ''} ${claim.customerLastName || ''}`.trim() || 'Müşteri',
                      claimDate: new Date(claim.claimDate),
                      status: 'CREATED',
                      items: items,
                      cargoTrackingNumber: claim.cargoTrackingNumber,
                    });
                    console.log(`📱 İade bildirimi gönderildi: ${claim.id}`);
                  } catch (telegramError) {
                    console.error('📱 Telegram bildirim hatası:', telegramError);
                  }

                  newReturns++;
                }
                processedCount++;
              } catch (claimError) {
                console.error(`❌ İade işleme hatası ${claim.claimId || claim.id}:`, claimError);
              }
            }

            results.push({
              marketplace: marketplace.name,
              success: true,
              message: `✅ ${processedCount} iade paketi işlendi, ${newReturns} yeni iade`,
              processed: processedCount,
              newReturns: newReturns,
            });
          } catch (error) {
            console.error(`❌ İade işleme hatası (${marketplace.name}):`, error);
            results.push({
              marketplace: marketplace.name,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
            });
          }
        }
        break;

      case 'daily-backup':
        try {
          console.log('💾 Running daily database backup...');

          // Internal API call for backup
          const { POST: backupPost } = await import('@/app/api/admin/backup/route');

          const mockBackupRequest = {
            json: async () => ({
              encrypt: !!process.env.BACKUP_ENCRYPTION_KEY,
              uploadToCloud: process.env.GOOGLE_ACCESS_TOKEN ? 'google-drive' : 'none',
            })
          } as any;

          const backupResponse = await backupPost(mockBackupRequest);
          const backupResult = await backupResponse.json();

          if (backupResult.success) {
            console.log(`✅ Daily backup created: ${backupResult.backup?.name}`);
            results.push({
              success: true,
              message: `Günlük yedek oluşturuldu: ${backupResult.backup?.name} (${backupResult.backup?.size})`,
              data: backupResult.backup,
            });
          } else {
            console.error('❌ Daily backup failed:', backupResult.error);
            results.push({
              success: false,
              error: backupResult.error || 'Yedekleme başarısız',
            });
          }
        } catch (error) {
          console.error('Daily backup error:', error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Yedekleme hatası',
          });
        }
        break;

      case 'cleanup-google-drive':
        try {
          console.log('🗑️ Running Google Drive cleanup...');

          const cleanupResponse = await fetch('http://localhost:3001/api/admin/backup/google-cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (cleanupResponse.ok) {
            const cleanupData = await cleanupResponse.json();
            results.push({
              success: true,
              message: `Google Drive cleanup: ${cleanupData.stats.deletedCount} files deleted`,
              data: cleanupData.stats,
            });
          } else {
            results.push({
              success: false,
              error: 'Google Drive cleanup failed',
            });
          }
        } catch (error) {
          console.error('Google Drive cleanup error:', error);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Cleanup failed',
          });
        }
        break;

      default:
        return NextResponse.json({
          success: false,
          error: 'Geçersiz job ID',
        });
    }

    // Sonuçları özetle
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount} başarılı, ${failCount} başarısız (${marketplaces.length} pazaryeri)`,
      results,
    });
  } catch (error: any) {
    console.error('❌ Cron job execution error:', error);

    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
