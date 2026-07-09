@AGENTS.md

# Roles and permissions

The app has two roles: `owner` (`businesses.owner_id`) and `encargado`
(`business_members`, `role="encargado"`, `status` in
`invited`/`active`/`revoked`). `getCurrentBusiness()` (`lib/business.ts`)
resolves either and returns `role` on the result — always branch on that
field rather than re-deriving role from raw table membership.

**v1 simplification — one business per encargado, forever.**
`business_members.user_id` has a `unique` index: an encargado can belong to
exactly one business, for the lifetime of that user, by design. If
multi-business managers ever become a requirement, this needs a real
migration: drop the `unique(user_id)` index, add a composite
`unique(business_id, user_id)`, revisit every RLS policy and the
`getCurrentBusiness()` resolution query that currently assume
`.maybeSingle()` keyed by `user_id` alone, and add a "current business"
selection concept that doesn't exist today (login goes straight to the
single business, no picker).

**Permission spec for Stock and Finanzas (read this before building either
module).** Postgres RLS is row-level, not column-level — no single policy
can show an encargado quantity/movement data on a row while hiding a price
column on that same row. Do not try; split the data model instead:

- **Stock**: encargado can insert today's stock/consumption entries, but
  must never see monetary valuation, and must never update or delete
  historical (non-today) records. Put monetary valuation in a separate
  table that only the owner can `SELECT` (e.g. `stock_valuations`), never a
  price column on the shared quantity/movement table the encargado also
  reads. Scope the encargado's write access to same-day rows only, e.g. a
  `created_at::date = current_date` condition in the RLS `USING` clause for
  UPDATE/DELETE (INSERT of new same-day rows is unrestricted).
- **Finanzas**: encargado can insert the daily cash-closing entry, but must
  never see totals, historical entries, or aggregate reports — this is
  stricter than Stock, closer to write-only. Give the encargado an
  INSERT-only RLS policy on the finance table (no SELECT policy for that
  role at all). RLS alone does not protect a reporting/aggregation code
  path that runs with a privileged connection — any such endpoint or server
  action must independently check `role === "owner"` server-side before
  returning aggregate data, the same way `app/dashboard/settings/page.tsx`
  and `app/dashboard/settings/actions.ts` re-check ownership rather than
  trusting RLS alone for the invite flow.

**Per-professional RLS restriction (peluquería/salón) — a stricter precedent
than restaurant's.** Restaurant encargados see every reservation in the
business (single shared `is_active_business_member`-based policy). Peluquería
encargados are different: each one is linked to a specific `professionals`
row via `business_members.professional_id`, and the `"Members can manage
their business reservations"` policy on `reservations` is narrowed (only for
`business_type = 'peluqueria_salon'`) so a member can only read/write rows
whose `professional_id` matches their own. Since PostgreSQL PERMISSIVE
policies only ever widen access when OR'd together, this restriction has to
live *inside* that one policy's boolean expression — it cannot be layered on
via an extra policy. If Stock/Finanzas or any future section needs a
similar "this encargado only sees their own slice" restriction, follow this
same shape (one shared policy, gated by business type/role inside its own
`USING`/`WITH CHECK`), not a second permissive policy.

**No-show auto-flagging runs in two layers, both must stay in sync.** A
`pg_cron` job (`flag-reservation-no-shows`, every minute) flags any
`confirmed` reservation with no `arrived_at` more than 15 minutes past
`starts_at` as `no_show`, in the background regardless of whether anyone has
a dashboard open. `syncNoShows()` (`app/dashboard/reservations/actions.ts`)
runs the same logic scoped to one business, on every reservations page load
and every 60s while the tab is open, so the alert appears instantly for
whoever's looking. **The cron job's `WHERE` clause is the single place that
decides which business types this feature applies to** — it must scope by
`businesses.business_type in (...)`, not by the presence of a business-type-
specific settings table (an earlier version scoped by `exists (select 1 from
reservation_settings ...)`, which incidentally only matches restaurants and
silently never flagged peluquería no-shows — worse, since `reservation_settings`
has no bearing on no-show semantics at all, that scoping was accidental, not
intentional). When a third business type adopts this feature, add it to that
`in (...)` list.

**`is_active_business_member()` never covers the owner — every new table needs
its own explicit owner policy, not just a "Members" one.** The helper only
checks `business_members` (encargados); an owner has no row there at all, so
`using (is_active_business_member(business_id))` alone silently blocks the
owner too. This bit the gimnasio build for real: `fee_payments` shipped with
only "Members can view/insert" (`is_active_business_member`) plus
"Owners can update/delete", and the owner's "Registrar pago" button silently
did nothing — no error surfaced in the UI either, because the calling code
didn't check the server action's return value (fixed in both places: added
`"Owners can view/insert fee_payments"` policies, and made the UI actually
render `{error}` from every mutating action). When adding RLS to a new table,
default to giving the owner a real `for select`/`for insert` (or `for all`)
policy explicitly — never assume `is_active_business_member` "plus an
owner-only UPDATE/DELETE" is enough, because SELECT/INSERT need the owner
too.

**A GiST exclusion constraint on `professional_id` only makes sense for a
1-person-serves-1-client-at-a-time model — scope it out of any group/cupo
model sharing the same column.** `reservations_professional_no_overlap`
(added for peluquería, where a professional can't be double-booked) was
initially left unscoped when gimnasio_academia started also setting
`professional_id` on class-attendance rows — but a gimnasio class is exactly
many students under the same instructor at the same `starts_at`, which the
peluquería-shaped constraint rejected as a "conflict". Fixed by gating the
generated `professional_occupied_range` column on `class_instance_id is
null` (peluquería reservations never have one, gimnasio ones always do), so
the exclusion constraint only ever fires for the 1:1 case; gimnasio capacity
is enforced separately, by `SELECT ... FOR UPDATE` + a count check inside
`enroll_student_punctual`/`enroll_student_recurring`. If a future business
type reuses `professional_id` for another group-style concept, make sure it's
similarly excluded from this constraint rather than assumed covered.

**Mercado Pago OAuth Connect — real constraints discovered while building
the gimnasio "Alumnos y Cuotas" recurring-billing integration**, kept here
since they're not obviously documented and cost real debugging time:
- **Sandbox test users (`POST /users/test_user`) cannot complete the
  `/authorization` login flow at all** — even with a perfectly registered
  `redirect_uri`, logging in as a test user fails with "la aplicación no
  puede conectarse a tu cuenta". This is a Mercado Pago platform limitation,
  not a config bug. Any real end-to-end OAuth-connect test has to use a real
  Mercado Pago account (a `status: "pending"` preapproval is enough to prove
  `collector_id` attribution without ever charging anyone).
- **`redirect_uri` must be `https://`** — Mercado Pago rejects
  `http://localhost:...` redirect URIs outright (403 on `/authorization`
  before any account/login step). Local testing needs an https tunnel (e.g.
  ngrok) forwarding to the dev server; the tunnel URL must be registered
  *exactly* (path included — a bare domain with no path is a silent
  mismatch that also 403s).
- **`payer_email` is required on `POST /preapproval`, even for
  `status: "pending"`** — omitting it is a clean 400, but pairing a
  sandbox-only `@testuser.com` payer email with a *real* (non-test)
  collector token produced an opaque 500, not a validation error. Use a
  real-looking email for anything created under a real connected account.
- **`client_id` is the same for a Mercado Pago app's test and production
  credentials** — only the access tokens differ (`TEST-...` vs `APP_USR-...`
  prefix). Don't assume a separate `client_id` exists per mode.
- The empirical proof this app relies on: creating a subscription via
  `POST /preapproval` authenticated with the *connected business's own*
  OAuth access token (not Lazzo's app-level token) sets `collector_id` to
  that business, confirmed via `scripts/mp-sandbox-spike.ts` — this is what
  makes money go directly to the business's own account with no Mercado
  Pago "Split Payments" feature involved at all (that feature is documented
  as unsupported for Subscriptions anyway).

# Product roadmap notes

## Planned: public booking page (not yet implemented)

A future phase will add a public, no-login booking page per business (e.g.
`lazzo.app/reservas/[nombre-del-negocio]`), letting a business's own
customers see availability and create a reservation themselves. It will
reuse the existing `reservations` table (see `resources`/`reservations`
migrations) rather than a new schema.

Known open problems to solve when this is built, not before:
- Preventing double-booking / race conditions on the same
  resource+time-slot when two customers submit concurrently.
- Real-time availability calculation (what's actually free to show).
- Anti-spam / anti-bot protection, since this page requires no
  authentication.
- Business rules still undefined: how far in advance a customer can book,
  whether a customer can cancel their own reservation, daily/per-customer
  limits, etc.
