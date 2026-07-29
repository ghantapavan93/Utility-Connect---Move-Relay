import { describe, it, expect, afterAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { join } from "node:path";

/**
 * The MCP server, spoken to over real stdio.
 *
 * This spawns `mcp/server.mjs` as an actual child process and exchanges actual
 * JSON-RPC lines with it. Importing the module and calling its functions would
 * be easier and would skip the two things most likely to be wrong in a stdio
 * server: whether replies are newline-framed correctly, and whether anything
 * ever writes to stdout that is not protocol.
 *
 * That second one is the classic failure. stdout *is* the channel — one stray
 * `console.log` puts a non-JSON line in the middle of the stream and the
 * client's parser desyncs, which presents as the server mysteriously dying. A
 * test that never reads stdout as a stream cannot catch it.
 *
 * A stub HTTP server stands in for the application so these tests do not need
 * `npm run dev` running. It returns the shapes the real routes return; the real
 * routes have their own tests in `agent-tools-route.test.ts`.
 */

const SERVER = join(process.cwd(), "mcp", "server.mjs");

let stub: Server | null = null;
let child: ChildProcessWithoutNullStreams | null = null;

/** Minimal stand-in for the application's HTTP surface. */
async function startStub(): Promise<string> {
  return new Promise((resolve) => {
    stub = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");

      if (req.url === "/api/v1/agent/runs") {
        res.end(
          JSON.stringify({
            tools: [
              { name: "get_move_record", authority: "read_only", description: "The canonical record." },
              { name: "get_audit_history", authority: "read_only", description: "The audit trail." },
              {
                name: "submit_provider_enrollment",
                authority: "forbidden",
                description: "Submit an enrolment.",
                refusal: "Whether a retry is safe is not a judgement the model may make.",
              },
            ],
          }),
        );
        return;
      }

      if (req.url === "/api/v1/moves") {
        res.end(JSON.stringify({ moves: [{ id: "m-1", reference: "MR-2026-0001", state: "canonical" }] }));
        return;
      }

      if (req.url === "/api/v1/agent/tools/get_move_record") {
        res.end(JSON.stringify({ outcome: "ok", observation: { verified: [{ field: "move.date" }] } }));
        return;
      }

      if (req.url === "/api/v1/agent/tools/submit_provider_enrollment") {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            error: "not callable here",
            authority: "forbidden",
            reason: "Whether a retry is safe is not a judgement the model may make.",
          }),
        );
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    });

    stub.listen(0, "127.0.0.1", () => {
      const address = stub!.address();
      resolve(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`);
    });
  });
}

/** Send one JSON-RPC message and wait for the reply with a matching id. */
function rpc(proc: ChildProcessWithoutNullStreams, message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for id ${message.id}`)), 10_000);
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(line);
          } catch {
            clearTimeout(timer);
            proc.stdout.off("data", onData);
            reject(new Error(`stdout carried a line that is not JSON-RPC: ${line.slice(0, 120)}`));
            return;
          }
          if (parsed.id === message.id) {
            clearTimeout(timer);
            proc.stdout.off("data", onData);
            resolve(parsed);
            return;
          }
        }
        newline = buffer.indexOf("\n");
      }
    };

    proc.stdout.on("data", onData);
    proc.stdin.write(JSON.stringify(message) + "\n");
  });
}

async function server(): Promise<ChildProcessWithoutNullStreams> {
  if (child) return child;
  const baseUrl = await startStub();
  child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, MOVE_RELAY_URL: baseUrl },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  return child;
}

afterAll(() => {
  child?.kill();
  stub?.close();
});

describe("the MCP handshake", () => {
  it("initializes with a protocol version and declares its tool capability", async () => {
    const proc = await server();
    const reply = await rpc(proc, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });

    const result = reply.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe("2024-11-05");
    expect(result.capabilities).toHaveProperty("tools");
    expect((result.serverInfo as Record<string, string>).name).toBe("move-relay");

    // The instructions tell a client what it is holding. An assistant that has
    // to infer "read-only" from the absence of write tools will eventually
    // infer wrong.
    expect(String(result.instructions)).toMatch(/read-only/i);
  });

  it("answers ping", async () => {
    const proc = await server();
    const reply = await rpc(proc, { jsonrpc: "2.0", id: 2, method: "ping" });
    expect(reply.result).toEqual({});
  });

  it("returns method-not-found rather than silence for an unknown method", async () => {
    const proc = await server();
    const reply = await rpc(proc, { jsonrpc: "2.0", id: 3, method: "resources/list" });
    expect((reply.error as Record<string, unknown>).code).toBe(-32601);
  });
});

describe("the tools it advertises", () => {
  it("lists the read-only tools and never a forbidden one", async () => {
    /*
      The load-bearing assertion. An MCP client is an assistant inside somebody's
      editor; offering it a tool that can never succeed is an invitation to keep
      trying. The boundary stays published at GET /api/v1/agent/runs for anyone
      who wants to read it — it is just not handed over as an affordance.
    */
    const proc = await server();
    const reply = await rpc(proc, { jsonrpc: "2.0", id: 4, method: "tools/list" });

    const tools = (reply.result as { tools: Array<{ name: string; inputSchema: unknown }> }).tools;
    const names = tools.map((t) => t.name);

    expect(names).toContain("get_move_record");
    expect(names).toContain("get_audit_history");
    expect(names).not.toContain("submit_provider_enrollment");

    // A discovery tool has to exist, or every other tool needs a UUID the
    // client has no way to obtain.
    expect(names).toContain("list_moves");

    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} needs a schema`).toBeTruthy();
    }
  });
});

describe("calling a tool", () => {
  it("returns the observation as text content", async () => {
    const proc = await server();
    const reply = await rpc(proc, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "get_move_record", arguments: { moveId: "m-1" } },
    });

    const result = reply.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.type).toBe("text");
    expect(JSON.parse(result.content[0]!.text)).toHaveProperty("verified");
  });

  it("reports a refusal as a tool error carrying the reason, not a protocol error", async () => {
    /*
      The distinction matters more than it looks. A JSON-RPC error means the
      client sent something malformed; `isError: true` means the call was
      well-formed and the system declined. Collapsing them would tell an
      assistant its request was invalid when in fact it was refused — and the
      reason is the part it should learn from.
    */
    const proc = await server();
    const reply = await rpc(proc, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "submit_provider_enrollment", arguments: { moveId: "m-1" } },
    });

    expect(reply.error).toBeUndefined();
    const result = reply.result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/not a judgement the model may make/i);
  });

  it("refuses a call with no moveId rather than inventing one", async () => {
    const proc = await server();
    const reply = await rpc(proc, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "get_move_record", arguments: {} },
    });

    const result = reply.result as { content: Array<{ text: string }>; isError: boolean };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/moveId is required/i);
  });

  it("survives a malformed line without dying", async () => {
    // A client that sends garbage must get a parse error and a live server,
    // not a closed pipe.
    const proc = await server();
    proc.stdin.write("this is not json\n");

    const reply = await rpc(proc, { jsonrpc: "2.0", id: 8, method: "ping" });
    expect(reply.result).toEqual({});
  });
});
