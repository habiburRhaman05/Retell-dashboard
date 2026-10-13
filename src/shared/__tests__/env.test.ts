import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

let validateEnv: typeof import("../env").validateEnv;

describe("validateEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    const mod = await import("../env");
    validateEnv = mod.validateEnv;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("validates successfully with required env vars", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/testdb";
    process.env.RETELL_API_KEY = "key_abc123";
    const env = validateEnv();
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/testdb");
    expect(env.RETELL_API_KEY).toBe("key_abc123");
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    process.env.RETELL_API_KEY = "key_abc123";
    expect(() => validateEnv()).toThrow("Environment validation failed");
  });

  it("throws when RETELL_API_KEY is missing", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/testdb";
    delete process.env.RETELL_API_KEY;
    expect(() => validateEnv()).toThrow("Environment validation failed");
  });

  it("applies defaults for optional fields", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/testdb";
    process.env.RETELL_API_KEY = "key_abc123";
    const env = validateEnv();
    expect(["development", "test", "production"]).toContain(env.NODE_ENV);
    expect(env.ALLOWED_FRAME_ANCESTORS).toBe("");
  });

  it("accepts valid NODE_ENV values", () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/testdb";
    process.env.RETELL_API_KEY = "key_abc123";
    (process.env as Record<string, string>).NODE_ENV = "production";
    const env = validateEnv();
    expect(env.NODE_ENV).toBe("production");
  });

  it("error message includes the failing field name", () => {
    delete process.env.DATABASE_URL;
    delete process.env.RETELL_API_KEY;
    try {
      validateEnv();
      expect.fail("Should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("DATABASE_URL");
      expect(msg).toContain("RETELL_API_KEY");
    }
  });
});
