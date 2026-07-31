"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The crash surface.
 *
 * A rendering error used to fall through to Next's default overlay in
 * development and an unstyled stack-adjacent screen in production — the one
 * moment a visitor's trust is most fragile, handled by the only screen in the
 * app with no authorship at all.
 *
 * The copy holds the same epistemics as every other failure surface here.
 * A crashed page proves exactly one thing: this render failed. It says
 * nothing about the database, the move, or the audit trail — the domain
 * state machine and its rows are on the server and untouched by a client
 * exception. Claiming more ("your data is safe!") would be reassurance
 * without evidence; claiming less would imply damage that did not happen.
 * The digest is shown in mono because it is the one fact worth carrying
 * into a bug report.
 *
 * Error boundaries must be client components, so unlike the 404 this page
 * cannot query the tenant — and does not pretend to.
 */

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The one place console.error is correct: the boundary caught it, so
    // nothing else will log it.
    console.error(error);
  }, [error]);

  return (
    <main className="relative min-h-dvh bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />

      <div className="relative mx-auto max-w-2xl px-6 py-24" style={{ zIndex: 1 }}>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.24em]"
          style={{ color: "var(--color-state-failed)" }}
        >
          This page crashed
        </p>
        <h1 className="mt-3 text-[clamp(28px,4.5vw,44px)] font-semibold leading-[1.06] tracking-tight">
          The render failed.
          <br />
          <span style={{ color: "var(--color-state-verified)" }}>The records did not.</span>
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          A client-side exception stopped this page from drawing. That is a fact about this
          render, not about the data: the Move Records, the audit trail and the state machine
          live on the server, which this crash never touched. Nothing was written, lost, or
          half-applied.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            digest: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide text-white"
            style={{ background: "var(--color-state-verified)" }}
          >
            Try the render again
          </button>
          <Link
            href="/dashboard"
            className="cine-glass inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide"
            style={{ color: "var(--color-text-mid)" }}
          >
            Back to the control room
          </Link>
        </div>

        <p className="mt-6 max-w-lg text-[11px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          If it crashes again, the digest above is the fact worth reporting — it identifies
          this exact failure in the server logs.
        </p>
      </div>
    </main>
  );
}
