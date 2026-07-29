import { describe, it, expect } from "vitest";
import { signatureSubmit, signatureRetry, signatureReconcile } from "../theater-signature";
import { theaterOrg } from "../theater";
import { query } from "../db";
import { VIOLATION } from "../theater-contract";

/**
 * The signature incident, run against the real database.
 *
 * The claim this page makes about the provider timeout is the one claim it
 * cannot afford to be animating: that at the moment our state reads UNKNOWN the
 * provider genuinely holds a created order, that a retry does not reach them,
 * and that reconciliation adopts the order that already exists rather than
 * making a second one.
 *
 * These assert each of those against live rows, and — because the page's
 * isolation claim depends on it — that none of it touches the demo tenant.
 */

describe("the provider created the order and the reply disappeared", () => {
  it("lands in UNKNOWN while the provider already holds the order", async () => {
    const r = await signatureSubmit();

    expect(r.outcome).not.toBe(VIOLATION);
    expect(r.evidence.ourState).toBe("unknown");
    // Our side knows nothing…
    expect(r.evidence.ourProviderOrderId).toBeNull();
    // …while the provider's own ledger already has it. That disagreement is
    // the entire incident; if these two agreed there would be no problem.
    expect(r.evidence.providerHoldsOrder).toMatch(/^RLNT-\d+$/);
  });

  it("refuses the blind retry without contacting the provider", async () => {
    const opened = await signatureSubmit();
    const retry = await signatureRetry(opened.runId);

    expect(retry.outcome).not.toBe(VIOLATION);
    expect(retry.evidence.blocked).toBe(true);
    expect(retry.evidence.stateAfterRetry).toBe("unknown");
    /*
      `retryService` passes a provider callback that throws when reached, so a
      returned result already proves nobody was called. The order ids on either
      side of the attempt prove the consequence: no second order exists.
    */
    expect(retry.evidence.providerOrderAfter).toBe(retry.evidence.providerOrderBefore);
    expect(retry.evidence.duplicateOrdersCreated).toBe(0);
  });

  it("adopts the existing order rather than creating another", async () => {
    const opened = await signatureSubmit();
    const created = opened.evidence.providerHoldsOrder;

    await signatureRetry(opened.runId);
    const done = await signatureReconcile(opened.runId);

    expect(done.outcome).not.toBe(VIOLATION);
    expect(done.evidence.reconciliationOutcome).toBe("found_existing");
    // The same order the provider made in stage one — not a new one.
    expect(done.evidence.recoveredOrderId).toBe(created);
    expect(done.evidence.finalState).toBe("reconciled");
    expect(done.evidence.ordersForThisRequest).toBe(1);
  });

  it("gives concurrent reviewers their own move", async () => {
    const [a, b] = await Promise.all([signatureSubmit(), signatureSubmit()]);
    expect(a.runId).not.toBe(b.runId);
    expect(a.evidence.providerHoldsOrder).not.toBe(b.evidence.providerHoldsOrder);
  });
});

describe("the isolation the hero claims", () => {
  it("runs entirely inside the theater tenant", async () => {
    const r = await signatureSubmit();
    const [moveId] = r.runId.split(":");
    const org = await theaterOrg();

    const rows = await query<{ organization_id: string }>(
      `SELECT organization_id FROM moves WHERE id = $1`,
      [moveId],
    );
    expect(rows[0]?.organization_id).toBe(org);
  });

  /*
    The reason this module exists rather than calling `/api/v1/demo/:step`.
    Those steps operate on `uc-demo`, whose reset deletes the organisation
    outright — so an attack launched here would have destroyed a different
    page's state under a different reviewer.
  */
  it("never touches the demo tenant", async () => {
    const before = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m
         JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug = 'uc-demo'`,
    );

    const opened = await signatureSubmit();
    await signatureRetry(opened.runId);
    await signatureReconcile(opened.runId);

    const after = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m
         JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug = 'uc-demo'`,
    );
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("refuses a run id that is not its own", async () => {
    await expect(signatureRetry("not-a-uuid:also-not")).rejects.toThrow(/malformed run id/);
    await expect(
      signatureRetry("11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222"),
    ).rejects.toThrow(/theater tenant/);
  });
});
