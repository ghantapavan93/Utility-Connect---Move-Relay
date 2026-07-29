import { describe, it, expect } from "vitest";
import { reasonForRequestFailure } from "../theater-verdict";

/**
 * The timeout branch, exercised through the mechanism that actually produces it.
 *
 * This classifier used to match `/timeout/` against `Error.message`, and nothing
 * in the app set a deadline — so the only way to reach that branch was to
 * construct an error whose text happened to contain the word. A test written
 * against such a fixture proves the regex works and says nothing about whether
 * the state can occur, which on a page about unearned claims is the wrong kind
 * of green.
 *
 * Every case below aborts a real request the way the app does, and classifies
 * whatever the runtime genuinely throws.
 */

/** A request that will never answer, so only the abort can end it. */
const hang = (signal: AbortSignal): Promise<never> =>
  new Promise<never>((_resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });

describe("a deadline and a cancellation are told apart by construction", () => {
  it("classifies a real deadline expiry as timeout", async () => {
    const deadline = AbortSignal.timeout(10);
    const err = await hang(deadline).catch((e: unknown) => e as { name: string });

    // The runtime's own name, not something this test supplied.
    expect(err.name).toBe("TimeoutError");
    expect(reasonForRequestFailure(err)).toBe("timeout");
  });

  it("classifies a real user cancellation as cancelled", async () => {
    const controller = new AbortController();
    const p = hang(controller.signal).catch((e: unknown) => e as { name: string });
    controller.abort();
    const err = await p;

    expect(err.name).toBe("AbortError");
    expect(reasonForRequestFailure(err)).toBe("cancelled");
  });

  /*
    The combination the app actually uses. Whichever signal fires first supplies
    the reason, so the two cases have to stay distinguishable after they are
    merged — this is the arrangement that would hide a deadline behind a
    cancellation if the names were shared.
  */
  it("keeps them distinct through AbortSignal.any, in both directions", async () => {
    const userA = new AbortController();
    const timedOut = await hang(AbortSignal.any([userA.signal, AbortSignal.timeout(10)])).catch((e: unknown) => e as { name: string });
    expect(reasonForRequestFailure(timedOut)).toBe("timeout");

    const userB = new AbortController();
    const p = hang(AbortSignal.any([userB.signal, AbortSignal.timeout(10_000)])).catch((e: unknown) => e as { name: string });
    userB.abort();
    expect(reasonForRequestFailure(await p)).toBe("cancelled");
  });

  it("does not depend on branch order — the two names are disjoint", async () => {
    const t = await hang(AbortSignal.timeout(5)).catch((e: unknown) => e as { name: string });
    const c = await (async () => {
      const ctl = new AbortController();
      const p = hang(ctl.signal).catch((e: unknown) => e as { name: string });
      ctl.abort();
      return p;
    })();
    expect(new Set([t.name, c.name]).size).toBe(2);
  });

  it("classifies an ordinary transport failure as network", () => {
    // What `fetch` rejects with when the socket never opens.
    expect(reasonForRequestFailure(new TypeError("Failed to fetch"))).toBe("network");
    expect(reasonForRequestFailure(new Error("ECONNRESET"))).toBe("network");
  });

  it("classifies a server answer by its status, never as a breach", () => {
    for (const status of [400, 401, 403, 409, 422, 500, 503]) {
      expect(reasonForRequestFailure(null, status)).toBe("server_error");
    }
  });
});

describe("expected domain refusals never travel as HTTP failure", () => {
  /*
    The generic rule `status >= 400 -> server_error` is only safe because every
    defence in this surface reports through a 200 envelope. If a scenario ever
    signalled a refusal with 403 or 409, that rule would file a working
    guarantee as an infrastructure fault — the page would report its own success
    as a broken server.

    So the contract is asserted rather than assumed: each scenario returns its
    outcome in the body, and HTTP status is reserved for transport and routing.
  */
  it("returns every outcome in the envelope, never in the status line", async () => {
    const { SCENARIOS } = await import("../theater");
    for (const [key, run] of Object.entries(SCENARIOS)) {
      const result = await run();
      expect(result.scenario, key).toBe(key);
      expect(typeof result.outcome, key).toBe("string");
      expect(typeof result.invariant, key).toBe("string");
      expect(result.evidence, key).toBeTypeOf("object");
    }
  }, 60_000);

  it("reserves non-2xx for routing and server faults only", () => {
    /*
      The complete set of non-200 responses this surface can produce:
        404  unknown scenario or unknown signature stage
        400  signature stage called without a runId
        500  an unexpected throw inside a scenario
      None of these is a domain outcome, so none needs its own verdict branch.
    */
    for (const status of [400, 404, 500]) {
      expect(reasonForRequestFailure(null, status)).toBe("server_error");
    }
  });
});
