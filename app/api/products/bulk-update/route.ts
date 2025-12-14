import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-check';

// POST /api/products/bulk-update - Toplu ürün güncelleme
export async function POST(request: NextRequest) {
    try {
        await requireAdmin();
    } catch (error) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { productIds, updateType, value } = body;

        // Validasyon
        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return NextResponse.json(
                { error: 'En az bir ürün seçilmeli' },
                { status: 400 }
            );
        }

        if (!updateType || !['fixed', 'percent_increase', 'percent_decrease'].includes(updateType)) {
            return NextResponse.json(
                { error: 'Geçersiz güncelleme tipi. fixed, percent_increase veya percent_decrease olmalı' },
                { status: 400 }
            );
        }

        if (typeof value !== 'number' || value < 0) {
            return NextResponse.json(
                { error: 'Değer pozitif bir sayı olmalı' },
                { status: 400 }
            );
        }

        // Güncellenecek ürünleri al
        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds }
            }
        });

        if (products.length === 0) {
            return NextResponse.json(
                { error: 'Güncellenecek ürün bulunamadı' },
                { status: 404 }
            );
        }

        let updatedCount = 0;
        const updates: { id: string; oldPrice: number; newPrice: number }[] = [];

        // Her ürün için fiyat güncelle
        for (const product of products) {
            const oldPrice = parseFloat(product.price.toString());
            let newPrice: number;

            switch (updateType) {
                case 'fixed':
                    // Sabit fiyat
                    newPrice = value;
                    break;
                case 'percent_increase':
                    // Yüzde artış
                    newPrice = oldPrice * (1 + value / 100);
                    break;
                case 'percent_decrease':
                    // Yüzde indirim
                    newPrice = oldPrice * (1 - value / 100);
                    break;
                default:
                    newPrice = oldPrice;
            }

            // Negatif fiyat engelle
            newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

            await prisma.product.update({
                where: { id: product.id },
                data: { price: newPrice.toString() }
            });

            updates.push({
                id: product.id,
                oldPrice,
                newPrice
            });

            updatedCount++;
        }

        console.log(`✅ Toplu fiyat güncelleme: ${updatedCount} ürün güncellendi (${updateType}: ${value})`);

        return NextResponse.json({
            success: true,
            message: `${updatedCount} ürün güncellendi`,
            updateType,
            value,
            updates
        });
    } catch (error) {
        console.error('Toplu güncelleme hatası:', error);
        return NextResponse.json(
            { error: 'Toplu güncelleme başarısız', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
