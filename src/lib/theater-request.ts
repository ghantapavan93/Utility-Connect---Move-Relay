import { reasonForRequestFailure, type InconclusiveReason } from "./theater-verdict";

/**
 * One way to call the theater, with a real deadline behind it.
 *
 * The verdict model distinguishes a timeout from a cancellation from a network
 * failure, and for a while it could not have: nothing in this app ever set a
 * deadline, so the branch that returned `timeout` was reachable only by an
 * `Error` whose message happened to contain the word. That is a fixture, not a
 * mechanism — the classifier was reporting a state the system had no way to
 * produce.
 *
 * A deadline exists now, and the two aborts are told apart by construction
 * rather than by inspecting prose:
 *
 *   `AbortSignal.timeout(ms)`  aborts with DOMException **TimeoutError**
 *   `controller.abort()`       aborts with DOMException **AbortError**
 *
 * They are different exception names, so the classifier never has to guess and
 * branch order cannot make one masquerade as the other. `AbortSignal.any`
 * forwards whichever fired first as the rejection reason.
 */

/**
 * How long an attack may take before we stop waiting.
 *
 * Generous on purpose. These scenarios do real database work — the signature
 * incident alone opens a move, submits, and reconciles — and a deadline tight
 * enough to fire during normal operation would manufacture the very ambiguity
 * this page argues against.
 */
export const THEATER_DEADLINE_MS = 20_000;

export interface TheaterFailure {
  error: string;
  reason: InconclusiveReason;
}

export type TheaterFetch<T> = { ok: true; data: T } | { ok: false; failure: TheaterFailure };

/**
 * POST to a theater endpoint and classify everything that can go wrong.
 *
 * Never throws. Every failure path returns a named reason, because the caller's
 * only alternative is to invent one — and a page that infers a breach from a
 * dead socket is making exactly the blind inference the signature incident
 * exists to refuse.
 */
export async function postTheater<T>(
  url: string,
  opts: { body?: Record<string, unknown>; signal?: AbortSignal } = {},
): Promise<TheaterFetch<T>> {
  const deadline = AbortSignal.timeout(THEATER_DEADLINE_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts.body ?? {}),
      signal,
    });
  } catch (err) {
    const reason = reasonForRequestFailure(err);
    return { ok: false, failure: { error: describe(err, reason), reason } };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return {
      ok: false,
      failure: {
        error: `The server answered ${res.status} with a body that is not JSON.`,
        reason: "malformed_response",
      },
    };
  }

  const body = json as { ok?: boolean; error?: string };

  /*
    Every expected domain refusal in this surface is returned inside a 200
    envelope — see the response contract in `theater.ts` and the signature
    route. So a non-2xx here is an infrastructure or server fault, never a
    defence doing its job, and classifying it as `server_error` does not
    swallow an expected outcome.
  */
  if (!res.ok || body.ok !== true) {
    return {
      ok: false,
      failure: {
        error: body.error ?? `The server returned ${res.status}.`,
        reason: reasonForRequestFailure(null, res.status),
      },
    };
  }

  return { ok: true, data: body as T };
}

function describe(err: unknown, reason: InconclusiveReason): string {
  if (reason === "timeout") return `No answer within ${THEATER_DEADLINE_MS / 1000}s. The run was abandoned.`;
  if (reason === "cancelled") return "The run was superseded before it completed.";
  return err instanceof Error ? err.message : String(err);
}
