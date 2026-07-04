@AGENTS.md

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
