import { createHmac, timingSafeEqual } from "crypto";

const TOLERANCE_MS = 5 * 60 * 1000;
const SIGNATURE_FORMAT = /^v=(\d+),d=([0-9a-fA-F]+)$/;

/**
 * Retell signs each webhook as `x-retell-signature: v={timestamp_ms},d={digest}`,
 * where digest = HMAC-SHA256(rawBody + timestamp) keyed with the API key that has
 * the webhook badge. Old timestamps are rejected to stop replays.
 */
export function verifyRetellSignature(
  rawBody: string,
  signature: string | null,
  apiKey: string,
  now: number = Date.now()
): boolean {
  if (!signature || !apiKey.trim()) return false;

  const match = SIGNATURE_FORMAT.exec(signature);
  if (!match) return false;
  const [, timestamp, digest] = match;

  if (Math.abs(now - Number(timestamp)) > TOLERANCE_MS) return false;

  const expected = createHmac("sha256", apiKey).update(rawBody + timestamp).digest();
  const received = Buffer.from(digest, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
