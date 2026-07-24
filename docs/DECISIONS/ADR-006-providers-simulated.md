# ADR-006 — Provider integrations are simulated, faithfully

**Status:** Accepted · **Date:** 2026-07-23

## Context

The hardest real-world part of this domain is the provider integrations —
real utility APIs, with real flakiness. This proof of work has no access to them,
and inventing a fake "integration" that pretends to be real would be dishonest and
would undermine the project's whole credibility stance.

## Decision

**Provider behaviour is simulated, and labelled as simulated everywhere.** The
simulator is faithful to how such integrations actually fail, and it keeps its own
order ledger separate from application state so reconciliation interrogates a
system that does not share our data.

## Options considered

1. **Claim a real integration.** Dishonest, and instantly falsifiable.
2. **A trivial mock that always succeeds.** Useless — it would hide the exact
   failure mode the product exists to handle.
3. **A faithful failure simulator (chosen).** Six modes: ok, degraded,
   duplicate_409, invalid_payload, hard_failure, and the centrepiece
   timeout_after_create — the provider creates the order, then the response is
   lost. From the caller's side that is indistinguishable from "never created."

## Consequences

- `provider-simulator.ts` holds a module-scoped `providerLedger`, deliberately
  separate from our database. `lookupOrder` is the only honest way out of an
  UNKNOWN outcome — ask the provider, do not resubmit.
- Because the ledger is separate, the demo cannot check its own homework: the
  reconciliation test proves recovery against a system that genuinely does not
  share application state.
- Every UI surface labels provider data as simulated.

**Enforced by:** `scenario.test.ts` Act 3 (the provider really did create the
order; the app cannot know it; reconciliation recovers exactly one order).

**Trade-off:** the genuinely hard part — messy real APIs — is the part not built.
Stated plainly in the limitations. Accepted: an honest simulation of the failure
is more valuable here than a real integration of the happy path.
