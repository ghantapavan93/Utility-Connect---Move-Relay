import { ImageResponse } from "next/og";

/**
 * The link preview card.
 *
 * This repository gets shared as a URL — in a message to a hiring manager, in
 * Slack, on LinkedIn — and until now every one of those unfurled as a bare
 * domain with no image. The card is the first thing seen, before the page
 * loads and often instead of it.
 *
 * It leads with the failure rather than the feature list, for the same reason
 * the demo does: every platform in this category claims to simplify a move, and
 * none of them put "the provider went quiet and the system refused to guess" on
 * a card. That sentence is the one a senior engineer stops scrolling for.
 *
 * Generated rather than designed in a file, so it cannot drift from the palette
 * it is drawn from, and rendered at the edge so no image asset ships.
 */

export const runtime = "edge";
export const alt =
  "Move Relay — a provider order times out, the outcome is UNKNOWN, and the blind retry is refused.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#12171c";
const CYAN = "#0087b5";
const AMBER = "#e8a33d";
const GREEN = "#3da76a";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: NAVY,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 34, height: 4, background: CYAN, borderRadius: 2 }} />
          <div
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 21,
              letterSpacing: 4,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Move Relay
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#fff",
              fontSize: 68,
              lineHeight: 1.06,
              fontWeight: 800,
              letterSpacing: -1.5,
              maxWidth: 940,
              display: "flex",
            }}
          >
            The provider created the order. The reply never came.
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.66)",
              fontSize: 30,
              marginTop: 22,
              maxWidth: 900,
              lineHeight: 1.35,
              display: "flex",
            }}
          >
            The state is UNKNOWN, the blind retry is refused, and reconciliation recovers the
            order that already existed. One order — never two.
          </div>
        </div>

        {/* The three states, in the palette they mean something in. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {[
            ["SUBMITTED", CYAN],
            ["UNKNOWN", AMBER],
            ["RECONCILED", GREEN],
          ].map(([label, colour]) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                border: `1px solid ${colour}`,
                borderRadius: 999,
                padding: "9px 20px",
                color: colour,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1.6,
              }}
            >
              <div style={{ width: 9, height: 9, borderRadius: 999, background: colour }} />
              {label}
            </div>
          ))}
          <div
            style={{
              marginLeft: "auto",
              color: "rgba(255,255,255,0.4)",
              fontSize: 20,
              display: "flex",
            }}
          >
            590 tests · real Postgres · no mocks
          </div>
        </div>
      </div>
    ),
    size,
  );
}
