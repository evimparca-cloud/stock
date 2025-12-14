import {
  IMarketplaceService,
  MarketplaceCredentials,
  MarketplaceProduct,
  MarketplaceOrder,
  MarketplaceOrderItem,
  StockUpdateRequest,
  PriceUpdateRequest,
  LocationUpdateRequest,
  SyncResult,
} from './types';

export class TrendyolService implements IMarketplaceService {
  private apiKey: string;
  private apiSecret: string;
  private supplierId: string;
  private baseUrl = 'https://apigw.trendyol.com/integration';

  constructor(credentials: MarketplaceCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.supplierId = credentials.supplierId || '';
  }

  private getHeaders(): HeadersInit {
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'User-Agent': 'StockManagementSystem/1.0',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.supplierId) {
        console.error('Trendyol Supplier ID eksik!');
        throw new Error('Supplier ID (Satıcı ID) girilmemiş. Pazaryeri ayarlarından Supplier ID ekleyin.');
      }

      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API Key veya API Secret eksik!');
      }

      const response = await fetch(
        `${this.baseUrl}/product/sellers/${this.supplierId}/products?page=0&size=1`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol API Error:', response.status, errorText);
        throw new Error(`Bağlantı başarısız (${response.status}). API bilgilerini kontrol edin.`);
      }

      return true;
    } catch (error) {
      console.error('Trendyol connection test failed:', error);
      throw error;
    }
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    try {
      const allProducts: MarketplaceProduct[] = [];
      let page = 0;
      const size = 100;
      let hasMorePages = true;

      // Tüm sayfaları çek
      while (hasMorePages) {
        console.log(`📦 Fetching page ${page + 1}...`);
        
        const response = await fetch(
          `${this.baseUrl}/product/sellers/${this.supplierId}/products?page=${page}&size=${size}`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error(`Trendyol API error: ${response.status}`);
        }

        const data = await response.json();
        
        // İlk sayfada sample data log'la (debugging için)
        if (page === 0 && data.content && data.content[0]) {
          console.log('📋 Sample Trendyol Product Data:', JSON.stringify(data.content[0], null, 2));
        }
        
        // Trendyol response formatına göre parse et
        const products: MarketplaceProduct[] = (data.content || []).map((item: any) => ({
          id: item.productMainId || item.id,
          productMainId: item.productMainId,
          sku: item.barcode || item.stockCode,
          barcode: item.barcode,
          title: item.title,
          price: item.salePrice || 0,
          listPrice: item.listPrice || item.salePrice || 0,
          stockQuantity: item.quantity || 0,
          categoryId: item.pimCategoryId || item.categoryId,
          categoryName: item.categoryName,
          brand: item.brand,
          brandId: item.brandId,
          description: item.description,
          images: item.images || [],
          attributes: item.attributes || [],
          vatRate: item.vatRate,
          stockCode: item.stockCode,
          stockUnitType: item.stockUnitType,
          gender: item.gender,
          approved: item.approved,
          onSale: item.onSale,
          dimensionalWeight: item.dimensionalWeight,
          deliveryDuration: item.deliveryDuration,
          locationBasedDelivery: item.locationBasedDelivery,
          lotNumber: item.lotNumber,
          deliveryOption: item.deliveryOption,
          cargoCompanyId: item.cargoCompanyId,
          shipmentAddressId: item.shipmentAddressId,
          returningAddressId: item.returningAddressId,
        }));

        allProducts.push(...products);

        // Son sayfa mı kontrol et
        hasMorePages = data.content && data.content.length === size;
        page++;

        // Güvenlik için maksimum 50 sayfa
        if (page >= 50) {
          console.log('⚠️  Maximum page limit reached (50 pages)');
          hasMorePages = false;
        }

        // Rate limiting için kısa bekleme
        if (hasMorePages) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Total products fetched: ${allProducts.length} from ${page} pages`);
      return allProducts;
    } catch (error) {
      console.error('Trendyol getProducts error:', error);
      return [];
    }
  }

  async getProduct(sku: string): Promise<MarketplaceProduct | null> {
    try {
      const products = await this.getProducts();
      return products.find(p => p.sku === sku) || null;
    } catch (error) {
      console.error('Error fetching Trendyol product:', error);
      return null;
    }
  }

  async getProductByBarcode(barcode: string): Promise<any> {
    try {
      // Trendyol'dan belirli bir barkoda sahip ürünü çek
      const response = await fetch(
        `${this.baseUrl}/product/sellers/${this.supplierId}/products?barcode=${barcode}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol getProductByBarcode error:', errorText);
        return null;
      }

      const result = await response.json();
      console.log('Trendyol getProductByBarcode full response:', result);

      // İlk ürünü döndür (barcode unique olmalı)
      const product = result.content && result.content.length > 0 ? result.content[0] : null;
      
      if (product) {
        console.log('Trendyol product details:', {
          barcode: product.barcode,
          cargoCompanyId: product.cargoCompanyId,
          shipmentAddressId: product.shipmentAddressId,
          locationBasedDelivery: product.locationBasedDelivery,
          allFields: Object.keys(product)
        });
      }
      
      return product;
    } catch (error) {
      console.error('Trendyol getProductByBarcode exception:', error);
      return null;
    }
  }

  async updateStock(updates: StockUpdateRequest[]): Promise<SyncResult> {
    try {
      const items = updates.map(update => ({
        barcode: update.sku,
        quantity: update.quantity,
      }));

      const endpoint = `${this.baseUrl}/inventory/sellers/${this.supplierId}/products/price-and-inventory`;
      console.log('🔄 Trendyol updateStock:', { endpoint, itemCount: items.length, supplierId: this.supplierId });

      const response = await fetch(
        endpoint,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol updateStock error:', response.status, errorText);
        return {
          success: false,
          message: `Stok güncelleme başarısız (${response.status})`,
          error: `API Hatası: ${errorText || response.statusText}`,
        };
      }

      const result = await response.json();
      console.log('Trendyol updateStock success:', result);

      return {
        success: true,
        message: `${updates.length} ürünün stoğu güncellendi`,
        batchRequestId: result.batchRequestId,
      };
    } catch (error) {
      console.error('Trendyol updateStock exception:', error);
      return {
        success: false,
        message: 'Stok güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updatePriceAndInventory(updates: Array<{
    sku: string;
    quantity?: number;
    salePrice?: number;
    listPrice?: number;
  }>): Promise<SyncResult> {
    try {
      // Maksimum 1000 item kontrolü
      if (updates.length > 1000) {
        return {
          success: false,
          message: 'Maksimum 1000 ürün güncelleyebilirsiniz',
          error: 'Item limit exceeded',
        };
      }

      const items = updates.map(update => {
        const item: any = {
          barcode: update.sku,
        };

        // Sadece değişen alanları gönder
        if (update.quantity !== undefined) {
          // Maksimum 20.000 adet kontrolü
          if (update.quantity > 20000) {
            throw new Error(`Ürün ${update.sku} için maksimum 20.000 adet stok ekleyebilirsiniz`);
          }
          item.quantity = update.quantity;
        }

        if (update.salePrice !== undefined) {
          item.salePrice = update.salePrice;
        }

        if (update.listPrice !== undefined) {
          item.listPrice = update.listPrice;
        }

        return item;
      });

      console.log('Trendyol updatePriceAndInventory request:', { items });

      const endpoint = `${this.baseUrl}/inventory/sellers/${this.supplierId}/products/price-and-inventory`;
      console.log('💰 Trendyol updatePriceAndInventory:', { endpoint, itemCount: items.length, supplierId: this.supplierId });

      const response = await fetch(
        endpoint,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol updatePriceAndInventory error:', response.status, errorText);
        
        // Özel hata mesajları
        if (errorText.includes('15 dakika boyunca aynı isteği tekrarlı olarak atamazsınız')) {
          return {
            success: false,
            message: '⏱️ 15 dakika boyunca aynı isteği tekrarlı olarak atamazsınız!',
            error: errorText,
          };
        }

        return {
          success: false,
          message: `❌ Fiyat ve stok güncelleme başarısız (${response.status})`,
          error: `API Hatası: ${errorText || response.statusText}. Endpoint: /inventory/sellers/${this.supplierId}/products/price-and-inventory`,
        };
      }

      const result = await response.json();
      console.log('Trendyol updatePriceAndInventory success:', result);

      return {
        success: true,
        message: `${updates.length} ürünün fiyat ve stoğu güncellendi`,
        batchRequestId: result.batchRequestId,
      };
    } catch (error) {
      console.error('Trendyol updatePriceAndInventory exception:', error);
      return {
        success: false,
        message: 'Fiyat ve stok güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateProductsWithRequiredFields(updates: Array<{
    sku: string;
    stockCode?: string;
    locationBasedDelivery?: string;
    [key: string]: any;
  }>): Promise<SyncResult> {
    try {
      // Maksimum 1000 item kontrolü
      if (updates.length > 1000) {
        return {
          success: false,
          message: 'Maksimum 1000 ürün güncelleyebilirsiniz',
          error: 'Item limit exceeded',
        };
      }

      const items = [];

      for (const update of updates) {
        console.log(`🔍 ${update.sku} için mevcut ürün bilgileri çekiliyor...`);
        
        // Önce mevcut ürün bilgilerini Trendyol'dan çek
        const existingProduct = await this.getProductByBarcode(update.sku);
        
        if (!existingProduct) {
          console.warn(`❌ Ürün bulunamadı: ${update.sku}`);
          continue;
        }

        console.log(`✅ Mevcut ürün bilgileri alındı:`, {
          barcode: existingProduct.barcode,
          title: existingProduct.title,
          stockCode: existingProduct.stockCode,
          productMainId: existingProduct.productMainId,
          brandId: existingProduct.brandId,
          categoryId: existingProduct.categoryId || existingProduct.pimCategoryId
        });

        // Zorunlu alanları mevcut ürün bilgilerinden al, güncellenmek istenen alanları override et
        // stockCode gönderilmişse kullan, yoksa mevcut stockCode'u kullan
        const newStockCode = update.stockCode !== undefined && update.stockCode !== null && update.stockCode !== '' 
          ? update.stockCode 
          : existingProduct.stockCode;

        console.log('📝 StockCode kontrolü:', {
          updateStockCode: update.stockCode,
          existingStockCode: existingProduct.stockCode,
          willUseStockCode: newStockCode,
          isDifferent: newStockCode !== existingProduct.stockCode
        });

        const item: any = {
          barcode: update.sku,
          title: existingProduct.title,
          productMainId: existingProduct.productMainId,
          brandId: existingProduct.brandId,
          categoryId: existingProduct.pimCategoryId || existingProduct.categoryId,
          stockCode: newStockCode,
          dimensionalWeight: update.dimensionalWeight !== undefined ? update.dimensionalWeight : (existingProduct.dimensionalWeight || 1),
          deliveryDuration: update.deliveryDuration !== undefined ? update.deliveryDuration : existingProduct.deliveryDuration,
          description: update.description !== undefined ? update.description : (existingProduct.description || 'Ürün açıklaması'),
          currencyType: 'TRY',
          cargoCompanyId: existingProduct.cargoCompanyId || 10,
          vatRate: update.vatRate !== undefined ? update.vatRate : (existingProduct.vatRate || 20),
          images: existingProduct.images && existingProduct.images.length > 0 
            ? existingProduct.images 
            : [{ url: 'https://via.placeholder.com/300x300' }],
          attributes: existingProduct.attributes || [],
        };

        // İsteğe bağlı alanları ekle
        if (update.locationBasedDelivery !== undefined) {
          item.locationBasedDelivery = update.locationBasedDelivery;
        }
        if (existingProduct.deliveryDuration) {
          item.deliveryDuration = existingProduct.deliveryDuration;
        }
        if (existingProduct.shipmentAddressId) {
          item.shipmentAddressId = existingProduct.shipmentAddressId;
        }
        if (existingProduct.returningAddressId) {
          item.returningAddressId = existingProduct.returningAddressId;
        }
        if (existingProduct.lotNumber) {
          item.lotNumber = existingProduct.lotNumber;
        }
        if (existingProduct.deliveryOption) {
          item.deliveryOption = existingProduct.deliveryOption;
        }

        console.log(`📦 Final payload oluşturuldu:`, {
          barcode: item.barcode,
          stockCode: item.stockCode,
          title: item.title,
          productMainId: item.productMainId,
          brandId: item.brandId,
          categoryId: item.categoryId
        });

        items.push(item);
      }

      if (items.length === 0) {
        return {
          success: false,
          message: 'Güncellenecek ürün bulunamadı',
          error: 'No products found',
        };
      }

      console.log('🚀 Trendyol updateProductsWithRequiredFields request:', { 
        itemCount: items.length,
        items: items.map(item => ({
          barcode: item.barcode,
          stockCode: item.stockCode,
          locationBasedDelivery: item.locationBasedDelivery
        }))
      });

      const response = await fetch(
        `${this.baseUrl}/product/sellers/${this.supplierId}/products`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol updateProductsWithRequiredFields error:', errorText);
        
        return {
          success: false,
          message: 'Ürün bilgisi güncelleme başarısız',
          error: errorText,
        };
      }

      const result = await response.json();
      console.log('Trendyol updateProductsWithRequiredFields success:', result);

      return {
        success: true,
        message: `${items.length} ürünün bilgileri güncellendi`,
        batchRequestId: result.batchRequestId,
      };
    } catch (error) {
      console.error('Trendyol updateProductsWithRequiredFields exception:', error);
      return {
        success: false,
        message: 'Ürün bilgisi güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Eski updateProducts metodunu koruyalım (geriye uyumluluk için)
  async updateProducts(updates: Array<{
    sku: string;
    title?: string;
    productMainId?: string;
    brandId?: number;
    categoryId?: number;
    stockCode?: string;
    dimensionalWeight?: number;
    description?: string;
    deliveryDuration?: number;
    vatRate?: number;
    locationBasedDelivery?: string;
    lotNumber?: string;
    deliveryOption?: {
      deliveryDuration?: number;
      fastDeliveryType?: string;
    };
    images?: Array<{ url: string }>;
    attributes?: Array<{
      attributeId: number;
      attributeValueId?: number;
      customAttributeValue?: string;
    }>;
    cargoCompanyId?: number;
    shipmentAddressId?: number;
    returningAddressId?: number;
  }>): Promise<SyncResult> {
    // Yeni metodu kullan
    return this.updateProductsWithRequiredFields(updates);
  }

  async updatePrice(updates: PriceUpdateRequest[]): Promise<SyncResult> {
    try {
      const items = updates.map(update => ({
        barcode: update.sku,
        salePrice: update.price,
        listPrice: update.price * 1.1, // %10 fazla liste fiyatı
      }));

      const endpoint = `${this.baseUrl}/inventory/sellers/${this.supplierId}/products/price-and-inventory`;
      console.log('💰 Trendyol updatePrice:', { endpoint, itemCount: items.length, supplierId: this.supplierId });

      const response = await fetch(
        endpoint,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ items }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Trendyol updatePrice error:', response.status, error);
        return {
          success: false,
          message: `❌ Fiyat güncelleme başarısız (${response.status})`,
          error: `API Hatası: ${error || response.statusText}`,
        };
      }

      return {
        success: true,
        message: `${updates.length} ürünün fiyatı güncellendi`,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Fiyat güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateLocation(updates: LocationUpdateRequest[]): Promise<SyncResult> {
    try {
      console.log('📍 Trendyol lokasyon güncelleme başlatılıyor:', updates.length);
      
      // Lokasyonu stockCode olarak Trendyol'a gönder
      const productUpdates = updates.map(update => ({
        sku: update.sku,
        stockCode: update.location, // Lokasyonu stockCode olarak gönder
      }));

      console.log('🔄 Trendyol ürün güncelleme verisi:', productUpdates);

      // updateProductsWithRequiredFields kullanarak gerçek güncelleme
      const result = await this.updateProductsWithRequiredFields(productUpdates);

      if (result.success) {
        console.log('✅ Trendyol lokasyon güncelleme başarılı:', result.message);
        return {
          success: true,
          message: `${updates.length} ürünün lokasyonu Trendyol'a stockCode olarak gönderildi`,
          data: { processed: updates.length, total: updates.length },
        };
      } else {
        console.error('❌ Trendyol lokasyon güncelleme başarısız:', result.message);
        return {
          success: false,
          message: `Trendyol güncelleme hatası: ${result.message}`,
          error: result.error,
        };
      }
    } catch (error) {
      console.error('Trendyol lokasyon güncelleme hatası:', error);
      return {
        success: false,
        message: 'Lokasyon güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getOrders(startDate?: Date, endDate?: Date): Promise<MarketplaceOrder[]> {
    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Son 7 gün
      const end = endDate || new Date();

      const url = `${this.baseUrl}/order/sellers/${this.supplierId}/orders?` +
        `startDate=${start.getTime()}&endDate=${end.getTime()}&page=0&size=100`;
      
      console.log('🔗 Trendyol sipariş URL:', url);
      console.log('📅 Tarih aralığı:', {
        start: start.toISOString(),
        end: end.toISOString(),
        startTimestamp: start.getTime(),
        endTimestamp: end.getTime()
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      console.log('📡 Trendyol API yanıt:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Trendyol API hatası:', errorText);
        throw new Error(`Trendyol API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📦 Trendyol sipariş verisi:', {
        totalElements: data.totalElements,
        totalPages: data.totalPages,
        size: data.size,
        contentLength: data.content?.length || 0
      });

      return (data.content || []).map((order: any) => {
        console.log(`🔍 Trendyol sipariş: ${order.orderNumber} -> status: "${order.status}"`);
        
        // Trendyol status'unu standart status'a çevir
        const statusMapping: { [key: string]: string } = {
          'Created': 'PENDING',
          'Picking': 'PROCESSING', 
          'Invoiced': 'PROCESSING',
          'Shipped': 'SHIPPED',
          'Delivered': 'DELIVERED',
          'UnDelivered': 'SHIPPED',
          'Returned': 'RETURNED',
          'Cancelled': 'CANCELLED'
        };
        
        const mappedStatus = statusMapping[order.status] || order.status;
        console.log(`🔄 Status mapping: "${order.status}" -> "${mappedStatus}"`);
        
        return {
          orderId: order.orderNumber,
          orderNumber: order.orderNumber,
          orderDate: new Date(order.orderDate),
          status: mappedStatus,
          totalAmount: order.grossAmount,
          customer: {
            name: `${order.customerFirstName} ${order.customerLastName}`,
            email: order.customerEmail,
            phone: order.shipmentAddress?.phone,
            address: this.formatAddress(order.shipmentAddress),
          },
          items: (order.lines || []).map((line: any) => ({
            productId: line.productCode,
            sku: line.barcode,
            barcode: line.barcode,
            productName: line.productName,
            quantity: line.quantity,
            price: line.price,
            totalPrice: line.amount,
          })),
        };
      });
    } catch (error) {
      console.error('Error fetching Trendyol orders:', error);
      return [];
    }
  }

  async getOrder(orderId: string): Promise<MarketplaceOrder | null> {
    try {
      const orders = await this.getOrders();
      return orders.find(o => o.orderId === orderId) || null;
    } catch (error) {
      console.error('Error fetching Trendyol order:', error);
      return null;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<SyncResult> {
    try {
      // Trendyol sipariş durumu güncelleme
      // Not: Gerçek implementasyon için Trendyol'un kargo entegrasyonu gerekir
      
      const response = await fetch(
        `${this.baseUrl}/order/sellers/${this.supplierId}/orders/${orderId}/status`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: 'Sipariş durumu güncellenemedi',
        };
      }

      return {
        success: true,
        message: 'Sipariş durumu güncellendi',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Sipariş durumu güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private formatAddress(address: any): string {
    if (!address) return '';
    return `${address.address1 || ''} ${address.district || ''} ${address.city || ''} ${address.country || ''}`.trim();
  }

  async getShipmentPackages(params: {
    startDate?: number;
    endDate?: number;
    page?: number;
    size?: number;
    status?: string;
    orderNumber?: string;
  } = {}): Promise<any> {
    try {
      const {
        startDate,
        endDate,
        page = 0,
        size = 50,
        status = 'Created',
        orderNumber,
      } = params;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: Math.min(size, 200).toString(),
        orderByField: 'PackageLastModifiedDate',
        orderByDirection: 'DESC',
      });

      if (startDate) queryParams.append('startDate', startDate.toString());
      if (endDate) queryParams.append('endDate', endDate.toString());
      if (status) queryParams.append('status', status);
      if (orderNumber) queryParams.append('orderNumber', orderNumber);
      if (this.supplierId) queryParams.append('supplierId', this.supplierId);

      console.log('📦 Trendyol sipariş paketleri çekiliyor:', {
        status,
        page,
        size,
        startDate: startDate ? new Date(startDate).toISOString() : 'N/A',
        endDate: endDate ? new Date(endDate).toISOString() : 'N/A',
      });

      const response = await fetch(
        `${this.baseUrl}/order/sellers/${this.supplierId}/orders?${queryParams}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'User-Agent': this.supplierId,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol getShipmentPackages error:', errorText);
        throw new Error(`Trendyol API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Sipariş paketleri alındı:', {
        totalPages: result.totalPages,
        totalElements: result.totalElements,
        size: result.size,
        currentPage: result.page,
        contentLength: result.content?.length || 0,
      });

      return result;
    } catch (error) {
      console.error('Trendyol getShipmentPackages exception:', error);
      throw error;
    }
  }

  async updatePackageStatus(params: {
    packageId: number;
    status: 'Picking' | 'Invoiced';
    lines: Array<{
      lineId: number;
      quantity: number;
    }>;
    invoiceNumber?: string;
  }): Promise<SyncResult> {
    try {
      const { packageId, status, lines, invoiceNumber } = params;

      console.log('📦 Paket durumu güncelleniyor:', {
        packageId,
        status,
        linesCount: lines.length,
        invoiceNumber: invoiceNumber || 'N/A',
      });

      // Validasyon
      if (status === 'Invoiced' && !invoiceNumber) {
        return {
          success: false,
          message: 'Invoiced statüsü için fatura numarası gerekli',
          error: 'Missing invoice number',
        };
      }

      const requestBody: any = {
        lines,
        status,
        params: status === 'Invoiced' ? { invoiceNumber } : {},
      };

      const response = await fetch(
        `${this.baseUrl}/order/sellers/${this.supplierId}/shipment-packages/${packageId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'User-Agent': this.supplierId,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Trendyol updatePackageStatus error:', errorText);
        return {
          success: false,
          message: `Paket durumu güncellenemedi: ${response.status}`,
          error: errorText,
        };
      }

      console.log('✅ Paket durumu güncellendi:', { packageId, status });

      return {
        success: true,
        message: `Paket ${status} statüsüne güncellendi`,
      };
    } catch (error) {
      console.error('Trendyol updatePackageStatus exception:', error);
      return {
        success: false,
        message: 'Paket durumu güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * İade paketlerini çek (getClaims)
   */
  async getClaims(options: {
    claimIds?: string[];
    claimItemStatus?: string;
    startDate?: number;
    endDate?: number;
    orderNumber?: string;
    page?: number;
    size?: number;
  } = {}): Promise<any> {
    try {
      if (!this.supplierId) {
        throw new Error('Supplier ID gerekli');
      }

      const params = new URLSearchParams();
      
      if (options.claimIds && options.claimIds.length > 0) {
        params.append('claimIds', options.claimIds.join(','));
      }
      if (options.claimItemStatus) {
        params.append('claimItemStatus', options.claimItemStatus);
      }
      if (options.startDate) {
        params.append('startDate', options.startDate.toString());
      }
      if (options.endDate) {
        params.append('endDate', options.endDate.toString());
      }
      if (options.orderNumber) {
        params.append('orderNumber', options.orderNumber);
      }
      if (options.page !== undefined) {
        params.append('page', options.page.toString());
      }
      if (options.size !== undefined) {
        params.append('size', options.size.toString());
      }

      const url = `${this.baseUrl}/order/sellers/${this.supplierId}/claims${params.toString() ? '?' + params.toString() : ''}`;
      
      console.log(`🔍 Trendyol iade paketleri çekiliyor: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Trendyol iade API hatası: ${response.status} - ${errorText}`);
        throw new Error(`Trendyol iade API hatası: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ ${data.content?.length || 0} iade paketi bulundu`);
      
      return data;
    } catch (error) {
      console.error('❌ Trendyol iade çekme hatası:', error);
      throw error;
    }
  }
}
