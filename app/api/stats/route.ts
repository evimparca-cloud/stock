import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET /api/stats - Dashboard istatistikleri
export async function GET() {
  try {
    // Cache kontrolü
    const cacheKey = 'stats:dashboard';
    const cachedStats = await cache.get(cacheKey);

    if (cachedStats) {
      console.log('📊 Stats served from cache');
      return NextResponse.json({
        ...cachedStats,
        cached: true,
        cacheTime: new Date().toISOString()
      });
    }
    const [
      totalProducts,
      totalMarketplaces,
      totalOrders,
      totalMappings,
      lowStockProducts,
      recentOrders,
      ordersByStatus,
    ] = await Promise.all([
      // Toplam ürün sayısı
      prisma.product.count(),

      // Aktif pazaryeri sayısı
      prisma.marketplace.count({ where: { isActive: true } }),

      // Toplam sipariş sayısı
      prisma.order.count(),

      // Toplam eşleşme sayısı
      prisma.productMapping.count(),

      // Düşük stoklu ürünler (10'dan az)
      prisma.product.findMany({
        where: { stockQuantity: { lt: 10 } },
        take: 5,
        orderBy: { stockQuantity: 'asc' },
      }),

      // Son 5 sipariş
      prisma.order.findMany({
        take: 5,
        orderBy: { orderDate: 'desc' },
        include: {
          marketplace: true,
          _count: {
            select: { items: true },
          },
        },
      }),

      // Durumlara göre sipariş sayıları
      prisma.order.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    // Toplam sipariş tutarı
    const totalRevenue = await prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
    });

    const statsData = {
      summary: {
        totalProducts,
        totalMarketplaces,
        totalOrders,
        totalMappings,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
      },
      lowStockProducts,
      recentOrders,
      ordersByStatus: ordersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };

    // Cache'e kaydet (5 dakika)
    await cache.set(cacheKey, statsData, 300);
    console.log('📊 Stats cached for 5 minutes');

    return NextResponse.json({
      ...statsData,
      cached: false,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
