import { leafPaths } from "./projection-diff";
import type { Actor } from "./actor";

/**
 * What a projection says about itself.
 *
 * The page could count fields by diffing three payloads it had fetched, which
 * works and quietly requires holding all three — so the count existed only for
 * a reviewer looking at the comparison tool, and not for anyone consuming one
 * projection on its own. A response that cannot describe its own shape leaves
 * every claim about it to the client.
 *
 * ## What is safe to put here, and what is not
 *
 * `withheldCategories` names categories, never fields. The temptation is to
 * derive it — diff this projection against the concierge one and list the
 * differences — and that would ship a precise map of everything the audience is
 * not allowed to see, attached to the response denying it. The categories are a
 * policy statement about the audience, fixed and reviewable, and they disclose
 * nothing about this move.
 *
 * `includedFieldCount` is the opposite case: it must be computed, because a
 * hardcoded number would keep asserting a shape the projection had stopped
 * having. It is counted from the object actually being returned.
 */

/**
 * Bumped when the allow-lists in `projections.ts` change.
 *
 * A projection's shape is a policy decision, and a reviewer comparing two
 * captured responses needs to know whether a difference is new data or a new
 * rule. Without this they are indistinguishable.
 */
export const PROJECTION_POLICY_VERSION = "projection-policy-v1";

/**
 * Categories deliberately absent from each audience.
 *
 * Written as prose about responsibility rather than as a field list. "Provider
 * operations" tells a reader what kind of thing is missing and gives them no
 * way to reconstruct it; `["services[].provider_order_id", "services[].error_category"]`
 * would tell them exactly what to go looking for.
 */
const WITHHELD: Record<Actor["audience"], string[]> = {
  concierge: [],
  customer: [
    "Provider operation internals",
    "Internal decisions and the actor who made them",
    "Partner attribution",
    "Full source history",
  ],
  partner: [
    "Provider operation internals",
    "Other partners' referrals",
    "Internal concierge notes and decisions",
    "Customer contact details",
  ],
};

export interface ProjectionManifest {
  audience: Actor["audience"];
  /** The granting path from the relationship graph. */
  relationship: string;
  /** Optimistic-concurrency version of the move this was built from. */
  moveVersion: number;
  policyVersion: string;
  /**
   * Leaf paths of the move data this audience received.
   *
   * The projection body only — not `exists`, not `authorization`, not the
   * manifest itself. Those are envelope: they are identical for every audience
   * and counting them would inflate every number by the same three, making the
   * figure describe the transport rather than the disclosure.
   */
  includedFieldCount: number;
  withheldCategories: string[];
  generatedAt: string;
}

export function buildManifest(input: {
  audience: Actor["audience"];
  relationship: string;
  moveVersion: number;
  /** The projection body, minus the manifest itself. */
  payload: Record<string, unknown>;
}): ProjectionManifest {
  return {
    audience: input.audience,
    relationship: input.relationship,
    moveVersion: input.moveVersion,
    policyVersion: PROJECTION_POLICY_VERSION,
    includedFieldCount: leafPaths(input.payload).length,
    withheldCategories: WITHHELD[input.audience],
    generatedAt: new Date().toISOString(),
  };
}
