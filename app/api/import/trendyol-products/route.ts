import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { MarketplaceProduct } from '@/lib/marketplace/types';
import { requireAdmin } from '@/lib/auth-check';
import * as Sentry from '@sentry/nextjs';

// POST /api/import/trendyol-products - Trendyol'dan ürünleri çek ve import et
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, autoCreateProducts = false, selectedProducts = null, mappings = {} } = body;

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    // Marketplace bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    // Marketplace service oluştur
    const service = MarketplaceFactory.createService(marketplace.name, {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    // Trendyol'dan ürünleri çek (sadece yeni ürünler çekiliyorsa)
    let trendyolProducts;

    if (selectedProducts && selectedProducts.length > 0) {
      // Seçili ürünler gönderilmişse, onları kullan
      trendyolProducts = selectedProducts;
      console.log(`📦 Using ${trendyolProducts.length} selected products`);
    } else {
      // Tüm ürünleri API'den çek
      console.log('📦 Fetching products from Trendyol...');
      trendyolProducts = await service.getProducts();
      console.log(`✅ Found ${trendyolProducts.length} products`);
    }

    // Otomatik ürün oluşturma ve mapping
    if (autoCreateProducts) {
      let created = 0;
      let existing = 0;
      let mapped = 0;
      const resultMappings = [];

      for (const tProduct of trendyolProducts) {
        let localProduct;

        // 1. TrendyolProduct tablosuna kaydetme (şimdilik devre dışı - Prisma Client yeni modeli tanımıyor)
        // TODO: Prisma Client yeniden generate edildikten sonra aktif et

        // 2. Eşleştirme kontrolü
        const mappedProductId = mappings[tProduct.sku];
        if (mappedProductId) {
          // Frontend'den gelen eşleştirme varsa, o ürünü kullan
          localProduct = await prisma.product.findUnique({
            where: { id: mappedProductId }
          });

          if (localProduct) {
            console.log(`✅ Eşleştirme bulundu: ${tProduct.sku} -> ${localProduct.name}`);
            mapped++;
          } else {
            console.warn(`⚠️ Eşleştirilen ürün bulunamadı: ${mappedProductId}`);
          }
        } else {
          // Eşleştirme yoksa, SKU ile kontrol et
          localProduct = await prisma.product.findUnique({
            where: { sku: tProduct.sku }
          });
        }

        if (localProduct) {
          // Mevcut ürün varsa güncelle
          await prisma.product.update({
            where: { id: localProduct.id },
            data: {
              stockQuantity: tProduct.stockQuantity,
              price: tProduct.price.toString(),
            }
          });
          existing++;
        } else {
          // Yeni ürün oluştur
          // ✅ ÖZEL FORMAT: ProductMainId'den numara + Renk + Beden
          // ProductMainId: VRDN2135 → 2135
          const productNumber = (tProduct.productMainId || '').replace(/^VRDN/i, '');

          // Attributes'den renk ve beden al
          const color = tProduct.attributes?.find((a: any) =>
            a.attributeName?.toLowerCase() === 'renk'
          )?.attributeValue || '';
          const size = tProduct.attributes?.find((a: any) =>
            a.attributeName?.toLowerCase() === 'beden'
          )?.attributeValue || '';

          // ✅ Türkçe büyük harf fonksiyonu (i→İ, ı→I)
          const toTurkishUpperCase = (str: string) => {
            return str
              .replace(/i/g, 'İ')
              .replace(/ı/g, 'I')
              .replace(/ğ/g, 'Ğ')
              .replace(/ü/g, 'Ü')
              .replace(/ş/g, 'Ş')
              .replace(/ö/g, 'Ö')
              .replace(/ç/g, 'Ç')
              .toUpperCase();
          };

          // Yeni SKU: 2135SİYAHM (boşluksuz, BÜYÜK HARF)
          const customSku = toTurkishUpperCase(
            `${productNumber}${color}${size}`.replace(/\s+/g, '')
          );

          // Yeni Ad: 2135-SİYAH-M (BÜYÜK HARF)
          const nameParts = [productNumber, color, size].filter(Boolean);
          const customName = toTurkishUpperCase(nameParts.join('-')) || tProduct.title;

          // Lokasyon: StockCode'dan
          const location = tProduct.stockCode || null;

          console.log(`📦 Özel format: ${tProduct.productMainId} → SKU: ${customSku}, Ad: ${customName}, Lok: ${location}`);

          localProduct = await prisma.product.create({
            data: {
              name: customName,
              sku: customSku || tProduct.sku, // Fallback: orijinal SKU
              price: tProduct.price.toString(),
              stockQuantity: tProduct.stockQuantity,
              description: tProduct.description || '',
              images: tProduct.images || [],
              attributes: tProduct.attributes || [],
              location: location,
            }
          });
          created++;
        }

        // 3. Eşleştirme oluştur veya güncelle (TrendyolProduct ile bağlantılı)
        const existingMapping = await prisma.productMapping.findFirst({
          where: {
            productId: localProduct.id,
            marketplaceId: marketplaceId
          }
        });

        if (!existingMapping) {
          // ✅ Remote SKU olarak Trendyol barcode kullan
          await prisma.productMapping.create({
            data: {
              productId: localProduct.id,
              marketplaceId: marketplaceId,
              remoteSku: tProduct.barcode || tProduct.sku, // Barcode öncelikli
              remoteProductId: tProduct.id,
              syncStock: true
            }
          });
        }

        resultMappings.push({
          localProductId: localProduct.id,
          trendyolProductId: null, // TrendyolProduct devre dışı
          action: mappedProductId ? 'mapped' : (created > existing ? 'created' : 'existing'),
        });
      }

      return NextResponse.json({
        success: true,
        message: `${created} yeni ürün oluşturuldu, ${existing} mevcut ürün bulundu, ${mapped} ürün eşleştirildi`,
        total: trendyolProducts.length,
        created,
        existing,
        mapped,
        mappings: resultMappings,
      });
    }

    // Sadece ürün listesini döndür (otomatik import yok)
    return NextResponse.json({
      success: true,
      message: `${trendyolProducts.length} ürün bulundu`,
      total: trendyolProducts.length,
      products: trendyolProducts.map((p: MarketplaceProduct) => ({
        id: p.id,
        productMainId: p.productMainId,
        sku: p.sku,
        barcode: p.barcode,
        title: p.title,
        price: p.price,
        listPrice: p.listPrice,
        stockQuantity: p.stockQuantity,
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        brand: p.brand,
        brandId: p.brandId,
        gender: p.gender,
        vatRate: p.vatRate,
        stockCode: p.stockCode,
        stockUnitType: p.stockUnitType,
        description: p.description,
        images: p.images,
        attributes: p.attributes,
        dimensionalWeight: p.dimensionalWeight,
        deliveryDuration: p.deliveryDuration,
        locationBasedDelivery: p.locationBasedDelivery,
        lotNumber: p.lotNumber,
        deliveryOption: p.deliveryOption,
        cargoCompanyId: p.cargoCompanyId,
        shipmentAddressId: p.shipmentAddressId,
        returningAddressId: p.returningAddressId,
        approved: p.approved,
        onSale: p.onSale,
      })),
    });
  } catch (error) {
    console.error('Error importing Trendyol products:', error);
    Sentry.captureException(error, { extra: { route: 'import/trendyol-products' } });
    return NextResponse.json(
      {
        error: 'Ürün import başarısız',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
