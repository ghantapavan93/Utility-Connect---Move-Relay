import { describe, it, expect } from "vitest";
import { leafPaths, withheld, additional, shared } from "../projection-diff";

/**
 * Comparing what each audience received.
 *
 * The Views page uses this to state, on screen, which fields the server did not
 * send to the audience being viewed. That is a privacy claim made to a reviewer,
 * so the failure that matters is asymmetric: reporting a field as withheld when
 * it was in fact disclosed is a false reassurance, and considerably worse than
 * failing to mention it. Most of what follows is aimed at that one direction.
 */

describe("flattening a payload to leaf paths", () => {
  it("walks nested objects into dotted paths", () => {
    expect(leafPaths({ a: 1, b: { c: 2, d: { e: 3 } } })).toEqual(["a", "b.c", "b.d.e"]);
  });

  it("collapses arrays to a single [] segment", () => {
    // The claim is about the shape a projection returns, not the row count. Two
    // services disclose exactly the fields one service discloses.
    const one = leafPaths({ services: [{ type: "electric" }] });
    const two = leafPaths({ services: [{ type: "electric" }, { type: "internet" }] });
    expect(one).toEqual(["services[].type"]);
    expect(two).toEqual(one);
  });

  it("unions fields across rows rather than trusting the first", () => {
    // A field present on any row was disclosed. Reading only element zero would
    // under-report a leak that appears on the second row — precisely the
    // direction of error this module must not make.
    expect(leafPaths({ s: [{ a: 1 }, { a: 1, order_id: "x" }] })).toEqual([
      "s[].a",
      "s[].order_id",
    ]);
  });

  it("treats an empty array as a leaf, disclosing nothing about its rows", () => {
    expect(leafPaths({ needsYou: [] })).toEqual(["needsYou[]"]);
  });

  it("keeps null as a disclosed path, because the key was still sent", () => {
    // `{ briefing: null }` tells the recipient a briefing concept exists. That
    // is a smaller disclosure than its contents, but it is not nothing, and
    // silently dropping it would overstate what was withheld.
    expect(leafPaths({ briefing: null })).toEqual(["briefing"]);
  });
});

describe("what one audience did not receive", () => {
  const concierge = {
    reference: "MR-1",
    briefing: { claims: [{ text: "x" }] },
    services: [{ service_type: "electric", provider_order_id: "PO-9", error_category: null }],
  };
  const partner = {
    reference: "MR-1",
    services: [{ service_type: "electric" }],
  };

  it("names exactly the paths the reference had and this audience did not", () => {
    expect(withheld(concierge, partner)).toEqual([
      "briefing.claims[].text",
      "services[].error_category",
      "services[].provider_order_id",
    ]);
  });

  it("never reports a path the audience actually received", () => {
    // The load-bearing assertion. Everything the partner got must be absent
    // from the withheld list, or the page is telling a reviewer a field is
    // private while the server is handing it over.
    const got = new Set(leafPaths(partner));
    for (const path of withheld(concierge, partner)) {
      expect(got.has(path)).toBe(false);
    }
  });

  it("reports nothing withheld when the payloads match", () => {
    expect(withheld(concierge, concierge)).toEqual([]);
  });

  it("surfaces fields an audience has that the reference does not", () => {
    // The reference is the most-privileged of three projections, not a superset
    // of them — the customer timeline exists nowhere else. Asserting otherwise
    // would be a claim the code cannot support.
    expect(additional(concierge, { ...partner, timeline: [{ headline: "h" }] })).toEqual([
      "timeline[].headline",
    ]);
  });
});

describe("what every audience receives", () => {
  it("intersects across all payloads", () => {
    expect(
      shared([{ a: 1, b: 2 }, { a: 1, c: 3 }, { a: 1, b: 2, d: 4 }]),
    ).toEqual(["a"]);
  });

  it("is empty for no payloads rather than throwing", () => {
    expect(shared([])).toEqual([]);
  });
});
