# ADR-007 — The public marketing site is not evidence of internal quality

**Status:** Accepted · **Date:** 2026-07-23

## Context

Studying utilityconnect.net surfaces real, verifiable observations: counters that
show the same metric with very different values on different pages, review
timestamps that all carry the crawl date, and a front-end stack from the early
2010s (PHP 5.6, Apache 2.2.22, jQuery 1.11.3, Bootstrap 3).

These are genuine and useful. They are also the single most dangerous material in
the project, because the obvious move — "look how weak their engineering is" —
would be both wrong and self-destructive. The founder has years of proprietary
CRM and platform experience; the marketing site and the operating platform are
different systems, and a public fingerprint sees only the former.

## Decision

**No public-site observation is ever presented as evidence about the internal
platform, the team, or their engineering.** Marketing-layer findings may be used
only as *narrative hooks* about the marketing layer, or, for the tech stack, as an
*additive* "modernize the front door" comparison that explicitly disclaims any
claim about internal systems.

## Consequences

- The counter discrepancy (1,503 vs 846,714) appears on the redesign as "which
  number is the source of truth?" — with an on-page disclaimer that it is a public
  marketing-page observation, not a claim about any internal system.
- The stack comparison (`FrontDoor`) compares front doors only, and says so on the
  page.
- Every research document tags claims `[FACT] / [INFER] / [ASSUME] / [HYPO]` and
  carries an explicit "do not conclude" block for these observations.
- Framing throughout: "a hypothesis-driven, additive product layer based on public
  workflows" — never "they lack X."

**Enforced by:** `research/public-facts-vs-assumptions.md`,
`research/tech-stack-observation.md`, and the on-page disclaimers in `FrontDoor`
and the provenance-hook section.

**Trade-off:** the project passes up the cheap, punchy "their site is broken"
angle. Accepted without hesitation: respect for the existing systems is a stated
non-negotiable, and it is also simply correct.
