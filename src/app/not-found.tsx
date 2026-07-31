import Link from "next/link";

import { query } from "@/lib/db";
import { listMoves, type MoveSummary } from "@/lib/moves";
import { asRoute } from "@/lib/routes";

/**
 * The page that is not there — treated as a page.
 *
 * Until this file existed, a typo'd URL rendered Next's stock "404 | This page
 * could not be found" in the framework's own styling: the calmest screen a
 * visitor could produce, on the one site whose stated thesis is that failure
 * must never render as calm. It was also the single most reproducible failure
 * in the whole app — every reviewer can mistype a path, and after a demo reset
 * every previously-shared /moves/:id link produces exactly this.
 *
 * So the 404 does what every other surface here does: it reads the live
 * backend before speaking. A dead link's most likely cause on this site is a
 * tenant reset that re-minted the move ids — which means the record the
 * visitor wanted usually still exists under a fresh id. This page fetches the
 * current moves and offers them by reference, so the dead end carries its own
 * way out.
 *
 * And because it queries, it can fail — in which case it says so. A 404 that
 * pretended the database was fine while its own read failed would be this
 * repository's central sin committed on its own error page.
 */

export const dynamic = "force-dynamic";

async function currentMoves(): Promise<{ moves: MoveSummary[]; readFailed: boolean }> {
  try {
    const org = (
      await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`)
    )[0];
    if (!org) return { moves: [], readFailed: false };
    return { moves: (await listMoves(org.id)).slice(0, 3), readFailed: false };
  } catch {
    return { moves: [], readFailed: true };
  }
}

const ROOMS: Array<{ href: string; label: string; sub: string }> = [
  { href: "/dashboard", label: "Control room", sub: "the live operator console" },
  { href: "/agent", label: "Copilot", sub: "investigate a case" },
  { href: "/demo", label: "Demo", sub: "run the whole story" },
  { href: "/future/thesis", label: "Product thesis", sub: "where this goes next" },
];

export default async function NotFound() {
  const { moves, readFailed } = await currentMoves();

  return (
    <main className="relative min-h-dvh bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />

      <div className="relative mx-auto max-w-2xl px-6 py-24" style={{ zIndex: 1 }}>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.24em]"
          style={{ color: "var(--color-state-failed)" }}
        >
          404 · Nothing lives at this address
        </p>
        <h1 className="mt-3 text-[clamp(28px,4.5vw,44px)] font-semibold leading-[1.06] tracking-tight">
          This page does not exist.
          <br />
          <span style={{ color: "var(--color-state-verified)" }}>
            The record you wanted probably does.
          </span>
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The most common way to reach this screen is a link minted before a demo reset — the
          tenant rebuilds with fresh ids, and the old address dies while the move itself lives
          on. So instead of guessing, this page asked the database.
        </p>

        {/* ── What the tenant holds right now, read live ── */}
        <section aria-labelledby="nf-moves" className="mt-10">
          <h2
            id="nf-moves"
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--color-text-lo)" }}
          >
            {readFailed
              ? "The tenant could not be read"
              : moves.length > 0
                ? "In the tenant right now"
                : "The tenant is empty right now"}
          </h2>

          {readFailed ? (
            <p
              className="mt-3 rounded-xl border p-4 text-sm leading-relaxed"
              style={{ borderColor: "var(--color-state-failed)", color: "var(--color-text-mid)" }}
            >
              This page queries the live database before claiming anything, and that read just
              failed — so no list is shown, rather than a reassuring empty one. The rooms below
              still link normally.
            </p>
          ) : moves.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {moves.map((m) => (
                <li key={m.id}>
                  <Link
                    href={asRoute(`/moves/${m.id}`)}
                    className="cine-glass flex min-h-11 items-baseline gap-3 rounded-xl px-4 py-3"
                  >
                    <span className="font-mono text-sm font-bold">{m.reference}</span>
                    <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                      {m.state.replace(/_/g, " ")}
                      {m.openConflicts > 0
                        ? ` · ${m.openConflicts} conflict${m.openConflicts === 1 ? "" : "s"} open`
                        : ""}
                    </span>
                    <span className="ml-auto text-xs" style={{ color: "var(--color-text-mid)" }}>
                      open →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              No moves exist yet —{" "}
              <Link href="/demo" className="underline underline-offset-4" style={{ color: "var(--color-state-verified)" }}>
                run the demo
              </Link>{" "}
              and the tenant seeds itself.
            </p>
          )}
        </section>

        {/* ── The rooms ── */}
        <nav aria-label="Main destinations" className="mt-10">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
            Or start from a room that exists
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ROOMS.map((room) => (
              <li key={room.href}>
                <Link
                  href={asRoute(room.href)}
                  className="cine-glass flex min-h-11 flex-col justify-center rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-semibold">{room.label}</span>
                  <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                    {room.sub}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
