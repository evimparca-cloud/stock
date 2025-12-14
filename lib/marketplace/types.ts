// Marketplace Service için ortak tipler

export interface MarketplaceCredentials {
  apiKey: string;
  apiSecret: string;
  supplierId?: string;
}

export interface MarketplaceProduct {
  id: string;
  productMainId?: string;
  sku: string;
  barcode?: string;
  title: string;
  price: number;
  listPrice?: number;
  stockQuantity: number;
  categoryId?: number;
  categoryName?: string;
  brand?: string;
  brandId?: number;
  description?: string;
  images?: Array<{ url: string }>;
  attributes?: Array<{ 
    attributeId: number;
    attributeName?: string;
    attributeValue?: string;
    attributeValueId?: number;
    customAttributeValue?: string;
  }>;
  vatRate?: number;
  stockCode?: string;
  stockUnitType?: string;
  gender?: string;
  approved?: boolean;
  onSale?: boolean;
  dimensionalWeight?: number;
  deliveryDuration?: number;
  locationBasedDelivery?: string;
  lotNumber?: string;
  deliveryOption?: {
    deliveryDuration?: number;
    fastDeliveryType?: string;
  };
  cargoCompanyId?: number;
  shipmentAddressId?: number;
  returningAddressId?: number;
}

export interface MarketplaceOrder {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  status: string;
  totalAmount: number;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: MarketplaceOrderItem[];
}

export interface MarketplaceOrderItem {
  productId: string;
  sku: string;
  barcode?: string;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface StockUpdateRequest {
  sku: string;
  quantity: number;
}

export interface PriceUpdateRequest {
  sku: string;
  price: number;
}

export interface LocationUpdateRequest {
  sku: string;
  location: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  batchRequestId?: string;
}

// Marketplace Service Interface
export interface IMarketplaceService {
  // Ürün işlemleri
  getProducts(): Promise<MarketplaceProduct[]>;
  getProduct(sku: string): Promise<MarketplaceProduct | null>;
  updateStock(updates: StockUpdateRequest[]): Promise<SyncResult>;
  updatePrice(updates: PriceUpdateRequest[]): Promise<SyncResult>;
  updateLocation?(updates: LocationUpdateRequest[]): Promise<SyncResult>;
  updatePriceAndInventory?(updates: Array<{
    sku: string;
    quantity?: number;
    salePrice?: number;
    listPrice?: number;
  }>): Promise<SyncResult>;
  updateProducts?(updates: Array<{
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
  }>): Promise<SyncResult>;
  getProductByBarcode?(barcode: string): Promise<any>;
  
  // Sipariş işlemleri
  getOrders(startDate?: Date, endDate?: Date): Promise<MarketplaceOrder[]>;
  getOrder(orderId: string): Promise<MarketplaceOrder | null>;
  updateOrderStatus(orderId: string, status: string): Promise<SyncResult>;
  
  // Genel işlemler
  testConnection(): Promise<boolean>;
}
