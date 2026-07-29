import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";
import { TOOLS } from "../agent/tools";
import { POST as invokeOverHttp } from "@/app/api/v1/agent/tools/[name]/route";

/**
 * The tool registry, reached over HTTP.
 *
 * The case agent calls `invokeTool` in-process. This route is the second
 * consumer and the MCP server is the third, and the entire value of that
 * arrangement rests on one property: **a tool that is forbidden must be
 * forbidden identically through every door.** A boundary observed by the only
 * caller anyone tested is not a boundary.
 *
 * So this file walks the registry rather than naming tools by hand. Adding a
 * forbidden tool later and forgetting to think about HTTP is the mistake it
 * exists to catch.
 */

const call = (name: string, body: unknown) =>
  invokeOverHttp(
    new Request("http://test.local/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ name }) },
  );

let org: string;
let move: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Tools route org", `tools-route-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state) VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-TOOLS-${Date.now()}`],
    )
  )[0]!.id;
});

describe("every read-only tool is reachable over HTTP", () => {
  it("serves each one against a real move", async () => {
    const readOnly = TOOLS.filter((t) => t.authority === "read_only");
    expect(readOnly.length).toBeGreaterThan(0);

    for (const tool of readOnly) {
      const response = await call(tool.name, { moveId: move });
      expect(response.status, `${tool.name} should succeed`).toBe(200);

      const body = await response.json();
      expect(body.outcome, `${tool.name}: ${body.note ?? ""}`).toBe("ok");
      expect(body.authority).toBe("read_only");
    }
  });
});

describe("nothing above read-only is reachable over HTTP", () => {
  it("refuses every non-read-only tool, with the registry's own reason", async () => {
    /*
      Walked from the registry, not listed here. A future forbidden tool that
      nobody thought about in the context of HTTP still gets checked.
    */
    const guarded = TOOLS.filter((t) => t.authority !== "read_only");
    expect(guarded.length).toBeGreaterThan(0);

    for (const tool of guarded) {
      const response = await call(tool.name, { moveId: move });
      expect(response.status, `${tool.name} must be refused`).toBe(403);

      const body = await response.json();
      expect(body.authority).toBe(tool.authority);
      // A refusal without a reason teaches the caller nothing, and the reason
      // is the part worth publishing.
      expect(body.reason?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("refuses before it even reads the body", async () => {
    // Order matters: authority is checked first, so a malformed request to a
    // forbidden tool still reports the refusal rather than a validation error.
    // Otherwise the boundary would look like an input problem.
    const response = await call("submit_provider_enrollment", { nonsense: true });
    expect(response.status).toBe(403);
  });

  it("404s for a tool that does not exist", async () => {
    const response = await call("force_submit", { moveId: move });
    expect(response.status).toBe(404);
  });
});

describe("the tenant comes from the move, never the caller", () => {
  it("ignores an organizationId in the body", async () => {
    const attacker = (
      await query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
        ["Elsewhere", `elsewhere-${Date.now()}`],
      )
    )[0]!.id;

    const response = await call("get_move_record", { moveId: move, organizationId: attacker });
    expect(response.status).toBe(200);
    // The call succeeded against the move's real tenant. Had the route trusted
    // the body, this would have read one tenant's data under another's name.
    expect((await response.json()).outcome).toBe("ok");
  });

  it("404s for a move that does not exist", async () => {
    const response = await call("get_move_record", {
      moveId: "00000000-0000-4000-8000-000000000000",
    });
    expect(response.status).toBe(404);
  });
});
