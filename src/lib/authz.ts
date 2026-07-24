import { query } from "./db";

/**
 * Relationship-based authorization.
 *
 * A brokerage network is a graph: network → brokerage → office → agent, with
 * referrals owned by organizations at any level. "role === 'partner'" cannot
 * answer the question that matters — may THIS actor act on THIS resource? —
 * because access follows relationships, not labels.
 *
 * This is the Zanzibar/OpenFGA model reduced to the relations this domain
 * needs, stored as tuples:
 *
 *   (user:amy,   member, org:office-a)      amy belongs to office A
 *   (org:office-a, parent, org:brokerage-b) office A is part of brokerage B
 *   (org:office-a, owner,  referral:r1)     office A owns referral r1
 *   (user:root,  admin,  org:brokerage-b)   root administers brokerage B
 *
 * The check walks the graph:
 *
 *   view(referral) ⇐ member of the owning org
 *                  ⇐ admin of the owning org or ANY ancestor org
 *
 * Two properties fall out, both tested:
 *   - Access is revoked by deleting one tuple (the former-agent case).
 *   - Cross-tenant access is denied by construction — no relationship path,
 *     no access. Deny is the default, not a filter someone remembered to add.
 */

export async function writeTuple(subject: string, relation: string, object: string): Promise<void> {
  await query(
    `INSERT INTO auth_tuples (subject, relation, object)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [subject, relation, object],
  );
}

export async function deleteTuple(subject: string, relation: string, object: string): Promise<void> {
  await query(
    `DELETE FROM auth_tuples WHERE subject = $1 AND relation = $2 AND object = $3`,
    [subject, relation, object],
  );
}

async function hasTuple(subject: string, relation: string, object: string): Promise<boolean> {
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM auth_tuples
      WHERE subject = $1 AND relation = $2 AND object = $3`,
    [subject, relation, object],
  );
  return rows.length > 0;
}

/** Organizations that directly own the object. */
async function ownersOf(object: string): Promise<string[]> {
  const rows = await query<{ subject: string }>(
    `SELECT subject FROM auth_tuples WHERE relation = 'owner' AND object = $1`,
    [object],
  );
  return rows.map((r) => r.subject);
}

/** Walk parent links upward from an org, bounded against cycles. */
async function ancestorsOf(org: string, maxDepth = 6): Promise<string[]> {
  const seen = new Set<string>();
  let frontier = [org];
  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: string[] = [];
    for (const node of frontier) {
      const rows = await query<{ object: string }>(
        `SELECT object FROM auth_tuples WHERE subject = $1 AND relation = 'parent'`,
        [node],
      );
      for (const r of rows) {
        if (!seen.has(r.object)) {
          seen.add(r.object);
          next.push(r.object);
        }
      }
    }
    frontier = next;
  }
  return [...seen];
}

export interface CheckResult {
  allowed: boolean;
  /** The relationship path that granted access — the explanation, for the audit. */
  via: string | null;
}

/**
 * May `subject` view `object`?
 *
 * Returns the granting path, not just a boolean — an authorization decision the
 * system cannot explain is an authorization decision nobody can review.
 */
export async function checkView(subject: string, object: string): Promise<CheckResult> {
  // Direct grant on the resource itself.
  if (await hasTuple(subject, "viewer", object)) {
    return { allowed: true, via: `direct viewer of ${object}` };
  }

  for (const org of await ownersOf(object)) {
    // Member of the owning organization.
    if (await hasTuple(subject, "member", org)) {
      return { allowed: true, via: `member of owning org ${org}` };
    }
    // Admin of the owning organization or any ancestor.
    if (await hasTuple(subject, "admin", org)) {
      return { allowed: true, via: `admin of owning org ${org}` };
    }
    for (const ancestor of await ancestorsOf(org)) {
      if (await hasTuple(subject, "admin", ancestor)) {
        return { allowed: true, via: `admin of ancestor ${ancestor} of ${org}` };
      }
    }
  }

  return { allowed: false, via: null };
}
