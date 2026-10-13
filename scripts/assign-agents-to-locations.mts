/**
 * One-off: link existing Retell agents to the location whose name appears in
 * the agent's name.
 *
 *   node --experimental-strip-types scripts/assign-agents-to-locations.mts          (plan only, writes nothing)
 *   node --experimental-strip-types scripts/assign-agents-to-locations.mts --apply  (inserts the links)
 *
 * Safe by design: it only ever INSERTS missing links. It never deletes or moves
 * a link, and an agent already linked to a different location is reported, not changed.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { findDuplicateLocationNames, matchAgentToLocation } from "../src/lib/location-matching.ts";

const apply = process.argv.includes("--apply");

const env = fs.readFileSync(".env.local", "utf8");
const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.replace(/^["']|["']$/g, "").trim();
const apiKey = get("RETELL_API_KEY");
if (!apiKey) throw new Error("RETELL_API_KEY is missing in .env.local");
process.env.DATABASE_URL = process.env.DATABASE_URL ?? get("DATABASE_URL");

// POST /v2/list-agents: one summary per agent (voice and chat), paginated.
async function listAllAgents(): Promise<{ agent_id: string; agent_name?: string | null }[]> {
  const agents: { agent_id: string; agent_name?: string | null }[] = [];
  let key: string | undefined;
  for (let page = 0; page < 50; page++) {
    const params = new URLSearchParams({ limit: "1000" });
    if (key) params.set("pagination_key", key);
    const path = `/v2/list-agents?${params}`;
    const res = await fetch(`https://api.retellai.com${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Retell ${path} failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    agents.push(...(data.items ?? []));
    if (!data.has_more || !data.pagination_key) return agents;
    key = data.pagination_key;
  }
  throw new Error("Retell agent list has too many pages");
}

const prisma = new PrismaClient();

try {
  const locations = await prisma.location.findMany({ select: { locationId: true, name: true } });
  const existing = await prisma.locationAgent.findMany({ select: { locationId: true, retellAgentId: true } });
  const linkedTo = new Map(existing.map((e) => [e.retellAgentId, e.locationId]));
  const nameOf = (id: string) => locations.find((l) => l.locationId === id)?.name ?? id;

  console.log(`Locations in the database: ${locations.length}`);
  for (const l of locations) {
    console.log(`  - ${l.name ?? "(no name)"}  [${l.locationId}]  already linked agents: ${existing.filter((e) => e.locationId === l.locationId).length}`);
  }
  const dupes = findDuplicateLocationNames(locations);
  if (dupes.length) console.log("\nWARNING: locations with the same name, matches to them will be flagged:", dupes);

  const all = await listAllAgents();
  const agents = all.filter((a) => !/\[test-chat:agent_[^\]]+\]$/.test(a.agent_name ?? ""));
  console.log(`\nAgents in Retell: ${agents.length} (from ${all.length} listed)`);

  const toInsert: { locationId: string; retellAgentId: string; agentName: string | null }[] = [];
  const counts = new Map<string, number>();
  const already: string[] = [];
  const conflicts: string[] = [];
  const ambiguous: string[] = [];
  const unmatched: string[] = [];

  for (const a of agents) {
    const r = matchAgentToLocation(a.agent_name, locations);
    const label = `${a.agent_name ?? "(unnamed)"} [${a.agent_id}]`;
    if (r.kind === "ambiguous") ambiguous.push(`${label} -> ${r.candidates.map(nameOf).join(" / ")} (${r.reason})`);
    else if (r.kind === "none") unmatched.push(`${label} (${r.reason})`);
    else {
      const current = linkedTo.get(a.agent_id);
      if (current === r.locationId) already.push(label);
      else if (current) conflicts.push(`${label}: linked to "${nameOf(current)}", name says "${nameOf(r.locationId)}"`);
      else {
        toInsert.push({ locationId: r.locationId, retellAgentId: a.agent_id, agentName: a.agent_name ?? null });
        counts.set(r.locationId, (counts.get(r.locationId) ?? 0) + 1);
      }
    }
  }

  console.log("\nPLAN");
  for (const [loc, n] of counts) console.log(`  + ${n} new link(s) to ${nameOf(loc)}`);
  console.log(`  = ${already.length} already linked correctly`);
  console.log(`  ! ${conflicts.length} already linked to a DIFFERENT location (left untouched)`);
  console.log(`  ? ${ambiguous.length} ambiguous (left untouched)`);
  console.log(`  - ${unmatched.length} without a matching location (left untouched)`);
  for (const c of conflicts) console.log("     conflict:", c);
  for (const c of ambiguous) console.log("     ambiguous:", c);
  for (const c of unmatched) console.log("     unmatched:", c);

  if (!apply) {
    console.log("\nDry run only. Nothing was written. Add --apply to insert the links.");
  } else if (toInsert.length === 0) {
    console.log("\nNothing to insert.");
  } else {
    const res = await prisma.locationAgent.createMany({ data: toInsert, skipDuplicates: true });
    console.log(`\nInserted ${res.count} link(s).`);
  }
} finally {
  await prisma.$disconnect();
}
