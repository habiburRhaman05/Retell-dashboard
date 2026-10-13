-- CreateEnum
CREATE TYPE "retell_item_type" AS ENUM ('agent', 'knowledge_base');

-- AlterTable
ALTER TABLE "location_agents" ADD COLUMN     "assigned_by" TEXT;

-- AlterTable
ALTER TABLE "location_knowledge_bases" ADD COLUMN     "assigned_by" TEXT;

-- CreateTable
CREATE TABLE "private_retell_items" (
    "id" TEXT NOT NULL,
    "retell_id" TEXT NOT NULL,
    "item_type" "retell_item_type" NOT NULL,
    "marked_by" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "private_retell_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "private_retell_items_item_type_idx" ON "private_retell_items"("item_type");

-- CreateIndex
CREATE UNIQUE INDEX "private_retell_items_retell_id_item_type_key" ON "private_retell_items"("retell_id", "item_type");
