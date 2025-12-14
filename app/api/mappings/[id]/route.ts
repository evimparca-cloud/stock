import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/mappings/[id] - Tek bir eşleşmeyi getir
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const mapping = await prisma.productMapping.findUnique({
      where: { id: params.id },
      include: {
        product: true,
        marketplace: true,
      },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error fetching mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mapping' },
      { status: 500 }
    );
  }
}

// PUT /api/mappings/[id] - Eşleşmeyi güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { remoteSku, remoteProductId, syncStock } = body;

    const mapping = await prisma.productMapping.update({
      where: { id: params.id },
      data: {
        ...(remoteSku && { remoteSku }),
        ...(remoteProductId !== undefined && { remoteProductId }),
        ...(syncStock !== undefined && { syncStock }),
      },
      include: {
        product: true,
        marketplace: true,
      },
    });

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('Error updating mapping:', error);
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    );
  }
}

// DELETE /api/mappings/[id] - Eşleşmeyi sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.productMapping.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Mapping deleted successfully' });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}
