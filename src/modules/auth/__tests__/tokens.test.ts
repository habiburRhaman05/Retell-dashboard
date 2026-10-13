import { describe, it, expect, afterEach } from "vitest";
import { createTenantLinkToken, signToken, verifyTenantLinkToken, verifyToken } from "../tokens";
import { signTestToken } from "@/test/auth";

const original = process.env.SESSION_SECRET;
afterEach(() => {
  process.env.SESSION_SECRET = original;
});

describe("signToken / verifyToken", () => {
  it("round-trips string claims", async () => {
    const token = await signToken("tenant-session", { tenantId: "t1", crmLocationId: "loc_1" }, 60);
    expect(await verifyToken("tenant-session", token)).toMatchObject({ tenantId: "t1", crmLocationId: "loc_1" });
  });

  it("does not leak the audience or timestamps as claims the caller could mistake for data", async () => {
    const token = await signToken("tenant-session", { a: "1" }, 60);
    const claims = await verifyToken("tenant-session", token);
    expect(claims).not.toHaveProperty("aud");
  });

  it("rejects a token of another kind", async () => {
    const token = await signToken("tenant-link", { loc: "loc_1" }, 60);
    expect(await verifyToken("tenant-session", token)).toBeNull();
    expect(await verifyToken("admin-session", token)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const forged = signTestToken("tenant-session", { tenantId: "t1" }, { secret: "x".repeat(40) });
    expect(await verifyToken("tenant-session", forged)).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signToken("admin-session", { role: "support" }, 60);
    const [h, , s] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ role: "owner", aud: "admin-session", exp: 9999999999 })).toString("base64url");
    expect(await verifyToken("admin-session", `${h}.${evil}.${s}`)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const old = signTestToken("tenant-session", { tenantId: "t1" }, { nowSec: Math.floor(Date.now() / 1000) - 3600, ttlSec: 10 });
    expect(await verifyToken("tenant-session", old)).toBeNull();
  });

  it("rejects an unsigned (alg none) token", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ aud: "admin-session", role: "owner" })}.`;
    expect(await verifyToken("admin-session", none)).toBeNull();
  });

  it("rejects garbage", async () => {
    for (const bad of ["", "abc", "a.b.c", "....", Buffer.from("{}").toString("base64")]) {
      expect(await verifyToken("tenant-session", bad)).toBeNull();
    }
  });

  it("throws instead of signing when SESSION_SECRET is missing or weak", async () => {
    delete process.env.SESSION_SECRET;
    await expect(signToken("tenant-session", { a: "1" }, 60)).rejects.toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = "too-short";
    await expect(signToken("tenant-session", { a: "1" }, 60)).rejects.toThrow(/SESSION_SECRET/);
    await expect(verifyToken("tenant-session", "a.b.c")).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("tenant link tokens", () => {
  it("carry the location id they were minted for", async () => {
    const token = await createTenantLinkToken("loc_42");
    expect(await verifyTenantLinkToken(token)).toBe("loc_42");
  });

  it("cannot be forged for another location", async () => {
    const token = await createTenantLinkToken("loc_42");
    const [h, , s] = token.split(".");
    const evil = Buffer.from(JSON.stringify({ loc: "loc_victim", aud: "tenant-link", exp: 9999999999 })).toString("base64url");
    expect(await verifyTenantLinkToken(`${h}.${evil}.${s}`)).toBeNull();
  });

  it("are not accepted when they are really a session token", async () => {
    const session = await signToken("tenant-session", { loc: "loc_42" }, 60);
    expect(await verifyTenantLinkToken(session)).toBeNull();
  });

  it("return null for garbage", async () => {
    expect(await verifyTenantLinkToken("nope")).toBeNull();
  });
});
