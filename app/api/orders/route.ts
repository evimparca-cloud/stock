import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helper';

// GET /api/orders - Tüm siparişleri listele
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const marketplaceId = searchParams.get('marketplaceId');

    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (marketplaceId) where.marketplaceId = marketplaceId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          marketplace: true,
          items: {
            select: {
              id: true,
              quantity: true,
              price: true,
              amount: true,
              discount: true,
              tyDiscount: true,
              // Ürün Bilgileri
              productName: true,
              productCode: true,
              productSize: true,
              productColor: true,
              productOrigin: true,
              productCategoryId: true,
              barcode: true,
              merchantSku: true,
              sku: true,
              productImageUrl: true, // Trendyol ürün resmi
              // Fiyat Detayları
              vatBaseAmount: true,
              laborCost: true,
              commission: true,
              currencyCode: true,
              // Kampanya
              salesCampaignId: true,
              merchantId: true,
              // Durum
              orderLineItemStatusName: true,
              orderLineId: true,
              // JSON Detaylar
              discountDetails: true,
              fastDeliveryOptions: true,
              // Relations
              productMapping: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);

    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Yeni sipariş oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketplaceOrderId, marketplaceId, totalAmount, status, customerInfo, items } = body;

    if (!marketplaceOrderId || !marketplaceId || !totalAmount || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Aynı marketplaceOrderId kontrolü
    const existingOrder = await prisma.order.findUnique({
      where: { marketplaceOrderId },
    });

    if (existingOrder) {
      return NextResponse.json(
        { error: 'Order with this marketplace order ID already exists' },
        { status: 409 }
      );
    }

    // Transaction ile sipariş ve kalemleri oluştur
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          marketplaceOrderId,
          marketplaceId,
          totalAmount: parseFloat(totalAmount),
          status: status || 'PENDING',
          customerInfo: customerInfo || null,
        },
      });

      // Sipariş kalemlerini oluştur
      const orderItems = await Promise.all(
        items.map((item: any) =>
          tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productMappingId: item.productMappingId,
              quantity: parseInt(item.quantity),
              price: parseFloat(item.price),
            },
          })
        )
      );

      // Stok düşür (syncStock true olan ürünler için)
      for (const item of items) {
        const mapping = await tx.productMapping.findUnique({
          where: { id: item.productMappingId },
          include: { product: true },
        });

        if (mapping?.syncStock) {
          await tx.product.update({
            where: { id: mapping.productId },
            data: {
              stockQuantity: {
                decrement: parseInt(item.quantity),
              },
            },
          });
        }
      }

      return newOrder;
    });

    // Oluşturulan siparişi detaylı şekilde getir
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        marketplace: true,
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            amount: true,
            discount: true,
            tyDiscount: true,
            // Ürün Bilgileri
            productName: true,
            productCode: true,
            productSize: true,
            productColor: true,
            productOrigin: true,
            productCategoryId: true,
            barcode: true,
            merchantSku: true,
            sku: true,
            // Fiyat Detayları
            vatBaseAmount: true,
            laborCost: true,
            commission: true,
            currencyCode: true,
            // Kampanya
            salesCampaignId: true,
            merchantId: true,
            // Durum
            orderLineItemStatusName: true,
            orderLineId: true,
            // JSON Detaylar
            discountDetails: true,
            fastDeliveryOptions: true,
            // Relations
            productMapping: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(fullOrder, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
