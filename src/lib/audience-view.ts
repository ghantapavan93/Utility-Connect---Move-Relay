import { query } from "./db";
import { conciergeView, customerView, partnerView } from "./projections";
import type { Actor } from "./actor";
import { buildManifest, type ProjectionManifest } from "./projection-manifest";

/**
 * The projection one actor is entitled to, for one move.
 *
 * `conciergeView`, `customerView` and `partnerView` were always move-scoped;
 * the route above them was not. `/api/v1/views` resolved the demo move by
 * reference, so the screen that demonstrates audience isolation could only ever
 * demonstrate it on the one scripted record — and a move created through the
 * console, with real conflicts and a real provider timeout, had no way to be
 * seen through any audience at all.
 *
 * This is the resolution logic both routes share. The important property is
 * that the audience is derived from the actor and never from the request: it
 * used to be `?audience=partner`, which the caller wrote themselves, so a
 * projection that carefully withheld a provider account number from partners
 * was worth nothing because anyone could ask for the concierge view instead.
 */

export interface AudienceView {
  exists: true;
  authorization: { actor: string; audience: Actor["audience"]; via: string };
  /** What this projection says about its own shape. See `projection-manifest`. */
  manifest: ProjectionManifest;
  [key: string]: unknown;
}

/**
 * A partner sees a move through the partner they belong to.
 *
 * Resolved from the actor's own organization membership rather than from a
 * fixed slug. The previous route looked up `'ntr'` unconditionally, which meant
 * a second partner would have been shown the first partner's projection — the
 * exact cross-tenant leak the projection exists to prevent, in the code that
 * chooses which projection to run.
 */
async function partnerForActor(
  organizationId: string,
  subject: string,
): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `SELECT p.id
       FROM auth_tuples t
       JOIN partners p ON 'org:' || p.slug = t.object
      WHERE t.subject = $1 AND t.relation = 'member' AND p.organization_id = $2
      LIMIT 1`,
    [subject, organizationId],
  );
  return rows[0]?.id ?? null;
}

export async function viewForActor(
  moveId: string,
  actor: Actor,
  via: string,
): Promise<AudienceView | { exists: false; reason: string }> {
  const move = (
    await query<{ id: string; organization_id: string; version: number }>(
      `SELECT id, organization_id, version FROM moves WHERE id = $1`,
      [moveId],
    )
  )[0];
  if (!move) return { exists: false, reason: "no such move" };

  // The granting path travels with the response. An authorization decision the
  // system cannot explain is one nobody can review, and the engineering panel
  // renders this directly.
  const authorization = { actor: actor.subject, audience: actor.audience, via };

  /*
    The manifest is built from the finished payload, not alongside it.

    `includedFieldCount` has to count what is actually being returned, so it is
    computed after the projection exists and before the response is assembled.
    Declaring it next to the projection would let the two drift the moment a
    field was added to one and not the other.
  */
  const finish = (payload: Record<string, unknown>): AudienceView => ({
    exists: true,
    authorization,
    manifest: buildManifest({
      audience: actor.audience,
      relationship: via,
      moveVersion: move.version,
      payload,
    }),
    ...payload,
  });

  if (actor.audience === "customer") {
    return finish(await customerView(move.id));
  }

  if (actor.audience === "partner") {
    const partnerId = await partnerForActor(move.organization_id, actor.subject);
    if (!partnerId) {
      // A partner actor with no partner record is not an error to render as an
      // empty projection — it is an actor who cannot be shown anything, and
      // saying so is more useful than a blank panel.
      return { exists: false, reason: "this actor belongs to no partner in this organization" };
    }
    return finish(await partnerView(move.id, partnerId));
  }

  return finish(await conciergeView(move.organization_id, move.id));
}
