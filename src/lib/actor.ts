import { NextResponse } from "next/server";
import { checkView } from "./authz";

/**
 * Who is asking, and may they.
 *
 * The authorization graph in `authz.ts` has always been correct and tested, and
 * until now it authorized nothing: no route called it, and `/api/v1/views`
 * decided what to return from a `?audience=` query parameter the caller wrote
 * themselves. A partner projection that withholds fields is worth very little
 * when anyone can ask for the concierge one instead.
 *
 * ── What this is, and what it is not ──────────────────────────────────────
 *
 * The actor is read from an `X-Actor` header. That is **authentication as a
 * stand-in** — there is no session, no signature and no password anywhere in
 * this project, and a header is trivially forged. Saying otherwise would be
 * the exact kind of claim this codebase exists to argue against.
 *
 * What *is* real is everything after identity: the decision is taken on the
 * server, against relationship tuples, by walking the ownership graph, and it
 * returns the granting path so the decision can be reviewed. Swapping the
 * header for a verified session changes one function in this file and nothing
 * else — the authorization model does not move.
 *
 * The demo actors are seeded by the orchestrator so the whole thing is
 * exercisable without an identity provider.
 */

export interface Actor {
  /** Zanzibar-style subject id, e.g. `user:concierge-7`. */
  subject: string;
  /** Which projection this actor is entitled to ask for. */
  audience: "concierge" | "customer" | "partner";
  label: string;
}

/** The demo identities, and the projection each is entitled to. */
export const DEMO_ACTORS: Record<string, Actor> = {
  "user:concierge-7": { subject: "user:concierge-7", audience: "concierge", label: "Concierge 7" },
  "user:maya-patel": { subject: "user:maya-patel", audience: "customer", label: "Maya Patel" },
  "user:ntr-agent": { subject: "user:ntr-agent", audience: "partner", label: "North Texas Realty agent" },
  // Deliberately present and deliberately entitled to nothing it does not own —
  // this is the actor the Failure Theater uses to prove cross-tenant denial.
  "user:rival-agent": { subject: "user:rival-agent", audience: "partner", label: "Rival brokerage agent" },
};

/**
 * Resolves the caller.
 *
 * Unknown or absent actors are not silently upgraded to a default with
 * concierge rights — that is how least-privilege systems quietly stop being
 * least-privilege. An unrecognised actor gets `null` and the route refuses.
 */
export function actorFrom(request: Request): Actor | null {
  const header = request.headers.get("x-actor");
  if (!header) return null;
  return DEMO_ACTORS[header] ?? null;
}

export interface Denial {
  response: NextResponse;
}

/**
 * Gate a request on the authorization graph.
 *
 * Returns `null` when the actor may proceed, or a ready-made 401/403 when they
 * may not. The denial body carries the reason and, on success, the granting
 * path — because an authorization decision the system cannot explain is an
 * authorization decision nobody can review.
 */
export async function requireView(
  request: Request,
  object: string,
): Promise<{ actor: Actor; via: string } | Denial> {
  const actor = actorFrom(request);
  if (!actor) {
    return {
      response: NextResponse.json(
        {
          error: "unauthenticated",
          detail:
            "Send an X-Actor header naming a known actor. This is a demo stand-in for a session, not a security boundary.",
          knownActors: Object.keys(DEMO_ACTORS),
        },
        { status: 401 },
      ),
    };
  }

  const decision = await checkView(actor.subject, object);
  if (!decision.allowed) {
    return {
      response: NextResponse.json(
        {
          error: "forbidden",
          actor: actor.subject,
          object,
          // No relationship path existed. Saying so is more useful than a bare
          // 403, and it is safe: the caller learns nothing they did not supply.
          detail: "No relationship path from this actor to this resource.",
        },
        { status: 403 },
      ),
    };
  }

  return { actor, via: decision.via ?? "unknown path" };
}

export const isDenial = (r: { actor: Actor } | Denial): r is Denial =>
  (r as Denial).response !== undefined;
