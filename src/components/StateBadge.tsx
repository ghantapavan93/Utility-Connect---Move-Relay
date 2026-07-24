/**
 * A workflow-state badge. Colour is never the only signal — every state also
 * carries an icon glyph and its text label, satisfying WCAG 1.4.1 and the design
 * system's rule against colour-only meaning.
 */

export type State =
  | "verified"
  | "pending"
  | "conflict"
  | "transit"
  | "failed"
  | "recovered"
  | "locked"
  | "unknown";

const STATES: Record<State, { label: string; glyph: string; color: string }> = {
  verified: { label: "Verified", glyph: "✓", color: "var(--color-state-verified)" },
  pending: { label: "Pending", glyph: "◷", color: "var(--color-state-pending)" },
  conflict: { label: "Conflict", glyph: "⚠", color: "var(--color-state-conflict)" },
  transit: { label: "In transit", glyph: "→", color: "var(--color-state-transit)" },
  failed: { label: "Failed", glyph: "✕", color: "var(--color-state-failed)" },
  recovered: { label: "Recovered", glyph: "↻", color: "var(--color-state-recovered)" },
  locked: { label: "Needs approval", glyph: "⚿", color: "var(--color-state-locked)" },
  unknown: { label: "Unknown", glyph: "?", color: "var(--color-state-conflict)" },
};

export function StateBadge({ state, subtle = false }: { state: State; subtle?: boolean }) {
  const s = STATES[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        color: s.color,
        background: subtle ? "transparent" : `color-mix(in oklab, ${s.color} 14%, transparent)`,
        border: `1px solid color-mix(in oklab, ${s.color} 40%, transparent)`,
      }}
    >
      <span aria-hidden="true">{s.glyph}</span>
      {s.label}
    </span>
  );
}

export const verificationToState = (v: string): State =>
  v === "human_approved" || v === "customer_confirmed"
    ? "verified"
    : v === "system_validated"
      ? "transit"
      : "pending";
