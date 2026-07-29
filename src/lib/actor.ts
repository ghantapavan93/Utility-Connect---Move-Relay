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
  /*
    The same role, named.

    "Concierge 7" is what the scripted demo calls its operator, and it stays
    because the console and its tests depend on it. The Views page needs a
    person rather than a seat number — a reviewer understands "Jordan Lee is
    responsible for resolving this move" and does not understand "concierge-7"
    — so it seeds its own tenant under this identity. Same audience, same
    entitlements, no additional privilege.
  */
  "user:jordan-lee": { subject: "user:jordan-lee", audience: "concierge", label: "Jordan Lee" },
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
          /*
            Stated by the server, because a screen that asserted them itself
            would be describing its own behaviour rather than reporting the
            system's. Both are literally true of this branch: it returns above
            `viewForActor`, so nothing was built and nothing was read.

            Everything here is either the caller's own input or a fact about the
            refusal. No field name, no value, and no hint about what the record
            contains — a denial that leaked the shape of what was withheld would
            be a disclosure dressed as a refusal.
          */
          relationship: null,
          projectionGenerated: false,
          returnedFields: 0,
        },
        { status: 403 },
      ),
    };
  }

  return { actor, via: decision.via ?? "unknown path" };
}

export const isDenial = (r: { actor: Actor } | Denial): r is Denial =>
  (r as Denial).response !== undefined;

/**
 * Gate a request that is about to *change* something.
 *
 * Two questions, and they are genuinely different. The relationship graph
 * answers *is this your record* — it is resource scope, and `requireView`
 * already asks it. This adds the second: *is this your job*. A customer can
 * legitimately view their own move and must never be the one who selects the
 * surviving value for a contested field; that is a concierge decision, and the
 * schema already insists a canonical value name the human who chose it.
 *
 * Splitting them keeps each answer in the place that owns it, rather than
 * inventing a `merge` relation in the tuple store and then having to keep it in
 * step with every new kind of write.
 *
 * This is not authentication. `X-Actor` is a forgeable header and a demo
 * stand-in for a session, stated wherever it appears. What it does provide is a
 * real authorization decision on a real graph, applied before a write instead of
 * after it — which is what was missing.
 */
export async function requireConciergeWrite(
  request: Request,
  object: string,
): Promise<{ actor: Actor; via: string } | Denial> {
  const gate = await requireView(request, object);
  if (isDenial(gate)) return gate;

  if (gate.actor.audience !== "concierge") {
    return {
      response: NextResponse.json(
        {
          error: "forbidden",
          actor: gate.actor.subject,
          object,
          detail:
            "This actor may view this record but may not change it. Selecting the surviving value for a contested field is a concierge decision.",
        },
        { status: 403 },
      ),
    };
  }

  return gate;
}
