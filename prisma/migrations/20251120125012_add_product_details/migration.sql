-- AlterTable
ALTER TABLE "products" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "images" JSONB,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "listPrice" DECIMAL(10,2),
ADD COLUMN     "stockCode" TEXT,
ADD COLUMN     "vatRate" INTEGER;

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");
