import { describe, it, expect } from "vitest";
import { seedViewsMove, VIEWS_ACTORS } from "../views-seed";
import { viewForActor } from "../audience-view";
import { fieldLineage } from "../field-lineage";
import { DEMO_ACTORS } from "../actor";
import { PROJECTION_POLICY_VERSION } from "../projection-manifest";
import { leafPaths } from "../projection-diff";

/**
 * A projection that describes its own shape, and a lineage that is itself
 * projected.
 *
 * Both are places where a well-meaning addition leaks. A manifest is tempting
 * to fill by diffing against the fullest projection — which attaches a precise
 * map of the withheld fields to the response withholding them. Lineage is
 * tempting to return whole, because history feels like neutral metadata — and
 * it carries the rejected values, the source channels and the name of the
 * operator who chose.
 */

const actorFor = (key: "concierge" | "customer" | "partner") =>
  DEMO_ACTORS[VIEWS_ACTORS[key].subject]!;

describe("the manifest describes the payload it travels with", () => {
  it("counts the fields actually returned, for every audience", async () => {
    const { moveId } = await seedViewsMove();

    for (const key of ["concierge", "customer", "partner"] as const) {
      const view = await viewForActor(moveId, actorFor(key), "test path");
      expect(view.exists, key).toBe(true);
      if (!view.exists) continue;

      /*
        The projection body, with the envelope removed.

        `exists`, `authorization` and `manifest` are identical for every
        audience, so counting them would inflate all three figures by the same
        amount and make the number describe the transport instead of the
        disclosure. Stripping them here is what keeps this an assertion about
        the payload rather than a restatement of the implementation.
      */
      const { manifest, exists: _e, authorization: _a, ...body } = view;
      expect(manifest.includedFieldCount, key).toBe(leafPaths(body).length);
      expect(manifest.audience, key).toBe(key);
      expect(manifest.policyVersion, key).toBe(PROJECTION_POLICY_VERSION);
      expect(manifest.relationship, key).toBe("test path");
      expect(manifest.moveVersion, key).toBeGreaterThanOrEqual(1);
    }
  }, 60_000);

  it("names withheld categories and never withheld fields", async () => {
    const { moveId } = await seedViewsMove();
    const concierge = await viewForActor(moveId, actorFor("concierge"), "t");
    const customer = await viewForActor(moveId, actorFor("customer"), "t");
    expect(concierge.exists && customer.exists).toBe(true);
    if (!concierge.exists || !customer.exists) return;

    const categories = customer.manifest.withheldCategories;
    expect(categories.length).toBeGreaterThan(0);

    /*
      The load-bearing assertion. A derived manifest would list the exact paths
      the concierge has and the customer does not — a map of everything this
      audience may not see, attached to the response denying it.
    */
    const blob = JSON.stringify(categories);
    for (const path of ["provider_order_id", "error_category", "selected_by", "selection_reason"]) {
      expect(blob, `the manifest leaked the field ${path}`).not.toContain(path);
    }
    // Nor any value from the record.
    for (const value of ["RLNT-", "jordan-lee", "469-555", "2026-08-16"]) {
      expect(blob, `the manifest leaked the value ${value}`).not.toContain(value);
    }

    // The concierge withholds nothing, and says so rather than omitting the key.
    expect(concierge.manifest.withheldCategories).toEqual([]);
  }, 60_000);
});

describe("lineage is projected, not merely gated", () => {
  it("gives the operator the rejected values and the decision", async () => {
    const { moveId } = await seedViewsMove();
    const l = await fieldLineage(moveId, "move.date", "concierge");
    expect(l).not.toBeNull();
    if (!l) return;

    // Two channels disagreed about the date; the operator resolved it.
    expect(l.history.length).toBeGreaterThan(1);
    expect(l.history.some((h) => h.value === "2026-08-14")).toBe(true);
    expect(l.decision?.by).toBe("human:jordan-lee");
    expect(l.decision?.reason).toContain("three days after the partner feed");
    expect(l.withheldFromThisView).toEqual([]);
  }, 60_000);

  it("gives the customer the value without the machinery that produced it", async () => {
    const { moveId } = await seedViewsMove();
    const l = await fieldLineage(moveId, "move.date", "customer");
    expect(l).not.toBeNull();
    if (!l) return;

    expect(l.projectedValue).toBe("2026-08-16");
    // How many times it was supplied is safe. What each one said is not.
    expect(l.history.length).toBeGreaterThan(1);
    expect(l.history.every((h) => h.value === undefined)).toBe(true);
    expect(l.decision).toBeNull();

    const blob = JSON.stringify(l);
    expect(blob).not.toContain("2026-08-14"); // the value her partner got wrong
    expect(blob).not.toContain("jordan-lee");
    expect(blob).not.toContain("partner_api");
    expect(l.withheldFromThisView.length).toBeGreaterThan(0);
  }, 60_000);

  it("answers identically for a field that is absent and one that is forbidden", async () => {
    const { moveId } = await seedViewsMove();

    // `customer.phone` exists on this move; the customer may not have its lineage.
    const forbidden = await fieldLineage(moveId, "customer.phone", "customer");
    // This path exists nowhere.
    const absent = await fieldLineage(moveId, "move.nonexistent", "customer");

    /*
      Both null, deliberately. Distinguishing them turns the endpoint into an
      oracle: ask for every plausible path and the difference maps the record.
    */
    expect(forbidden).toBeNull();
    expect(absent).toBeNull();
  }, 60_000);

  it("never lets a partner read another channel's contribution", async () => {
    const { moveId } = await seedViewsMove();
    const l = await fieldLineage(moveId, "move.date", "partner");
    expect(l).not.toBeNull();
    if (!l) return;

    expect(l.history.every((h) => h.value === undefined)).toBe(true);
    expect(l.decision).toBeNull();
    expect(JSON.stringify(l)).not.toContain("customer_form");

    // And nothing outside its one permitted field.
    expect(await fieldLineage(moveId, "customer.email", "partner")).toBeNull();
    expect(await fieldLineage(moveId, "customer.phone", "partner")).toBeNull();
  }, 60_000);
});
