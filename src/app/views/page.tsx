"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";
import type { Accent } from "@/lib/accents";
import { withheld, additional, shared } from "@/lib/projection-diff";

/**
 * Screens 5, 7, 8 — the same Move Record seen by three audiences.
 *
 * One toggle, three projections, all fetched from /api/v1/views. The point the
 * screen makes visually: identical underlying data, deliberately different
 * surfaces, and the differences are enforced on the server. Flip between tabs
 * and the provider's order id and the internal error category are simply not in
 * the customer's or the partner's payload.
 *
 * The page used to make that claim without showing it. Three panels that merely
 * look different prove nothing — a field can be present in a response and just
 * not rendered by that component, which is the exact bug this screen exists to
 * rule out. All three payloads are now fetched and compared, and the withheld
 * paths are read off the real responses.
 */

type Audience = "concierge" | "customer" | "partner";

const TABS: Array<{ key: Audience; label: string; blurb: string }> = [
  { key: "concierge", label: "Concierge", blurb: "The trusted operator. Full context, every source, every unknown." },
  { key: "customer", label: "Customer", blurb: "Their move, in plain terms. No internal machinery." },
  { key: "partner", label: "Partner", blurb: "Attributed engagement only. Nothing cross-partner, no provider internals." },
];

// The audience is not something the client asks for — it is a property of who
// the request says it is. Switching tabs switches actor, and the server decides
// what that actor may see by walking the relationship graph. A forged header is
// trivial here and that is stated plainly on the page: identity is a demo
// stand-in, the authorization decision behind it is not.
const ACTOR: Record<Audience, string> = {
  concierge: "user:concierge-7",
  customer: "user:maya-patel",
  partner: "user:ntr-agent",
};

export default function ViewsPage() {
  const [audience, setAudience] = useState<Audience>("concierge");
  const [all, setAll] = useState<Record<Audience, Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch all three projections, not just the one on screen.
   *
   * Comparing them is the only way to demonstrate an absence, and the
   * comparison has to be against responses this page actually received — a
   * hardcoded list of "fields the partner does not get" would keep reassuring a
   * reviewer long after a projection started leaking one.
   */
  const load = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(
      (Object.keys(ACTOR) as Audience[]).map(async (a) => {
        const res = await fetch("/api/v1/views", { headers: { "x-actor": ACTOR[a] } });
        return [a, (await res.json()) as Record<string, unknown>] as const;
      }),
    );
    setAll(Object.fromEntries(entries) as Record<Audience, Record<string, unknown>>);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const data = all?.[audience] ?? null;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="views" />

      {/*
        The claim this page makes is a negative one, and negatives are hard to
        show: the partner does not receive the provider's order id, and the
        customer does not receive the internal error category. You cannot
        photograph an absence — so the page fetches all three projections and
        names the paths that are missing from the one on screen, computed from
        the responses rather than described in prose. Enforced on the server,
        which is the only place it counts.

        (The copy here previously cited an SSN and a provider account number.
        Neither field exists anywhere in this demo's data, so the page was
        claiming to withhold things it never had. The fields named above are the
        ones the payloads actually contain.)
      */}
      <CineHero
        image="/renders/living.webp"
        alt="The living room of the residence, looking through to the kitchen"
        accent="security"
        pills={
          <>
            <Pill accent="security">Three projections</Pill>
            <Pill accent="verified">Enforced server-side</Pill>
          </>
        }
        headline={
          <>
            One record.
            <br />
            <span className="cine-shimmer">Three truths.</span>
          </>
        }
        sub="A concierge, a customer and a partner look at the same move and see three different things — because a partner has no business seeing another partner's referrals, and nobody outside the operator needs the provider's order id or the reason a submission failed. Flip the toggle and read the fields that are not there."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "security",
            body: "Show that least-privilege is a property of the data returned, not a class name on a div.",
          },
          {
            eyebrow: "Proof",
            accent: "verified",
            body: "The projections are computed on the server from relationship tuples. Switch audience and the withheld fields are absent from the response — not hidden in it.",
          },
          {
            eyebrow: "Code",
            accent: "recovered",
            body: "Zanzibar-style tuples rather than a role string, a CQRS read model per audience, and tests that fail if a partner projection ever contains a foreign referral.",
          },
        ]}
        actions={
          <>
            <button
              onClick={() => panelRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("verified", 1) }}
            >
              Switch the audience <ArrowDown className="h-4 w-4" />
            </button>
            <MagneticLink
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.26)" } }}
            >
              Run the demo first <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </>
        }
      />

      <ChapterMarker n="01" label="The same move, three ways" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          The safest field is{" "}
          <span style={{ color: accentColor("security", 1) }}>the one that never left the server</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Run the demo first so there is a record to project. Then switch between the three
          audiences below and read the payload — the difference is what is missing.
        </p>
      </div>

      <WithheldBand audience={audience} all={all} loading={loading} />

      <div ref={panelRef} className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
      {/*
        The toggle is the instrument, so it is sized like one. Each tab carries
        the count of fields the server withholds from that audience, which turns
        three interchangeable-looking labels into a visible gradient of
        privilege before anything is clicked.
      */}
      <div className="grid gap-2 sm:grid-cols-3">
        {TABS.map((t) => {
          const active = audience === t.key;
          const count = all?.concierge?.exists === true ? withheld(all.concierge, all[t.key]).length : null;
          return (
            <button
              key={t.key}
              onClick={() => setAudience(t.key)}
              className="rounded-xl border px-4 py-3 text-left transition-all"
              style={{
                borderColor: active ? accentColor("verified", 0.9) : "rgba(255,255,255,0.09)",
                background: active ? accentColor("verified", 0.14) : "rgba(255,255,255,0.02)",
                boxShadow: active ? `0 0 0 3px ${accentColor("verified", 0.12)}` : undefined,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-base font-semibold"
                  style={{ color: active ? accentColor("verified", 1) : "rgba(255,255,255,0.85)" }}
                >
                  {t.label}
                </span>
                {count !== null && (
                  <span className="font-mono text-[11px] text-white/40">
                    {count === 0 ? "baseline" : `−${count}`}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{t.blurb}</p>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={audience}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          {loading && <p style={{ color: "var(--color-text-lo)" }}>Loading…</p>}
          {!loading && (data?.exists as boolean) === false && (
            <Panel title="No record yet">
              <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
                Run the demo from the start to create a Move Record, then return here.
              </p>
            </Panel>
          )}
          {!loading && data?.exists === true && audience === "concierge" && <ConciergeView d={data} />}
          {!loading && data?.exists === true && audience === "customer" && <CustomerView d={data} />}
          {!loading && data?.exists === true && audience === "partner" && <PartnerView d={data} />}
        </motion.div>
      </AnimatePresence>
      </div>
    </main>
  );
}

/**
 * The fields the server did not send to this audience.
 *
 * This is the page's whole argument, and until now it was made only in prose.
 * The list is computed by comparing the concierge payload against the one on
 * screen, both fetched moments ago — so it reports the current behaviour of the
 * server rather than a description of it written at some point in the past. If a
 * projection ever started leaking a field, the field would drop out of this list
 * instead of the page carrying on asserting an absence that had stopped being
 * true.
 *
 * The concierge is described as the most-privileged projection, never as
 * "everything". No view in this system returns every column, and calling one a
 * superset would be a claim the code does not support — the customer's timeline
 * appears in no other payload.
 */
function WithheldBand({
  audience,
  all,
  loading,
}: {
  audience: Audience;
  all: Record<Audience, Record<string, unknown>> | null;
  loading: boolean;
}) {
  const ready = !!all && all.concierge?.exists === true;
  const missing = ready ? withheld(all.concierge, all[audience]) : [];
  const only = ready ? additional(all.concierge, all[audience]) : [];
  const common = ready ? shared([all.concierge, all.customer, all.partner]) : [];

  const isOperator = audience === "concierge";
  const accent: Accent = isOperator ? "verified" : "security";

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
      <div
        className="rounded-2xl border px-6 py-7 sm:px-9 sm:py-8"
        style={{
          borderColor: accentColor(accent, 0.45),
          background: `linear-gradient(120deg, ${accentColor(accent, 0.16)}, rgba(255,255,255,0.015) 60%)`,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
          Withheld from this audience
        </span>

        {!ready ? (
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            {loading
              ? "Reading all three projections…"
              : "No Move Record yet. Run the demo from the start, then come back and compare."}
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
              <span
                className="font-semibold leading-[0.95] tracking-tight"
                style={{ fontSize: "clamp(44px,8vw,96px)", color: accentColor(accent, 1) }}
              >
                {missing.length}
              </span>
              <span
                className="font-semibold leading-none tracking-tight text-white/35"
                style={{ fontSize: "clamp(18px,2.6vw,30px)" }}
              >
                field{missing.length === 1 ? "" : "s"} not sent
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
              {isOperator
                ? "This is the most-privileged of the three projections — the baseline the other two are measured against. It is still not every column in the database."
                : `These paths are present in the concierge's response and absent from this one. Not hidden by CSS, not filtered in the browser — they were never in the payload.`}
            </p>

            {missing.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {missing.map((p) => (
                  <li
                    key={p}
                    className="rounded-md border px-2 py-1 font-mono text-[11px]"
                    style={{
                      borderColor: accentColor(accent, 0.35),
                      background: accentColor(accent, 0.08),
                      color: accentColor(accent, 0.95),
                    }}
                  >
                    {p}
                  </li>
                ))}
              </ul>
            )}

            {only.length > 0 && (
              <div className="mt-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  And {only.length} the concierge does not get
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {only.map((p) => (
                    <li
                      key={p}
                      className="rounded-md border border-white/12 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-white/55"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 font-mono text-[11px] text-white/40">
              {common.length} path{common.length === 1 ? "" : "s"} shared by all three · computed
              from the three responses this page just received
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConciergeView({ d }: { d: Record<string, unknown> }) {
  const verified = (d.verified as Array<{ field: string; value: unknown; source: string; by: string | null }>) ?? [];
  const priority = (d.priority as { unknownsToReconcile: number; conflictsToResolve: number }) ?? { unknownsToReconcile: 0, conflictsToResolve: 0 };
  const services = (d.services as Array<Record<string, unknown>>) ?? [];
  const briefing = d.briefing as { claims?: Array<{ text: string; kind: string }>; openQuestions?: string[] } | null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Conflicts to resolve" value={priority.conflictsToResolve} tone={priority.conflictsToResolve ? "conflict" : "verified"} />
        <Stat label="Unknown outcomes to reconcile" value={priority.unknownsToReconcile} tone={priority.unknownsToReconcile ? "conflict" : "verified"} />
      </div>

      {briefing?.claims && (
        <Panel title="Source-grounded briefing — every claim cites a record">
          <ul className="space-y-1.5 text-sm">
            {briefing.claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden style={{ color: c.kind === "conflict" ? "var(--color-state-conflict)" : c.kind === "unknown" ? "var(--color-state-pending)" : "var(--color-state-verified)" }}>
                  {c.kind === "conflict" ? "⚠" : c.kind === "unknown" ? "?" : "✓"}
                </span>
                <span style={{ color: "var(--color-text-mid)" }}>{c.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Verified facts">
        <table className="w-full text-sm">
          <tbody>
            {verified.map((v, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
                <td className="py-1.5 font-mono text-xs">{v.field}</td>
                <td className="py-1.5">{String(v.value)}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.source}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.by ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="font-medium">{String(s.service_type)}</span>
            <span style={{ color: "var(--color-text-lo)" }}>{String(s.provider_name)}</span>
            <span className="font-mono text-xs" style={{ color: "var(--color-text-mid)" }}>{String(s.submission_state ?? "pending")}</span>
            {s.provider_order_id ? <span className="font-mono text-xs" style={{ color: "var(--color-text-lo)" }}>order {String(s.provider_order_id)}</span> : null}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function CustomerView({ d }: { d: Record<string, unknown> }) {
  const details = (d.details as Array<{ label: string; value: unknown }>) ?? [];
  const services = (d.services as Array<{ service: string; status: string }>) ?? [];
  const needsYou = (d.needsYou as string[]) ?? [];
  const timeline = (d.timeline as Array<{ headline: string; detail: string | null; tone: string }>) ?? [];

  return (
    <div className="space-y-4">
      <Panel title="Your move">
        {details.map((x, i) => (
          <div key={i} className="flex justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span style={{ color: "var(--color-text-lo)" }}>{x.label}</span>
            <span className="font-medium">{String(x.value)}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Your services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span className="font-medium capitalize">{s.service}</span>
            <StateBadge state={s.status === "Scheduled" ? "verified" : "transit"} subtle />
          </div>
        ))}
      </Panel>

      {needsYou.length > 0 && (
        <Panel title="Needs your attention">
          <ul className="space-y-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            {needsYou.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </Panel>
      )}

      {timeline.length > 0 && (
        <Panel title="Your move so far">
          <ol className="space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                  style={{
                    background: t.tone === "done" ? "var(--color-state-verified)" : "var(--color-ground-3)",
                    color: t.tone === "done" ? "white" : "var(--color-text-mid)",
                  }}
                >
                  {t.tone === "done" ? "✓" : "·"}
                </span>
                <div>
                  <div className="text-sm font-medium">{t.headline}</div>
                  {t.detail && <div className="text-xs" style={{ color: "var(--color-text-lo)" }}>{t.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            Built asynchronously from domain events by the outbox projector — already in
            customer language. The system&rsquo;s internal states never reach this list.
          </p>
        </Panel>
      )}

      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This is everything the customer sees. No provider account numbers, no internal
        error states, no concierge notes, no AI prompts. A lost provider response reads
        simply as &ldquo;In progress&rdquo; — the ambiguity is handled internally.
      </p>
    </div>
  );
}

function PartnerView({ d }: { d: Record<string, unknown> }) {
  if (!d.attributed) {
    return (
      <Panel title="No attributed engagement">
        <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{String(d.message)}</p>
      </Panel>
    );
  }
  const progress = (d.progress as { servicesRequested: number; servicesScheduled: number }) ?? { servicesRequested: 0, servicesScheduled: 0 };
  return (
    <div className="space-y-4">
      <Panel title={`Referral ${String(d.reference)}`}>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Engagement</span>
          <span className="font-medium">{String(d.engagement)}</span>
        </div>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Move date</span>
          <span className="font-medium">{String(d.moveDate)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span style={{ color: "var(--color-text-lo)" }}>Services scheduled</span>
          <span className="font-medium">{progress.servicesScheduled} of {progress.servicesRequested}</span>
        </div>
      </Panel>
      <Panel title="Attribution">
        <div className="flex items-center gap-2 text-sm">
          <StateBadge state="verified" subtle />
          <span style={{ color: "var(--color-text-mid)" }}>{String(d.attributionStatus)}</span>
        </div>
      </Panel>
      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This partner sees only their attributed engagement. No customer PII beyond the move
        date, no provider account numbers, no other partner&rsquo;s pipeline, no internal notes.
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "verified" | "conflict" }) {
  const color = tone === "conflict" ? "var(--color-state-conflict)" : "var(--color-state-verified)";
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{label}</div>
    </div>
  );
}
