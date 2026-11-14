# Yasmeen Zafer — portfolio site

A static site (plain HTML, CSS and ES modules) backed by Supabase for sign-in, booking requests and a live dashboard. There's no build step.

## Run locally

```bash
python serve.py 5510
```

Open http://localhost:5510. `http://localhost:5510/**` is an allowed auth redirect.

## Layout

| Path | Role |
|---|---|
| `js/main.js` | Entry point. Page behaviour loads first; Supabase features load separately so a CDN failure can't break the page. |
| `js/config.js` | Project URL and **publishable** key. Never put a secret or `service_role` key here. |
| `js/lib/supabase.js` | Shared client, loaded from the jsdelivr CDN. |
| `js/lib/auth.js` | Magic-link sign-in, sign-out, role lookup. |
| `js/lib/bookings.js` | Create, list, update, delete and subscribe to bookings. |
| `js/modules/*` | UI wiring: page motion, booking form, sign-in dialog and dashboard. |
| `supabase/migrations/` | Schema, Row Level Security, realtime, admin role trigger, rate limit. |

## Data and security

- **`bookings`**: anyone can insert the four form fields. Signed-in users read their own requests. Admins read, update the status of, and delete every request. Each email address is limited to 3 requests per 10 minutes.
- **`profiles`**: one row per user, written only by a database trigger. Clients can't change roles.
- **Admin role**: `yasmein.abdelmohsen@gmail.com` becomes `admin` automatically the first time that address signs in with a confirmed email (clicking the magic link confirms it). Unconfirmed sign-ups claiming the address stay `user`.
- **Realtime**: the dashboard subscribes to `bookings`. Supabase applies the same read policies, so each person only receives rows they may see.

## Deploy

Upload the folder as static files to any host (Netlify, Cloudflare Pages, GitHub Pages, Vercel static). `serve.py`, `supabase/` and `.claude/` aren't needed in production.

Then, in **Supabase Dashboard → Authentication → URL Configuration**:

1. Set **Site URL** to the live address, for example `https://your-domain.com`.
2. Add `https://your-domain.com/**` to **Redirect URLs**.

Without this, magic links from the live site send people to the wrong address. (`supabase/config.toml` only affects a local Supabase stack.)

## Database changes

```bash
supabase migration new <name>
supabase db push
```
