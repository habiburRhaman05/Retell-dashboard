import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyRetellSignature } from "../webhook";

describe("verifyRetellSignature", () => {
  const secret = "test-secret-key";
  const body = '{"event":"call_ended","call":{"call_id":"c1"}}';

  function validSig(raw: string) {
    return createHmac("sha256", secret).update(raw).digest("hex");
  }

  it("returns true for valid signature", () => {
    expect(verifyRetellSignature(body, validSig(body), secret)).toBe(true);
  });

  it("returns false for wrong signature", () => {
    expect(verifyRetellSignature(body, "invalid-sig", secret)).toBe(false);
  });

  it("returns false for null signature", () => {
    expect(verifyRetellSignature(body, null, secret)).toBe(false);
  });

  it("returns false for empty secret", () => {
    expect(verifyRetellSignature(body, validSig(body), "")).toBe(false);
  });

  it("returns false for different body", () => {
    const sig = validSig(body);
    expect(verifyRetellSignature('{"different":"body"}', sig, secret)).toBe(false);
  });
});
