import { prisma } from "@/lib/prisma";
import type { TenantStatus } from "@prisma/client";

export async function findTenantByLocationId(crmLocationId: string) {
  return prisma.tenant.findUnique({ where: { crmLocationId } });
}

export async function findTenantById(id: string) {
  return prisma.tenant.findUnique({ where: { id } });
}

export async function listTenants() {
  return prisma.tenant.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createTenant(data: {
  crmLocationId: string;
  name: string;
  email?: string;
}) {
  const tenant = await prisma.tenant.create({ data });

  // Keep the Location table in sync so agent/KB naming uses the tenant name.
  await prisma.location.upsert({
    where: { locationId: data.crmLocationId },
    create: { locationId: data.crmLocationId, name: data.name },
    update: { name: data.name },
  });

  return tenant;
}

export async function updateTenant(
  id: string,
  data: { name?: string; email?: string; status?: TenantStatus }
) {
  const tenant = await prisma.tenant.update({ where: { id }, data });

  // If the name changed, keep the Location table in sync.
  if (data.name) {
    await prisma.location.updateMany({
      where: { locationId: tenant.crmLocationId },
      data: { name: data.name },
    });
  }

  return tenant;
}

export async function getLocationName(locationId: string): Promise<string | null> {
  const loc = await prisma.location.findUnique({
    where: { locationId },
    select: { name: true },
  });
  return loc?.name ?? null;
}
