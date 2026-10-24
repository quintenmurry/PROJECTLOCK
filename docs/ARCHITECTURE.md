# Haulbook — Architecture & Implementation Plan

Working name: **Haulbook** (from the repo name; set `NEXT_PUBLIC_APP_NAME` to change it in the UI).

A shared operational workspace where ocean freight forwarders and drayage carriers coordinate
existing container moves: jobs, delivery orders, documents, messages, statuses and POD.
Not a brokerage, load board or TMS.

---

## 1. Architecture

```
Browser (desktop dashboards, mobile driver view, guest job links)
        │
        ▼
Next.js (App Router, TypeScript) on a managed host (Vercel recommended)
  • Server Components for reads, Server Actions for writes
  • Every write validated with Zod, then executed as the signed-in user
  • Guest (non-registered carrier) links handled only by server routes
        │  @supabase/ssr (cookie session, user JWT)
        ▼
Supabase
  • Auth: email + password, email confirmation, password recovery
  • Postgres: all tables have Row Level Security (RLS) ON; access rules live in the DB
  • Storage: private bucket `job-documents`; files served only via short-lived signed URLs
  • Security-definer RPCs for multi-step writes (create company, invitations, status changes)
        │
        ▼
Email: Resend (transactional). Dev fallback: emails written to `email_outbox` and the
console, and invite links shown on screen, so the full flow works with no email provider.
```

**Why this shape.** The spec's two hard requirements are tenant isolation and "don't rely on
hiding buttons". Putting the access rules in Postgres RLS means a bug in a page, a hand-edited
URL or a direct API call still can't read another company's rows: the database itself refuses.
Next.js server code adds validation and nicer errors on top, but is not the last line of defense.

The **service-role key** is used in exactly one place: server routes that resolve guest job
links (a recipient without an account has no JWT). Those routes look up the hashed token,
check expiry/revocation/scope, and only then read the single job it grants.

## 2. Tenancy & permission model

### Companies and roles
A **company** is either a `carrier` or a `forwarder`. Users join companies through
**memberships** with one role. A user can belong to more than one company (e.g. a consultant);
the UI keeps one "active company" at a time.

| Role | Carrier company | Forwarder company |
|---|---|---|
| `owner` | Full control, billing, can't be removed while sole owner | same |
| `admin` | Manage profile, team, jobs, documents | Manage profile, team, carriers, jobs |
| `dispatcher` | Accept/decline jobs, assign drivers, update milestones, docs, messages | — |
| `member` | — | Create/send jobs, attach DOs, request updates, retrieve PODs |
| `driver` | Only jobs assigned to them; mobile view | — |

A DB trigger enforces that carrier companies only use owner/admin/dispatcher/driver and
forwarder companies only owner/admin/member.

**Platform administrator** is separate from company roles (`platform_admins` table). Admins see
company/account metadata and usage counts and can suspend/reactivate companies. Admin views do
**not** read job contents, documents or messages.

**Suspension**: every membership check also requires the company's status to be `active`,
so suspending a company cuts off all its members immediately at the database level.

### Job access (Milestone 3+)
A job has exactly one owning forwarder company and at most one carrier company.

| Who | Can see the job | Can see internal notes |
|---|---|---|
| Forwarder company members | jobs where `forwarder_company_id` = their company | forwarder notes only |
| Carrier owner/admin/dispatcher | jobs where `carrier_company_id` = their company, once sent | carrier notes only |
| Carrier driver | only jobs with an active assignment to them; no rates/invoices | no |
| Guest link holder | only the one job in the link, only the actions the link grants | no |
| Other companies | nothing | no |

Rates and invoices are documents with a `visibility` that excludes drivers. Messages have a
`visibility` of `shared`, `carrier_internal` or `forwarder_internal`; RLS filters each.

### Enforcement layers
1. **RLS policies** on every table, using helper functions `is_member(company)`,
   `has_role(company, roles[])`, `can_access_job(job)` (all `security definer`, `stable`).
2. **Security-definer RPCs** for writes that touch several tables, each re-checking permission.
3. **Server Actions** validate input with Zod and return friendly errors.
4. **UI** hides what the role can't do — convenience only.

## 3. Database schema

`✓` = built in Milestone 1. Everything else is designed now so later milestones don't need
rewrites.

### Identity & tenancy
- ✓ `profiles` (id = auth.users.id, full_name, email, phone, created_at, updated_at)
- ✓ `companies` (id, kind carrier|forwarder, name, legal_name, status active|suspended,
  created_by, created_at, updated_at)
- ✓ `company_memberships` (id, company_id, user_id, role, status active|disabled,
  created_at, unique(company_id,user_id))
- ✓ `company_invitations` (id, company_id, email, role, token_hash, invited_by, expires_at,
  accepted_at, accepted_by, revoked_at, created_at) — raw token emailed once, only SHA-256 stored
- ✓ `platform_admins` (user_id, created_at)
- ✓ `audit_events` (id, company_id, actor_id, action, target_type, target_id, metadata jsonb,
  created_at) — append-only; no update/delete policies

### Carrier directory (Milestone 2)
- `carrier_profiles` (company_id PK, description, dispatch_email, dispatch_phone,
  operating_hours, qualification_status, public_listing bool, updated_at)
- `ports`, `terminals` (reference data), `carrier_terminals` (carrier ↔ terminal)
- `carrier_service_areas` (company_id, city, state, radius_miles)
- `carrier_capabilities` (company_id, kind equipment|container_type|service, value)
- `carrier_insurance_docs` (company_id, storage_path, type, expires_at) — private to carrier +
  forwarders that have approved it
- `forwarder_carrier_relationships` (forwarder_company_id, carrier_company_id,
  status pending|approved|suspended, notes, approved_by, approved_at) — per-forwarder approval

### Jobs (Milestone 3)
- `jobs` (id, job_number human-readable, forwarder_company_id, carrier_company_id nullable,
  move_type import|export|empty_reposition|other, status, forwarder_reference,
  carrier_reference, booking_number, bol_number, customer_reference,
  pickup_terminal_id / pickup_location_text, delivery_address, empty_return_location,
  special_instructions, handling_notes, assigned_dispatcher_id, created_by, sent_at,
  acknowledged_at, completed_at, created_at, updated_at)
- `job_containers` (id, job_id, container_number, seal_number, size, type, weight,
  status, pickup/delivery/empty-return confirmations) — **one job, many containers**;
  BOL and container are not assumed 1:1
- `job_appointments` (id, job_id, container_id nullable, kind pickup|delivery|empty_return,
  window_start, window_end, confirmation_number)
- `job_status_events` (id, job_id, container_id nullable, from_status, to_status, actor_id,
  actor_kind user|guest_link|integration, source manual|integration, note, occurred_at,
  recorded_at) — the timeline; `source` separates reported vs automatic events
- `job_changes` (id, job_id, actor_id, field, old_value, new_value, created_at)
- `job_access_links` (id, job_id, recipient_email, token_hash, permissions text[],
  expires_at, revoked_at, first_accessed_at, last_accessed_at, created_by)
- `driver_assignments` (id, job_id, container_id nullable, driver_user_id, truck_ref,
  chassis_ref, assigned_by, active, created_at)

### Documents & messaging (Milestone 4)
- `documents` (id, job_id, container_id nullable, doc_type do|bol|gate_receipt|eir|pod|
  damage_photo|rate_confirmation|invoice|other, storage_path, filename, mime, size,
  visibility shared|carrier_internal|forwarder_internal, uploaded_by, uploaded_via,
  replaces_document_id, superseded_at, created_at) — replacements keep the old row
- `required_documents` (job_id, doc_type, satisfied_by_document_id) — drives "missing" flags
- `messages` (id, job_id, author_id or guest link id, body, visibility, created_at)
- `message_attachments` (message_id, document_id)

### Notifications & exceptions (Milestone 5)
- `notification_preferences` (company_id, user_id nullable, event, email bool)
- `notifications` (id, user_id, job_id, event, read_at, created_at)
- `email_outbox` (id, to, template, job_id, status queued|sent|failed, provider_id,
  sent_at, opened_at) — "email sent" and "opened" are recorded here and are never treated as
  acceptance
- Exceptions come from `job_status_events` (status `exception`) plus computed checks
  (overdue acknowledgment, missing POD after delivery, approaching appointment).

### Billing readiness (Milestone 7)
- `plans` (id, audience carrier|forwarder, name, price_cents, interval, limits jsonb, active)
- `company_subscriptions` (company_id, plan_id, status, period_start, period_end)
- `billable_events` (id, company_id, job_id, event_type, idempotency_key **unique**,
  created_at). The billable event for forwarders is **"job accepted by a carrier"**, keyed
  `job:{id}:accepted`, so edits, re-sends and document re-uploads can never double-charge.
  Pricing rules read these rows; job code never computes money.

### Indexes for large histories
Unique `jobs.job_number`; btree on `(forwarder_company_id, status, created_at desc)`,
`(carrier_company_id, status, created_at desc)`; `job_containers(container_number)`;
`jobs(booking_number)`, `jobs(bol_number)`; trigram indexes (pg_trgm) on reference fields
for partial search; `job_status_events(job_id, occurred_at)`.

## 4. Status workflow (Milestone 3)

```
draft → sent → awaiting_ack → accepted ─┬→ awaiting_info ─→ ready_for_pickup
                         └→ declined     └→ ready_for_pickup
ready_for_pickup → pickup_scheduled → picked_up → in_transit → delivered
delivered → awaiting_pod → pod_received → (awaiting_empty_return → empty_returned) → completed
any active state → exception → (back to the prior state)   any non-final state → canceled
```
Transitions are a table-driven allow-list checked inside the `set_job_status` RPC, varying by
`move_type` (e.g. empty-return steps only when applicable). Each change writes a
`job_status_events` row with the actor and `source`. Only a signed-in user, a guest link with
the `update_status` permission, or a verified integration can record pickup/delivery.

## 5. Guest job links for non-registered carriers (Milestone 3)
1. Forwarder creates the job and chooses "send to a carrier by email".
2. Server creates a `job_access_links` row with 32 random bytes; only the SHA-256 is stored.
   Default permissions: `view, respond, message, upload_documents, update_status`;
   default expiry 14 days; revocable at any time.
3. Email contains `/j/{token}`. The route hashes the token, checks expiry/revocation, records
   `link accessed` (separately from email sent/opened), and shows **only** that job.
4. The recipient can accept / decline / request clarification, upload documents and post
   updates. Every action is attributed to the link and its email.
5. A "Create your free carrier account" prompt converts the guest into a carrier company and
   attaches the job to it.

## 6. Security checklist
- RLS on every table; deny by default. Cross-tenant tests in `supabase/tests/`.
- Storage bucket private; object paths `{job_id}/{document_id}`; signed URLs ≤ 5 minutes,
  issued only after a `can_access_job` check.
- Invitation and guest tokens: random 256-bit, hashed at rest, expiring, revocable, single
  purpose.
- Audit events for membership changes, invitations, suspensions, status changes, document
  replacement.
- Rate limits: Supabase Auth built-in limits; invitation creation limited per company per hour
  in the RPC; guest-link routes limited per token.
- Secrets only in environment variables; `.env.example` lists them; the service-role key is
  never sent to the browser.
- Backups: Supabase daily backups (enable PITR on a paid plan before production). All schema
  changes as versioned migrations in `supabase/migrations/`.
- Demo data uses obviously fictional companies only.

## 7. Milestones

| # | Scope | Status |
|---|---|---|
| 1 | Auth (sign up, sign in, password reset), company creation & onboarding, roles, team invitations, member management, company switcher, platform admin (companies, suspend/reactivate, audit log), RLS + isolation tests | Done |
| 2 | Carrier profiles, directory search/filter, per-forwarder approvals, platform verification, public website + specialist inquiries | Done |
| 3 | Job creation (multi-container), send to carrier, guest links, accept/decline, status workflow, job detail + timeline | Next |
| 4 | Private document storage, required-doc tracking, POD, job messaging with internal notes | |
| 5 | Dashboards & filters, notifications + exception queue, audit history, reports, CSV export | |
| 6 | Mobile driver workflow, driver assignment, operational extras | |
| 7 | Billing, API, EDI — only when customers ask for it | |

## 8. Configuration

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key — safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Needed from Milestone 3 (guest links). Never prefix with NEXT_PUBLIC |
| `NEXT_PUBLIC_SITE_URL` | both | e.g. `http://localhost:3000`; used in email links |
| `RESEND_API_KEY`, `EMAIL_FROM` | server only | Optional. Without them, emails go to the console/outbox and links are shown on screen |
