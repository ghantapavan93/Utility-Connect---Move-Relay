import { describe, it, expect } from "vitest";

import { query, withTransaction, dbBackend } from "../db";

/**
 * The transaction primitive itself, tested before anything is built on it.
 *
 * `withTransaction` used to issue `BEGIN`, the work, and `COMMIT` as three
 * independent calls on the shared handle. Against PGlite that is a transaction:
 * one connection, nothing to interleave. Against a real server behind a pool it
 * is not — each call can be served by a different connection, so `BEGIN` opens
 * a transaction on one, the writes autocommit on others, and `COMMIT` closes an
 * empty transaction somewhere else.
 *
 * Sequentially the pool tends to hand back the same idle connection, which is
 * why every existing test passed and why nothing surfaced. It would have broken
 * first inside the concurrency tests, where it would have looked like flakiness
 * rather than like a missing transaction. These three tests exist so that a
 * future refactor back to pool-level calls fails here, loudly, with a name that
 * says what was lost.
 *
 * Tests 1 and 3 run on both backends. Test 2 is PostgreSQL-only: PGlite has one
 * connection, so "the same connection was used throughout" is trivially true
 * there and proves nothing.
 */

const isPg = dbBackend === "pg";

describe("1 — rollback atomicity", () => {
  it("commits neither write when the callback throws", async () => {
    const slugA = `tx-rollback-a-${Date.now()}`;
    const slugB = `tx-rollback-b-${Date.now()}`;

    await expect(
      withTransaction(async (tx) => {
        await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, [
          "Rollback A",
          slugA,
        ]);
        await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, [
          "Rollback B",
          slugB,
        ]);
        throw new Error("deliberate failure after both writes");
      }),
    ).rejects.toThrow(/deliberate failure/);

    /*
      Read back through the ordinary pool, not the transaction client. If the
      writes had autocommitted on separate connections — the exact failure this
      guards — they would be visible here while the "transaction" reported
      itself rolled back.
    */
    const survivors = await query<{ slug: string }>(
      `SELECT slug FROM organizations WHERE slug = ANY($1)`,
      [[slugA, slugB]],
    );
    expect(survivors, "a rolled-back transaction must leave nothing behind").toHaveLength(0);
  });

  it.skipIf(!isPg)("rolls back even while the pool is under contention", async () => {
    /*
      The test that actually discriminates the defect.

      The three proofs in this file all passed against the *broken* pool-level
      implementation, which was worth discovering: with a single caller the pool
      hands back the same idle connection every time, so `BEGIN`, the writes and
      `ROLLBACK` all happen to land together and behave correctly. A proof that
      cannot fail is not a proof.

      Contention is what exposes it. Under the broken version the connection
      used for `BEGIN` was returned to the pool immediately, so the concurrent
      traffic below could take it — and the second write would land on a
      *different* connection, outside any transaction, and autocommit. The
      rollback would then roll back an empty transaction somewhere else and the
      row would survive.

      With a pinned client the connection is held for the whole callback and no
      amount of concurrent traffic can take it.
    */
    const slugA = `tx-contended-a-${Date.now()}`;
    const slugB = `tx-contended-b-${Date.now()}`;

    let pidA = 0;
    let pidB = 0;
    let competingPids: number[] = [];

    await expect(
      withTransaction(async (tx) => {
        pidA = (await tx.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`)).rows[0]!.pid;
        await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, [
          "Contended A",
          slugA,
        ]);

        /*
          Occupy the rest of the pool while the transaction is open, and record
          which backends served that work. Without these PIDs the test could
          quietly become sequential again — a future `max: 1` pool would make
          every assertion below true for the wrong reason, and the proof would
          go green while proving nothing.
        */
        const competitors = await Promise.all(
          Array.from({ length: 12 }, async () => {
            const r = await query<{ pid: number }>(
              `SELECT pg_sleep(0.05), pg_backend_pid() AS pid`,
            );
            return r[0]!.pid;
          }),
        );
        competingPids = competitors;

        pidB = (await tx.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`)).rows[0]!.pid;
        await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, [
          "Contended B",
          slugB,
        ]);

        throw new Error("deliberate failure under contention");
      }),
    ).rejects.toThrow(/deliberate failure under contention/);

    // The transaction never moved connection, even while the pool churned.
    expect(pidB, "the transaction changed backend mid-flight").toBe(pidA);

    // And the churn was real: something else genuinely ran on another backend.
    expect(
      competingPids.some((pid) => pid !== pidA),
      `no competing query used a different backend (transaction ${pidA}, competitors ${[...new Set(competingPids)].join(", ")}) — the pool is not being contended and this test proves nothing`,
    ).toBe(true);

    const survivors = await query<{ slug: string }>(
      `SELECT slug FROM organizations WHERE slug = ANY($1) ORDER BY slug`,
      [[slugA, slugB]],
    );
    expect(
      survivors.map((r) => r.slug),
      "a write inside an open transaction escaped onto another connection and committed",
    ).toEqual([]);
  }, 30_000);

  it("commits both writes when the callback returns", async () => {
    // The positive control. A "transaction" that rolls everything back always
    // would pass the test above and be useless.
    const slug = `tx-commit-${Date.now()}`;
    await withTransaction(async (tx) => {
      await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, ["Committed", slug]);
    });

    const rows = await query<{ slug: string }>(
      `SELECT slug FROM organizations WHERE slug = $1`,
      [slug],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("2 — connection pinning", () => {
  it.skipIf(!isPg)("runs every statement in one callback on one backend PID", async () => {
    const pids = await withTransaction(async (tx) => {
      const seen: number[] = [];
      for (let i = 0; i < 4; i++) {
        const r = await tx.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
        seen.push(r.rows[0]!.pid);
      }
      return seen;
    });

    expect(pids).toHaveLength(4);
    expect(
      new Set(pids).size,
      `statements ran on ${new Set(pids).size} different connections: ${pids.join(", ")}`,
    ).toBe(1);
  });

  it.skipIf(!isPg)("gives two simultaneous transactions different connections", async () => {
    /*
      Without this, the test above is vacuous: if the pool only ever produced
      one connection, "they were all the same" would be true no matter how the
      primitive was written.

      Two transactions are held open at once through a barrier, so neither can
      finish until both have their PID. If they shared a connection they could
      not both be inside `BEGIN` simultaneously.
    */
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    let arrived = 0;
    const holdOpen = async () => {
      return withTransaction(async (tx) => {
        const r = await tx.query<{ pid: number }>(`SELECT pg_backend_pid() AS pid`);
        arrived++;
        if (arrived === 2) releaseBarrier();
        await barrier;
        return r.rows[0]!.pid;
      });
    };

    const [first, second] = await Promise.all([holdOpen(), holdOpen()]);

    expect(
      first,
      "two concurrently open transactions shared one connection — they cannot both be inside BEGIN",
    ).not.toBe(second);
  }, 20_000);
});

describe("3 — release after failure", () => {
  it("releases the client so the next transaction succeeds", async () => {
    await expect(
      withTransaction(async () => {
        throw new Error("first transaction fails");
      }),
    ).rejects.toThrow(/first transaction fails/);

    const slug = `tx-after-failure-${Date.now()}`;
    await withTransaction(async (tx) => {
      await tx.query(`INSERT INTO organizations (name, slug) VALUES ($1,$2)`, ["After failure", slug]);
    });

    const rows = await query(`SELECT slug FROM organizations WHERE slug = $1`, [slug]);
    expect(rows).toHaveLength(1);
  });

  it("does not leak a connection per failure", async () => {
    /*
      The proof that `release()` is in a `finally` rather than on the happy path.

      The pool is capped at 10. Failing more times than that would exhaust it if
      each failure kept its client, and the symptom would not be an error — it
      would be this test hanging forever while `pool.connect()` waits for a
      connection that is never coming back. The timeout is the assertion.
    */
    for (let i = 0; i < 15; i++) {
      await expect(
        withTransaction(async (tx) => {
          await tx.query(`SELECT 1`);
          throw new Error(`failure ${i}`);
        }),
      ).rejects.toThrow(new RegExp(`failure ${i}`));
    }

    const alive = await query<{ ok: number }>(`SELECT 1 AS ok`);
    expect(alive[0]!.ok).toBe(1);
  }, 30_000);

  it("keeps the application error when rollback also fails", async () => {
    /*
      Ordering of causes. If ROLLBACK fails too, the caller still needs the
      reason the transaction was being abandoned — the plumbing failure is a
      second fact, attached rather than substituted.

      Not forced here (killing a connection mid-transaction is not portable
      across both backends); what is asserted is the guarantee that matters to
      a caller: the error they receive is theirs.
    */
    const mine = new Error("application-level failure");
    await expect(
      withTransaction(async () => {
        throw mine;
      }),
    ).rejects.toBe(mine);
  });
});
