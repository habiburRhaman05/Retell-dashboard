import { describe, it, expect } from "vitest";
import { registerTenantSchema, updateTenantSchema, updateBrandingSchema } from "../schemas";

describe("registerTenantSchema", () => {
  it("accepts valid input", () => {
    const result = registerTenantSchema.safeParse({
      name: "Acme Corp",
      email: "admin@acme.com",
      crmLocationId: "loc_abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts without email", () => {
    const result = registerTenantSchema.safeParse({
      name: "Acme Corp",
      crmLocationId: "loc_abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = registerTenantSchema.safeParse({
      name: "",
      crmLocationId: "loc_abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing crmLocationId", () => {
    const result = registerTenantSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerTenantSchema.safeParse({
      name: "Test",
      email: "not-an-email",
      crmLocationId: "loc_1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = registerTenantSchema.safeParse({
      name: "A".repeat(101),
      crmLocationId: "loc_1",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTenantSchema", () => {
  it("accepts partial update", () => {
    expect(updateTenantSchema.safeParse({ name: "New Name" }).success).toBe(true);
    expect(updateTenantSchema.safeParse({ email: "new@email.com" }).success).toBe(true);
    expect(updateTenantSchema.safeParse({}).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(updateTenantSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("updateBrandingSchema", () => {
  it("accepts a valid primary color alone", () => {
    expect(updateBrandingSchema.safeParse({ brandPrimaryColor: "#1d6bf3" }).success).toBe(true);
  });

  it("accepts both colors", () => {
    const result = updateBrandingSchema.safeParse({
      brandPrimaryColor: "#1d6bf3",
      brandSecondaryColor: "#1558d6",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear a color", () => {
    expect(updateBrandingSchema.safeParse({ brandPrimaryColor: null }).success).toBe(true);
  });

  it("accepts an empty object (no-op update)", () => {
    expect(updateBrandingSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a 3-digit short hex", () => {
    expect(updateBrandingSchema.safeParse({ brandPrimaryColor: "#fff" }).success).toBe(false);
  });

  it("rejects a non-hex string", () => {
    expect(updateBrandingSchema.safeParse({ brandPrimaryColor: "blue" }).success).toBe(false);
  });

  it("rejects a hex color missing the #", () => {
    expect(updateBrandingSchema.safeParse({ brandPrimaryColor: "1d6bf3" }).success).toBe(false);
  });
});
