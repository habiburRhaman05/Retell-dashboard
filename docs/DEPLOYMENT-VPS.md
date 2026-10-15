# Deploy on a Linux VPS

This setup runs the app as a Node.js service and runs the call-limit reconciler hourly with a systemd timer. Put Nginx, Caddy, or another TLS reverse proxy in front of the app. Retell webhooks and CRM tenant links must use the public HTTPS domain.

## 1. Install runtime requirements

Install Node.js supported by this project's Next.js version, npm, PostgreSQL connectivity, `curl`, and systemd. Create a dedicated unprivileged Linux user named `retell-dashboard` and install or check out this project at `/opt/retell-dashboard`.

## 2. Configure secrets

Create `/etc/retell-dashboard.env` with mode `600`, owned by root. Use one `KEY=value` per line; do not add shell `export` prefixes.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/DATABASE?sslmode=require
RETELL_API_KEY=your_retell_api_key
RETELL_WEBHOOK_KEY=your_webhook_key_if_different
SESSION_SECRET=replace_with_at_least_32_random_characters
CRON_SECRET=replace_with_a_separate_random_secret
NEXT_PUBLIC_APP_URL=https://dashboard.example.com
ADMIN_FRAME_ANCESTORS=https://app.gohighlevel.com https://*.gohighlevel.com https://*.leadconnectorhq.com
```

`RETELL_WEBHOOK_KEY` and `ADMIN_FRAME_ANCESTORS` are optional. Add `ADMIN_EMAIL` and `ADMIN_PASSWORD` only if you still need to create the first admin. Do not commit this file or copy a developer `.env.local` to the server.

## 3. Install, migrate, and build

Run these commands as the deployment user from `/opt/retell-dashboard`:

```bash
npm ci
set -a
. /etc/retell-dashboard.env
set +a
npx prisma migrate deploy
npm run build
```

`npm run build` generates Prisma Client, creates the Next.js standalone server, and copies static and public assets into the standalone output. Keep the source checkout and `node_modules` on the VPS because the included systemd unit runs `npm start` from the checkout.

## 4. Install the app service and hourly timer

Copy the unit files into systemd's unit directory, then enable the app and timer:

```bash
sudo cp deploy/systemd/retell-dashboard.service /etc/systemd/system/
sudo cp deploy/systemd/retell-call-limit-reconcile.service /etc/systemd/system/
sudo cp deploy/systemd/retell-call-limit-reconcile.timer /etc/systemd/system/
sudo chmod 600 /etc/retell-dashboard.env
sudo systemctl daemon-reload
sudo systemctl enable --now retell-dashboard
sudo systemctl enable --now retell-call-limit-reconcile.timer
```

The app listens on `127.0.0.1:3000`; configure the reverse proxy to forward requests there. The included service runs as the dedicated user and reads secrets from `/etc/retell-dashboard.env`.

Check service and timer state:

```bash
sudo systemctl status retell-dashboard
sudo systemctl list-timers retell-call-limit-reconcile.timer
sudo journalctl -u retell-dashboard -n 100 --no-pager
```

Run the reconciler once manually after the app is up:

```bash
sudo systemctl start retell-call-limit-reconcile.service
sudo journalctl -u retell-call-limit-reconcile.service -n 100 --no-pager
```

## 5. Point integrations at the VPS

Set Retell's webhook URL to `https://dashboard.example.com/api/webhooks/retell`. Update the CRM custom menu links to use the same domain. Keep the TLS certificate valid and allow inbound HTTPS traffic to the reverse proxy. Do not expose port 3000 directly to the internet.

## Updating the app

Deploy code, then rebuild and restart the service. Apply database migrations before starting code that depends on them:

```bash
git pull
npm ci
set -a
. /etc/retell-dashboard.env
set +a
npx prisma migrate deploy
npm run build
sudo systemctl restart retell-dashboard
```

The call-limit timer remains enabled across app updates. Its reconciliation endpoint is protected by a constant-time bearer-secret check; the scheduled job never deletes Retell agents or phone numbers.
