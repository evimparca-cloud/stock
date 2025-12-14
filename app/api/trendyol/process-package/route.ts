import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-check';

/**
 * Sipariş paketini işle:
 * 1. Local DB'ye kaydet
 * 2. Ürünleri eşleştir
 * 3. Stoktan düş
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, packageData } = body;

    if (!marketplaceId || !packageData) {
      return NextResponse.json(
        { success: false, error: 'Eksik parametreler' },
        { status: 400 }
      );
    }

    const pkg = packageData;

    // Pazaryeri bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { success: false, error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    // Sipariş zaten var mı kontrol et
    const existingOrder = await prisma.order.findUnique({
      where: { marketplaceOrderId: pkg.orderNumber },
    });

    if (existingOrder) {
      return NextResponse.json({
        success: false,
        message: 'Bu sipariş zaten işlendi',
        orderId: existingOrder.id,
      });
    }

    console.log('📦 Sipariş paketi işleniyor:', {
      orderNumber: pkg.orderNumber,
      itemCount: pkg.lines?.length || 0,
      totalPrice: pkg.totalPrice,
    });

    // Sipariş kalemlerini hazırla ve eşleştir
    const orderItems: Array<{
      productMappingId: string;
      quantity: number;
      price: number;
      sku: string;
      productName: string;
    }> = [];

    const errors: string[] = [];
    const stockUpdates: Array<{
      productId: string;
      quantity: number;
      productName: string;
    }> = [];

    for (const line of pkg.lines || []) {
      // merchantSku ile mapping bul
      const mapping = await prisma.productMapping.findFirst({
        where: {
          marketplaceId: marketplace.id,
          remoteSku: line.merchantSku || line.barcode,
        },
        include: {
          product: true,
        },
      });

      if (!mapping) {
        errors.push(`Eşleşme bulunamadı: ${line.merchantSku} - ${line.productName}`);
        continue;
      }

      orderItems.push({
        productMappingId: mapping.id,
        quantity: parseInt(line.quantity),
        price: parseFloat(line.amount),
        sku: line.merchantSku,
        productName: line.productName,
      });

      // Stok senkronizasyonu açık mı kontrol et
      if (mapping.syncStock) {
        stockUpdates.push({
          productId: mapping.productId,
          quantity: parseInt(line.quantity),
          productName: mapping.product.name,
        });
      }
    }

    if (orderItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Hiçbir ürün eşleştirilemedi',
        errors,
      });
    }

    // Transaction ile sipariş oluştur ve stok düş
    const result = await prisma.$transaction(async (tx) => {
      // Siparişi oluştur
      const order = await tx.order.create({
        data: {
          marketplaceOrderId: pkg.orderNumber,
          marketplaceId: marketplace.id,
          totalAmount: parseFloat(pkg.totalPrice || '0'),
          status: mapPackageStatus(pkg.packageHistories?.[0]?.status || 'Created'),
          customerInfo: {
            firstName: pkg.customerFirstName,
            lastName: pkg.customerLastName || '',
            email: pkg.customerEmail,
            phone: pkg.customerPhone || '',
            address: {
              city: pkg.city,
              district: pkg.district,
              fullAddress: pkg.address || '',
            },
          },
          orderDate: new Date(),
          items: {
            create: orderItems.map(item => ({
              productMappingId: item.productMappingId,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      // Stoktan düş
      for (const stockUpdate of stockUpdates) {
        const product = await tx.product.findUnique({
          where: { id: stockUpdate.productId },
        });

        if (product) {
          const newStock = Math.max(0, product.stockQuantity - stockUpdate.quantity);

          await tx.product.update({
            where: { id: stockUpdate.productId },
            data: { stockQuantity: newStock },
          });

          console.log(`📉 Stok düşüldü: ${stockUpdate.productName} - ${product.stockQuantity} → ${newStock} (${stockUpdate.quantity} adet)`);
        }
      }

      return { order, stockUpdates };
    });

    console.log('✅ Sipariş işlendi:', {
      orderId: result.order.id,
      orderNumber: result.order.marketplaceOrderId,
      itemsProcessed: orderItems.length,
      stocksUpdated: stockUpdates.length,
    });

    return NextResponse.json({
      success: true,
      message: `Sipariş başarıyla işlendi. ${stockUpdates.length} ürün stoktan düşüldü.`,
      order: {
        id: result.order.id,
        orderNumber: result.order.marketplaceOrderId,
        totalAmount: result.order.totalAmount,
        itemCount: orderItems.length,
      },
      stockUpdates: stockUpdates.map(su => ({
        productName: su.productName,
        quantity: su.quantity,
      })),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Process package error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}

function mapPackageStatus(status: string): OrderStatus {
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

  return statusMap[status] || OrderStatus.PENDING;
}
