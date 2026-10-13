import { createHmac } from "crypto";

// Tests sign tokens the same way production does (HS256 JWT with an audience),
// but synchronously, so existing tests can build cookies without async setup.
export const TEST_SESSION_SECRET = "test-session-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

type Kind = "tenant-session" | "admin-session" | "tenant-link";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export function signTestToken(
  kind: Kind,
  claims: Record<string, string>,
  opts: { ttlSec?: number; secret?: string; nowSec?: number } = {}
): string {
  const { ttlSec = 3600, secret = TEST_SESSION_SECRET, nowSec = Math.floor(Date.now() / 1000) } = opts;
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({ ...claims, aud: kind, iat: nowSec, exp: nowSec + ttlSec });
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function tenantSessionToken(over: Record<string, string> = {}): string {
  return signTestToken("tenant-session", {
    tenantId: "t1",
    crmLocationId: "loc_1",
    tenantName: "Acme",
    status: "active",
    ...over,
  });
}

export function adminSessionToken(role: "owner" | "support" = "owner"): string {
  return signTestToken("admin-session", { adminId: "a1", email: "admin@test.com", role });
}

/** What prisma.tenant.findUnique answers for the live status check on tenant routes. */
export const liveTenant = (over: Record<string, string> = {}) => ({
  name: "Acme",
  status: "active",
  crmLocationId: "loc_1",
  ...over,
});

/** What prisma.adminUser.findUnique answers for the live check on admin routes. */
export const liveAdmin = (role: "owner" | "support" = "owner") => ({
  email: "admin@test.com",
  role,
});
