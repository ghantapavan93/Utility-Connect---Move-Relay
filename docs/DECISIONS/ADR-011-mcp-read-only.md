# ADR-011 — The MCP server is a read-only bridge, and has no SDK

**Status:** Accepted · **Date:** 2026-07-27

## Context

An MCP server was deferred from the start, with a qualifier: *read-only,
optional*. That deferral was right while there was nothing behind it — an MCP
server over an empty domain is a protocol demo.

Two things changed. The domain exists, and so does a tool registry with real
authority tiers (ADR-010). That registry currently has exactly one consumer, the
concierge case agent, running in-process. A boundary with one caller is not yet
a boundary; it is a convention that caller happens to observe. Exposing the same
registry to an unrelated client is what turns it into an interface.

## Decision

**A read-only MCP server ships as a bridge over the application's HTTP API,
with no MCP SDK dependency.**

Three consumers now share one registry: the agent calls `invokeTool` in-process,
`POST /api/v1/agent/tools/[name]` calls it over HTTP, and `mcp/server.mjs`
bridges JSON-RPC to that route. A tool that is forbidden is forbidden
identically through all three, and the test walks the registry rather than
naming tools, so a forbidden tool added later by someone not thinking about HTTP
or MCP is still checked.

## Options considered

1. **Import the registry and query Postgres directly from the MCP process.**
   Fewer moving parts and one fewer hop. Rejected: it creates a second place
   answering "what may an AI touch?", and two answers agree only until somebody
   edits one. It would also hold database credentials in a process launched by
   an editor.
2. **Use `@modelcontextprotocol/sdk`.** Idiomatic, and what a reviewer expects.
   Rejected for this surface: MCP over stdio is line-delimited JSON-RPC 2.0 with
   `initialize`, `tools/list` and `tools/call` doing the work. That is ~150
   lines. The project's standing rule is that no dependency arrives without a
   stated purpose, a non-duplication check, and an ADR — and "the SDK would
   write the switch statement for me" does not clear it. Reconsider immediately
   if resources, prompts, sampling, or transport negotiation are needed;
   hand-rolling those would be a different and much worse trade.
3. **Expose write tools with a confirmation prompt.** Rejected outright.
   Approving an action has an actor and a recorded run behind it. A bare tool
   call that executed one would be an unaudited second path into the domain,
   and the confirmation would live in a client this repository does not control.

## Consequences

- The MCP process holds no credentials and knows no SQL. If the application is
  down, every call fails with a connection error. That is the honest failure
  mode; the alternative is a path into the data that works while the app does
  not.
- `requires_approval` tools are refused over HTTP as firmly as forbidden ones.
  Approvals go through `POST /api/v1/agent/runs/[id]`, where the run and the
  human are both known.
- Forbidden tools are **not advertised** to MCP clients. They remain defined in
  the registry and published at `GET /api/v1/agent/runs`. Offering an assistant
  a tool that can never succeed is an invitation to keep trying; hiding the
  boundary entirely would be worse, so it is published rather than offered.
- A refusal returns `isError: true` with the reason, never a JSON-RPC error. A
  protocol error means the client sent something malformed; this call was
  well-formed and was declined, and the reason is the part worth learning from.
- `list_moves` exists here and not in the agent's registry. The agent is always
  handed a move; a client is not, and a tool surface where every call needs a
  UUID you cannot obtain is unusable.
- stdout carries protocol only. The test spawns the real process and fails if
  any line on stdout is not valid JSON-RPC, because a stray `console.log`
  desyncs the client and presents as an unexplained crash.
- **Not built:** resources, prompts, sampling, and any transport other than
  stdio. None are needed for a read surface this size.
