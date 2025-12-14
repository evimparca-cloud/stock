-- DropIndex
DROP INDEX "marketplaces_name_key";

-- AlterTable
ALTER TABLE "marketplaces" ADD COLUMN     "storeName" TEXT;
