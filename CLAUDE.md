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
