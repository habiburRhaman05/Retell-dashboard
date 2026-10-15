This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

Set these in `.env.local` (never commit it):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `RETELL_API_KEY` | The one Retell account key used for every Retell call |
| `RETELL_WEBHOOK_KEY` | Optional. The Retell API key that carries the webhook badge, if it differs from `RETELL_API_KEY`. Webhooks are verified with this, falling back to `RETELL_API_KEY` |
| `ADMIN_FRAME_ANCESTORS` | Optional. Space-separated sites allowed to show the admin panel in a frame. Defaults to GoHighLevel's domains. Add your white-label CRM domain here if you use one |
| `SESSION_SECRET` | At least 32 random characters. Signs every login cookie and tenant link. Changing it logs everyone out and invalidates all links |
| `CRON_SECRET` | Random bearer secret required by the scheduled call-limit reconciler |
| `NEXT_PUBLIC_APP_URL` | Public address of this app, used when creating tenant links |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by `scripts/seed-admin.mts` to create the first admin |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## How tenants get in

Tenants never sign in with a password. An admin opens **Admin > Tenants > (tenant) > Access** and creates a
dashboard link, then pastes it into that tenant's CRM custom menu. The link carries a signed token for exactly
one tenant. Knowing a location id is not enough to open a dashboard. Links last one year; suspending a tenant
cuts access immediately.

## Retell webhook

Point Retell at `https://<your-domain>/api/webhooks/retell`. Requests are checked against the
`x-retell-signature` header (`v={timestamp},d={digest}`, signed with the Retell API key) and rejected if the
signature is wrong or older than 5 minutes. If Retell answers 401, check the Vercel logs for
`[retell-webhook] rejected`: the reason says what is wrong.

## Hard call limits

Hard `CALL_MINUTES` and `CALLS` policies block new dashboard web calls when usage reaches the limit. After a verified call-end webhook updates usage, the server saves a phone-routing snapshot and uses Retell's phone-number update API to remove only the blocked tenants' inbound/outbound agent assignments. It never deletes agents or phone numbers. SMS routing and other phone-number settings are not changed. If a number has an inbound webhook that can dynamically choose an agent, the automatic reconciliation leaves its inbound assignments unchanged and reports the route for review. When a limit is raised, deleted, or its period resets, saved voice routes are restored only if the current routes still match the state this feature applied; otherwise the snapshot is marked for review and current Retell routes are left untouched.

Apply database migrations during deployment with `npx prisma migrate deploy`. The hourly reconciler at `/api/internal/jobs/reconcile-call-limits` requires `CRON_SECRET`; configure the same random secret in the deployment environment so it can retry failed route changes and restore routes after monthly period rollover.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
