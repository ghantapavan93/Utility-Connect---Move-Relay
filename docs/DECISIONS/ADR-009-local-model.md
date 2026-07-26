# ADR-009 — The live model is local

**Status:** accepted
**Date:** 2026-07-26

## Context

An audit found the LLM integration **PARTIAL**: `anthropicAdapter` was a genuine
`fetch` to a real API, and no test had ever exercised the HTTP path. All nine
gateway tests used a scripted adapter or none. Every AI run recorded in this
project's history was the deterministic fallback — the seam was real and had
never carried traffic.

"We support LLM APIs" was therefore technically true and practically false, which
is the precise failure mode this codebase exists to argue against.

Closing it with Anthropic required an API key. That meant the capability could
only be demonstrated by whoever held the key, and could not be verified by anyone
reviewing the repository.

## Decision

The default live adapter is a **local model served by Ollama**, discovered at
runtime. Resolution order:

1. `ANTHROPIC_API_KEY` if set — someone who configured one meant it.
2. A reachable Ollama on `OLLAMA_HOST` (default `127.0.0.1:11434`).
3. Deterministic assembly.

Three reasons, in order of weight:

**Data.** The whole system is an argument about handling other people's data
carefully. A local model means the synthetic customer records in this demo never
leave the machine in order to prove that a language model can be called. Sending
them to a third party to demonstrate care would be an odd way to demonstrate it.

**Verifiability.** A reviewer can clone this repository, run `ollama serve`, and
watch `ai_runs.model` read `ollama:llama3.1:8b` with `fallback = false`. No key is
issued, nothing is taken on trust. That is the difference between a demonstrable
capability and a screenshot of one.

**Cost.** Free, and therefore never a reason to stop running it.

## What the model is and is not allowed to do

Unchanged by this decision, and worth restating because it is what makes a small
model acceptable here: the gateway never lets the model decide anything. Claims
are assembled from cited `field_versions` rows first; the model only rewrites
that assembly into prose; any line citing an id that was not supplied is dropped
before display. A weaker model produces a **blander** briefing, not a wrong one.

There is a test that hands the real model a prompt-injection string and asserts
the invented citation does not survive.

## Consequences

Two adjustments were needed, and both were the local model exposing wrong
assumptions rather than the model being at fault:

- **Constrained decoding.** Asked for JSON in a system prompt, `llama3.1:8b`
  replied `"OK."`. The gateway correctly rejected it as `invalid_output` and fell
  back — so the model looked unavailable when it was merely chatty. Ollama's
  `format: "json"` forces well-formed JSON at the sampler, which is a stronger
  guarantee than asking politely.
- **A timeout that reflects where the model runs.** Ten seconds is right for a
  hosted API and wrong for a local one: the first call took 33 seconds, most of
  it loading weights. Under a single deadline the local path timed out every
  time, which from the outside is indistinguishable from having no model at all.
  Local adapters now get 90 seconds.

Tests skip rather than fail when Ollama is absent. A machine without it is not a
broken machine — deterministic assembly is the designed floor, not a degraded
mode — and a suite that goes red on a laptop with no model installed is a suite
somebody deletes.

## Alternatives rejected

- **Anthropic only.** Rejected: unverifiable without a key, and it sends
  synthetic customer data off-machine to prove a point about not doing that.
- **Ship the fallback and call it "AI-ready".** Rejected. That is the exact
  phrasing the audit was written to catch.
- **A cloud free tier.** Rejected: rate limits and sign-up make it fail for a
  reviewer at the worst moment, and it reintroduces the data-egress objection.
