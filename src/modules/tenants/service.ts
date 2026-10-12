import * as repo from "./repository";

export async function getTenantByLocationId(crmLocationId: string) {
  return repo.findTenantByLocationId(crmLocationId);
}

export async function getTenantById(id: string) {
  return repo.findTenantById(id);
}

export async function registerTenant(data: {
  crmLocationId: string;
  name: string;
  email?: string;
}) {
  const existing = await repo.findTenantByLocationId(data.crmLocationId);
  if (existing) {
    throw Object.assign(new Error("A tenant with this location ID already exists"), {
      code: "DUPLICATE_LOCATION_ID",
    });
  }
  return repo.createTenant(data);
}

export async function listAllTenants() {
  return repo.listTenants();
}

export async function updateTenant(
  id: string,
  data: { name?: string; email?: string }
) {
  return repo.updateTenant(id, data);
}

export async function suspendTenant(id: string) {
  return repo.updateTenant(id, { status: "suspended" });
}

export async function reactivateTenant(id: string) {
  return repo.updateTenant(id, { status: "active" });
}
