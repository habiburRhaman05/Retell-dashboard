-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "company_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_company_id_key" ON "admin_users"("company_id");
