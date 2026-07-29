import { withTransaction, query } from "./db";
import { writeTuple } from "./authz";
import { materialiseServices, providerRequestKey } from "./fulfillment";
import { submitToProvider, reconcile } from "./provider-submission";
import { callProvider, lookupOrder } from "./provider-simulator";

/**
 * Maya's move, seeded into a tenant this page owns.
 *
 * The Views page could only ever show a record the nine-step console had
 * already produced, so a reviewer arriving from a link met the sentence "run
 * the demo from the start, then come back and compare". That asks someone to
 * leave, complete an unrelated experience, remember to return, and reconstruct
 * what changed — which is a request most people decline, and the page's whole
 * argument goes unread.
 *
 * ## Why not just run the demo orchestrator
 *
 * Because it operates on `uc-demo`, and `demo.reset()` deletes that
 * organisation outright. A "load" button here would silently destroy the state
 * of whoever had the console open — the same collision the Failure Theater's
 * signature incident avoided by running in its own tenant.
 *
 * So this seeds `views-demo`: its own organisation, its own move, its own
 * relationship tuples. Nothing it does is visible from `/demo`, and nothing
 * `/demo` does is visible here.
 *
 * ## What it produces, and why each part is needed
 *
 * The three projections read different things, and a seed that satisfied only
 * one would make the other two look empty rather than restrained:
 *
 *   concierge  needs conflicting field versions, a resolved canonical value
 *              with a named human, live provider state, a briefing
 *   customer   needs canonical fields on its allow-list, services, timeline
 *   partner    needs field versions carrying its `partner_id`, or the
 *              projection correctly reports no attributed engagement
 *
 * The provider submission is real: it goes through `submitToProvider` with the
 * timeout scenario and is then reconciled, so the concierge sees a recovered
 * order and the customer sees "Scheduled" — the same asymmetry the rest of the
 * project is about, rather than two rows written to look like it.
 */

export const VIEWS_ORG_SLUG = "views-demo";
export const VIEWS_MOVE_REF = "MR-2026-0001";
const PARTNER_SLUG = "north-texas-realty";

/** The people, named. Abstract roles were the reason the page read as a diagram. */
export const VIEWS_ACTORS = {
  concierge: { subject: "user:jordan-lee", label: "Jordan Lee", role: "Concierge" },
  customer: { subject: "user:maya-patel", label: "Maya Patel", role: "Customer" },
  partner: { subject: "user:ntr-agent", label: "North Texas Realty", role: "Referring partner" },
  /** Related to nothing here. The actor the forbidden view uses. */
  unrelated: { subject: "user:rival-agent", label: "Rival Brokerage", role: "Unrelated partner" },
} as const;

export interface SeedResult {
  moveId: string;
  reference: string;
  organizationId: string;
  /** True when this call created it, false when it already existed. */
  created: boolean;
}

async function orgId(): Promise<string> {
  const existing = await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
    VIEWS_ORG_SLUG,
  ]);
  if (existing[0]) return existing[0].id;
  const made = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    ["Utility Connect (views)", VIEWS_ORG_SLUG],
  );
  return made[0]!.id;
}


/**
 * The relationship graph, ensured on every call rather than only at creation.
 *
 * `writeTuple` is idempotent, so re-running is free — and the alternative is a
 * tenant that exists with an incomplete graph and can never repair itself,
 * because the seed short-circuits on the move already being there. That is
 * exactly what happened when a grant was added after the first seed had run:
 * the move was present, the early return fired, and the new tuple was never
 * written.
 */
async function ensureTuples(moveId: string): Promise<void> {
  /*
    The relationship graph, which is what every projection is authorized
    against. Without these tuples the page shows three denials, correctly, and
    proves nothing.

    The unrelated actor is deliberately absent: it has no tuple to this move,
    which is exactly what makes the forbidden view a real refusal rather than a
    branch someone wrote.
  */
  await writeTuple(`org:${VIEWS_ORG_SLUG}`, "owner", `move:${moveId}`);
  await writeTuple(VIEWS_ACTORS.concierge.subject, "member", `org:${VIEWS_ORG_SLUG}`);
  /*
    The console's concierge identity is granted here as well.

    `user:concierge-7` is what the Views page has always sent, and what every
    move created in the console is granted under. Seeding only `user:jordan-lee`
    made this tenant's move correct and unreadable: the projection built fine
    and the gate in front of it returned 403, so all three panels came back
    empty on a page whose subject is what each audience receives.

    Both are the same audience with the same entitlements. One is a seat number
    the console uses; the other is the person this page names. Neither is more
    privileged than the other, and dropping one would break a working surface
    to tidy an identifier.
  */
  await writeTuple("user:concierge-7", "member", `org:${VIEWS_ORG_SLUG}`);
  await writeTuple(VIEWS_ACTORS.customer.subject, "viewer", `move:${moveId}`);
  await writeTuple(`org:${PARTNER_SLUG}`, "parent", `org:${VIEWS_ORG_SLUG}`);
  await writeTuple(VIEWS_ACTORS.partner.subject, "member", `org:${PARTNER_SLUG}`);
  /*
    The partner co-owns the move, and this edge is what actually grants them
    access.

    `checkView` reaches a member through `ownersOf(object)` — it does not walk
    down from an owning org into its children. So the four tuples above wire the
    partner into the org tree and grant nothing: the projection would build
    correctly and the gate in front of it would return 403. Omitting this was a
    real defect in the first version of this seed, and the test that grants all
    three actors is what found it.
  */
  await writeTuple(`org:${PARTNER_SLUG}`, "owner", `move:${moveId}`);

}

/**
 * Idempotent. Pressing the button twice returns the same move.
 *
 * Not a reset: re-seeding would destroy a projection a reviewer was reading,
 * and there is no reason to. The move is complete on first creation and
 * unchanged afterwards, so `created: false` is a normal answer, not a failure.
 */
export async function seedViewsMove(): Promise<SeedResult> {
  const organizationId = await orgId();

  const existing = await query<{ id: string }>(
    `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
    [organizationId, VIEWS_MOVE_REF],
  );
  if (existing[0]) {
    await ensureTuples(existing[0].id);
    return { moveId: existing[0].id, reference: VIEWS_MOVE_REF, organizationId, created: false };
  }

  const { moveId, serviceRequestId } = await withTransaction(async (c) => {
    const partner = (
      await c.query<{ id: string }>(
        `INSERT INTO partners (organization_id, name, slug) VALUES ($1,$2,$3)
         ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [organizationId, "North Texas Realty", PARTNER_SLUG],
      )
    ).rows[0]!;

    const move = (
      await c.query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state) VALUES ($1,$2,'canonical') RETURNING id`,
        [organizationId, VIEWS_MOVE_REF],
      )
    ).rows[0]!;

    /*
      Three channels disagreeing about one move, then a human choosing.

      `move.date` carries the conflict the demo narrative is built on: the
      partner feed said the 14th and Maya said the 16th on her own form. The
      canonical row names the concierge who chose it, because the schema's
      `canonical_requires_actor` check refuses a canonical value with no actor —
      a constraint worth exercising here rather than sidestepping.
    */
    const field = async (
      path: string,
      value: unknown,
      channel: string,
      opts: { canonical?: boolean; verification?: string; partner?: boolean; reason?: string } = {},
    ) =>
      c.query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel, partner_id,
            verification, is_canonical, selected_by, selection_reason)
         VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10)`,
        [
          organizationId,
          move.id,
          path,
          JSON.stringify(value),
          channel,
          opts.partner ? partner.id : null,
          opts.verification ?? "unverified",
          opts.canonical ?? false,
          opts.canonical ? "human:jordan-lee" : null,
          opts.canonical ? (opts.reason ?? null) : null,
        ],
      );

    // The partner's referral. `partner_id` is what earns them a projection.
    await field("move.date", "2026-08-14", "partner_api", { partner: true });
    await field("customer.phone", "469-555-0142", "partner_api", { partner: true });
    await field("move.to_address", "1420 Windhaven Pkwy Plano TX", "partner_api", { partner: true });

    // The CSV, with one transposed digit — the duplicate the console detects.
    await field("customer.phone", "469-555-0124", "csv_upload", { partner: true });

    // Maya's own form, which is where the later date comes from.
    await field("move.date", "2026-08-16", "customer_form", { verification: "customer_confirmed" });
    await field("customer.email", "maya.patel@example.com", "customer_form", {
      verification: "customer_confirmed",
    });

    // The concierge decision. Named, with a reason, as the schema insists.
    await field("move.date", "2026-08-16", "customer_form", {
      canonical: true,
      verification: "customer_confirmed",
      reason: "Customer stated 16 Aug directly on the web form, three days after the partner feed.",
    });
    await field("customer.phone", "469-555-0142", "partner_api", {
      canonical: true,
      partner: true,
      reason: "Two of three sources agree; the CSV differs by a single transposed digit.",
    });
    await field("move.to_address", "1420 Windhaven Pkwy Plano TX", "partner_api", {
      canonical: true,
      partner: true,
      reason: "Consistent across every channel that supplied it.",
    });

    const services = await materialiseServices(c, organizationId, move.id, [
      "electric",
      "internet",
      "security",
    ]);

    /*
      The partner's slug is what ties it to the tuple graph: `partnerForActor`
      joins `'org:' || p.slug` against the tuple object, so `org:north-texas-realty`
      below only resolves because the row was inserted under the same slug.
    */
    return { moveId: move.id, serviceRequestId: services[0]! };
  });

  /*
    A real provider submission, lost, then reconciled.

    Written through `submitToProvider` and `reconcile` rather than as two rows
    shaped to look like the outcome. The concierge projection then shows a
    recovered order id because one genuinely exists, and the customer projection
    shows "Scheduled" because `customerStatus` maps the reconciled state — the
    asymmetry is produced by the same code that produces it in production.
  */
  const requestKey = providerRequestKey(serviceRequestId);
  const correlationId = "22222222-2222-4222-8222-222222222222";

  const submitted = await submitToProvider(
    {
      organizationId,
      moveId,
      serviceRequestId,
      payload: { service: "electric", provider: "Reliant" },
      correlationId,
      actor: "human:jordan-lee",
      providerRequestKey: requestKey,
    },
    (payload) =>
      callProvider(payload, {
        scenario: "timeout_after_create",
        requestKey,
        serviceType: "electric",
        now: new Date().toISOString(),
      }),
  );

  await reconcile(
    { organizationId, moveId, submissionId: submitted.submissionId, correlationId },
    () => lookupOrder(requestKey),
  );

  await ensureTuples(moveId);

  return { moveId, reference: VIEWS_MOVE_REF, organizationId, created: true };
}

/** The seeded move, if it exists. Read-only — never creates. */
export async function seededMove(): Promise<SeedResult | null> {
  const org = await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
    VIEWS_ORG_SLUG,
  ]);
  if (!org[0]) return null;

  const move = await query<{ id: string }>(
    `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
    [org[0].id, VIEWS_MOVE_REF],
  );
  if (!move[0]) return null;

  return {
    moveId: move[0].id,
    reference: VIEWS_MOVE_REF,
    organizationId: org[0].id,
    created: false,
  };
}
