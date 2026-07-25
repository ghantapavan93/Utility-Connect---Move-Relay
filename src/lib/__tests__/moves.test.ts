import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { ingestReferral } from "../intake";
import { listMoves, conflictsFor, approveMergeFor, StaleMergeError } from "../moves";
import { timelineFor } from "../projector";

/**
 * The generalized move workspace: any intake-created move can be listed,
 * inspected, and resolved — with the same guarantees as the scripted demo,
 * plus optimistic locking at the merge boundary.
 */

let org: string;
let moveId: string;
let version: number;

const casey = {
  customer: { first_name: "Casey", last_name: "Tran", email: "casey.tran@example.com", phone: "469-555-0321" },
  move: { date: "2026-11-05", to_address: "9 Legacy Dr, Plano, TX 75024" },
  services: ["electric", "security"],
};

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Workspace','wksp') RETURNING id`,
    )
  )[0]!.id;

  // Casey arrives twice: her own form, then a partner feed with a stale date.
  const first = await ingestReferral({ organizationId: org, channel: "customer_form", payload: casey });
  moveId = first.moveId!;
  await ingestReferral({
    organizationId: org,
    channel: "partner_api",
    payload: {
      customer: casey.customer,
      move: { date: "2026-11-01", to_address: casey.move.to_address },
      referral: { partner_slug: "plano-homes" },
    },
  });
});

describe("the move queue", () => {
  it("lists the move with its open-conflict and source counts", async () => {
    const moves = await listMoves(org);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.reference).toMatch(/^MR-W/);
    expect(moves[0]!.openConflicts).toBeGreaterThanOrEqual(1);
    expect(moves[0]!.sources).toBe(2);
    version = moves[0]!.version;
  });

  it("exposes each conflict with all candidates and a recommendation", async () => {
    const result = await conflictsFor(moveId);
    const dateConflict = result!.conflicts.find((c) => c.fieldPath === "move.date");
    expect(dateConflict).toBeDefined();
    expect(dateConflict!.candidates).toHaveLength(2);
    // The customer's own statement outranks the partner feed.
    expect(dateConflict!.recommended?.value).toBe("2026-11-05");
    expect(dateConflict!.recommended?.channel).toBe("customer_form");
  });
});

describe("the generalized merge", () => {
  it("rejects a stale merge with the current version — no silent overwrite", async () => {
    await expect(
      approveMergeFor({
        organizationId: org,
        moveId,
        expectedVersion: version - 1, // read before someone else's write
        actor: "human:concierge-9",
        decisions: [{ fieldPath: "move.date", value: "2026-11-05", reason: "customer stated" }],
      }),
    ).rejects.toThrow(StaleMergeError);
  });

  it("rejects an unnamed actor before the database has to", async () => {
    await expect(
      approveMergeFor({
        organizationId: org,
        moveId,
        expectedVersion: version,
        actor: "   ",
        decisions: [{ fieldPath: "move.date", value: "2026-11-05", reason: "x" }],
      }),
    ).rejects.toThrow(/named human/);
  });

  it("applies a fresh merge: canonical row, audit, event, timeline — one transaction", async () => {
    const result = await approveMergeFor({
      organizationId: org,
      moveId,
      expectedVersion: version,
      actor: "human:concierge-9",
      decisions: [
        {
          fieldPath: "move.date",
          value: "2026-11-05",
          reason: "Customer stated the 5th directly; partner feed predates her closing change.",
        },
      ],
    });

    expect(result.newVersion).toBe(version + 1);

    const canonical = await query<{ selected_by: string }>(
      `SELECT selected_by FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date' AND is_canonical`,
      [moveId],
    );
    expect(canonical[0]!.selected_by).toBe("human:concierge-9");

    const audit = await query<{ actor: string }>(
      `SELECT actor FROM audit_events
        WHERE move_id = $1 AND event_type = 'move.canonical.approved'`,
      [moveId],
    );
    expect(audit[0]!.actor).toBe("human:concierge-9");

    const timeline = await timelineFor(moveId);
    expect(timeline.some((t) => t.headline.includes("confirmed"))).toBe(true);
  });

  it("the resolved field leaves the conflict list", async () => {
    const after = await conflictsFor(moveId);
    expect(after!.conflicts.find((c) => c.fieldPath === "move.date")).toBeUndefined();
    const queue = await listMoves(org);
    expect(queue[0]!.state).toBe("canonical");
  });

  it("a second merge with the old version is refused — the lock keeps holding", async () => {
    await expect(
      approveMergeFor({
        organizationId: org,
        moveId,
        expectedVersion: version, // now stale: the merge above bumped it
        actor: "human:concierge-2",
        decisions: [{ fieldPath: "move.date", value: "2026-11-01", reason: "override attempt" }],
      }),
    ).rejects.toThrow(StaleMergeError);

    // The first decision survived.
    const canonical = await query<{ value: unknown }>(
      `SELECT value FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date' AND is_canonical`,
      [moveId],
    );
    expect(canonical[0]!.value).toBe("2026-11-05");
  });
});
