# Retell Dashboard

Multi-tenant Retell dashboard built with Next.js, PostgreSQL, and Prisma. It can run on a standard Linux VPS with Node.js and systemd.

## VPS deployment

See [VPS deployment guide](docs/DEPLOYMENT-VPS.md) for the full setup, systemd service and hourly call-limit reconciliation timer.

The production build uses Next.js standalone output. On a Linux VPS, install dependencies with `npm ci`, set environment variables, apply database migrations with `npx prisma migrate deploy`, then run `npm run build` and `npm start`. Keep the app behind a TLS reverse proxy such as Nginx or Caddy.

## Environment variables

Set these in the server environment file (for example `/etc/retell-dashboard.env`). Keep secrets out of source control.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `RETELL_API_KEY` | Retell API key used for Retell calls |
| `RETELL_WEBHOOK_KEY` | Optional webhook signing key; defaults to `RETELL_API_KEY` |
| `SESSION_SECRET` | At least 32 random characters; signs login cookies and tenant links |
| `CRON_SECRET` | Random bearer secret for the call-limit reconciliation endpoint |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS address used when creating tenant links |
| `ADMIN_FRAME_ANCESTORS` | Optional space-separated CRM origins allowed to frame the admin panel |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only when creating the first admin |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Hard call limits

Hard `CALL_MINUTES` and `CALLS` policies block new dashboard web calls when usage reaches the limit. After a verified call-end webhook updates usage, the server saves a phone-routing snapshot and uses Retell's phone-number update API to remove only the blocked tenants' inbound/outbound agent assignments. It never deletes agents or phone numbers. SMS routing and other phone-number settings are not changed. If a number has an inbound webhook that can dynamically choose an agent, automatic reconciliation leaves its inbound assignments unchanged and reports the route for review. When a limit is raised, deleted, or its period resets, saved voice routes are restored only if current Retell routes still match the state this feature applied; otherwise the snapshot is marked for review and current routes are left untouched.

The VPS systemd timer calls `/api/internal/jobs/reconcile-call-limits` hourly using `CRON_SECRET`. This retries failed route changes and restores routes after a monthly period rollover.

## Retell webhook

Set the webhook URL in Retell to `https://<your-domain>/api/webhooks/retell`. Requests are checked against `x-retell-signature` and rejected if invalid or older than five minutes.
