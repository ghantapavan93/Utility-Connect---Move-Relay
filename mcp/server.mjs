#!/usr/bin/env node
/**
 * Move Relay — a read-only MCP server.
 *
 * Exposes the platform's governed read-only tools to any MCP client: Claude
 * Desktop, an IDE, a local script. The point is not that AI can now read the
 * database — it could always do that through the API. The point is that the
 * *same registry* decides what is reachable here as decides what the concierge
 * case agent may touch in-process. One boundary, three consumers.
 *
 * ## Why this is a bridge and not a copy
 *
 * The obvious implementation imports the tool registry and queries Postgres
 * directly. That would be faster and it would be wrong: there would then be two
 * places where "what may an AI touch?" is answered, and they would agree until
 * the first time somebody edited one of them. This process holds no database
 * credentials and knows no SQL. It speaks JSON-RPC on stdin/stdout and HTTP to
 * the running application, and every authority decision happens server-side in
 * `src/lib/agent/tools.ts`.
 *
 * A consequence worth stating plainly: if the app is not running, this server
 * starts fine and every tool call fails with a connection error. That is the
 * honest failure. The alternative — a second path into the data that works when
 * the application is down — is exactly the thing worth not building.
 *
 * ## Why no SDK
 *
 * `@modelcontextprotocol/sdk` is the idiomatic choice and this deliberately
 * does not use it. MCP over stdio is line-delimited JSON-RPC 2.0 with three
 * methods that matter, and this project's rule is that no dependency arrives
 * without an ADR justifying it. ~150 lines of protocol against one dependency,
 * for a surface this small, is not a close call. See ADR-011.
 *
 * ## Protocol implemented
 *
 *   initialize                 → protocolVersion, capabilities, serverInfo
 *   notifications/initialized  → acknowledged, no reply (it is a notification)
 *   tools/list                 → the read-only tools, with JSON Schema
 *   tools/call                 → invoke one, return its observation as text
 *   ping                       → {}
 *
 * Anything else answers JSON-RPC error -32601, method not found.
 *
 * ## Running it
 *
 *   npm run dev                        # the application must be up
 *   node mcp/server.mjs                # speaks MCP on stdin/stdout
 *
 * Wire it into a client with `mcp/README.md`.
 */

import { createInterface } from "node:readline";

const BASE_URL = process.env.MOVE_RELAY_URL ?? "http://localhost:3000";
const PROTOCOL_VERSION = "2024-11-05";

/**
 * Log to stderr, never stdout.
 *
 * stdout *is* the protocol channel. A stray `console.log` writes a line that is
 * not JSON-RPC into the middle of the stream and the client's parser desyncs —
 * a failure that looks like the server crashing for no reason.
 */
const log = (...args) => console.error("[move-relay-mcp]", ...args);

/** Fetch the tool catalogue from the running application. */
async function fetchTools() {
  const response = await fetch(`${BASE_URL}/api/v1/agent/runs`);
  if (!response.ok) throw new Error(`tool catalogue: HTTP ${response.status}`);
  const body = await response.json();

  /*
    Only the read-only tools are advertised. The forbidden ones are deliberately
    not offered here — an MCP client is an assistant in somebody's editor, and
    handing it a tool it can never successfully call is an invitation to try.
    The boundary is still published at GET /api/v1/agent/runs for anyone who
    wants to read it.
  */
  return (body.tools ?? []).filter((tool) => tool.authority === "read_only");
}

/** The JSON Schema every tool takes. All of them are scoped to one move. */
const INPUT_SCHEMA = {
  type: "object",
  properties: {
    moveId: {
      type: "string",
      description: "UUID of the move to read. Use list_moves to find one.",
    },
  },
  required: ["moveId"],
  additionalProperties: false,
};

/**
 * A convenience tool with no equivalent in the agent's registry.
 *
 * The agent is always handed a move; an MCP client has to find one first, and
 * a tool surface where every call needs a UUID you cannot obtain is a surface
 * nobody can use. It reads the same endpoint the move queue screen does.
 */
const LIST_MOVES = {
  name: "list_moves",
  description:
    "List the moves in the demo tenant with their state and open-conflict counts. Start here to obtain a moveId.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

async function callTool(name, args) {
  if (name === "list_moves") {
    const response = await fetch(`${BASE_URL}/api/v1/moves`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  const moveId = args?.moveId;
  if (typeof moveId !== "string" || moveId.length === 0) {
    throw new Error("moveId is required — call list_moves first");
  }

  const response = await fetch(`${BASE_URL}/api/v1/agent/tools/${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ moveId }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    /*
      Surface the server's stated reason rather than a status code. A client
      that is told "403" learns nothing; one that is told *why this action is
      never permitted* learns the shape of the system.
    */
    throw new Error(body?.reason ?? body?.error ?? `HTTP ${response.status}`);
  }
  return body.observation ?? body;
}

/** One JSON-RPC request in, one response out (or null for a notification). */
async function handle(message) {
  const { id, method, params } = message;
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, msg) => ({ jsonrpc: "2.0", id, error: { code, message: msg } });

  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "move-relay", version: "1.0.0" },
        instructions:
          "Read-only access to Move Relay's canonical move records, field-level provenance, " +
          "conflicts, provider submission state, consent events, and the append-only audit trail. " +
          "Nothing here can change any record. Actions that would — submitting a provider " +
          "enrolment, merging a conflicting field, confirming an order — are refused by the " +
          "server and are not offered as tools.",
      });

    // A notification has no id and must receive no reply at all.
    case "notifications/initialized":
      return null;

    case "ping":
      return ok({});

    case "tools/list": {
      const tools = await fetchTools();
      return ok({
        tools: [
          LIST_MOVES,
          ...tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: INPUT_SCHEMA,
          })),
        ],
      });
    }

    case "tools/call": {
      const name = params?.name;
      try {
        const result = await callTool(name, params?.arguments ?? {});
        return ok({
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        /*
          A tool failure is `isError: true` in the result, not a JSON-RPC error.
          The distinction matters: a protocol error means the client sent
          something malformed, while this means the call was well-formed and the
          system declined or could not answer. Collapsing the two would tell an
          assistant its request was invalid when in fact it was refused.
        */
        return ok({
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        });
      }
    }

    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n",
    );
    return;
  }

  try {
    const response = await handle(message);
    if (response) process.stdout.write(JSON.stringify(response) + "\n");
  } catch (error) {
    // Never let a handler throw take the process down mid-session; the client
    // would see the pipe close with no explanation.
    log("handler failed:", error);
    if (message.id !== undefined) {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32603, message: error instanceof Error ? error.message : String(error) },
        }) + "\n",
      );
    }
  }
});

log(`ready — bridging to ${BASE_URL}`);
