-- AlterTable
ALTER TABLE "stock_logs" ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "stock_logs_orderId_idx" ON "stock_logs"("orderId");

-- AddForeignKey
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
