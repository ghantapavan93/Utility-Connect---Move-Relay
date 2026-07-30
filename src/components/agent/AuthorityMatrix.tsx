"use client";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { stageLabel } from "@/lib/agent/narrative";

/**
 * The copilot's operating licence, as a matrix instead of a wall.
 *
 * Every row here comes from `GET /api/v1/agent/runs` — the same registry the
 * planner is checked against at runtime. The page holds no second copy of the
 * policy, which is the property that matters: a tool moved between tiers on the
 * server changes this table on the next load, and a table that could disagree
 * with the enforcement would be documentation wearing a uniform.
 *
 * ## Contextual, not decorative
 *
 * `attempted` carries the tools the *current run* actually touched. Those rows
 * light up with the outcome the run recorded, so the matrix answers "what just
 * happened" rather than only "what is allowed in general". A visitor who runs
 * the unknown-outcome case watches `submit_provider_enrollment` glow in the
 * prohibited tier with the registry's own refusal under it.
 */

export interface RegistryTool {
  name: string;
  authority: "read_only" | "requires_approval" | "forbidden";
  description: string;
  refusal: string | null;
}

const TIERS: Array<{
  authority: RegistryTool["authority"];
  title: string;
  status: string;
  accent: Accent;
  explain: string;
}> = [
  {
    authority: "read_only",
    title: "Reads and analyzes",
    status: "Available now",
    accent: "internet",
    explain:
      "Runs immediately, through the same projections the concierge screen renders. Nothing here is observable outside this process.",
  },
  {
    authority: "requires_approval",
    title: "Prepares and recommends",
    status: "Proposal only",
    accent: "security",
    explain:
      "The copilot may propose these. Execution happens after a named person approves, through the same service function the console's own button calls.",
  },
  {
    authority: "forbidden",
    title: "Permanently prohibited",
    status: "Blocked by policy",
    accent: "failed",
    explain:
      "Defined in the registry deliberately, so reaching for one produces a recorded refusal rather than a silent no-op. These are the decisions reserved for deterministic code or a human.",
  },
];

export function AuthorityMatrix({
  tools,
  attempted,
}: {
  tools: RegistryTool[];
  /** tool name → outcome from the current run, e.g. { submit_provider_enrollment: "refused" } */
  attempted: Record<string, string>;
}) {
  return (
    <div className="min-w-0 space-y-3">
      {TIERS.map((tier) => {
        const rows = tools.filter((t) => t.authority === tier.authority);
        if (rows.length === 0) return null;

        return (
          <section
            key={tier.authority}
            aria-label={tier.title}
            className="min-w-0 rounded-2xl border p-4"
            style={{ borderColor: accentColor(tier.accent, 0.3), background: accentColor(tier.accent, 0.04) }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk(tier.accent) }}>
                {tier.title}
              </h4>
              <span
                className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ borderColor: accentColor(tier.accent, 0.45), color: accentInk(tier.accent) }}
              >
                {tier.status}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {tier.explain}
            </p>

            <ul className="mt-3 list-none space-y-1.5">
              {rows.map((tool) => {
                const outcome = attempted[tool.name];
                return (
                  <li
                    key={tool.name}
                    className="min-w-0 rounded-lg border p-2.5"
                    style={{
                      /*
                        The run's own rows carry the tier colour at full
                        presence; the rest stay quiet. "This is what just
                        happened" must be visually louder than "this exists".
                      */
                      borderColor: outcome ? accentColor(tier.accent, 0.55) : "rgba(255,255,255,0.1)",
                      background: outcome ? accentColor(tier.accent, 0.09) : "transparent",
                    }}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-semibold text-white/90">{stageLabel(tool.name)}</span>
                      <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                        {tool.name}
                      </span>
                      {outcome && (
                        <span
                          className="rounded-full border px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em]"
                          style={{ borderColor: accentColor(tier.accent, 0.5), color: accentInk(tier.accent) }}
                        >
                          this run · {outcome}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                      {tool.description}
                    </p>
                    {tool.refusal && (
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: accentInk(tier.accent) }}>
                        {tool.refusal}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
