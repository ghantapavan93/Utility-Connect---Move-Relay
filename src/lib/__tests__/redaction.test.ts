import { describe, it, expect } from "vitest";
import { redact } from "../audit";

/**
 * Audit redaction.
 *
 * An audit found that `REDACTED_PATHS` held dotted paths — `customer.ssn` —
 * while the implementation compared them against top-level keys only. Every
 * payload in this system nests customer data under `customer`, so the matcher
 * never fired: the comment described redaction the code was not performing, and
 * a social security number in a referral payload was written into the audit log
 * in clear.
 *
 * The audit log is the one table that is deliberately immutable, which makes
 * this the worst possible place to leak: the rows cannot be edited afterwards
 * and cannot be deleted at all. These tests exist so that never regresses
 * quietly.
 */

describe("redaction reaches nested values", () => {
  it("redacts an SSN nested under customer — the shape every payload actually uses", () => {
    const out = redact({
      customer: { first_name: "Maya", ssn: "123-45-6789" },
      move: { date: "2026-08-14" },
    })!;
    const customer = out.customer as Record<string, unknown>;
    expect(customer.ssn).toBe("[redacted]");
    // Everything else survives — redaction is a scalpel, not a bucket.
    expect(customer.first_name).toBe("Maya");
    expect((out.move as Record<string, unknown>).date).toBe("2026-08-14");
  });

  it("redacts an account number nested two levels down", () => {
    const out = redact({ billing: { payment: { account_number: "4111111111111111" } } })!;
    const payment = (out.billing as Record<string, unknown>).payment as Record<string, unknown>;
    expect(payment.account_number).toBe("[redacted]");
  });

  it("redacts inside arrays without the index breaking the path", () => {
    const out = redact({
      services: [{ type: "electric" }, { type: "gas", payment: { account_number: "9999" } }],
    })!;
    const second = (out.services as Array<Record<string, unknown>>)[1]!;
    expect((second.payment as Record<string, unknown>).account_number).toBe("[redacted]");
    expect(second.type).toBe("gas");
  });

  it("still catches a bare key when the wrapper is missing", () => {
    // Not every producer nests. A flattened payload must not be a way around it.
    expect(redact({ ssn: "123-45-6789" })!.ssn).toBe("[redacted]");
  });

  it("leaves ordinary payloads untouched", () => {
    const input = { customer: { first_name: "Maya", email: "maya@example.com" }, count: 3 };
    expect(redact(input)).toEqual(input);
  });

  it("handles null and undefined without throwing", () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeNull();
  });
});
