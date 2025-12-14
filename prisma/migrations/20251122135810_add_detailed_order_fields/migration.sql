-- CreateEnum
CREATE TYPE "StockLogType" AS ENUM ('ENTRY', 'EXIT', 'SALE', 'RETURN', 'CANCEL', 'ADJUSTMENT', 'DAMAGED', 'TRANSFER');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "amount" DECIMAL(10,2),
ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "commission" DECIMAL(10,2),
ADD COLUMN     "currencyCode" TEXT DEFAULT 'TRY',
ADD COLUMN     "discount" DECIMAL(10,2),
ADD COLUMN     "discountDetails" JSONB,
ADD COLUMN     "fastDeliveryOptions" JSONB,
ADD COLUMN     "laborCost" DECIMAL(10,2),
ADD COLUMN     "merchantId" INTEGER,
ADD COLUMN     "merchantSku" TEXT,
ADD COLUMN     "orderLineId" TEXT,
ADD COLUMN     "orderLineItemStatusName" TEXT,
ADD COLUMN     "productCategoryId" INTEGER,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "productColor" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "productOrigin" TEXT,
ADD COLUMN     "productSize" TEXT,
ADD COLUMN     "salesCampaignId" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "tyDiscount" DECIMAL(10,2),
ADD COLUMN     "vatBaseAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "agreedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "agreedDeliveryDateExtendible" BOOLEAN,
ADD COLUMN     "agreedDeliveryExtensionEndDate" TIMESTAMP(3),
ADD COLUMN     "agreedDeliveryExtensionStartDate" TIMESTAMP(3),
ADD COLUMN     "cargoDeci" DECIMAL(10,2),
ADD COLUMN     "cargoProviderName" TEXT,
ADD COLUMN     "cargoSenderNumber" TEXT,
ADD COLUMN     "cargoTrackingLink" TEXT,
ADD COLUMN     "cargoTrackingNumber" TEXT,
ADD COLUMN     "commercial" BOOLEAN DEFAULT false,
ADD COLUMN     "containsDangerousProduct" BOOLEAN DEFAULT false,
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "currencyCode" TEXT DEFAULT 'TRY',
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerFirstName" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "customerLastName" TEXT,
ADD COLUMN     "deliveredByService" BOOLEAN DEFAULT false,
ADD COLUMN     "deliveryAddressType" TEXT,
ADD COLUMN     "deliveryType" TEXT DEFAULT 'normal',
ADD COLUMN     "estimatedDeliveryEndDate" TIMESTAMP(3),
ADD COLUMN     "estimatedDeliveryStartDate" TIMESTAMP(3),
ADD COLUMN     "etgbDate" TIMESTAMP(3),
ADD COLUMN     "etgbNo" TEXT,
ADD COLUMN     "extendedAgreedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "fastDelivery" BOOLEAN DEFAULT false,
ADD COLUMN     "fastDeliveryType" TEXT,
ADD COLUMN     "giftBoxRequested" BOOLEAN DEFAULT false,
ADD COLUMN     "grossAmount" DECIMAL(10,2),
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "identityNumber" TEXT,
ADD COLUMN     "invoiceAddress" JSONB,
ADD COLUMN     "invoiceLink" TEXT,
ADD COLUMN     "isCod" BOOLEAN DEFAULT false,
ADD COLUMN     "lastModifiedDate" TIMESTAMP(3),
ADD COLUMN     "micro" BOOLEAN DEFAULT false,
ADD COLUMN     "originPackageIds" JSONB,
ADD COLUMN     "originShipmentDate" TIMESTAMP(3),
ADD COLUMN     "packageHistories" JSONB,
ADD COLUMN     "scheduledDeliveryStoreId" TEXT,
ADD COLUMN     "shipmentAddress" JSONB,
ADD COLUMN     "shipmentPackageId" TEXT,
ADD COLUMN     "shipmentPackageStatus" TEXT,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "threePByTrendyol" BOOLEAN DEFAULT false,
ADD COLUMN     "timeSlotId" INTEGER,
ADD COLUMN     "totalDiscount" DECIMAL(10,2),
ADD COLUMN     "totalPrice" DECIMAL(10,2),
ADD COLUMN     "totalTyDiscount" DECIMAL(10,2),
ADD COLUMN     "whoPays" INTEGER;

-- AlterTable
ALTER TABLE "product_mappings" ADD COLUMN     "trendyolProductId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "stock_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockLogType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "oldStock" INTEGER NOT NULL,
    "newStock" INTEGER NOT NULL,
    "reason" TEXT,
    "reference" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trendyol_products" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productMainId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "brandId" INTEGER,
    "brandName" TEXT,
    "categoryId" INTEGER,
    "categoryName" TEXT,
    "stockCode" TEXT,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "listPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatRate" INTEGER NOT NULL DEFAULT 20,
    "dimensionalWeight" DECIMAL(8,2),
    "deliveryDuration" INTEGER,
    "cargoCompanyId" INTEGER,
    "shipmentAddressId" INTEGER,
    "returningAddressId" INTEGER,
    "locationBasedDelivery" TEXT,
    "lotNumber" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "onSale" BOOLEAN NOT NULL DEFAULT false,
    "gender" TEXT,
    "images" JSONB,
    "attributes" JSONB,
    "deliveryOption" JSONB,
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trendyol_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_logs_productId_idx" ON "stock_logs"("productId");

-- CreateIndex
CREATE INDEX "stock_logs_type_idx" ON "stock_logs"("type");

-- CreateIndex
CREATE INDEX "stock_logs_createdAt_idx" ON "stock_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "trendyol_products_barcode_key" ON "trendyol_products"("barcode");

-- CreateIndex
CREATE INDEX "trendyol_products_barcode_idx" ON "trendyol_products"("barcode");

-- CreateIndex
CREATE INDEX "trendyol_products_productMainId_idx" ON "trendyol_products"("productMainId");

-- CreateIndex
CREATE INDEX "trendyol_products_stockCode_idx" ON "trendyol_products"("stockCode");

-- CreateIndex
CREATE INDEX "trendyol_products_lastSyncAt_idx" ON "trendyol_products"("lastSyncAt");

-- CreateIndex
CREATE INDEX "order_items_barcode_idx" ON "order_items"("barcode");

-- CreateIndex
CREATE INDEX "order_items_sku_idx" ON "order_items"("sku");

-- CreateIndex
CREATE INDEX "orders_customerEmail_idx" ON "orders"("customerEmail");

-- CreateIndex
CREATE INDEX "orders_cargoTrackingNumber_idx" ON "orders"("cargoTrackingNumber");

-- CreateIndex
CREATE INDEX "product_mappings_trendyolProductId_idx" ON "product_mappings"("trendyolProductId");

-- AddForeignKey
ALTER TABLE "product_mappings" ADD CONSTRAINT "product_mappings_trendyolProductId_fkey" FOREIGN KEY ("trendyolProductId") REFERENCES "trendyol_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
