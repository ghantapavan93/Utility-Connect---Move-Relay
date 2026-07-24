import { describe, it, expect } from "vitest";
import {
  assessDuplicate,
  detectConflicts,
  flatten,
  normalizePhone,
  normalizeAddress,
  candidatesFromSubmission,
  type FieldCandidate,
} from "../ingestion";

// The exact three payloads from scripts/seed.mjs. If the fixture changes, these
// fail — the demo narrative and the tests are not allowed to drift apart.
const partnerApi = {
  customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
  move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
  services: ["electric", "internet"],
};

const csvUpload = {
  customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0143" },
  move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
  services: ["electric"],
};

const customerForm = {
  customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
  move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
  services: ["electric", "internet", "security"],
};

describe("normalisation", () => {
  it("reduces phone formats to ten digits", () => {
    expect(normalizePhone("469-555-0142")).toBe("4695550142");
    expect(normalizePhone("(469) 555-0142")).toBe("4695550142");
    expect(normalizePhone("+1 469 555 0142")).toBe("4695550142");
  });

  it("treats abbreviated and spelled-out street types as equal", () => {
    expect(normalizeAddress("1420 Windhaven Parkway, Plano, TX")).toBe(
      normalizeAddress("1420 Windhaven Pkwy Plano TX"),
    );
  });

  it("flattens nested payloads to dotted paths", () => {
    expect(flatten(partnerApi)["customer.email"]).toBe("maya.patel@example.com");
    expect(flatten(partnerApi)["move.date"]).toBe("2026-08-14");
  });
});

describe("duplicate detection", () => {
  it("flags the CSV as a duplicate of the API despite the wrong phone digit", () => {
    const result = assessDuplicate(partnerApi, csvUpload);

    expect(result.verdict).not.toBe("distinct");
    expect(result.score).toBeGreaterThanOrEqual(0.9);

    // The mistyped digit must be visibly reported, not silently absorbed. The
    // operator has to see *why* the system is confident.
    const phone = result.signals.find((s) => s.signal === "phone");
    expect(phone?.matched).toBe(false);
    expect(phone?.detail).toContain("differs");
  });

  it("flags the customer form as a duplicate despite the changed move date", () => {
    const result = assessDuplicate(partnerApi, customerForm);
    expect(result.verdict).not.toBe("distinct");
  });

  it("keeps two different people apart even at the same address", () => {
    // Roommates. Same destination, different humans. Splitting on address alone
    // would merge them, which is the failure mode that matters most.
    const other = {
      customer: { first_name: "Ravi", last_name: "Shah", email: "ravi.shah@example.com", phone: "469-555-0999" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    };
    expect(assessDuplicate(partnerApi, other).verdict).toBe("distinct");
  });

  it("does not merge on a shared surname alone", () => {
    const cousin = {
      customer: { first_name: "Anil", last_name: "Patel", email: "anil.patel@example.com", phone: "214-555-0000" },
      move: { date: "2026-09-01", to_address: "88 Elm St, Frisco, TX 75034" },
    };
    expect(assessDuplicate(partnerApi, cousin).verdict).toBe("distinct");
  });

  it("exposes every signal with its weight so a human can audit the decision", () => {
    const { signals } = assessDuplicate(partnerApi, csvUpload);
    expect(signals.map((s) => s.signal).sort()).toEqual([
      "destination_address",
      "email",
      "name",
      "phone",
    ]);
    for (const s of signals) expect(s.weight).toBeGreaterThan(0);
  });
});

describe("channel trust", () => {
  it("ranks the customer's own form above the partner API", () => {
    const [fromCustomer] = candidatesFromSubmission({
      id: "s1", channel: "customer_form", partner_id: null,
      payload: customerForm, received_at: "2026-07-20T10:00:00Z",
    });
    const [fromPartner] = candidatesFromSubmission({
      id: "s2", channel: "partner_api", partner_id: "p1",
      payload: partnerApi, received_at: "2026-07-20T10:00:00Z",
    });

    // The inversion that encodes the product's point of view: the messier
    // channel wins, because it is the only one where the customer speaks.
    expect(fromCustomer!.verification).toBe("customer_confirmed");
    expect(fromPartner!.verification).toBe("unverified");
    expect(fromCustomer!.confidence).toBeGreaterThan(fromPartner!.confidence);
  });

  it("trusts hand-exported CSV least of all", () => {
    const [csv] = candidatesFromSubmission({
      id: "s3", channel: "csv_upload", partner_id: "p1",
      payload: csvUpload, received_at: "2026-07-20T10:00:00Z",
    });
    expect(csv!.confidence).toBeLessThan(0.7);
  });
});

describe("conflict detection", () => {
  const at = (iso: string) => iso;

  const candidates: FieldCandidate[] = [
    {
      fieldPath: "move.date", value: "2026-08-14", channel: "partner_api",
      partnerId: "p1", rawSubmissionId: "s1", verification: "unverified",
      confidence: 0.7, recordedAt: at("2026-07-17T09:00:00Z"),
    },
    {
      fieldPath: "move.date", value: "2026-08-16", channel: "customer_form",
      partnerId: null, rawSubmissionId: "s3", verification: "customer_confirmed",
      confidence: 0.95, recordedAt: at("2026-07-20T14:00:00Z"),
    },
    {
      fieldPath: "customer.email", value: "maya.patel@example.com", channel: "partner_api",
      partnerId: "p1", rawSubmissionId: "s1", verification: "unverified",
      confidence: 0.7, recordedAt: at("2026-07-17T09:00:00Z"),
    },
    {
      fieldPath: "customer.email", value: "maya.patel@example.com", channel: "customer_form",
      partnerId: null, rawSubmissionId: "s3", verification: "customer_confirmed",
      confidence: 0.95, recordedAt: at("2026-07-20T14:00:00Z"),
    },
  ];

  it("reports only fields where sources actually disagree", () => {
    const conflicts = detectConflicts(candidates);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.fieldPath).toBe("move.date");
  });

  it("recommends the customer-confirmed date over the partner's", () => {
    const [conflict] = detectConflicts(candidates);
    expect(conflict!.recommended?.value).toBe("2026-08-16");
    expect(conflict!.recommended?.channel).toBe("customer_form");
    expect(conflict!.reason).toContain("customer_confirmed");
  });

  it("returns every candidate, not just the winner", () => {
    // The rejected value has to stay visible. A merge UI that hides what was
    // discarded is not auditable.
    const [conflict] = detectConflicts(candidates);
    expect(conflict!.candidates).toHaveLength(2);
    expect(conflict!.candidates.map((c) => c.value)).toContain("2026-08-14");
  });

  it("recommends without deciding — nothing here marks a value canonical", () => {
    const [conflict] = detectConflicts(candidates);
    // detectConflicts is pure. Canonicality requires a human actor and is
    // enforced by the canonical_requires_actor CHECK constraint.
    expect(conflict).not.toHaveProperty("isCanonical");
    expect(Object.keys(conflict!)).toEqual(
      expect.arrayContaining(["fieldPath", "candidates", "recommended", "reason"]),
    );
  });
});
