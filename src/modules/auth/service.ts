import { prisma } from "@/lib/prisma";
import * as crypto from "crypto";

export interface TenantSession {
  tenantId: string;
  crmLocationId: string;
  tenantName: string;
  status: "active" | "suspended";
}

export interface AdminSession {
  adminId: string;
  email: string;
  role: "owner" | "support";
}

export async function verifyTenantAccess(
  crmLocationId: string
): Promise<TenantSession | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { crmLocationId },
  });
  if (!tenant) return null;
  return {
    tenantId: tenant.id,
    crmLocationId: tenant.crmLocationId,
    tenantName: tenant.name,
    status: tenant.status,
  };
}

export async function verifyAdminLogin(
  email: string,
  password: string
): Promise<AdminSession | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return null;
  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (hash !== admin.passwordHash) return null;
  return {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
  };
}

export async function createAdminUser(data: {
  email: string;
  name?: string;
  password: string;
  role?: "owner" | "support";
}) {
  const passwordHash = crypto.createHash("sha256").update(data.password).digest("hex");
  return prisma.adminUser.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      role: data.role ?? "support",
    },
  });
}
