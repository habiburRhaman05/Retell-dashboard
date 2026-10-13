This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration

Set these in `.env.local` (never commit it):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `RETELL_API_KEY` | The one Retell account key. It also signs Retell webhooks, so it must be the key with the webhook badge |
| `SESSION_SECRET` | At least 32 random characters. Signs every login cookie and tenant link. Changing it logs everyone out and invalidates all links |
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
signature is wrong or older than 5 minutes.

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
