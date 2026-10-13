import { SignJWT, jwtVerify } from "jose";

// Each kind of token has its own audience, so a token minted for one purpose
// (e.g. a dashboard link) can never be replayed as another (e.g. an admin session).
export type TokenKind = "tenant-session" | "admin-session" | "tenant-link";

export const TENANT_SESSION_TTL_SEC = 60 * 60 * 24;
export const ADMIN_SESSION_TTL_SEC = 60 * 60 * 8;
export const TENANT_LINK_TTL_SEC = 60 * 60 * 24 * 365;

const MIN_SECRET_LENGTH = 32;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  // Failing loudly beats silently accepting forged sessions.
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(
  kind: TokenKind,
  claims: Record<string, string>,
  ttlSeconds: number
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(kind)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

/** The claims of a valid, unexpired token of this kind, or null. */
export async function verifyToken(
  kind: TokenKind,
  token: string
): Promise<Record<string, string> | null> {
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { audience: kind, algorithms: ["HS256"] });
    const claims: Record<string, string> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === "string" && k !== "aud") claims[k] = v;
    }
    return claims;
  } catch {
    return null;
  }
}

export async function createTenantLinkToken(crmLocationId: string): Promise<string> {
  return signToken("tenant-link", { loc: crmLocationId }, TENANT_LINK_TTL_SEC);
}

/** The CRM location id a dashboard link was minted for, or null. */
export async function verifyTenantLinkToken(token: string): Promise<string | null> {
  const claims = await verifyToken("tenant-link", token);
  return claims?.loc || null;
}
