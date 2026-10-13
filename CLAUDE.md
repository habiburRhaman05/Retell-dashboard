@AGENTS.md

# CLAUDE.md: Retell SaaS Platform

Read this file fully before every task. Task prompts live in `docs/PROMPTS.md`.

## 1. Vision

We are turning a single-customer Retell dashboard into a **multi-tenant SaaS**.

- We (the operator) own **one paid Retell account**. All agents of all customers live inside it.
- Each customer is a **sub-account** (a CRM "location"). In code we call it a **tenant**.
- Tenants get a safe, simple dashboard for their own agents and knowledge bases.
- We run an **admin panel** where we register tenants, see everything they create, and set **limits** on what each may use.
- When a tenant reaches a limit, **that feature is switched off for that tenant** and the UI says so clearly. Nothing else is affected.
- The product must be **scalable, secure and fully tested**. Quality is part of the feature, not an extra.

The one-line test for any change: *does it keep tenants isolated, measured and limited?*

## 2. Glossary (use these words in code, tests and UI)

| Term | Meaning |
| --- | --- |
| Tenant | One sub-account. DB table `tenants` (renamed from `locations`). `crm_location_id` is the ID the CRM sends |
| Admin | Our team member using `/admin`. Roles: `owner`, `support` (read only) |
| Metric | A thing we limit: `AGENTS`, `KNOWLEDGE_BASES`, `CALL_MINUTES`, `CALLS`, `CONCURRENT_CALLS` (extendable enum) |
| Limit policy | One row per tenant per metric: value, period (monthly or lifetime), warn percentage, mode (hard or soft) |
| Usage event | One immutable row per finished call or chat, written from a Retell webhook, unique on `call_id` |
| Counter | Running total per tenant, metric and period, updated in the same transaction as the usage event |
| Lock | A row that says "feature X is off for tenant Y, because of limit Z". Created and cleared automatically or by an admin |

## 3. Business rules (never break these)

1. **Tenant identity comes from the server, never from the request.** The tenant ID is taken from the verified signed link token (tenant routes) and never from a URL parameter, query string or body field. The admin panel uses a separate login and a separate API prefix.
2. **Every repository function takes `tenantId`** and filters by it. No query may return another tenant's rows.
3. **Only `modules/retell` calls Retell.** Nothing else imports `fetch` against `api.retellai.com`.
4. **Every action that creates, spends or changes something passes `LimitGuard`** before it runs. A blocked action returns HTTP 403 with `{ code: "LIMIT_REACHED", metric, used, limit, message }`.
5. **Counted limits (agents, knowledge bases) are checked inside one database transaction** with a lock on the tenant's policy row, so parallel requests cannot exceed the limit.
6. **Usage comes from Retell webhooks, not from live Retell queries.** Webhook handling is idempotent (unique `call_id`), verifies `x-retell-signature` against the raw body, and returns 2xx fast.
7. **Naming rule:** every agent and knowledge base name ends with ` - {tenant name}`. One naming service applies it on create, rename and sync. Tenants cannot change their own tenant name.
8. **Tenants may edit only allow-listed agent fields** and allow-listed models. Never forward a request body to Retell unfiltered.
9. **Agents are never deleted by enforcement.** A lock disables use; clearing the lock restores it, including any saved phone-number bindings.
10. **Every admin change is written to `audit_log`.**
11. **Limit-reached state is shown, never hidden:** buttons disabled with a reason, plus a banner with the numbers.

## 4. Architecture: modular monolith

```text
src/
  app/                      routing only: pages and thin route handlers
    (tenant)/retell/[locationId]/...
    admin/...
    api/tenant/...          session-scoped endpoints
    api/admin/...           admin-only endpoints
    api/webhooks/retell/    call_ended, inbound call
  modules/
    retell/                 the ONLY Retell caller: client, types, fake for tests
    tenants/  auth/  agents/  knowledge-bases/
    limits/                 policies, LimitGuard, error contract
    usage/                  ledger, counters, reconciliation
    enforcement/            locks, unlock, phone-number bindings
    analytics/              reads our usage tables
    audit/
  shared/                   env config (Zod), errors, logger, UI kit
```

Inside each module: `service.ts` (business rules), `repository.ts` (database), `schemas.ts` (Zod), `index.ts` (public surface), `__tests__/`.

- A route handler does four things only: **authenticate, validate, call one service, return the result**.
- Modules import each other only through `index.ts` (enforced by `no-restricted-imports`).
- Pure helpers already in the code (`naming.ts`, `location-matching.ts`, `validators.ts`, `agent-names.ts`) move into their modules **unchanged**, with tests added first.
- Migrate step by step. Do not rewrite working UI components.

## 4a. Stack

Keep: Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, React Query, Zod, Prisma 6, PostgreSQL.
Add: Prisma migrations, signed link tokens (`jose`), Auth.js for admin, Vitest, React Testing Library, MSW or the in-repo Retell fake, Playwright, Docker PostgreSQL for tests, Sentry.

`AGENTS.md` warns that this Next.js version differs from older versions. Read the relevant guide in `node_modules/next/dist/docs/` before using a Next.js API you are not sure about.

## 5. Definition of Done (every task)

A task is not done until all of these are true:

- [ ] Every new or changed **function** has unit tests, including edge cases.
- [ ] Every new or changed **API route** has tests for: no token (401), another tenant's data (403), bad input (400), over limit (403 `LIMIT_REACHED`, where a limit applies), happy path.
- [ ] Every new or changed **component** has tests for: loading, error, empty, limit reached, normal.
- [ ] A **route-matrix test** passes: every `route.ts` has a test file and is wrapped by the auth helper.
- [ ] Retell is faked in tests. No test calls the real Retell or spends call minutes.
- [ ] `npm run lint`, type-check and all tests pass.
- [ ] A new module respects the boundaries above.
- [ ] Security-sensitive and money-sensitive modules (`limits`, `usage`, `enforcement`, `auth`) keep strict coverage.
- [ ] Docs updated if behaviour, schema or env vars changed.

## 6. Known facts and open assumptions

Verified in Retell docs (Oct 2026):
- Webhook events include `call_started`, `call_ended`, `call_analyzed`, and chat equivalents. Signed with `x-retell-signature`. Retries up to 3 times, so duplicates happen.
- The inbound call webhook can answer `{ "reject": true }` to hang up before any agent starts.
- Webhook signature (verified Oct 2026): `x-retell-signature: v={timestamp_ms},d={hex}`, digest = HMAC-SHA256(rawBody + timestamp) keyed with the **API key that has the webhook badge** (no separate secret). Reject timestamps older than 5 minutes.
- Legacy `GET /list-agents` and `GET /list-chat-agents` are retired. Use `POST /v2/list-agents` (query `limit`, `pagination_key`; body `filter_criteria.channel`). Items are summaries only (`agent_id`, `agent_name`, `channel`, `user_modified_timestamp`, `tags`); full settings need `get-agent` / `get-chat-agent`.

NOT verified (confirm with a spike before relying on it):
- What setting `outbound_agents` (or `inbound_agents`) to `null` does on `update-phone-number`.
- Whether `call_ended` carries cost and duration directly. Derive duration from timestamps and fetch cost from the call object if needed.

Assumptions awaiting the boss's answer (change them only when told):
1. Tenants open the app from the CRM through an admin-minted signed link.
2. "Minutes used" and "minutes talked" are both billed call minutes. "Calls made" is a separate count.
3. Limits reset monthly; admin can add a top-up.
4. Inbound is blocked by the inbound webhook; outbound by unbinding agents from numbers.
5. A running call is allowed to finish; agents get a maximum call length to cap overshoot.
6. If our database is down: inbound calls fail **open** (alert fires), dashboard create actions fail **closed**.
7. One shared Retell account for now. `tenants.retell_workspace` is reserved for sharding later.

## 7. How to work

1. **Plan first** for anything over about 3 files: list the files you will touch, the tests you will write, and any open assumption. Wait for approval on schema or auth changes.
2. **Tests first** for rules and bug fixes: write the failing test, then the code.
3. **Small steps.** One module or one route family per pull request. Keep the app working at every commit.
4. **Do not guess about Retell.** If behaviour is not in section 6 as verified, say so and propose a spike.
5. **Report honestly:** what changed, what you ran, what failed, what is left. Never claim a test passed that you did not run.
6. When a requirement is ambiguous, ask one specific question and propose a default.

## 8. Current status

Built: tenants and admin panel, signed sessions (`jose`, `SESSION_SECRET`), admin-minted signed tenant links, live tenant/admin status check on every request (`withTenant`, `withTenantRoute`, `withAdmin`), a route-matrix test, usage ledger from webhooks, limit policies and feature switches (admin UI), 700+ tests with a faked Retell.

Still open:
- `checkAccess` (suspend / feature switch / lock) and `LimitGuard` are only wired into agent create and import. Knowledge base create, web call, chat and simulate are not gated, and locks are never created automatically.
- Tenant PATCH bodies for agents, LLMs and flows are not fully allow-listed (rule 8).
- Tenants can still rename their own location (rule 7).
- Admin passwords are unsalted SHA-256 with no login rate limit; no way to add or change admins.
- `UNTESTED` in `src/app/api/route-matrix.test.ts` lists routes that still need tests.
- Plan phases not started: Docker PostgreSQL integration tests, Playwright, Sentry.
