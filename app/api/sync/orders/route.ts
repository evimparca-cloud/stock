import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { OrderStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-check';

// POST /api/sync/orders - Pazaryerinden siparişleri çek ve sisteme ekle
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, startDate, endDate } = body;

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    // Pazaryeri bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    if (!marketplace.isActive) {
      return NextResponse.json(
        { error: 'Pazaryeri aktif değil' },
        { status: 400 }
      );
    }

    // Marketplace service oluştur
    const service = MarketplaceFactory.createService(marketplace.name, {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    // Siparişleri çek
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const marketplaceOrders = await service.getOrders(start, end);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

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
          // Remote SKU ile mapping bul
          const mapping = await prisma.productMapping.findFirst({
            where: {
              marketplaceId: marketplace.id,
              remoteSku: item.sku,
            },
          });

          if (!mapping) {
            errors.push(`Eşleşme bulunamadı: ${item.sku} - ${item.productName}`);
            continue;
          }

          orderItems.push({
            productMappingId: mapping.id,
            quantity: item.quantity,
            price: item.price,
          });
        }

        if (orderItems.length === 0) {
          errors.push(`Sipariş ${mpOrder.orderNumber} için eşleşme bulunamadı`);
          continue;
        }

        // Siparişi oluştur
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              marketplaceOrderId: mpOrder.orderNumber,
              marketplaceId: marketplace.id,
              totalAmount: mpOrder.totalAmount,
              status: mapOrderStatus(mpOrder.status),
              customerInfo: mpOrder.customer,
              orderDate: mpOrder.orderDate,
              items: {
                create: orderItems,
              },
            },
          });

          // Stok düşür (syncStock true olan ürünler için)
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
        errors.push(`Sipariş ${mpOrder.orderNumber} eklenemedi: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${imported} sipariş içe aktarıldı, ${skipped} sipariş zaten mevcut`,
      imported,
      skipped,
      total: marketplaceOrders.length,
      marketplace: marketplace.name,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error syncing orders:', error);
    return NextResponse.json(
      {
        error: 'Sipariş senkronizasyonu başarısız',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }

  function mapOrderStatus(status: string): OrderStatus {
    // Pazaryeri durumlarını sistem durumlarına çevir
    const statusMap: Record<string, OrderStatus> = {
      'Created': OrderStatus.PENDING,
      'Approved': OrderStatus.PROCESSING,
      'Shipped': OrderStatus.SHIPPED,
      'Delivered': OrderStatus.DELIVERED,
      'Cancelled': OrderStatus.CANCELLED,
      'Returned': OrderStatus.REFUNDED,
    };

    return statusMap[status] || OrderStatus.PENDING;
  }
}
