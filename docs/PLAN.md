# Retell SaaS Platform — 4-Phase Build Plan

> **Rule:** No phase moves forward until every test in that phase passes.
> **Rule:** Limits are enforced in our dashboard only. We never modify Retell to enforce limits.
> **Rule:** Usage data comes from Retell webhooks, stored in our DB. Both dashboards read the same tables.

---

## What already exists (Phase 0 — done)

| Area | Status |
|------|--------|
| Dashboard UI | Voice/text agents, knowledge bases, test chat, AI simulation, analytics, settings, overview page |
| Agent naming | `{name} - {location name}` on create and rename |
| Duplicate blocking | Client + server side, case-insensitive |
| Location assignment | Script + DB mapping |
| Voice picker | All accents, server-proxied previews |
| DB tables | `locations`, `location_agents`, `location_knowledge_bases` |
| Tests | Unit tests for naming, location-matching, agent-names, validators, flow-utils, languages, utils, validation |
| Stack | Next.js 16, React 19, Tailwind 4, Prisma 6, PostgreSQL, Vitest, React Testing Library |

### What does NOT exist yet

- No authentication (anyone with a location ID gets full access)
- No admin panel
- No usage metering or recording
- No limits
- No module boundaries (business logic in route handlers)
- No Prisma migrations (no `prisma/migrations/` folder)
- Dangerous routes: `DELETE /agents/cleanup`, unprotected `/agents/import`, `/agents/available`
- Settings forwarded to Retell unfiltered

---

## Phase 1: Foundation & Security (Week 1-2)

**Goal:** Lock down the app. Nobody gets in without a registered account. Code is modular and tested.

### 1.1 Prisma migrations & schema expansion

**What:**
- Remove `dev.db` from repo, add `*.db` to `.gitignore`
- Create baseline migration matching current schema
- Add new tables via migration:

```
tenants (rename from locations)
  id, crm_location_id (unique), name, email, status (active/suspended),
  retell_workspace (reserved), created_at, updated_at

access_links
  id, tenant_id, token_hash, expires_at, revoked_at, created_at

admin_users
  id, email, name, role (owner/support), password_hash, created_at

audit_log
  id, actor_type (admin/system), actor_id, action, target_type,
  target_id, before (json), after (json), created_at

agents (rename from location_agents)
  + status (active/suspended), channel, created_by

knowledge_bases (rename from location_knowledge_bases)
  + status (active/suspended), created_by
```

**Tests (must pass):**
- [ ] Migration applies cleanly on empty database
- [ ] Migration applies on database with existing location data (data preserved)
- [ ] All existing queries still work after rename
- [ ] Rollback migration works without data loss

### 1.2 Module structure

**What:**
Move flat `src/lib/` into domain modules:

```
src/modules/
  retell/          client.ts, types.ts, fake.ts, index.ts
  tenants/         service.ts, repository.ts, schemas.ts, index.ts
  auth/            service.ts, middleware.ts, schemas.ts, index.ts
  agents/          service.ts, repository.ts, schemas.ts, index.ts
  knowledge-bases/ service.ts, repository.ts, schemas.ts, index.ts
  audit/           service.ts, repository.ts, index.ts
```

Rules:
- Only `modules/retell/` calls the Retell API. Nothing else imports `retell-api.ts` directly
- Modules import each other only through `index.ts`
- ESLint `no-restricted-imports` rule enforces boundaries
- Route handlers become thin: authenticate → validate → call service → return result

**What moves where:**
- `retell-api.ts` → `modules/retell/client.ts`
- `naming.ts` → `modules/tenants/naming.ts`
- `location-matching.ts` → `modules/tenants/matching.ts`
- `agent-names.ts` → `modules/agents/names.ts`
- `agent-name-check.ts` → `modules/agents/name-check.ts`
- `location-name.ts` → `modules/tenants/repository.ts`
- `voices-cache.ts` → `modules/retell/voices-cache.ts`

**Tests (must pass):**
- [ ] All existing unit tests still pass after move
- [ ] ESLint boundary rule fails on a direct import of `retell/client.ts` from outside
- [ ] ESLint boundary rule passes on import through `retell/index.ts`
- [ ] Retell fake implements the same interface as real client
- [ ] Retell client retries on 429 and 5xx (token bucket rate limiter)
- [ ] Route handlers are thin (no business logic, just auth → validate → service → response)

### 1.3 Authentication — tenant access

**What:**
- Tenant access via CRM custom menu link: link sends location ID
- App checks: does this `crm_location_id` exist in `tenants` table?
  - **Yes + status active** → create session (signed token in cookie), show dashboard
  - **Yes + status suspended** → show "Account suspended. Contact support."
  - **No** → show "Account not registered. Contact support." — no dashboard access at all
- `withTenant()` middleware for all tenant API routes: extracts tenant from session, passes `tenantId` to service
- Tenant ID comes from session **only**, never from URL param, query, or body
- If URL's `locationId` doesn't match session's tenant → 403

**What gets removed/changed:**
- Remove `DELETE /api/retell/agents/cleanup` (dangerous, wipes all mappings)
- Remove `/api/retell/agents/available` (lists all unassigned agents — admin only later)
- Remove `/api/retell/agents/import` (admin only later)
- Remove `LocationNameSync` URL param saving (admin sets the name)
- All 25 API routes wrapped with `withTenant()`
- `PUT /api/locations/[id]` becomes admin-only

**Tests (must pass):**
- [ ] Unregistered location ID → blocked page, no API access
- [ ] Suspended tenant → suspended page, no API access
- [ ] Active tenant → session created, dashboard loads
- [ ] No session cookie → all API routes return 401
- [ ] Session with tenant A → cannot access tenant B's agents (403)
- [ ] Session with tenant A → cannot access tenant B's knowledge bases (403)
- [ ] URL locationId mismatch with session tenant → 403
- [ ] `/agents/cleanup` route no longer exists (404)
- [ ] `/agents/available` route no longer exists (404)
- [ ] `/agents/import` route no longer exists (404)
- [ ] Route-matrix test: every `route.ts` has a test file and uses `withTenant()`

### 1.4 Authentication — admin panel

**What:**
- Admin login at `/admin/login` (email + password)
- `withAdmin()` middleware for admin API routes
- Two roles: `owner` (full access) and `support` (read only)
- Admin token and tenant token are completely separate — a tenant token can never call an admin route
- Seed first owner from env var `ADMIN_EMAIL` + `ADMIN_PASSWORD`

**Tests (must pass):**
- [ ] Admin login with valid credentials → session
- [ ] Admin login with wrong password → 401
- [ ] No admin session → all `/api/admin/*` routes return 401
- [ ] Support role → cannot POST/PUT/DELETE on admin routes (403)
- [ ] Owner role → full access
- [ ] Tenant token → cannot access any `/api/admin/*` route (401)
- [ ] Admin token → cannot access tenant routes (401)

### Phase 1 gate: ALL of the above tests pass + `npm run lint` + `tsc` clean

---

## Phase 2: Admin Panel (Week 3-4)

**Goal:** Admin can register tenants, see everything, and control access. Every admin action is audited.

### 2.1 Tenant registration

**What:**
- `POST /api/admin/tenants` — register new tenant: `{ name, email, crmLocationId }`
- Validates: name not empty, email valid, crmLocationId not already registered
- Creates tenant row with status `active`
- Returns the tenant record
- Duplicate `crmLocationId` or duplicate normalized name → 409
- Admin UI: `/admin/tenants/new` form with validation

**Tests (must pass):**
- [ ] Happy path: create tenant with valid data → 201
- [ ] Duplicate crmLocationId → 409 with clear error
- [ ] Duplicate normalized name → 409 with clear error
- [ ] Missing name → 400
- [ ] Invalid email → 400
- [ ] Support role → 403 (read only)
- [ ] Audit log entry created for registration
- [ ] Component: form validation states, success state, error state

### 2.2 Tenants overview page

**What:**
- `/admin` shows all tenants in a table:
  - Name, email, status, agents count, KB count
  - Warning badge if approaching a limit
  - Locked badge if any feature is locked
  - Suspended badge if suspended
- Sort by: name, status, agents count
- Search by name or email
- Pagination for large tenant lists

**Tests (must pass):**
- [ ] Overview loads with tenant list
- [ ] Empty state (no tenants)
- [ ] Pagination works (10+ tenants)
- [ ] Search filters correctly
- [ ] Sort works on each column
- [ ] Badges show correctly for each status
- [ ] Support role can view (read only)

### 2.3 Tenant detail page

**What:**
- `/admin/tenants/[id]` with tabs:

**Info tab:**
- Edit name, email
- Suspend / reactivate account (with confirmation)
- View CRM location ID (read only)

**Agents tab:**
- Every agent the tenant created: name, channel (voice/text), created date
- Naming badge: flags agents not ending with ` - {tenant name}`
- Link to view agent details

**Knowledge Bases tab:**
- Every KB the tenant created: name, sources count, created date

**Access tab:**
- Show current access status
- Suspend / reactivate with reason
- View login history (when they last accessed)

**Tests (must pass):**
- [ ] Detail page loads with correct tenant data
- [ ] Edit name → saves, audit log entry
- [ ] Edit email → saves, audit log entry
- [ ] Suspend tenant → status changes, audit log entry, tenant sees suspended page
- [ ] Reactivate tenant → status changes, audit log entry, tenant can access again
- [ ] Agents tab shows only this tenant's agents
- [ ] KB tab shows only this tenant's KBs
- [ ] Naming badge appears on incorrectly named agents
- [ ] Support role can view all tabs but cannot edit/suspend (buttons hidden)
- [ ] Non-existent tenant ID → 404

### 2.4 Audit log

**What:**
- Every admin action writes to `audit_log`: who, what, when, before/after values
- `/admin/audit-log` page: filterable by tenant, action type, date range
- Actions logged: tenant create, tenant edit, tenant suspend/reactivate, limit change, manual lock/unlock

**Tests (must pass):**
- [ ] Every admin mutation creates an audit entry
- [ ] Audit entry captures before and after state
- [ ] Audit log page filters by tenant
- [ ] Audit log page filters by action type
- [ ] Audit log page filters by date range
- [ ] Audit entries are immutable (no UPDATE or DELETE)

### 2.5 Naming service (centralized)

**What:**
- One naming service in `modules/tenants/` applies `{name} - {tenant name}`
- Used on: agent create, agent rename, KB create
- Admin action "rename tenant" → renames all existing agents in Retell (batched, audited)
- Tenant cannot change their own name

**Tests (must pass):**
- [ ] Create agent → name gets suffix
- [ ] Rename agent → suffix re-applied
- [ ] Already-suffixed name → not double-suffixed
- [ ] Long name → truncated correctly (KB < 40 chars)
- [ ] Tenant rename → all agents updated in Retell, audit log entries
- [ ] Tenant rename partial failure → resumable, no half-renamed state
- [ ] Tenant cannot call rename endpoint (403)

### Phase 2 gate: ALL of the above tests pass + Phase 1 tests still pass + lint + typecheck clean

---

## Phase 3: Usage Metering & Analytics (Week 5-6)

**Goal:** Every call is recorded. Usage is accurate. Both dashboards show the same numbers.

### 3.1 Webhook handler

**What:**
- `POST /api/webhooks/retell/call-ended`:
  1. Verify `x-retell-signature` against raw body
  2. Return 2xx immediately
  3. Parse event: `call_id`, `agent_id`, `start_time`, `end_time`, `duration`, `cost`
  4. Map `agent_id` → tenant via our `agents` table
  5. Insert into `usage_events` (unique on `call_id`, so retries count once)
  6. Update `usage_counters` in same transaction
  7. Unknown agent → `dead_letter` status (not lost, investigated later)

**New tables:**
```
usage_events
  id, call_id (unique), tenant_id, agent_id, event_type,
  duration_sec, cost_cents, started_at, ended_at, raw_payload (json),
  created_at

usage_counters
  id, tenant_id, metric, period_start, value
  unique on (tenant_id, metric, period_start)

webhook_inbox
  id, event_type, call_id, raw_body, signature_valid,
  processed_at, error, created_at
```

**Tests (must pass):**
- [ ] Valid signature → event processed, 2xx returned
- [ ] Invalid signature → rejected, 401
- [ ] Missing signature → rejected, 401
- [ ] Duplicate `call_id` → counts once (idempotent)
- [ ] 10 parallel deliveries of same `call_id` → exactly 1 usage_event row
- [ ] Unknown agent_id → stored in dead letter, not lost
- [ ] `usage_counters` incremented correctly for CALL_MINUTES and CALLS
- [ ] Monthly period rollover: new period_start, counter resets
- [ ] Webhook returns 2xx within 500ms (fast response)
- [ ] Raw payload stored for debugging

### 3.2 Reconciliation job

**What:**
- Scheduled route: `POST /api/admin/reconcile` (admin-only, or cron)
- Lists recent calls from Retell API since last checkpoint
- Compares with `usage_events` table
- Inserts any missing events
- Updates counters
- Logs what it found and fixed

**Tests (must pass):**
- [ ] No gaps → no changes, report "all synced"
- [ ] One missing call → inserted, counter updated
- [ ] Multiple missing calls → all inserted
- [ ] Already-existing calls → not duplicated
- [ ] Checkpoint advances after successful run
- [ ] Retell API error → job fails gracefully, retries next run

### 3.3 Analytics from our database

**What:**
- Rewrite `/api/retell/analytics` to read from `usage_events` instead of pulling 10k calls from Retell
- Same response shape so the dashboard UI doesn't change
- SQL aggregation with proper indexes
- Add tenant scoping (tenant can only see own data)
- Admin analytics: see any tenant's data or all tenants combined

**Tests (must pass):**
- [ ] Tenant A sees only tenant A's analytics
- [ ] Tenant A cannot see tenant B's data
- [ ] Admin sees all tenants' data
- [ ] Admin can filter by specific tenant
- [ ] Empty state: no calls yet → zeros, not errors
- [ ] Aggregations match: total calls, total minutes, average duration, daily breakdown
- [ ] Date range filter works
- [ ] Performance: 10,000 events returns in < 200ms

### 3.4 Usage display

**What:**
- Tenant dashboard: usage summary card showing calls made, minutes used this month
- Admin tenant detail: usage tab with daily chart, totals, per-agent breakdown

**Tests (must pass):**
- [ ] Tenant sees own usage numbers
- [ ] Admin sees tenant's usage with breakdown
- [ ] Numbers match between tenant and admin views (same data source)
- [ ] Monthly reset: new month shows 0
- [ ] Loading state, error state, empty state all render correctly

### Phase 3 gate: ALL above tests pass + Phase 1-2 tests still pass + lint + typecheck clean

---

## Phase 4: Limits, Enforcement & Production Readiness (Week 7-9)

**Goal:** Limits work. Features can be controlled. App is production-ready.

### 4.1 Limit policies & LimitGuard

**What:**
- `limit_policies` table: one row per tenant per metric
- Metrics enum: `AGENTS`, `KNOWLEDGE_BASES`, `CALL_MINUTES`, `CALLS` (extendable)
- Each policy: `limit_value`, `period` (monthly/lifetime), `warn_at_pct`, `mode` (hard/soft)
- `LimitGuard.check(tenantId, metric, amount)` → `allow` | `warn` | `block`
- Blocked action returns HTTP 403: `{ code: "LIMIT_REACHED", metric, used, limit, message }`

**New table:**
```
limit_policies
  id, tenant_id, metric, period (monthly/lifetime),
  limit_value, warn_at_pct (default 80), mode (hard/soft),
  created_at, updated_at
  unique on (tenant_id, metric)
```

**Where LimitGuard is called (dashboard enforcement only):**
- Agent create (all paths) → check AGENTS
- Knowledge base create → check KNOWLEDGE_BASES
- Test call → check CALL_MINUTES, CALLS
- Test chat → check CALL_MINUTES (if it costs minutes)
- Simulation → check CALL_MINUTES (if it costs minutes)
- Any other spending action through our dashboard

**Tests (must pass):**
- [ ] Limit of 5 agents, tenant has 4 → allow
- [ ] Limit of 5 agents, tenant has 5 → block with LIMIT_REACHED
- [ ] Limit of 1 agent + 5 parallel creates → exactly 1 succeeds (atomic with row lock)
- [ ] Soft mode at limit → warn but allow
- [ ] Hard mode at limit → block
- [ ] Warn at 80%: 4 of 5 → warn response
- [ ] Monthly period rollover → counter resets, previously blocked → now allowed
- [ ] No limit policy for a metric → allow (no restriction)
- [ ] Admin top-up: raise limit → previously blocked → now allowed
- [ ] Adding a new metric requires only: enum value + counter rule + guard call (test with fake metric)
- [ ] LimitGuard never calls Retell — only reads our DB

### 4.2 Feature locks & admin switches

**What:**
- `tenant_features` table: admin can toggle any feature on/off per tenant
- `feature_locks` table: automatic locks when limit is reached
- When usage counter hits limit → create feature_lock → dashboard blocks that feature
- When admin raises limit or period rolls over → clear lock → feature works again
- Admin manual lock/unlock (audited)

**New table:**
```
tenant_features
  id, tenant_id, feature_key, enabled (default true),
  reason, changed_by, changed_at

feature_locks
  id, tenant_id, feature_key, metric, reason,
  locked_at, cleared_at, saved_data (json)
```

**The 3-switch check order:**
1. Is account active? → If suspended: ACCOUNT_SUSPENDED
2. Is feature enabled? → If off: FEATURE_DISABLED (with admin's reason)
3. Is under limit? → If over: LIMIT_REACHED (with numbers)

**Tests (must pass):**
- [ ] Account suspended → all features blocked with ACCOUNT_SUSPENDED
- [ ] Feature disabled by admin → that feature blocked with FEATURE_DISABLED + reason
- [ ] Limit reached → that feature blocked with LIMIT_REACHED + usage numbers
- [ ] Suspend doesn't clear feature switches (3 switches are independent)
- [ ] Re-enable feature doesn't clear a limit lock
- [ ] Admin lock is audited
- [ ] Admin unlock is audited
- [ ] Lock at limit is idempotent (hitting limit twice doesn't create duplicate locks)
- [ ] Period rollover clears usage-based locks automatically

### 4.3 Entitlements API & tenant UI

**What:**
- `GET /api/tenant/entitlements` → returns per-feature status for the logged-in tenant:
  ```json
  {
    "agents.create_voice": { "enabled": true, "used": 3, "limit": 5, "status": "ok" },
    "calls.inbound": { "enabled": false, "reason": "LIMIT_REACHED", "used": 100, "limit": 100 }
  }
  ```
- `useEntitlements()` React Query hook
- Disabled features: buttons disabled with tooltip showing reason
- Warning state: banner "You have used 80 of 100 minutes this month"
- Blocked state: banner "You have used 100 of 100 minutes. Contact support to raise your limit."

**Tests (must pass):**
- [ ] Entitlements API returns correct status for each feature
- [ ] Tenant A's entitlements don't leak tenant B's data
- [ ] `useEntitlements()` hook provides data to components
- [ ] Create agent button disabled when AGENTS limit reached, tooltip shows reason
- [ ] Create KB button disabled when KB limit reached
- [ ] Warning banner appears at warn percentage
- [ ] Blocked banner appears at limit
- [ ] Banner disappears when limit is raised
- [ ] All component states render: ok, warning, blocked, loading, error

### 4.4 Admin limits management

**What:**
- Admin tenant detail → Limits tab:
  - View/edit each metric's limit for the tenant
  - Add top-up (increase limit temporarily)
  - See current usage vs limit with progress bar
  - Manual lock/unlock any feature with reason
- Admin tenant detail → Features tab:
  - Toggle each feature on/off with reason
  - Reason is shown to the tenant

**Tests (must pass):**
- [ ] Admin sets agent limit → saved, audit logged
- [ ] Admin raises limit → previously blocked tenant can create again
- [ ] Admin lowers limit below current usage → feature locked
- [ ] Top-up increases limit → audit logged
- [ ] Admin toggles feature off → tenant sees FEATURE_DISABLED + reason
- [ ] Admin toggles feature on → tenant can use it again
- [ ] Support role can view but not edit (read only)
- [ ] All form states: loading, saving, success, error

### 4.5 Allow-listed agent fields

**What:**
- Tenants can only edit specific agent fields (not all settings)
- Allow-listed fields: prompt, voice, language, pronunciation, post-call analysis, greeting message
- Block: model selection (use our default), webhook URLs, max call duration override, any setting that costs more money
- PATCH route filters request body against allow-list before sending to Retell

**Tests (must pass):**
- [ ] Allowed field in PATCH body → forwarded to Retell
- [ ] Blocked field in PATCH body → stripped, not sent to Retell
- [ ] Attempt to change model → rejected
- [ ] Attempt to change webhook URL → rejected
- [ ] Empty body after filtering → 400

### 4.6 Production hardening

**What:**
- Structured logging (request ID, tenant ID, action)
- Error tracking (Sentry)
- Rate limiting on API routes (per tenant)
- `frame-ancestors` locked to CRM domains (from env var)
- GitHub Actions CI: lint, typecheck, unit tests, integration tests
- Health check endpoint
- Environment validation with Zod on startup

**Tests (must pass):**
- [ ] CI pipeline runs all test suites
- [ ] App starts with valid env → boots
- [ ] App starts with missing env var → clear error message, no boot
- [ ] Rate limiter: burst of 100 requests from one tenant → some rejected (429)
- [ ] Health check returns 200 with version info
- [ ] Iframe from allowed domain → loads
- [ ] Iframe from unknown domain → blocked

### Phase 4 gate: ALL above tests pass + ALL previous phase tests pass + lint + typecheck clean

---

## Total test count by category

| Category | Estimated tests |
|----------|----------------|
| Unit (pure functions) | ~50 (existing) + ~30 (new) |
| Service + DB (business rules) | ~60 |
| API routes (contract) | ~80 |
| Components (UI states) | ~40 |
| Integration (webhook, reconcile) | ~20 |
| End-to-end (Playwright) | ~10 |
| **Total** | **~290** |

## Architecture after all 4 phases

```
CRM custom menu link
    │
    ▼
┌─────────────────────────────────────────────────┐
│ Our App                                          │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Tenant   │  │ Admin    │  │ Webhook       │  │
│  │ Routes   │  │ Routes   │  │ Handler       │  │
│  │ /api/    │  │ /api/    │  │ /api/webhooks │  │
│  │ tenant/* │  │ admin/*  │  │ /retell/*     │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │           │
│       ▼              ▼               ▼           │
│  ┌─────────────────────────────────────────┐     │
│  │ withTenant()  │  withAdmin()  │ verify  │     │
│  │ (session)     │  (login)      │ (sig)   │     │
│  └─────────────────────────────────────────┘     │
│       │              │               │           │
│       ▼              ▼               ▼           │
│  ┌─────────────────────────────────────────┐     │
│  │            LimitGuard                    │     │
│  │  check(tenantId, metric, amount)         │     │
│  │  → allow / warn / block                  │     │
│  │  (dashboard only, never touches Retell)  │     │
│  └─────────────────────────────────────────┘     │
│       │                                          │
│       ▼                                          │
│  ┌──────────┬──────────┬──────────┬─────────┐    │
│  │ tenants/ │ agents/  │ limits/  │ usage/  │    │
│  │ auth/    │ kb/      │ enforce/ │ audit/  │    │
│  │          │          │ analytics│         │    │
│  └──────────┴──────────┴──────────┴─────────┘    │
│       │                      │                   │
│       ▼                      ▼                   │
│  ┌──────────┐        ┌──────────────┐            │
│  │ modules/ │        │ PostgreSQL   │            │
│  │ retell/  │──────▶ │ (all tenant, │            │
│  │ (only    │        │  usage, limit│            │
│  │  Retell  │        │  data)       │            │
│  │  caller) │        └──────────────┘            │
│  └──────────┘                                    │
│       │                                          │
│       ▼                                          │
│  Retell API (our paid account)                   │
│  - Create/update/delete agents                   │
│  - NEVER modified for limit enforcement          │
└─────────────────────────────────────────────────┘
```

## Key decisions baked into this plan

1. **Limits = dashboard only.** We block in our UI/API. Retell account stays untouched.
2. **Usage = webhooks → our DB.** Both dashboards read same tables. Reconciliation catches gaps.
3. **Access = registered only.** No location ID in DB → no access. Period.
4. **Admin registers with:** name, email, CRM location ID.
5. **3-switch system:** account active + feature enabled + under limit. All independent.
6. **Scalable:** tenant-scoped queries, usage in our DB (not Retell), rate-limited client, modular code.
