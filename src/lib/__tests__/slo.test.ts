import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { computeObjectives } from "../slo";

/**
 * The service-level objectives must be able to fail.
 *
 * This suite exists because an audit found three of the six objectives
 * hardcoding `met: true` while the page rendering them told the reader "if
 * something is broken, this page will say so — including downward". In a
 * project whose entire subject is provenance, the dashboard was the one
 * component structurally incapable of telling the truth about itself.
 *
 * A green dashboard proves nothing unless you have watched it go red. So each
 * test here seeds an actual breach in the database and asserts the objective
 * notices — which is the only way this page is worth putting in front of
 * anyone.
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('SLO probe','slo-probe') RETURNING id`,
    )
  )[0]!.id;
});

const objectives = () => computeObjectives();

const find = (o: Awaited<ReturnType<typeof objectives>>, id: string) =>
  o.objectives.find((x) => x.id === id)!;

describe("every objective evaluates rows rather than asserting success", () => {
  it("exposes six objectives and an overall verdict", async () => {
    const o = await objectives();
    expect(o.objectives).toHaveLength(6);
    expect(typeof o.allMet).toBe("boolean");
  });

  it("cannot even be made to breach on duplicate orders — the index forbids it", async () => {
    // This one turned out to be unbreachable, and finding that out is the
    // point of the test.
    //
    // The objective asks whether two settled submissions share an
    // operation_key. Seeding that breach is impossible: a unique index on
    // (organization_id, operation_key) rejects the second row outright. A
    // duplicate provider order is not merely detected here, it is
    // unrepresentable — which is a stronger guarantee than any dashboard.
    //
    // The query stays as defence in depth. If that index is ever dropped, the
    // objective notices; until then this test documents *why* it reads zero.
    const move = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1, 'SLO-DUP-1', 'canonical') RETURNING id`,
        [org],
      )
    )[0]!.id;
    const svc = (
      await query<{ id: string }>(
        `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
         VALUES ($1, $2, 'electric', 'Probe Energy') RETURNING id`,
        [org, move],
      )
    )[0]!.id;

    const insert = (fp: string) =>
      query(
        `INSERT INTO provider_submissions
           (organization_id, service_request_id, operation_key, request_fingerprint, request_payload, state)
         VALUES ($1, $2, 'slo-dup-key', $3, '{}'::jsonb, 'confirmed')`,
        [org, svc, fp],
      );

    await insert("fp-1");
    await expect(insert("fp-2")).rejects.toThrow(/unique|duplicate key/i);

    // And with the second insert refused, the objective correctly reads clean.
    expect(find(await objectives(), "zero-duplicate-orders").met).toBe(true);

    await query(`DELETE FROM provider_submissions WHERE operation_key = 'slo-dup-key'`);
  });

  it("goes red when an UNKNOWN outcome is left undrained", async () => {
    const move = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1, 'SLO-STALE-1', 'canonical') RETURNING id`,
        [org],
      )
    )[0]!.id;
    const svc = (
      await query<{ id: string }>(
        `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
         VALUES ($1, $2, 'electric', 'Probe Energy') RETURNING id`,
        [org, move],
      )
    )[0]!.id;

    // An UNKNOWN is acceptable. An UNKNOWN nobody reconciled is not — it means
    // the sweep has stopped running, which is silent by nature.
    await query(
      `INSERT INTO provider_submissions
         (organization_id, service_request_id, operation_key, request_fingerprint, request_payload, state, started_at)
       VALUES ($1, $2, 'slo-stale-key', 'fp-stale', '{}'::jsonb, 'unknown', now() - interval '3 hours')`,
      [org, svc],
    );

    const after = find(await objectives(), "unknowns-resolve");
    expect(after.met).toBe(false);
    expect(after.actual).toMatch(/over an hour old/);

    await query(`DELETE FROM provider_submissions WHERE operation_key = 'slo-stale-key'`);
    expect(find(await objectives(), "unknowns-resolve").met).toBe(true);
  });

  it("goes red when an AI run is neither grounded nor a declared fallback", async () => {
    const before = find(await objectives(), "ai-grounding");
    expect(before.met).toBe(true);

    // Neither grounded nor flagged as a fallback: an uncited claim that reached
    // a surface. That is the breach this objective is named after.
    await query(
      `INSERT INTO ai_runs
         (organization_id, purpose, model, prompt_version, input_field_ids, output, grounded, fallback)
       VALUES ($1, 'slo-probe', 'probe', 'v0', '{}'::uuid[], '{}'::jsonb, false, false)`,
      [org],
    );

    expect(find(await objectives(), "ai-grounding").met).toBe(false);

    await query(`DELETE FROM ai_runs WHERE purpose = 'slo-probe'`);
    expect(find(await objectives(), "ai-grounding").met).toBe(true);
  });
});
