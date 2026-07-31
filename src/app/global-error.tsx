"use client";

/**
 * The last resort.
 *
 * `error.tsx` catches a crash inside a route segment — but a crash in the root
 * layout itself replaces the entire document, which is why this file must
 * render its own `<html>` and `<body>` and can rely on no stylesheet, no
 * tokens, and no components: everything that usually exists may be the thing
 * that just failed. Inline styles only, and the same epistemics as every
 * other failure surface: this proves the shell failed to render, and says
 * nothing about the records on the server.
 *
 * If a visitor ever sees this page, the digest is the fact to report.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#04070b",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "560px" }}>
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#e5484d",
              margin: 0,
            }}
          >
            The application shell crashed
          </p>
          <h1 style={{ fontSize: "32px", lineHeight: 1.1, margin: "12px 0 0", fontWeight: 600 }}>
            The page could not draw itself.
            <br />
            <span style={{ color: "#2498bf" }}>The records are on the server, untouched.</span>
          </h1>
          <p style={{ fontSize: "14px", lineHeight: 1.6, color: "rgba(255,255,255,0.65)", marginTop: "16px" }}>
            This is the deepest failure surface the app has — the layout itself failed, so
            nothing styled survives here by design. It is still only a rendering fact: no
            Move Record, audit row or state machine was involved in this crash.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "16px" }}>
              digest: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                minHeight: "44px",
                padding: "0 24px",
                borderRadius: "999px",
                border: "none",
                background: "#0087b5",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                minHeight: "44px",
                padding: "0 24px",
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "rgba(255,255,255,0.75)",
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
              }}
            >
              Control room
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
