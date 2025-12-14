import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helper';

// GET /api/marketplaces/[id] - Tek bir pazaryerini getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: params.id },
      include: {
        mappings: {
          include: {
            product: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Marketplace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(marketplace);
  } catch (error) {
    console.error('Error fetching marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplace' },
      { status: 500 }
    );
  }
}

// PUT /api/marketplaces/[id] - Pazaryerini güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { name, storeName, apiKey, apiSecret, supplierId, isActive } = body;

    const marketplace = await prisma.marketplace.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(storeName !== undefined && { storeName }),
        ...(apiKey !== undefined && { apiKey }),
        ...(apiSecret !== undefined && { apiSecret }),
        ...(supplierId !== undefined && { supplierId }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(marketplace);
  } catch (error: any) {
    console.error('Error updating marketplace:', error);
    
    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update marketplace' },
      { status: 500 }
    );
  }
}

// DELETE /api/marketplaces/[id] - Pazaryerini sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.marketplace.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Marketplace deleted successfully' });
  } catch (error) {
    console.error('Error deleting marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to delete marketplace' },
      { status: 500 }
    );
  }
}
