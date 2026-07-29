# Move Relay — MCP server

Read-only access to the platform's canonical move records, field-level
provenance, conflicts, provider submission state, consent events, and the
append-only audit trail — over the Model Context Protocol.

Nothing here can change a record. That is not a policy in a prompt; the server
holds no database credentials and knows no SQL. Every call is checked against
the same authority registry that governs the concierge case agent
(`src/lib/agent/tools.ts`), server-side, before anything runs.

---

## Run it

The application must be running — this server is a bridge, not a second door
into the data.

```bash
npm run dev          # terminal 1
npm run mcp          # terminal 2, speaks MCP on stdin/stdout
```

`MOVE_RELAY_URL` overrides the target (default `http://localhost:3000`).

---

## Wire it into a client

### Claude Code

```bash
claude mcp add move-relay -- node /absolute/path/to/mcp/server.mjs
```

### Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "move-relay": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/server.mjs"],
      "env": { "MOVE_RELAY_URL": "http://localhost:3000" }
    }
  }
}
```

Absolute paths — the client does not run from this directory.

---

## The tools

| Tool | Returns |
| --- | --- |
| `list_moves` | Every move in the demo tenant, with state and open-conflict counts. **Start here** — the others need a `moveId`. |
| `get_move_record` | The canonical record: verified fields with their source channel, unconfirmed fields, open conflicts, services and live provider state |
| `list_field_conflicts` | Fields where sources disagree, with each competing value and the channel that supplied it |
| `get_provider_operation` | Provider submissions: state, operation key, order id. `unknown` means the response was lost and the outcome is genuinely not known |
| `get_audit_history` | The append-only trail — what happened, who did it, when |
| `get_consent_status` | Consent events: purpose, channel, granted, and the exact wording version agreed to |

Every tool except `list_moves` takes `{ moveId }`.

### What is deliberately not here

`submit_provider_enrollment` · `merge_canonical_record` · `mark_order_confirmed`
· `update_consent` · `delete_audit_history`

These are not omitted — they are **defined** as forbidden in the registry, so a
refusal is a recorded event rather than an absence. They are simply not
advertised to a client, because offering an assistant a tool that can never
succeed is an invitation to keep trying.

Ask for one anyway and the reply is `isError: true` carrying the reason, not a
protocol error. The call was well-formed; the system declined. Read the whole
boundary at `GET /api/v1/agent/runs`.

---

## Design notes

**It is a bridge, not a copy.** The obvious implementation imports the registry
and queries Postgres directly. That would be faster and it would be wrong:
there would then be two places answering "what may an AI touch?", and they
would agree right up until somebody edited one. This process speaks JSON-RPC on
stdio and HTTP to the application. If the app is down, every call fails with a
connection error — that is the honest failure. A second path into the data that
works while the application is down is exactly the thing worth not building.

**No SDK.** `@modelcontextprotocol/sdk` is the idiomatic choice and this does
not use it. MCP over stdio is line-delimited JSON-RPC 2.0 with three methods
that matter; the project's rule is that no dependency arrives without an ADR
justifying it, and ~150 lines against one dependency for a surface this small is
not a close call. See `docs/DECISIONS/ADR-011-mcp-read-only.md`.

**stdout is the protocol.** Nothing but JSON-RPC is written there — logging goes
to stderr. A single stray `console.log` desyncs the client's parser and presents
as the server dying for no reason. `src/lib/__tests__/mcp-server.test.ts` spawns
the real process and fails if any line on stdout is not valid JSON-RPC.

---

## Verifying it

```bash
npx vitest run src/lib/__tests__/mcp-server.test.ts
```

Spawns the real server as a child process and exchanges real JSON-RPC lines
with it, against a stub application. The routes it bridges to have their own
tests in `agent-tools-route.test.ts`, which walks the registry rather than
naming tools by hand — so a forbidden tool added later, by someone not thinking
about HTTP or MCP, is still checked.
