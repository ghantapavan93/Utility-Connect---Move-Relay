import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CONTINUUM, continuumModule, labelCounts, type ContinuumLabel } from "../continuum";

/**
 * The Continuum's honesty labels, and the four places that state them.
 *
 * Each module carries a label — BUILT AND FUNCTIONING, INTERACTIVE CONCEPT,
 * FUTURE HYPOTHESIS — printed on the index card, repeated on the module's own
 * page, and summarised in a sentence at the bottom of the index.
 *
 * Three statements of one fact is three chances to drift, and it had already
 * drifted: the index prose read "Five are explorable concepts. Two are
 * hypotheses" against module labels that said four and three. The page now
 * renders every one of them from `CONTINUUM`, so the drift is structural
 * rather than merely tested.
 *
 * A fourth statement used to exist — the beams background encoded the ratio as
 * colour, and had been built from the wrong prose. That background has been
 * replaced by the particle field the demo uses, and its guards went with it
 * rather than being left to pass while watching nothing.
 *
 * The counts below are derived from the module rows, which are the only
 * authoritative source: the label sits with the claim on each act, where a
 * reader meets it. Everything else has to agree with them.
 */

const root = join(process.cwd());
const read = (p: string) => readFileSync(join(root, p), "utf8");

const FUTURE_PAGE = "src/components/cinematic/FuturePage.tsx";

describe("every module is complete enough to publish", () => {
  it("has a slug, a label, and the five sections its page renders", () => {
    for (const m of CONTINUUM) {
      expect(m.slug, m.title).toMatch(/^[a-z0-9-]+$/);
      expect(m.problem.length, m.slug).toBeGreaterThan(80);
      expect(m.mechanism.length, m.slug).toBeGreaterThanOrEqual(3);
      expect(m.reuses.length, m.slug).toBeGreaterThanOrEqual(1);
      expect(m.aiBoundary.may.length, m.slug).toBeGreaterThanOrEqual(1);
      expect(m.aiBoundary.mayNot.length, m.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("states what would have to be true, for every single module", () => {
    // The section a roadmap omits. A module page that argued only for itself
    // would be marketing, and the one module allowed to skip this is none.
    for (const m of CONTINUUM) {
      expect(m.openQuestions.length, m.slug).toBeGreaterThanOrEqual(2);
      for (const q of m.openQuestions) expect(q.length, m.slug).toBeGreaterThan(40);
    }
  });

  it("has unique slugs, since they are routes", () => {
    const slugs = CONTINUUM.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(continuumModule(s)?.slug).toBe(s);
  });

  it("only links to proof that is actually built", () => {
    // A "see it working" link on a hypothesis would be the exact blur these
    // labels exist to prevent.
    for (const m of CONTINUUM.filter((x) => x.proof)) {
      expect(
        ["/demo", "/theater", "/dashboard", "/views", "/architecture", "/agent"],
        m.slug,
      ).toContain(m.proof!.href);
    }
  });
});

describe("the label ratio cannot drift again", () => {
  const counts = labelCounts();
  const tally = (label: ContinuumLabel) => counts[label] ?? 0;

  it("keeps no second copy of the modules in the page", () => {
    /*
      The original failure was prose reading "five concepts, two hypotheses"
      over module labels that said four and three — two copies of one fact,
      drifting apart.

      The page now renders from `CONTINUUM` and derives its summary sentence
      from `labelCounts()`, so that particular drift is structurally impossible
      rather than merely tested. This asserts the structure holds: a literal
      label or slug reappearing in the page means someone has started a second
      copy, and the drift can begin again.
    */
    const src = read(FUTURE_PAGE);

    /*
      `label: "X"` and `slug: "X"` are the drift signature — a module *defined*
      in the page. Reading a count by its key (`counts["FUTURE HYPOTHESIS"]`) is
      the opposite: it is the page deferring to the data, which is the thing
      being asked for.
    */
    for (const label of [
      "BUILT AND FUNCTIONING",
      "INTERACTIVE CONCEPT",
      "FUTURE HYPOTHESIS",
    ] as ContinuumLabel[]) {
      expect(src, `${label} is declared in the page`).not.toContain(`label: "${label}"`);
    }
    for (const m of CONTINUUM) {
      expect(src, `${m.slug} is declared in the page`).not.toContain(`slug: "${m.slug}"`);
    }
    expect(src, "the page no longer reads the module list").toContain("CONTINUUM");
    expect(src, "the summary sentence is not derived from the counts").toContain("labelCounts");
  });

  it("gives every module a scene to draw it", () => {
    // A section with no drawing is a wall of text in a page whose whole method
    // is showing the mechanic before explaining it.
    const scenes = read("src/components/continuum/Scenes.tsx");
    const block = scenes.slice(scenes.indexOf("export const SCENES"));
    for (const m of CONTINUUM) {
      expect(block, `no scene registered for ${m.slug}`).toContain(`"${m.slug}"`);
    }
  });

  it("lets each section shout exactly once", () => {
    // One bold sentence per section. A page where everything is emphasised has
    // emphasised nothing, so `line` is the only copy allowed display weight.
    for (const m of CONTINUUM) {
      expect(m.line.length, `${m.slug} has no headline sentence`).toBeGreaterThan(24);
      expect(m.line.length, `${m.slug}'s headline is a paragraph`).toBeLessThan(120);
    }
  });
});

describe("the index and the detail pages describe the same modules", () => {
  it("routes every module to a detail page that exists", () => {
    // Both surfaces read `CONTINUUM`, so agreement on accent and label is
    // structural. What still needs checking is that the route exists at all.
    const route = read("src/app/future/[slug]/page.tsx");
    expect(route).toContain("generateStaticParams");
    expect(route).toContain("continuumModule");
    for (const m of CONTINUUM) {
      expect(continuumModule(m.slug), m.slug).toBeDefined();
    }
  });

  it("names no competitor anywhere a visitor can read", () => {
    /*
      The market reasoning behind these sections is real and is cited, in
      `research/competitive-landscape.md`. It stays there. A portfolio piece
      that ranks a prospective employer's competitors on the employer's own
      behalf is presuming a relationship that does not exist, and the reasoning
      is just as defensible without the names.
    */
    const surfaces = [
      read(FUTURE_PAGE),
      read("src/app/future/[slug]/page.tsx"),
      read("src/lib/continuum.ts"),
      read("src/components/continuum/Scenes.tsx"),
    ].join("\n");

    for (const name of [
      "Updater",
      "LiveEasy",
      "Move Concierge",
      "Porch",
      "Utilify",
      "Transactly",
      "Verity",
      "AppFolio",
    ]) {
      expect(surfaces, `${name} is named on a public surface`).not.toContain(name);
    }
  });
});
