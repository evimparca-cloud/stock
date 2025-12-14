import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { requireAdmin } from '@/lib/auth-check';

/**
 * PUT /api/orders/[id]/update-trendyol-status
 * 
 * "Toplanıyor" butonu için Trendyol paket durumu güncelleme
 * 1. Local DB'de status = PROCESSING
 * 2. Trendyol API'de paket status = "Picking"
 */
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
        // Siparişi getir
        const order = await prisma.order.findUnique({
            where: { id: params.id },
            include: {
                marketplace: true,
                items: {
                    include: {
                        productMapping: true,
                    },
                },
            },
        });

        if (!order) {
            return NextResponse.json(
                { error: 'Sipariş bulunamadı' },
                { status: 404 }
            );
        }

        // Local DB güncelle
        const updatedOrder = await prisma.order.update({
            where: { id: params.id },
            data: { status: 'PROCESSING' },
        });

        console.log(`✅ Local DB güncellendi: ${order.marketplaceOrderId} -> PROCESSING`);

        // Trendyol'e bildir (sadece Trendyol siparişleri için)
        if (order.marketplace.name === 'Trendyol') {
            // shipmentPackageId kontrolü - Trendyol API için zorunlu
            if (!order.shipmentPackageId) {
                console.error('❌ shipmentPackageId bulunamadı:', order.marketplaceOrderId);
                return NextResponse.json({
                    ...updatedOrder,
                    trendyolSync: {
                        success: false,
                        message: 'Yerel sistem güncellendi ama Trendyol senkronize edilemedi',
                        error: 'shipmentPackageId eksik - sipariş Trendyol\'dan tam olarak yüklenmemiş olabilir',
                    },
                });
            }

            const trendyolService = new TrendyolService({
                apiKey: order.marketplace.apiKey || '',
                apiSecret: order.marketplace.apiSecret || '',
                supplierId: order.marketplace.supplierId || '',
            });

            // orderLineId kullanarak lines oluştur (Trendyol API gerekliliği)
            const lines = order.items
                .filter(item => item.orderLineId) // Sadece orderLineId olanları
                .map(item => ({
                    lineId: parseInt(item.orderLineId!), // Trendyol'un beklediği gerçek line ID
                    quantity: item.quantity,
                }));

            if (lines.length === 0) {
                console.error('❌ orderLineId bulunamadı:', order.marketplaceOrderId);
                return NextResponse.json({
                    ...updatedOrder,
                    trendyolSync: {
                        success: false,
                        message: 'Yerel sistem güncellendi ama Trendyol senkronize edilemedi',
                        error: 'orderLineId eksik - sipariş kalemleri Trendyol\'dan tam olarak yüklenmemiş olabilir',
                    },
                });
            }

            console.log('📦 Trendyol API çağrısı:', {
                packageId: order.shipmentPackageId,
                status: 'Picking',
                lines,
            });

            const trendyolResult = await trendyolService.updatePackageStatus({
                packageId: parseInt(order.shipmentPackageId), // Gerçek Trendyol paket ID'si
                status: 'Picking', // "Toplanıyor" = "Picking"
                lines,
            });

            if (trendyolResult.success) {
                console.log(`✅ Trendyol güncellendi: ${order.marketplaceOrderId} -> Picking`);
                return NextResponse.json({
                    ...updatedOrder,
                    trendyolSync: {
                        success: true,
                        message: 'Trendyol Seller Panel\'de güncellendi',
                    },
                });
            } else {
                console.error(`❌ Trendyol güncellenemedi:`, trendyolResult);
                return NextResponse.json({
                    ...updatedOrder,
                    trendyolSync: {
                        success: false,
                        message: 'Yerel sistem güncellendi ama Trendyol senkronize edilemedi',
                        error: trendyolResult.error,
                    },
                });
            }
        }

        // Trendyol dışı siparişler sadece local güncellenir
        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Update Trendyol status error:', error);
        return NextResponse.json(
            {
                error: 'failed to update status',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
