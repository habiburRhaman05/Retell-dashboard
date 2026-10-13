import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every API route must either be wrapped by an auth helper or be on the short,
// reviewed PUBLIC list below, and must have a test file. New routes cannot
// quietly skip either rule.

const API_DIR = path.join(process.cwd(), "src", "app", "api");

// Reachable without a session on purpose; each has its own proof of identity.
const PUBLIC: Record<string, string> = {
  "auth/admin/route.ts": "admin login (email and password)",
  "auth/admin/logout/route.ts": "clears the caller's own admin cookie",
  "auth/tenant/route.ts": "tenant login (signed link token or existing session)",
  "health/route.ts": "uptime probe, reveals nothing but status",
  "webhooks/retell/route.ts": "Retell webhook, verified by x-retell-signature",
};

// Routes that still lack a test file. This list may only shrink: when a route
// gets its test, the "stale entries" check below forces the entry to be removed.
const UNTESTED = new Set([
  "auth/admin/logout/route.ts",
  "retell/agents/[agentId]/chat/completion/route.ts",
  "retell/agents/[agentId]/chat/route.ts",
  "retell/agents/[agentId]/flow/route.ts",
  "retell/agents/[agentId]/simulate/route.ts",
  "retell/agents/[agentId]/versions/publish/route.ts",
  "retell/agents/[agentId]/versions/route.ts",
  "retell/agents/create/route.ts",
  "retell/knowledge-base/[kbId]/route.ts",
  "retell/knowledge-base/[kbId]/sources/[sourceId]/route.ts",
  "retell/knowledge-base/[kbId]/sources/route.ts",
  "retell/knowledge-base/available/route.ts",
  "retell/knowledge-base/import/route.ts",
  "retell/voices/preview/route.ts",
  "retell/voices/route.ts",
]);

function routes(dir = API_DIR): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return routes(p);
    return e.name === "route.ts" ? [path.relative(API_DIR, p).split(path.sep).join("/")] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(API_DIR, rel), "utf8");
const hasTest = (rel: string) => fs.existsSync(path.join(API_DIR, rel.replace("route.ts", "route.int.test.ts")));
const all = routes();

describe("route matrix", () => {
  it("finds the routes", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it("only allows reviewed routes to be public", () => {
    for (const rel of Object.keys(PUBLIC)) expect(all).toContain(rel);
  });

  it.each(all.filter((r) => !(r in PUBLIC)))("%s is wrapped by an auth helper on every method", (rel) => {
    const src = read(rel);
    // A bare `export async function GET(` would be reachable without a session.
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/);
    const methods = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*([\s\S]*?)\(/g)];
    expect(methods.length).toBeGreaterThan(0);
    for (const [, method, wrapper] of methods) {
      expect(["withTenantRoute", "withTenant", "withAdmin"], `${rel} ${method}`).toContain(wrapper.trim());
    }
  });

  it.each(all)("%s has a test file or is on the tracked list", (rel) => {
    expect(hasTest(rel) || UNTESTED.has(rel), `${rel} needs a route.int.test.ts`).toBe(true);
  });

  it("keeps the untested list honest: no entries for routes that now have tests or no longer exist", () => {
    for (const rel of UNTESTED) {
      expect(all, `${rel} no longer exists`).toContain(rel);
      expect(hasTest(rel), `${rel} now has a test: remove it from UNTESTED`).toBe(false);
    }
  });
});
