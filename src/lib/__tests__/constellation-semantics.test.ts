import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LINE, BACKEND_TRUTH_STATES } from "@/components/constellation/vocabulary";

/**
 * What a colour is allowed to claim.
 *
 * `constellation-vocabulary.test.ts` proves the components use tokens rather
 * than literal hex. That is necessary and it is not sufficient: a component can
 * reach for `lineProps("verified")` on state that lives only in the browser and
 * be perfectly token-compliant while telling the reviewer something false.
 *
 * `#0087B5` means *verified* in this project. A candidate a concierge has
 * clicked has not been authorized, has not been accepted by the API, has not
 * been written to Postgres, and has not been read back. Drawing it verified
 * made the screen assert a database fact on the strength of a click — and it
 * would have gone on asserting it through a 403 or a 409.
 *
 * These tests guard the rule that fixed it: **verified is reachable only from a
 * committed phase**, and the phase is a property of the request, never of the
 * selection.
 */

const source = readFileSync(
  join(process.cwd(), "src", "components", "constellation", "ConflictConstellation.tsx"),
  "utf8",
);

const page = readFileSync(
  join(process.cwd(), "src", "app", "moves", "[id]", "page.tsx"),
  "utf8",
);

describe("verified is a claim about the database", () => {
  it("names the states that may assert backend truth", () => {
    expect(BACKEND_TRUTH_STATES).toContain("verified");
    expect(BACKEND_TRUTH_STATES).toContain("recovered");
    // A proposal is not truth. If this ever passes, the distinction has been
    // lost and the palette has quietly acquired a second meaning.
    expect(BACKEND_TRUTH_STATES).not.toContain("proposed");
    expect(BACKEND_TRUTH_STATES).not.toContain("transit");
    expect(BACKEND_TRUTH_STATES).not.toContain("pending");
  });

  it("gives a proposal its own state, distinct from verified", () => {
    expect(LINE.proposed).toBeTruthy();
    expect(LINE.proposed.stroke).not.toBe(LINE.verified.stroke);
    expect(LINE.proposed.meaning).toMatch(/not yet committed/i);
  });

  it("keeps in-flight distinct from both", () => {
    // Submitting is neither a proposal nor a fact. Collapsing it into either
    // would hide the window where the outcome is genuinely unknown — the same
    // window the whole product exists to take seriously.
    expect(LINE.transit.stroke).not.toBe(LINE.verified.stroke);
    expect(LINE.transit.stroke).not.toBe(LINE.proposed.stroke);
  });
});

describe("the conflict constellation cannot draw verified from a click", () => {
  it("reaches verified only through the committed phase", () => {
    /*
      Read from the source rather than rendered, because the failure this
      guards is a *reachability* property: is there any path from selection
      state to the verified token? A render test would only prove the paths
      someone thought to exercise.
    */
    const verifiedMentions = [...source.matchAll(/"verified"/g)].length;
    expect(verifiedMentions, "verified must appear, or nothing is committed-capable").toBeGreaterThan(0);

    // Every occurrence must be guarded by a committed check on the same line
    // or the one before it.
    const lines = source.split("\n");
    lines.forEach((line, i) => {
      if (!line.includes('"verified"')) return;
      const window = [lines[i - 2], lines[i - 1], line].join(" ");
      expect(
        /committed/.test(window),
        `verified is used at line ${i + 1} without a committed guard: ${line.trim()}`,
      ).toBe(true);
    });
  });

  it("does not fill the canonical node from selection alone", () => {
    // The specific regression: `nodeProps(..., resolved)` filled the canonical
    // node because something had been clicked.
    expect(source).not.toMatch(/nodeProps\([^)]*,\s*resolved\s*\)/);
    expect(source).toMatch(/phase === "committed"/);
  });

  it("treats a corroborating source as dormant, not as a second choice", () => {
    // Two sources agreeing is one piece of evidence expressed twice, not two.
    expect(source).toMatch(/carriesChosenValue/);
    expect(source).toMatch(/"dormant"/);
  });
});

describe("a refused merge restores backend truth", () => {
  it("returns to selecting rather than staying in flight", () => {
    // `busy` is cleared before any status branch runs, so 401, 403, 409 and a
    // thrown request all drop the diagram back to `proposed`.
    const busyClearedFirst = page.indexOf("setBusy(false)") < page.indexOf("res.status === 401");
    expect(busyClearedFirst).toBe(true);
    expect(page).toMatch(/phase=\{busy \? "submitting" : "selecting"\}/);
  });

  it("re-reads the server on a stale merge instead of trusting the screen", () => {
    expect(page).toMatch(/res\.status === 409[\s\S]{0,400}await load\(\)/);
  });

  it("shows the server's own reason on a denial", () => {
    expect(page).toMatch(/json\.detail \?\? json\.error/);
  });
});

describe("the identity chooser is labelled as synthetic", () => {
  it("does not present itself as authentication", () => {
    /*
      The chooser exists to demonstrate an authorization decision, and a demo
      control that looks like a login is a demo that overstates itself. The
      word "Demo" has to be on screen, and the word "authentication" must not
      be used to describe it.
    */
    expect(page).toMatch(/Demo actor/i);
    expect(page).not.toMatch(/\bsign in\b|\blog in\b|\bauthenticated as\b/i);
  });
});
