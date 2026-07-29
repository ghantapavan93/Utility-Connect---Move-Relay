import type { Mutation } from "./theater-builder";

/**
 * What each mutation costs, and what must survive it.
 *
 * Shown *before* the run, which is the whole point of a builder: a reviewer
 * states the expected outcome, presses the button, and then compares. A page
 * that only narrated results afterwards could describe any result as the
 * expected one, and nobody could tell the difference.
 *
 * Kept out of `theater-builder.ts` because that module opens a database
 * connection and this copy has to reach the browser — the same seam
 * `theater-contract.ts` exists for.
 *
 * `risk` is `[HYPO]`: a reasoned consequence in scaled home-service
 * coordination, not an observed incident and not a claim about anyone's
 * internal operations. `invariant` and `proves` describe this system.
 */

const UNSTATED = "The server returned no evidence for this claim.";

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const arr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const allowed = (v: unknown): boolean | null =>
  v && typeof v === "object" && "allowed" in v ? bool((v as { allowed: unknown }).allowed) : null;

export interface MutationCopy {
  /** Shown in the chooser. */
  label: string;
  /** One line, present tense, describing the fault being introduced. */
  fault: string;
  /** Business consequence if the guarantee were absent. `[HYPO]` */
  risk: string;
  /** Computed from returned evidence. Never asserted independently. */
  proves: (evidence: Record<string, unknown>) => string;
}

export const MUTATION_COPY: Record<Mutation, MutationCopy> = {
  replay_batch: {
    label: "Replay the same intake batch",
    fault: "Deliver the identical referral a second time.",
    risk: "One household enrolled twice, and two concierges working the same move from two records.",
    proves: (e) => {
      const first = str(e.firstStatus);
      const second = str(e.secondStatus);
      const same = bool(e.sameMove);
      if (!first || !second || same === null) return UNSTATED;
      return `First delivery ${first}, second ${second}. Same move: ${same ? "yes" : "no"}.`;
    },
  },

  replay_webhook: {
    label: "Replay the same webhook",
    fault: "Deliver one event twice, as an at-least-once transport may.",
    risk: "The business action behind the event repeating — a second order against one intent.",
    proves: (e) => {
      const handled = num(e.handlerInvocations);
      const redelivery = num(e.redeliveryProcessed);
      if (handled === null || redelivery === null) return UNSTATED;
      return `Two deliveries accepted. Handler ran ${handled}×; redelivery processed ${redelivery}.`;
    },
  },

  remove_required_field: {
    label: "Remove a required field",
    fault: "Send the referral with move.date missing.",
    risk: "A move accepted with no date, or dropped so silently that neither side knows it went nowhere.",
    proves: (e) => {
      const issues = arr(e.issues);
      const version = str(e.contractVersion);
      const q = str(e.quarantineId);
      if (!issues || !version) return UNSTATED;
      return `Failed ${version} with ${issues.length} issues; ${q ? "quarantined and resolvable" : "not quarantined"}.`;
    },
  },

  rename_partner_field: {
    label: "Rename a supported partner field",
    fault: "Send move.date as move.moveDate, with no notice.",
    risk: "A renamed field read as absent, losing the date while the payload still looks complete.",
    proves: (e) => {
      const issues = arr(e.issues);
      const version = str(e.contractVersion);
      const q = str(e.quarantineId);
      if (!issues || !version) return UNSTATED;
      return `Failed ${version} with ${issues.length} issues; ${q ? "quarantined and resolvable" : "not quarantined"}.`;
    },
  },

  stale_version: {
    label: "Submit a stale record version",
    fault: "Two concierges save from the same read.",
    risk: "The second save silently replacing the first, with nothing recording that it happened.",
    proves: (e) => {
      const first = num(e.firstWriteRows);
      const second = num(e.secondWriteRows);
      if (first === null || second === null) return UNSTATED;
      return `The first write updated ${first} row. The stale write updated ${second}.`;
    },
  },

  other_tenant: {
    label: "Reach in from another synthetic tenant",
    fault: "An identity outside the owning organisation asks to read the referral.",
    risk: "One partner seeing another partner's pipeline — the disclosure that ends a partnership.",
    proves: (e) => {
      const owner = allowed(e.owningAgent);
      const rival = allowed(e.otherTenantAdmin);
      if (owner === null || rival === null) return UNSTATED;
      return `Owning agent ${owner ? "allowed" : "denied"}; other tenant ${rival ? "allowed" : "denied"}.`;
    },
  },

  drop_provider_response: {
    label: "Drop the provider response",
    fault: "The provider creates the order, then the reply is lost.",
    risk: "Guessing failure creates a second order; guessing success leaves a household unconnected.",
    proves: (e) => {
      const ours = str(e.ourState);
      const theirs = str(e.providerHoldsOrder);
      if (!ours) return UNSTATED;
      return `Our state ${ours}; the provider holds ${theirs ?? "no order"}.`;
    },
  },

  crash_at_submit: {
    label: "Crash at the submit checkpoint",
    fault: "Kill the worker inside submit, after reserve has committed.",
    risk: "A restart re-running work that already happened, or the move stalling with no one aware.",
    proves: (e) => {
      const after = str(e.stateAfterResume);
      const reserve = num(e.reserveCompletions);
      const crash = str(e.injectedCrashPoint);
      if (!after || reserve === null || !crash) return UNSTATED;
      return `Crashed in ${crash}, resumed to ${after}. reserve completed ${reserve}×.`;
    },
  },
};

/** The order the chooser presents them in — cheapest fault to hardest. */
export const MUTATION_ORDER: Mutation[] = [
  "replay_batch",
  "replay_webhook",
  "remove_required_field",
  "rename_partner_field",
  "stale_version",
  "other_tenant",
  "drop_provider_response",
  "crash_at_submit",
];

/** Whether returned evidence can establish this mutation's invariant. */
export function builderEstablishes(mutation: string, evidence: Record<string, unknown>): boolean {
  const copy = MUTATION_COPY[mutation as Mutation];
  return copy ? copy.proves(evidence) !== UNSTATED : false;
}
