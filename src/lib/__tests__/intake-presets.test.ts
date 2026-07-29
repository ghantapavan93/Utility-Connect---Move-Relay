import { describe, it, expect } from "vitest";
import { INTAKE_PRESETS, matchedExpectation, reusesKey } from "../intake-presets";
import { CONTRACTS, validateSubmission } from "../contracts";
import { CONSENT_CHANNELS, CONSENT_PURPOSES } from "../consent";

/**
 * The operator console's intake presets.
 *
 * Each preset claims a specific outcome — created, replayed, collapsed,
 * attached, quarantined, key conflict — and the console shows that claim beside
 * whatever the API actually returned. That only means anything if the payloads
 * genuinely provoke what they promise, so this checks the half that can be
 * checked without a database: whether each payload passes or fails its
 * channel's contract, which is the gate that decides quarantine.
 *
 * The preset that matters most here is the quarantine one. If a renamed column
 * quietly started validating, the console would report a clean acceptance while
 * telling the reviewer it was demonstrating schema drift — a page inventing a
 * failure it did not have, which is worse than not showing one at all.
 */

describe("every preset is a real, sendable request", () => {
  it("names a channel the intake endpoint actually accepts", () => {
    for (const p of INTAKE_PRESETS) {
      expect(Object.keys(CONTRACTS), p.id).toContain(p.channel);
    }
  });

  it("has unique ids, since the console keys and dedupes on them", () => {
    const ids = INTAKE_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("explains itself — a preset with no stated reason is a button, not evidence", () => {
    for (const p of INTAKE_PRESETS) {
      expect(p.demonstrates.length, p.id).toBeGreaterThan(20);
      expect(p.why.length, p.id).toBeGreaterThan(40);
    }
  });
});

describe("the payloads provoke what they claim", () => {
  it("passes contract validation for every preset that expects to be accepted", () => {
    for (const p of INTAKE_PRESETS.filter((x) => x.expect !== "quarantined")) {
      const result = validateSubmission(p.channel, p.payload);
      expect(result.ok, `${p.id}: ${result.ok ? "" : JSON.stringify(result.issues)}`).toBe(true);
    }
  });

  it("fails contract validation for the preset that demonstrates quarantine", () => {
    // The whole point of that preset. If this ever passes, the console is
    // claiming to show schema drift while showing a clean acceptance.
    const drift = INTAKE_PRESETS.filter((p) => p.expect === "quarantined");
    expect(drift.length).toBeGreaterThan(0);

    for (const p of drift) {
      const result = validateSubmission(p.channel, p.payload);
      expect(result.ok, p.id).toBe(false);
      if (!result.ok) {
        // Reasons, not just a rejection — the console prints these paths, and a
        // partner is supposed to be able to act on them.
        expect(result.issues.length).toBeGreaterThan(0);
        for (const issue of result.issues) expect(issue.path.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("a preset cannot carry a value the database would reject", () => {
  it("names consent purposes and channels that exist in the enum", () => {
    /*
      `consent_purpose` and `consent_channel` are real Postgres enums, so a
      wrong value is not a validation failure — it is a transaction that throws
      part-way through creating a move.

      The contract schema does not catch it: it accepts `purposes` as an array
      of arbitrary strings, because the wording is the partner's and the scope
      list is ours. So this is the only place the two can be reconciled before
      the write.

      This exists because the consented preset used `service_setup` and
      `provider_contact`, neither of which is a purpose. It survived review
      because that referral always attached to an existing move, and the attach
      path does not write consent — the crash was waiting for the first tenant
      where it landed first.
    */
    for (const p of INTAKE_PRESETS) {
      const consent = (p.payload as { consent?: { purposes?: string[]; channels?: string[] } })
        .consent;
      if (!consent) continue;
      for (const purpose of consent.purposes ?? []) {
        expect(CONSENT_PURPOSES, `${p.id} grants "${purpose}"`).toContain(purpose);
      }
      for (const channel of consent.channels ?? []) {
        expect(CONSENT_CHANNELS, `${p.id} grants via "${channel}"`).toContain(channel);
      }
    }
  });
});

describe("the ordering is part of the demonstration", () => {
  it("never asks to reuse a key before one has been minted", () => {
    // `replayed` and `key_conflict` both send the previous submission's key.
    // Fired first, they would have no key to reuse and would silently behave
    // like an ordinary request — demonstrating nothing while claiming to.
    const firstReuse = INTAKE_PRESETS.findIndex(reusesKey);
    if (firstReuse === -1) return;
    const freshBefore = INTAKE_PRESETS.slice(0, firstReuse).some((p) => p.key === "fresh");
    expect(freshBefore).toBe(true);
  });

  it("puts the exact-duplicate collapse after the request it collapses into", () => {
    const clean = INTAKE_PRESETS.findIndex((p) => p.expect === "created");
    const collapse = INTAKE_PRESETS.findIndex((p) => p.expect === "collapsed");
    expect(clean).toBeGreaterThanOrEqual(0);
    expect(collapse).toBeGreaterThan(clean);
  });

  it("puts the duplicate attach after a move exists to attach to", () => {
    const clean = INTAKE_PRESETS.findIndex((p) => p.expect === "created");
    const attach = INTAKE_PRESETS.findIndex((p) => p.expect === "attached");
    expect(attach).toBeGreaterThan(clean);
  });
});

describe("the console cannot quietly pass a mismatch", () => {
  it("treats any other outcome as a mismatch, not as near enough", () => {
    const preset = INTAKE_PRESETS[0]!;
    expect(matchedExpectation(preset, preset.expect)).toBe(true);
    for (const other of ["attached", "collapsed", "replayed", "quarantined", "key_conflict"]) {
      if (other === preset.expect) continue;
      expect(matchedExpectation(preset, other), other).toBe(false);
    }
  });
});
