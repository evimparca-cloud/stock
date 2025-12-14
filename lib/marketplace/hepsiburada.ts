import {
  IMarketplaceService,
  MarketplaceCredentials,
  MarketplaceProduct,
  MarketplaceOrder,
  StockUpdateRequest,
  PriceUpdateRequest,
  SyncResult,
} from './types';

export class HepsiburadaService implements IMarketplaceService {
  private apiKey: string;
  private apiSecret: string;
  private merchantId: string;
  private baseUrl = 'https://mpop-sit.hepsiburada.com/api';

  constructor(credentials: MarketplaceCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.merchantId = credentials.supplierId || '';
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'StockManagementSystem/1.0',
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/products/list`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Hepsiburada connection test failed:', error);
      return false;
    }
  }

  async getProducts(): Promise<MarketplaceProduct[]> {
    try {
      const response = await fetch(`${this.baseUrl}/products/list`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Hepsiburada API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.listings || []).map((item: any) => ({
        id: item.hbSku,
        sku: item.merchantSku,
        barcode: item.barcode,
        title: item.productName,
        price: item.price,
        stockQuantity: item.availableStock,
        categoryId: item.categoryId,
        brand: item.brand,
        images: item.images || [],
      }));
    } catch (error) {
      console.error('Error fetching Hepsiburada products:', error);
      return [];
    }
  }

  async getProduct(sku: string): Promise<MarketplaceProduct | null> {
    try {
      const products = await this.getProducts();
      return products.find(p => p.sku === sku) || null;
    } catch (error) {
      console.error('Error fetching Hepsiburada product:', error);
      return null;
    }
  }

  async updateStock(updates: StockUpdateRequest[]): Promise<SyncResult> {
    try {
      const items = updates.map(update => ({
        merchantSku: update.sku,
        quantity: update.quantity,
      }));

      const response = await fetch(`${this.baseUrl}/products/inventory`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: 'Stok güncelleme başarısız',
          error,
        };
      }

      return {
        success: true,
        message: `${updates.length} ürünün stoğu güncellendi`,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Stok güncelleme hatası',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updatePrice(updates: PriceUpdateRequest[]): Promise<SyncResult> {
    try {
      const items = updates.map(update => ({
        merchantSku: update.sku,
        price: update.price,
      }));

      const response = await fetch(`${this.baseUrl}/products/price`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: 'Fiyat güncelleme başarısız',
          error,
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

  async getOrders(startDate?: Date, endDate?: Date): Promise<MarketplaceOrder[]> {
    try {
      const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const response = await fetch(
        `${this.baseUrl}/orders?` +
        `startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Hepsiburada API error: ${response.status}`);
      }

      const data = await response.json();

      return (data.orders || []).map((order: any) => ({
        orderId: order.orderNumber,
        orderNumber: order.orderNumber,
        orderDate: new Date(order.orderDate),
        status: order.status,
        totalAmount: order.totalPrice,
        customer: {
          name: order.shippingAddress?.firstName + ' ' + order.shippingAddress?.lastName,
          email: order.customerEmail,
          phone: order.shippingAddress?.phone,
          address: this.formatAddress(order.shippingAddress),
        },
        items: (order.items || []).map((item: any) => ({
          productId: item.hbSku,
          sku: item.merchantSku,
          barcode: item.barcode,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
        })),
      }));
    } catch (error) {
      console.error('Error fetching Hepsiburada orders:', error);
      return [];
    }
  }

  async getOrder(orderId: string): Promise<MarketplaceOrder | null> {
    try {
      const orders = await this.getOrders();
      return orders.find(o => o.orderId === orderId) || null;
    } catch (error) {
      console.error('Error fetching Hepsiburada order:', error);
      return null;
    }
  }

  async updateOrderStatus(orderId: string, status: string): Promise<SyncResult> {
    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ status }),
      });

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
    return `${address.address || ''} ${address.district || ''} ${address.city || ''} ${address.country || ''}`.trim();
  }
}
