# BTA Fresh — online ordering & payments

A small ordering site for BTA Fresh: customers browse bananas by carton, add
to a cart, and pay through **Stripe Checkout** (Stripe's own hosted payment
page — so card numbers never touch your server). Orders are saved to a real
database, and there's a password-protected admin page to view orders and
update prices.

## What's in here

```
server/            Node.js/Express backend (API, Stripe integration, database)
public/            The website itself (storefront, checkout result pages, admin page)
scripts/hash-password.js   Utility to set your own admin password (optional — see below)
data/               SQLite database file lives here when run locally
.env.example        Template for the settings/secrets the server needs
```

## Minimal setup — no installs, no terminal (recommended)

This gets the site live on the internet using only your web browser —
clicking buttons in GitHub, Railway, and Stripe's dashboards. No coding,
no command line.

**Your admin login for the finished site** (write these down somewhere safe —
you won't need to generate these yourself, just paste the hash below into
Railway in step 5):

```
Admin password:      Cavendish-Carton-6762
ADMIN_PASSWORD_HASH: $2b$12$IHP.f9Tc3SPc3fRd/0XSkurguC5CGnDzM3rM9FQXYDoJUxkap1WXK
SESSION_SECRET:       c86dd243b2d3527efc60f26c4a67ad182ffc4c55ea3a0c765c67d46f3be360b0
```

### Steps

1. **Put the code on GitHub** (GitHub is just free file storage that Railway
   reads from — you won't write any code).
   - Go to https://github.com/join and create a free account if you don't
     have one.
   - Click the **+** in the top right → **New repository**. Name it
     `bta-fresh-shop`, set it to **Private**, click **Create repository**.
   - On the new (empty) repo page, click **uploading an existing file**.
   - Unzip the project folder I sent you, then drag *all the files and
     folders inside it* (not the zip itself) into the browser window.
   - Scroll down, click **Commit changes**.

2. **Sign up for Railway** (this is the host that actually runs the site):
   go to https://railway.com, click **Login**, choose **Login with GitHub**,
   and approve it. No credit card needed to start; a small usage-based cost
   kicks in once you deploy (roughly USD $5/month for a site this size —
   the cheap plans don't reliably keep your order history safe between
   updates, which matters once real customers are ordering).

3. **Deploy it**: click **New Project** → **Deploy from GitHub repo** →
   select `bta-fresh-shop`. Railway will detect it's a Node.js app and
   start building automatically — you don't need to configure anything here.

4. **Add a persistent disk for your order data** (so orders aren't lost
   when you update the site later): in your new service, go to the
   **Volumes** tab → **Add Volume** → set the mount path to `/data` →
   save.

5. **Add the settings** (Variables tab → **New Variable**, one at a time):

   | Name | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | your `sk_test_...` key from the Stripe dashboard (Developers → API keys) |
   | `STRIPE_WEBHOOK_SECRET` | leave blank for now — you'll add this in step 7 |
   | `ADMIN_PASSWORD_HASH` | the hash printed above |
   | `SESSION_SECRET` | the value printed above |
   | `DB_PATH` | `/data/bta.db` |
   | `SITE_URL` | leave blank for now — you'll add this in step 6 |
   | `NODE_ENV` | `production` |

6. **Get your site's address**: in the service's **Settings** tab →
   **Networking** → click **Generate Domain**. Railway gives you a URL like
   `bta-fresh-shop-production.up.railway.app`. Copy it, go back to
   **Variables**, and set `SITE_URL` to `https://` + that address.

7. **Connect Stripe's webhook** (this is what tells your site "the payment
   actually went through"): in the Stripe dashboard, make sure **Test mode**
   is on, then go to **Developers → Webhooks → Add endpoint**.
   - Endpoint URL: your site's address from step 6, with `/api/webhook` on
     the end — e.g. `https://bta-fresh-shop-production.up.railway.app/api/webhook`
   - Select the event `checkout.session.completed`.
   - Click **Add endpoint**, then click **Reveal** next to "Signing secret"
     and copy the `whsec_...` value.
   - Back in Railway → Variables, paste it into `STRIPE_WEBHOOK_SECRET`.

8. Railway redeploys automatically whenever you change a variable. Give it
   a minute, then visit your site's address. Add something to the cart,
   check out, and pay with Stripe's test card `4242 4242 4242 4242`, any
   future expiry date, any CVC. You should land on a confirmation page, and
   the order should appear at `yoursite.../admin.html` (log in with the
   admin password above).

That's a fully working, live-on-the-internet version of your ordering site
— still in Stripe's test mode, so no real money moves yet. When you're
ready to take real payments, see "Going live with real payments" below —
at that point you'll swap in your **live** Stripe key and a live webhook,
and everything else stays exactly as it is.

## Running it on your own computer instead (optional, for developers)

If you or your son want to make code changes and test them before they go
live, this runs the same site locally:

1. **Install Node.js**: https://nodejs.org (LTS version).
2. ```
   cd bta-fresh-shop
   npm install
   cp .env.example .env
   ```
3. Fill in `.env` with the same values from the table above (for
   `STRIPE_WEBHOOK_SECRET` locally, install the
   [Stripe CLI](https://docs.stripe.com/stripe-cli) and run
   `stripe listen --forward-to localhost:3000/api/webhook`, which prints a
   `whsec_...` value to use). Leave `DB_PATH` blank locally.
4. `npm start`, then open http://localhost:3000.
5. To set a different admin password later: `node scripts/hash-password.js "YourNewPassword"`
   and paste the hash it prints into `.env` (or into Railway's Variables).

## Going live with real payments

1. **Activate your Stripe account** — ABN, business details, and a bank
   account for payouts, done inside the Stripe dashboard. Only you can
   complete this step; it's usually quick.
2. **Switch the key**: once activated, get your **live** secret key
   (`sk_live_...`, Test mode switched off) and update `STRIPE_SECRET_KEY`
   in Railway's Variables.
3. **Add a live webhook**: same as step 7 above, but with Test mode off —
   this gives you a different signing secret, which replaces
   `STRIPE_WEBHOOK_SECRET`.
4. **Optional — your own domain**: buy `btafresh.com.au` (or similar) and
   connect it in Railway's Networking settings instead of the
   `railway.app` address; update `SITE_URL` to match.
5. **Business paperwork** worth doing before advertising publicly: a
   returns/refund policy, terms of service, a privacy policy (you're
   collecting names and addresses), and a quick check with your accountant
   on GST handling.
6. **Change your admin password** one more time before going live, and
   don't reuse it anywhere else.

## Notes on how payment security works here

Card numbers are entered on Stripe's own hosted checkout page, never on
this site's server — the simplest and safest way for a small business to
accept cards online. The server only ever sees the *result* (paid or not)
via the signed webhook. Product prices are decided by the server/database,
not sent from the browser, so someone can't tamper with the price by
editing the page before checking out.
