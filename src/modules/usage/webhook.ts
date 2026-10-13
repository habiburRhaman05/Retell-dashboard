import { createHmac, timingSafeEqual } from "crypto";

const TOLERANCE_MS = 5 * 60 * 1000;
const SIGNATURE_FORMAT = /^v=(\d+),d=([0-9a-fA-F]+)$/;

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "no_api_key" | "no_header" | "bad_format" | "digest_mismatch" }
  | { ok: false; reason: "stale_timestamp"; skewMs: number };

/**
 * Retell signs each webhook as `x-retell-signature: v={timestamp_ms},d={digest}`,
 * where digest = HMAC-SHA256(rawBody + timestamp) keyed with the API key that has
 * the webhook badge. Old timestamps are rejected to stop replays. The reason for
 * a rejection is returned so it can be logged; it never contains key material.
 */
export function checkRetellSignature(
  rawBody: string,
  signature: string | null,
  apiKey: string,
  now: number = Date.now()
): SignatureCheck {
  if (!apiKey.trim()) return { ok: false, reason: "no_api_key" };
  if (!signature) return { ok: false, reason: "no_header" };

  const match = SIGNATURE_FORMAT.exec(signature);
  if (!match) return { ok: false, reason: "bad_format" };
  const [, timestamp, digest] = match;

  const skewMs = now - Number(timestamp);
  if (Math.abs(skewMs) > TOLERANCE_MS) return { ok: false, reason: "stale_timestamp", skewMs };

  const expected = createHmac("sha256", apiKey).update(rawBody + timestamp).digest();
  const received = Buffer.from(digest, "hex");
  const same = received.length === expected.length && timingSafeEqual(received, expected);
  return same ? { ok: true } : { ok: false, reason: "digest_mismatch" };
}

export function verifyRetellSignature(
  rawBody: string,
  signature: string | null,
  apiKey: string,
  now: number = Date.now()
): boolean {
  return checkRetellSignature(rawBody, signature, apiKey, now).ok;
}
