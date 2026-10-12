-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "admin_role" AS ENUM ('owner', 'support');

-- CreateEnum
CREATE TYPE "metric_type" AS ENUM ('AGENTS', 'KNOWLEDGE_BASES', 'CALL_MINUTES', 'CALLS', 'CONCURRENT_CALLS');

-- CreateEnum
CREATE TYPE "limit_period" AS ENUM ('monthly', 'lifetime');

-- CreateEnum
CREATE TYPE "limit_mode" AS ENUM ('hard', 'soft');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "crm_location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "status" "tenant_status" NOT NULL DEFAULT 'active',
    "retell_workspace" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_links" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "admin_role" NOT NULL DEFAULT 'support',
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limit_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "metric" "metric_type" NOT NULL,
    "period" "limit_period" NOT NULL DEFAULT 'monthly',
    "limit_value" INTEGER NOT NULL,
    "warn_at_pct" INTEGER NOT NULL DEFAULT 80,
    "mode" "limit_mode" NOT NULL DEFAULT 'hard',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limit_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "duration_sec" INTEGER,
    "cost_cents" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "metric" "metric_type" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_locks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "metric" "metric_type",
    "reason" TEXT,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cleared_at" TIMESTAMP(3),
    "saved_data" JSONB,

    CONSTRAINT "feature_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_features" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "tenant_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_inbox" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "call_id" TEXT,
    "raw_body" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_crm_location_id_key" ON "tenants"("crm_location_id");

-- CreateIndex
CREATE INDEX "access_links_token_hash_idx" ON "access_links"("token_hash");

-- CreateIndex
CREATE INDEX "access_links_tenant_id_idx" ON "access_links"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "limit_policies_tenant_id_idx" ON "limit_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "limit_policies_tenant_id_metric_key" ON "limit_policies"("tenant_id", "metric");

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_call_id_key" ON "usage_events"("call_id");

-- CreateIndex
CREATE INDEX "usage_events_tenant_id_idx" ON "usage_events"("tenant_id");

-- CreateIndex
CREATE INDEX "usage_events_tenant_id_started_at_idx" ON "usage_events"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "usage_events_agent_id_idx" ON "usage_events"("agent_id");

-- CreateIndex
CREATE INDEX "usage_counters_tenant_id_idx" ON "usage_counters"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_tenant_id_metric_period_start_key" ON "usage_counters"("tenant_id", "metric", "period_start");

-- CreateIndex
CREATE INDEX "feature_locks_tenant_id_idx" ON "feature_locks"("tenant_id");

-- CreateIndex
CREATE INDEX "feature_locks_tenant_id_feature_key_idx" ON "feature_locks"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "tenant_features_tenant_id_idx" ON "tenant_features"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_features_tenant_id_feature_key_key" ON "tenant_features"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "webhook_inbox_call_id_idx" ON "webhook_inbox"("call_id");

-- CreateIndex
CREATE INDEX "webhook_inbox_processed_at_idx" ON "webhook_inbox"("processed_at");

-- AddForeignKey
ALTER TABLE "access_links" ADD CONSTRAINT "access_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "limit_policies" ADD CONSTRAINT "limit_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_locks" ADD CONSTRAINT "feature_locks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
