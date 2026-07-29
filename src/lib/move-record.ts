import { query } from "./db";
import { servicesFor, type ServiceRow } from "./fulfillment";

/**
 * The whole record for one move.
 *
 * The move workspace could resolve conflicts and nothing else. With no open
 * conflicts it showed a single card reading "No open conflicts" and a link
 * away — so the screen that exists to prove provenance displayed none of it,
 * and a reviewer arriving at a settled move saw an empty page where the
 * argument was supposed to be.
 *
 * The parts were all there and none of them were move-scoped:
 * `/api/v1/provenance` resolved the demo move by reference and took a field
 * name, the audit trail was only rendered inside the guided demo, and consent
 * was not surfaced anywhere at all. This module is the read model those screens
 * should always have shared — everything known about one move, by id.
 *
 * Every list is ordered oldest-first. A provenance view sorted newest-first
 * reads as a feed; sorted oldest-first it reads as a history, which is what it
 * is.
 */

export interface FieldVersion {
  id: string;
  value: unknown;
  channel: string;
  verification: string;
  confidence: number;
  isCanonical: boolean;
  /** The version this one replaced, if a human chose it over something. */
  supersedesId: string | null;
  selectedBy: string | null;
  selectionReason: string | null;
  /** When the fact was true in the world, where known. */
  validAt: string | null;
  /** When we learned it. */
  recordedAt: string;
}

export interface FieldHistory {
  fieldPath: string;
  /** The human-approved value, where one exists. */
  canonical: FieldVersion | null;
  versions: FieldVersion[];
  /** More than one distinct value and nothing canonical yet. */
  contested: boolean;
}

export interface AuditRow {
  id: string;
  eventType: string;
  actor: string;
  correlationId: string | null;
  detail: Record<string, unknown> | null;
  occurredAt: string;
}

export interface ConsentRow {
  granted: boolean;
  purpose: string;
  channel: string;
  textVersion: string;
  occurredAt: string;
}

export interface MoveRecord {
  move: { id: string; reference: string; state: string; version: number; createdAt: string };
  fields: FieldHistory[];
  sources: { channel: string; fields: number; firstSeen: string }[];
  services: ServiceRow[];
  consent: ConsentRow[];
  audit: AuditRow[];
}

export async function moveRecord(moveId: string): Promise<MoveRecord | null> {
  const move = (
    await query<{
      id: string;
      reference: string;
      state: string;
      version: number;
      createdAt: string;
    }>(
      `SELECT id, reference, state, version, created_at AS "createdAt"
         FROM moves WHERE id = $1`,
      [moveId],
    )
  )[0];
  if (!move) return null;

  const versions = await query<FieldVersion & { fieldPath: string }>(
    `SELECT id, field_path AS "fieldPath", value, channel, verification,
            confidence, is_canonical AS "isCanonical",
            supersedes_id AS "supersedesId",
            selected_by AS "selectedBy", selection_reason AS "selectionReason",
            valid_at AS "validAt", recorded_at AS "recordedAt"
       FROM field_versions
      WHERE move_id = $1
      ORDER BY field_path, recorded_at, id`,
    [moveId],
  );

  /*
    Grouped in code rather than by a lateral join.

    The grouping is trivial and the alternative is a query nobody can read for
    the sake of one round trip on a result set of tens of rows. If a move ever
    carries thousands of field versions this becomes a paginated endpoint, and
    the shape returned here does not change.
  */
  const byPath = new Map<string, FieldVersion[]>();
  for (const v of versions) {
    const { fieldPath, ...rest } = v;
    const list = byPath.get(fieldPath) ?? [];
    list.push(rest);
    byPath.set(fieldPath, list);
  }

  const fields: FieldHistory[] = [...byPath.entries()].map(([fieldPath, list]) => {
    const canonical = list.find((v) => v.isCanonical) ?? null;
    const distinct = new Set(list.map((v) => JSON.stringify(v.value)));
    return {
      fieldPath,
      canonical,
      versions: list,
      // Contested means "still needs a person", so a field a human has already
      // settled is not contested however much its sources disagreed.
      contested: !canonical && distinct.size > 1,
    };
  });

  const sources = await query<{ channel: string; fields: number; firstSeen: string }>(
    `SELECT channel, count(*)::int AS fields, min(recorded_at) AS "firstSeen"
       FROM field_versions
      WHERE move_id = $1
      GROUP BY channel
      ORDER BY min(recorded_at)`,
    [moveId],
  );

  const consent = await query<ConsentRow>(
    `SELECT granted, purpose::text, channel::text,
            consent_text_version AS "textVersion",
            occurred_at AS "occurredAt"
       FROM consent_events
      WHERE move_id = $1
      ORDER BY occurred_at`,
    [moveId],
  );

  const audit = await query<AuditRow>(
    `SELECT id::text, event_type AS "eventType", actor,
            correlation_id AS "correlationId", detail,
            occurred_at AS "occurredAt"
       FROM audit_events
      WHERE move_id = $1
      ORDER BY occurred_at, id`,
    [moveId],
  );

  return { move, fields, sources, services: await servicesFor(moveId), consent, audit };
}
