import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/[id]/stock-logs - Ürünün stok hareketlerini getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const logs = await prisma.stockLog.findMany({
      where: { productId: id },
      include: {
        order: {
          select: {
            id: true,
            marketplaceOrderId: true,
            marketplace: {
              select: {
                name: true,
                storeName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Son 50 hareket
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error fetching stock logs:', error);
    return NextResponse.json(
      { error: 'Stok hareketleri getirilemedi' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/stock-logs - Yeni stok hareketi oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { type, quantity, reason, reference, createdBy } = body;

    // Ürünü getir
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    const oldStock = product.stockQuantity;
    let newStock = oldStock;

    // Hareket tipine göre yeni stok hesapla
    switch (type) {
      case 'ENTRY':
      case 'RETURN':
      case 'CANCEL':
        newStock = oldStock + quantity;
        break;
      case 'EXIT':
      case 'SALE':
      case 'DAMAGED':
        newStock = oldStock - quantity;
        break;
      case 'ADJUSTMENT':
        newStock = quantity; // Düzeltmede direkt yeni miktar
        break;
      case 'TRANSFER':
        newStock = oldStock - quantity;
        break;
      default:
        return NextResponse.json(
          { error: 'Geçersiz hareket tipi' },
          { status: 400 }
        );
    }

    // Negatif stok kontrolü
    if (newStock < 0) {
      return NextResponse.json(
        { error: 'Stok miktarı negatif olamaz' },
        { status: 400 }
      );
    }

    // Transaction ile hem stok güncelle hem log oluştur
    const result = await prisma.$transaction([
      // Ürün stok güncelle
      prisma.product.update({
        where: { id },
        data: { stockQuantity: newStock },
      }),
      // Log oluştur
      prisma.stockLog.create({
        data: {
          productId: id,
          type,
          quantity,
          oldStock,
          newStock,
          reason,
          reference,
          createdBy,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Stok hareketi kaydedildi',
      data: result[1], // Log kaydı
      product: result[0], // Güncellenmiş ürün
    });
  } catch (error) {
    console.error('Error creating stock log:', error);
    return NextResponse.json(
      { error: 'Stok hareketi kaydedilemedi' },
      { status: 500 }
    );
  }
}
