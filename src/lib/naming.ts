/**
 * Names for new agents and knowledge bases are saved as "{name} - {location name}",
 * so resources from different sub-accounts are easy to tell apart.
 */
export function withLocationName(
  base: string,
  locationName: string | null | undefined,
  maxLen?: number
): { full: string; shortened: boolean } {
  const name = base.trim();
  const loc = (locationName ?? "").trim();
  if (!name || !loc) return { full: name, shortened: false };

  // Typed twice, or already formatted: leave it alone.
  if (name.toLowerCase().endsWith(` - ${loc}`.toLowerCase())) {
    return { full: name, shortened: false };
  }

  let suffix = ` - ${loc}`;
  let shortened = false;

  if (maxLen !== undefined) {
    // Keep the location part short enough that the typed name still has room.
    const maxSuffix = Math.min(suffix.length, 22);
    if (suffix.length > maxSuffix) {
      suffix = `${suffix.slice(0, maxSuffix - 1)}…`;
      shortened = true;
    }
    const room = Math.max(1, maxLen - suffix.length);
    if (name.length > room) {
      return { full: `${name.slice(0, room).trimEnd()}${suffix}`, shortened: true };
    }
  }
  return { full: `${name}${suffix}`, shortened };
}
