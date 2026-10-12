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
  return prisma.tenant.create({ data });
}

export async function updateTenant(
  id: string,
  data: { name?: string; email?: string; status?: TenantStatus }
) {
  return prisma.tenant.update({ where: { id }, data });
}

export async function getLocationName(locationId: string): Promise<string | null> {
  const loc = await prisma.location.findUnique({
    where: { locationId },
    select: { name: true },
  });
  return loc?.name ?? null;
}
