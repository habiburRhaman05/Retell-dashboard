import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyRetellSignature } from "../webhook";

describe("verifyRetellSignature", () => {
  const apiKey = "key_test_abc";
  const body = '{"event":"call_ended","call":{"call_id":"c1"}}';
  const now = 1_700_000_000_000;

  // Retell's format: v={timestamp_ms},d=HMAC-SHA256(body + timestamp, apiKey)
  function sign(raw: string, ts = now, key = apiKey) {
    const digest = createHmac("sha256", key).update(raw + String(ts)).digest("hex");
    return `v=${ts},d=${digest}`;
  }

  it("accepts a correctly signed webhook", () => {
    expect(verifyRetellSignature(body, sign(body), apiKey, now)).toBe(true);
  });

  it("accepts a timestamp just inside the 5 minute window, either direction", () => {
    expect(verifyRetellSignature(body, sign(body, now - 299_000), apiKey, now)).toBe(true);
    expect(verifyRetellSignature(body, sign(body, now + 299_000), apiKey, now)).toBe(true);
  });

  it("rejects a replayed webhook older than 5 minutes", () => {
    expect(verifyRetellSignature(body, sign(body, now - 301_000), apiKey, now)).toBe(false);
  });

  it("rejects a timestamp too far in the future", () => {
    expect(verifyRetellSignature(body, sign(body, now + 301_000), apiKey, now)).toBe(false);
  });

  it("rejects the old plain-hex format", () => {
    const plain = createHmac("sha256", apiKey).update(body).digest("hex");
    expect(verifyRetellSignature(body, plain, apiKey, now)).toBe(false);
  });

  it("rejects a signature made with a different key", () => {
    expect(verifyRetellSignature(body, sign(body, now, "key_other"), apiKey, now)).toBe(false);
  });

  it("rejects a body that was changed after signing", () => {
    expect(verifyRetellSignature('{"different":"body"}', sign(body), apiKey, now)).toBe(false);
  });

  it("rejects a tampered timestamp", () => {
    const sig = sign(body, now);
    const tampered = sig.replace(`v=${now}`, `v=${now + 1}`);
    expect(verifyRetellSignature(body, tampered, apiKey, now)).toBe(false);
  });

  it("rejects missing, malformed or truncated signatures", () => {
    expect(verifyRetellSignature(body, null, apiKey, now)).toBe(false);
    expect(verifyRetellSignature(body, "", apiKey, now)).toBe(false);
    expect(verifyRetellSignature(body, "garbage", apiKey, now)).toBe(false);
    expect(verifyRetellSignature(body, `v=${now},d=`, apiKey, now)).toBe(false);
    expect(verifyRetellSignature(body, `v=${now},d=abc123`, apiKey, now)).toBe(false);
    expect(verifyRetellSignature(body, `v=${now},d=zz`, apiKey, now)).toBe(false);
  });

  it("rejects everything when no API key is configured", () => {
    expect(verifyRetellSignature(body, sign(body, now, ""), "", now)).toBe(false);
    expect(verifyRetellSignature(body, sign(body, now, " "), " ", now)).toBe(false);
  });
});
