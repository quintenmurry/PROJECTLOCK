# Haulbook

A shared workspace where ocean freight forwarders and drayage carriers coordinate container moves:
jobs, delivery orders, documents, messages, statuses and proof of delivery.

**Status: Milestones 1–3 of 7** — accounts and permissions; carrier directory; shipments with paperwork, customer share links and a driver phone view.
The full plan (architecture, schema, permission model and milestones) is in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What works today

- Sign up, email confirmation, sign in, sign out, forgot/reset password
- Onboarding: create a **forwarder** or **carrier** company (you become its owner)
- Team: invite by email with a role, resend or revoke invites, change roles, remove/restore access
- Invite links: expire after 7 days, single-use, only work for the invited email address
- Users in several companies get a company switcher
- Company and account settings
- Platform administration: list all companies, suspend/reactivate (suspension cuts off access at
  the database level), platform activity log
- Audit log of company, invitation and membership changes

Roles: carriers have **Owner, Administrator, Dispatcher, Driver**; forwarders have
**Owner, Administrator, Forwarder user**. The database rejects a role that doesn't fit the
company type.

### Milestone 2

- Public website: home page, pricing, and a "talk to a specialist" form (requests appear under Administration)
- Carriers: carrier profile (description, hours, SCAC/USDOT/MC, dispatch contacts, insurance expiry), coverage
  (ports, terminals, delivery areas, container types, equipment, services), opt-in directory listing, customers list
- Forwarders: carrier directory with filters, carrier detail pages, private approved list (members suggest,
  owners/admins approve, suspend or remove), internal notes the carrier never sees
- Contact details and insurance are shown only to forwarders that approved the carrier
- Platform admins can verify carriers; changing insurance or USDOT/MC sends a carrier back to review

### Milestone 3

- **Shipments** (carrier side): dispatch board with counts (not dispatched, today, on the road,
  delivered without POD, open problems), views, search by container/booking/B/L/customer/ref/#number,
  driver and date filters
- **Shipment workspace**: one page per load with status progress, paperwork (upload, view, download,
  replace with history, share or keep private), activity timeline, internal notes, problems, details,
  and customer share links (create, email, see opens and downloads, turn off)
- **Customer share page** (`/share/...`): status, containers, route, shared documents and a big
  "Download POD" button; no account needed
- **Driver phone view** (`/driver`): assigned loads only, big Picked up / Delivered / Empty returned
  buttons, camera upload, report a problem, note to dispatch
- **Dispatch a trucker**: from the shipment, send a company driver or an outside owner-operator a
  secure dispatch sheet by email or text: route, appointments, instructions, seals and only the
  documents the carrier ticks (DO ticked by default; rate confirmations allowed if the carrier chooses).
  Sending it marks the load dispatched; opens and downloads show in the activity
- Rates and invoices are never shared on customer links; drivers never see internal notes

Photos come from Unsplash; swap them in `src/lib/photos.ts`.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app is already pointed at the `projectlock` Supabase project
(public settings are in `.env`), and the database schema is already applied there — there is
nothing else to configure for local development.

### Optional: real invitation emails

Without an email provider, invite emails are printed to the terminal running `npm run dev`, and
the invite link is shown on screen right after you create it so you can share it yourself.
To send real emails, create `.env.local` with:

```
RESEND_API_KEY=re_...
EMAIL_FROM="Haulbook <notifications@yourdomain.com>"
```

Account emails (confirmation, password reset) are sent by Supabase itself. Its built-in sender
is heavily rate-limited (a few emails per hour) and is meant for testing; set up custom SMTP in
Supabase before inviting real users.

## Security model (short version)

Every table has Row Level Security. Companies can only read their own rows, enforced by Postgres,
not by the UI. Multi-step changes (creating companies, invitations, role changes, suspensions) go
through database functions that re-check permissions. Invitation tokens are 256-bit random values;
only their SHA-256 hash is stored. See `docs/ARCHITECTURE.md` §2 and §6.

## Tests

`supabase/tests/01_tenant_isolation.sql` checks, with two unrelated forwarders and two unrelated
carriers, that nobody can read or change another company's data, that members can't do admin
things, that invite links can't be reused or used by the wrong person, and that suspension
cuts off access. Run it against a throwaway local Postgres:

```bash
npm run test:db      # needs PostgreSQL 15+ installed locally
```

## Database changes

Migrations live in `supabase/migrations/`, one file per change, applied in order.

## Deploying (later)

Any Node host works; Vercel is the simplest. Set `NEXT_PUBLIC_SITE_URL` to the real domain, and in
Supabase → Authentication → URL Configuration set the Site URL to that domain and add
`https://YOUR-DOMAIN/auth/callback` to the redirect URLs.
