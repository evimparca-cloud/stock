import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/products/[id] - Tek bir ürünü getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        mappings: {
          include: {
            marketplace: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Ürünü güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { name, stockQuantity, price, location } = body;

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(stockQuantity !== undefined && { stockQuantity: parseInt(stockQuantity) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(location !== undefined && { location }),
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Ürünü sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🗑️ Deleting product:', params.id);

    // Önce ürünün var olup olmadığını kontrol et
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        mappings: true,
        stockLogs: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    // İlişkili kayıtları sil (cascade delete yerine manuel)
    // 1. Önce order items'ları sil (foreign key constraint için)
    if (product.mappings.length > 0) {
      for (const mapping of product.mappings) {
        await prisma.orderItem.deleteMany({
          where: { productMappingId: mapping.id },
        });
      }
      
      // 2. Sonra mappings'leri sil
      await prisma.productMapping.deleteMany({
        where: { productId: params.id },
      });
    }

    // 3. Stock logs'ları sil
    if (product.stockLogs.length > 0) {
      await prisma.stockLog.deleteMany({
        where: { productId: params.id },
      });
    }

    // Ürünü sil
    await prisma.product.delete({
      where: { id: params.id },
    });

    console.log('✅ Product deleted:', product.name);
    return NextResponse.json({ 
      success: true,
      message: 'Ürün başarıyla silindi',
      productName: product.name 
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { 
        error: 'Ürün silinirken bir hata oluştu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
