# Prompt playbook for Claude Code

Paste one prompt at a time. Start each in **plan mode**, read the plan, then approve. Claude Code reads `CLAUDE.md` automatically, so prompts do not repeat the vision or the rules.

How to use:
1. Finish a phase completely (all tests green) before the next.
2. After each phase, run the **Review prompt** (section 7).
3. Anything marked **DECISION** needs the boss's answer first; the prompt says what to assume if unanswered.

---

## 0. Generic template for any new requirement

```text
New requirement: <one sentence>.

Why: <the business reason>.
Scope: <what is in> / <what is out>.
Touches: <modules, tables, screens>.

Do this:
1. Read CLAUDE.md and the modules involved. Do not write code yet.
2. Reply with: the files you will change, the tests you will write, schema changes, and any assumption or question.
3. After I approve, implement test-first, one module at a time.

Acceptance criteria:
- <observable behaviour 1>
- <observable behaviour 2>
- Definition of Done in CLAUDE.md section 5 is met.

Do not: touch unrelated modules, change auth or schema without asking, call the real Retell.
```

---

## 1. Phase 1: Foundation (weeks 1 to 2)

### 1a. Test and CI setup

```text
Set up the quality foundation, no product features yet.
- Add Vitest, React Testing Library, and Playwright. Add scripts: test, test:unit, test:e2e, typecheck.
- Add a docker-compose PostgreSQL for tests and a test database helper that resets between tests.
- Add a Retell fake in src/modules/retell/fake.ts that implements the same interface as the real client (agents, LLMs, knowledge bases, calls, phone numbers) in memory.
- Add a GitHub Actions workflow: lint, typecheck, unit, integration. E2E on pull requests.
- Add ESLint no-restricted-imports rules for module boundaries (see CLAUDE.md section 4).
Acceptance: `npm test` runs and passes with at least one example test per layer. CI file is valid.
```

### 1b. Tests for existing pure code

```text
Write unit tests, with no behaviour changes, for: naming.ts, location-matching.ts, validators.ts, validation.ts, agent-names.ts, and the pure parts of flow-utils.ts.
Cover the edge cases already described in their comments (accents, plurals, brackets, ties, too-short names, name length limits).
If a test reveals a bug, do not fix it silently: list it in your reply and add the failing test marked as known.
```

### 1c. Prisma migrations

```text
The schema targets PostgreSQL but prisma/dev.db (SQLite) is in the repo and there is no migrations folder.
1. Remove dev.db from the repo and add *.db to .gitignore.
2. Create a baseline migration that matches the current schema so existing databases can adopt it.
3. Explain how to apply it to an existing production database without data loss.
Do not change models yet.
```

### 1d. Move Retell calls into one module

```text
Move src/lib/retell-api.ts into src/modules/retell/ (client.ts, types.ts, index.ts). Keep behaviour identical.
Make every route import Retell only through the module's index.
Add a rate limiter (token bucket) with retry and backoff on 429 and 5xx inside the client.
Add tests using the fake for the retry and error-mapping logic.
```

### 1e. Authentication and locked routes (needs plan approval)

```text
Implement tenant authentication.
- Add a tenants module: tenant lookup by crm_location_id, status (active, suspended).
- Add an auth module: sign and verify link tokens with jose (HS256, secret from validated env, expiry, revocation via access_links.token_hash).
- Add a withTenant() helper for route handlers: verifies the token (cookie or header), loads the tenant, passes tenantId to the handler. A tenantId in the URL, query or body must never be trusted: compare it with the token and reject a mismatch.
- Convert ALL existing /api/retell/* routes to use withTenant(). Remove DELETE /api/retell/agents/cleanup. Make /agents/import and /agents/available admin-only (stub 404 for now). Make /api/retell/llm/[llmId] check ownership through the agent mapping.
- Stop LocationNameSync from saving names from the URL. Make PUT /api/locations/[id] admin-only.
- Add the route-matrix test described in CLAUDE.md section 5.
Acceptance: no route works without a valid token; tenant A cannot read or change tenant B's agents, KBs, LLMs, flows, chats or simulations (tests for each); existing UI still works when opened with a valid link.
```

---

## 2. Phase 2: Admin panel v1 (weeks 3 to 4)

### 2a. Schema and admin auth (needs plan approval)

```text
Add the new tables from the design: tenants rename, access_links, admin_users, audit_log; rename location_agents to agents and location_knowledge_bases to knowledge_bases with status and created_by columns.
Write migrations that keep existing data (existing locations become active tenants).
Add Auth.js admin login with roles owner and support (support is read only). Add withAdmin(role) for /api/admin routes. Seed the first owner from an env var.
Tests: role checks on every admin route; a tenant token can never call an admin route.
```

### 2b. Register sub-account and get its URL

```text
Build the admin flow to register a sub-account.
- API: POST /api/admin/tenants { name, crmLocationId, limits? } creates the tenant, default limit policies, an access link, and returns the full URL to paste into the CRM.
- UI: /admin/tenants/new form with validation, and a copy button on the result.
- Duplicate crmLocationId or duplicate normalized name is rejected with a clear error (use findDuplicateLocationNames logic).
- Rotate and revoke the link from the tenant detail page. Write audit_log entries.
Tests: service, API (all cases in the Definition of Done), component states, and one Playwright test of the whole flow.
```

### 2c. Tenants overview and detail

```text
Build /admin (overview) and /admin/tenants/[id] with tabs Agents, Limits and usage (read only for now), Access.
- Overview: every tenant with agents used, minutes used and limit, calls, warning and locked badges. Sort by closest to limit. Paging for large lists.
- Agents tab: every agent the tenant created, with channel, creator, created date, and a naming-check badge when the name does not end with " - {tenant name}".
Read from our database only. Do not list all agents from Retell on these pages.
```

### 2d. Naming service

```text
Create one naming service in the tenants module that applies " - {tenant name}" using withLocationName.
Use it on agent create, agent rename (PATCH must re-apply the suffix), knowledge base create, and an admin action "rename tenant" that renames existing agents in Retell (batched, resumable, audited).
Tests: create, rename, long names, already-suffixed names, tenant rename propagation, partial failure and resume.
```

---

## 3. Phase 3: Usage metering (weeks 5 to 6)

### 3a. Spike: Retell behaviour we have not verified

```text
Spike, no production code. In a test Retell workspace (never production), find out and write down in docs/retell-findings.md:
1. What update-phone-number does when outbound_agents or inbound_agents is null or empty. Can we save and restore the previous binding?
2. The exact fields of the call_ended webhook (duration, cost) and of get-call.
3. How the inbound call webhook is configured and its payload (to_number, agent) and timeout.
4. Whether an agent has a maximum call duration setting and its field name.
Report evidence (request and response), not guesses. Update CLAUDE.md section 6 with what is now verified.
```

### 3b. Webhook, ledger and counters

```text
Implement usage metering.
- POST /api/webhooks/retell: verify x-retell-signature on the raw body, store the event in a webhook_inbox table, return 2xx immediately, then process.
- usage module: map agent_id to tenant, insert usage_events (unique call_id), update usage_counters in the same transaction. Unknown agent goes to a dead-letter status, not lost.
- Reconciliation job (scheduled route): list recent calls from Retell since the last checkpoint and fill any gap. Idempotent.
- Monthly period handling: counters keyed by period_start in the tenant's configured time zone (UTC by default).
Tests: signature failure, duplicate delivery counts once, 10 parallel deliveries of the same call, unknown agent, reconcile fills a missing call, period rollover.
```

### 3c. Analytics from our database

```text
Rewrite /api/retell/analytics to read usage_events instead of pulling up to 10,000 calls from Retell.
Keep the response shape so the UI is unchanged, remove the truncation, and add paging or aggregation in SQL. Add the needed indexes.
Tests: aggregates match a fixture; two tenants never see each other's data; large fixture performance check.
Gate: totals match Retell's own dashboard for a test tenant.
```

---

## 4. Phase 4: Limits and enforcement (weeks 7 to 8)

### 4a. Policies and LimitGuard

```text
Implement the limits module.
- limit_policies CRUD for admins (audited), with metric enum, period, limit, warn percentage, mode.
- LimitGuard.check(tenantId, metric, amount) returning allow, warn or block. Counted metrics (AGENTS, KNOWLEDGE_BASES) reserve atomically inside a transaction with a row lock.
- Error contract: HTTP 403 { code: "LIMIT_REACHED", metric, used, limit, message }.
- Apply the guard to: agent create (all create paths), knowledge base create, test call, test chat, simulation.
- Adding a new metric must need only: one enum value, one counter rule, one guard call. Write a test that proves it with a fake metric.
Tests: limit of 1 with 5 parallel creates gives exactly one success; soft mode warns but allows; period rollover resets; top-up raises the limit.
```

### 4b. Locks and disabling

```text
Implement the enforcement module.
- When a usage event pushes a counter to its limit, create a feature_locks row and run the disable actions for that metric:
  - block dashboard actions (via LimitGuard reading locks),
  - reject new inbound calls through the inbound webhook response { "reject": true } (answer fast; fail OPEN if our database is down and raise an alert),
  - outbound: per the spike result in docs/retell-findings.md, unbind outbound agents and save the old binding in saved_bindings.
- Clear locks when the admin raises the limit or the period rolls over, restoring saved bindings. Manual lock and unlock by admin, audited.
- Set each agent's maximum call length to no more than the minutes remaining, where Retell supports it.
Tests: lock at limit, lock idempotent on duplicate events, unlock restores bindings exactly, partial Retell failure retries, admin manual lock.
```

### 4c. UI messages and entitlements

```text
Build useEntitlements() (React Query) returning { enabled, used, limit, reason } per feature from GET /api/tenant/entitlements.
Use it in: create agent, create knowledge base, test call, test chat, simulate. Disabled controls show a tooltip. Add a top banner when any feature is warning or locked: "You have used 500 of 500 minutes this month. Contact support to raise your limit."
Add the admin Limits and usage tab (edit limits, top-up, lock and unlock, daily usage chart).
Tests: every component state; Playwright end to end: admin registers a tenant, opens its URL, creates agents until the limit, sees the message, admin raises the limit, create works again.
```

---

## 5. Phase 5: Rollout (week 9)

```text
Prepare for production.
1. Write a migration script to turn every existing location into a tenant with generous default limits, generate access links, and produce a CSV of tenant name and URL. Dry-run mode first; never delete data.
2. Load test the webhook and the tenant APIs with 50 tenants and 10,000 usage events; report p95 latency and fix indexes.
3. Add Sentry, structured logs, and alerts for: webhook delay over N minutes, reconciliation failures, lock creation, Retell 429 rate.
4. Restrict frame-ancestors to the CRM domains in next.config.ts (take them from env).
5. Write docs/runbook.md: how to unlock a tenant, replay a webhook, rotate keys, roll back a migration.
```

---

## 6. Recipes for later requirements

**Add a new limit type (for example chat messages):**
```text
Add a new limit metric CHAT_MESSAGES. Add the enum value, the counter rule fed by chat_ended webhooks, the LimitGuard call on the chat endpoints, the default policy for new tenants, the admin editor field and the entitlements entry. Test with the Definition of Done. Do not add a new table.
```

**Add a new tenant-facing feature:**
```text
Add <feature>. First list which limit it needs, whether it spends Retell credits, and which fields tenants may edit. Put the Retell calls in modules/retell, the rules in a service, and gate it with LimitGuard. Then tests per CLAUDE.md section 5.
```

**Add a second Retell workspace:**
```text
Use tenants.retell_workspace to pick the Retell API key per tenant. Make the Retell client take a workspace key. Update webhook verification to try the right key. Tests with two fake workspaces proving isolation.
```

---

## 7. Review prompt (run after every phase)

```text
Act as a strict reviewer who has not seen this code. Review the changes of this phase against CLAUDE.md.
Check: tenant isolation (any query without tenantId, any trust in URL or body IDs), every route authenticated and tested, LimitGuard on every spending action, webhook idempotency, naming rule, audit log, module boundaries, race conditions, and tests that assert nothing meaningful.
Run lint, typecheck and all tests and report the real results.
Output a ranked list: severity, file and line, what is wrong, how to fix. Do not fix anything yet.
```
