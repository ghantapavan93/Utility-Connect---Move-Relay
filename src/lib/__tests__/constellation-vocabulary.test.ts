import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { LINE, lineProps, nodeProps, convergePath } from "@/components/constellation/vocabulary";

/**
 * The Handoff Constellation stays one language.
 *
 * `CLAUDE.md` requires the same line vocabulary in the hero, the demo, the
 * audit timeline, conflict resolution and the architecture diagrams — and the
 * failure mode of a rule like that is not that someone ignores it. It is that
 * four pages each implement it slightly differently, drift by one shade and one
 * dash length, and the language stops meaning anything without anyone deciding
 * that it should.
 *
 * So the meanings live in `vocabulary.ts` and this file guards two properties:
 * that the vocabulary itself uses semantic tokens rather than literal colours,
 * and that constellation components ask it rather than inventing their own.
 */

const componentsDir = join(process.cwd(), "src", "components", "constellation");

const constellationFiles = () =>
  readdirSync(componentsDir).filter((f) => f.endsWith(".tsx"));

describe("the vocabulary is semantic", () => {
  it("never hardcodes a colour", () => {
    /*
      `#0087B5` means *verified* in this system and nothing else. A literal hex
      anywhere in the vocabulary would be a second, unnamed meaning — the exact
      way a one-meaning palette quietly acquires two.
    */
    for (const [state, style] of Object.entries(LINE)) {
      expect(style.stroke, `${state} must use a token`).toMatch(/^var\(--/);
    }
  });

  it("gives every state a stated meaning", () => {
    // A state with no meaning is decoration, and decoration is the one thing
    // this design system forbids outright.
    for (const [state, style] of Object.entries(LINE)) {
      expect(style.meaning.length, `${state} needs a meaning`).toBeGreaterThan(3);
    }
  });

  it("distinguishes conflict from failure", () => {
    // A conflict needs judgement; it is not a break. Collapsing the two would
    // tell a concierge that a disagreement between two honest sources is an
    // error condition.
    expect(LINE.conflicting.stroke).not.toBe(LINE.failed.stroke);
    expect(LINE.conflicting.stroke).toContain("conflict");
    expect(LINE.failed.stroke).toContain("failed");
  });

  it("keeps verified visually distinct from recovered", () => {
    // Recovery is not the same claim as verification: one says the value was
    // confirmed, the other says a break was repaired.
    expect(LINE.verified.stroke).not.toBe(LINE.recovered.stroke);
  });

  it("marks only unsettled states as dashed", () => {
    // Dashed means pending in this language. A settled state drawn dashed would
    // be saying "still waiting" about something that has finished.
    expect(LINE.verified.strokeDasharray).toBeUndefined();
    expect(LINE.recovered.strokeDasharray).toBeUndefined();
    expect(LINE.failed.strokeDasharray).toBeUndefined();
    expect(LINE.pending.strokeDasharray).toBeTruthy();
    expect(LINE.conflicting.strokeDasharray).toBeTruthy();
  });
});

describe("constellation components speak it rather than reinventing it", () => {
  it("has components to check", () => {
    expect(constellationFiles().length).toBeGreaterThan(0);
  });

  it("contains no literal hex colour", () => {
    /*
      The drift check. A component that reaches for `#e8a33d` instead of
      `lineProps("conflicting")` has forked the language, and the fork is
      invisible in review because it looks right on the page it was written for.
    */
    /*
      Comments are stripped first. A comment that names `#0087B5` while
      explaining what the token means is documentation, not a hardcoded colour
      — and a check that cannot tell those apart makes the rule unexplainable
      in the very place it most needs explaining.
    */
    const strippedOfComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

    const offenders: string[] = [];
    for (const file of constellationFiles()) {
      const code = strippedOfComments(readFileSync(join(componentsDir, file), "utf8"));
      const hex = code.match(/#[0-9a-fA-F]{3,8}\b/g);
      if (hex) offenders.push(`${file}: ${hex.join(", ")}`);
    }
    expect(offenders, "use a token from vocabulary.ts").toEqual([]);
  });

  it("imports the vocabulary", () => {
    for (const file of constellationFiles()) {
      const source = readFileSync(join(componentsDir, file), "utf8");
      expect(
        /from "\.\/vocabulary"/.test(source),
        `${file} draws lines without asking the vocabulary what they mean`,
      ).toBe(true);
    }
  });
});

describe("the drawing helpers", () => {
  it("spreads valid SVG props", () => {
    const props = lineProps("verified");
    expect(props.fill).toBe("none");
    expect(props.stroke).toBe(LINE.verified.stroke);
    expect(props.strokeWidth).toBeGreaterThan(0);
  });

  it("fills a node only when it is real", () => {
    // Filled means "this one is the record". Hollow means "this one is a
    // candidate". The distinction does the work a legend would otherwise do.
    expect(nodeProps("verified", true).fill).toBe(LINE.verified.stroke);
    expect(nodeProps("verified", false).fill).toBe("transparent");
  });

  it("draws a converging path that starts and ends where it was told", () => {
    const d = convergePath(10, 20, 100, 60);
    expect(d.startsWith("M 10 20")).toBe(true);
    expect(d.endsWith("100 60")).toBe(true);
    // Horizontal control points: every strand leaves and arrives flat, so the
    // bundle reads before the individual line.
    expect(d).toContain("C 55 20, 55 60");
  });
});
