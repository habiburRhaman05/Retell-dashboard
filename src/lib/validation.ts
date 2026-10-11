/** Shared input checks, so forms catch mistakes before Retell rejects them. */

export const TOOL_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** Removes spaces, dashes, dots and brackets people type into phone numbers. */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s().-]/g, "");
}

/** E.164: a plus sign, a country code that does not start with 0, then up to 15 digits in total. */
export function isE164(input: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(normalizePhone(input));
}

/** Returns an error message, or null when the number is acceptable. */
export function phoneError(input: string, { required = false } = {}): string | null {
  const v = normalizePhone(input);
  if (!v) return required ? "Enter a phone number" : null;
  if (!v.startsWith("+")) return "Start with + and the country code, e.g. +14155551234";
  if (!/^\+\d+$/.test(v)) return "Use digits only after the +";
  if (v.length < 8) return "That number is too short";
  if (v.length > 16) return "That number is too long (15 digits at most)";
  if (v[1] === "0") return "The country code cannot start with 0";
  return null;
}

export function isHttpUrl(input: string): boolean {
  try {
    const u = new URL(input.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

export function urlError(input: string, { required = true } = {}): string | null {
  const v = input.trim();
  if (!v) return required ? "Enter the URL" : null;
  if (!isHttpUrl(v)) return "Enter a full URL starting with http:// or https://";
  return null;
}

export function toolNameError(name: string, taken: string[]): string | null {
  const v = name.trim();
  if (!v) return "Give the function a name";
  if (!TOOL_NAME_RE.test(v)) return "Use letters, numbers, underscores and dashes only (64 characters at most)";
  if (taken.some((t) => t.toLowerCase() === v.toLowerCase())) return `"${v}" is already used by another function`;
  return null;
}

export function jsonObjectError(text: string): string | null {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "Must be a JSON object, like { ... }";
    }
    return null;
  } catch {
    return "Not valid JSON. Check for missing commas, quotes or brackets";
  }
}
