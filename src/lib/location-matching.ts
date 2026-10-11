/**
 * Decides which location an agent belongs to from its name.
 *
 * Agents are named like "HVAC - Inbound-(Bright AI Solutions)-HVAC Calendar":
 * the location name appears in the agent name, usually inside brackets. No
 * imports on purpose, so scripts can use this file too.
 *
 * Edge cases handled:
 * - capitals, punctuation, extra spaces and accents ("Café" matches "cafe")
 * - "&" and "and" read the same, apostrophes are ignored
 * - plural endings ("Solution" matches "Solutions")
 * - whole words only, so a location called "Spa" never matches "Spanish"
 * - a location name that is part of a longer one ("Bright Solution" inside
 *   "Bright AI Solution") does not match unless its words really follow each other
 * - a match inside brackets beats a match elsewhere in the name
 * - the longest matching location name wins; a true tie is flagged, never guessed
 * - names too short to trust (under 4 letters, e.g. "Spa") are never auto-matched
 * - locations without a name, and agents without a name, are left alone
 */

export interface MatchLocation {
  locationId: string;
  name: string | null;
}

export type MatchResult =
  | { kind: "match"; locationId: string; reason: string }
  | { kind: "ambiguous"; candidates: string[]; reason: string }
  | { kind: "none"; reason: string };

const MIN_KEY_LETTERS = 4;

export function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function stem(token: string): string {
  return token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token;
}

export function tokens(input: string): string[] {
  const n = normalizeName(input);
  return n ? n.split(" ").map(stem) : [];
}

/** True when `needle` appears as consecutive whole words inside `hay`. */
function containsSequence(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i <= hay.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** Text inside round, square or curly brackets: "a-(B c)-d" gives ["B c"]. */
function bracketGroups(name: string): string[] {
  const out: string[] = [];
  const re = /[(\[{]([^)\]}]*)[)\]}]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name)) !== null) out.push(m[1]);
  return out;
}

export function matchAgentToLocation(agentName: string | null | undefined, locations: MatchLocation[]): MatchResult {
  const name = (agentName ?? "").trim();
  if (!name) return { kind: "none", reason: "The agent has no name" };

  const agentTokens = tokens(name);
  const groups = bracketGroups(name).map(tokens);

  const keyed = locations
    .map((l) => ({ locationId: l.locationId, key: tokens(l.name ?? "") }))
    .filter((l) => l.key.length > 0 && l.key.join("").length >= MIN_KEY_LETTERS);

  const hits = keyed
    .filter((l) => containsSequence(agentTokens, l.key))
    .map((l) => ({
      locationId: l.locationId,
      words: l.key.length,
      inBrackets: groups.some((g) => containsSequence(g, l.key)),
    }));

  if (hits.length === 0) return { kind: "none", reason: "No location name appears in the agent name" };
  if (hits.length === 1) {
    return { kind: "match", locationId: hits[0].locationId, reason: hits[0].inBrackets ? "Name in brackets" : "Name in agent name" };
  }

  // Several locations match: a match inside brackets wins, then the longest name.
  const inside = hits.filter((h) => h.inBrackets);
  const pool = inside.length > 0 ? inside : hits;
  const longest = Math.max(...pool.map((h) => h.words));
  const best = pool.filter((h) => h.words === longest);
  if (best.length === 1) {
    return {
      kind: "match",
      locationId: best[0].locationId,
      reason: inside.length > 0 ? "Several names matched; the one in brackets wins" : "Several names matched; the longest wins",
    };
  }
  return {
    kind: "ambiguous",
    candidates: best.map((b) => b.locationId),
    reason: "Several locations match equally well",
  };
}

/** Two locations whose names normalise to the same words cannot be told apart. */
export function findDuplicateLocationNames(locations: MatchLocation[]): string[][] {
  const byKey = new Map<string, string[]>();
  for (const l of locations) {
    const key = tokens(l.name ?? "").join(" ");
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), l.locationId]);
  }
  return [...byKey.values()].filter((ids) => ids.length > 1);
}
