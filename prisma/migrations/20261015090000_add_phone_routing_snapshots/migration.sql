CREATE TABLE "phone_routing_snapshots" (
    "id" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "before_routes" JSONB NOT NULL,
    "expected_routes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_routing_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "phone_routing_snapshots_phone_number_key" ON "phone_routing_snapshots"("phone_number");
CREATE INDEX "phone_routing_snapshots_status_idx" ON "phone_routing_snapshots"("status");