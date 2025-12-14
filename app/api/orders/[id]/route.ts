import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-check';

// GET /api/orders/[id] - Tek bir siparişi getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        marketplace: true,
        items: {
          include: {
            productMapping: {
              include: {
                product: true,
                marketplace: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[id] - Sipariş durumunu güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Önce mevcut siparişi al
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            productMapping: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    let restoredProducts: any[] = [];

    // Eğer CANCELLED durumuna geçiyorsa ve önceden CANCELLED değilse, stokları geri ekle
    if (status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
      console.log(`🔙 Sipariş iptal ediliyor: ${existingOrder.marketplaceOrderId}`);
      console.log(`   Stoklar geri eklenecek...`);

      await prisma.$transaction(async (tx) => {
        // Her item için stok geri ekle
        for (const item of existingOrder.items) {
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
                orderId: existingOrder.id,
                type: 'CANCEL',
                quantity: item.quantity,
                oldStock,
                newStock,
                reason: 'Sipariş İptal Edildi (Durum Değişikliği)',
                reference: existingOrder.marketplaceOrderId,
                createdBy: 'system',
              },
            });

            restoredProducts.push({
              name: product.name,
              sku: product.sku,
              quantity: item.quantity,
              oldStock,
              newStock,
            });

            console.log(`  ✅ Stok geri eklendi: ${product.name} ${oldStock} → ${newStock} (+${item.quantity})`);
          }
        }
      });
    }

    // Durumu güncelle
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { status },
      include: {
        marketplace: true,
        items: {
          include: {
            productMapping: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    console.log(`✅ Sipariş durumu güncellendi: ${order.marketplaceOrderId} → ${status}`);
    if (restoredProducts.length > 0) {
      console.log(`   📦 ${restoredProducts.length} ürün stoğa geri eklendi`);
    }

    return NextResponse.json({
      ...order,
      restoredProducts: restoredProducts.length > 0 ? restoredProducts : undefined,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Alias for PUT (client sends PATCH)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return PUT(request, { params });
}

// DELETE /api/orders/[id] - Siparişi tamamen sil ve stokları geri yükle
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let restoredProducts: any[] = [];

    // Siparişi iptal et ve stokları geri yükle
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: {
          items: {
            include: {
              productMapping: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // ÖNEMLİ: Sadece CANCELLED olmayan siparişlerde stok geri ekle
      // CANCELLED siparişlerde zaten stok geri eklenmiştir
      if (order.status !== 'CANCELLED') {
        console.log(`🗑️ Sipariş siliniyor: ${order.marketplaceOrderId} (Durum: ${order.status})`);
        console.log(`   Stoklar geri eklenecek...`);

        // Stokları geri yükle ve log kaydet
        for (const item of order.items) {
          if (item.productMapping.syncStock) {
            const product = item.productMapping.product;
            const oldStock = product.stockQuantity;
            const newStock = oldStock + item.quantity;

            await tx.product.update({
              where: { id: item.productMapping.productId },
              data: { stockQuantity: newStock },
            });

            // Stok log'u kaydet
            await tx.stockLog.create({
              data: {
                productId: product.id,
                orderId: order.id,
                type: 'CANCEL',
                quantity: item.quantity,
                oldStock,
                newStock,
                reason: 'Sipariş Silindi (Manuel)',
                reference: order.marketplaceOrderId,
                createdBy: 'user',
              },
            });

            restoredProducts.push({
              name: product.name,
              sku: product.sku,
              quantity: item.quantity,
              oldStock,
              newStock,
            });

            console.log(`  ✅ Stok geri eklendi: ${product.name} ${oldStock} → ${newStock} (+${item.quantity})`);
          }
        }
      } else {
        console.log(`🗑️ Sipariş siliniyor: ${order.marketplaceOrderId} (Durum: CANCELLED)`);
        console.log(`   ℹ️  Stok zaten geri eklenmiş, tekrar eklenmeyecek`);
      }

      // Siparişi sil (cascade ile items de silinir)
      await tx.order.delete({
        where: { id: params.id },
      });
    });

    if (restoredProducts.length > 0) {
      console.log(`✅ Sipariş silindi: ${params.id}, ${restoredProducts.length} ürün stoğa eklendi`);
    } else {
      console.log(`✅ Sipariş silindi: ${params.id} (CANCELLED - stok zaten eklenmişti)`);
    }

    return NextResponse.json({
      message: restoredProducts.length > 0
        ? 'Sipariş başarıyla silindi ve stoklar geri yüklendi'
        : 'Sipariş başarıyla silindi (Stok zaten geri eklenmişti)',
      restoredProducts: restoredProducts.length > 0 ? restoredProducts : undefined,
      alreadyCancelled: restoredProducts.length === 0,
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}
