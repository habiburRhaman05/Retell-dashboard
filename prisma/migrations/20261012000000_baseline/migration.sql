-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_agents" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "retell_agent_id" TEXT NOT NULL,
    "agent_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_knowledge_bases" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "retell_knowledge_base_id" TEXT NOT NULL,
    "knowledge_base_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_location_id_key" ON "locations"("location_id");

-- CreateIndex
CREATE INDEX "location_agents_location_id_idx" ON "location_agents"("location_id");

-- CreateIndex
CREATE INDEX "location_agents_retell_agent_id_idx" ON "location_agents"("retell_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "location_agents_location_id_retell_agent_id_key" ON "location_agents"("location_id", "retell_agent_id");

-- CreateIndex
CREATE INDEX "location_knowledge_bases_location_id_idx" ON "location_knowledge_bases"("location_id");

-- CreateIndex
CREATE INDEX "location_knowledge_bases_retell_knowledge_base_id_idx" ON "location_knowledge_bases"("retell_knowledge_base_id");

-- CreateIndex
CREATE UNIQUE INDEX "location_knowledge_bases_location_id_retell_knowledge_base__key" ON "location_knowledge_bases"("location_id", "retell_knowledge_base_id");

-- AddForeignKey
ALTER TABLE "location_agents" ADD CONSTRAINT "location_agents_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_knowledge_bases" ADD CONSTRAINT "location_knowledge_bases_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;
