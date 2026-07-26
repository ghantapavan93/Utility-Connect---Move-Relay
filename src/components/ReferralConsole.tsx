"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EASE } from "@/lib/motion";
import { accentColor, type Accent } from "@/lib/accents";

/**
 * Send your own referral.
 *
 * `POST /api/v1/referrals` has accepted arbitrary payloads from the beginning —
 * contract validation with quarantine, persisted idempotency, cross-channel
 * duplicate detection, provenance on every field — and nothing in the interface
 * said so. The demo page walks one hardcoded move, so the engine behind it read
 * as a scripted tour of a single record rather than the general thing it is.
 *
 * This is the same endpoint, with the request body exposed and editable. A
 * reviewer changes a name, presses send, and gets back the real response: a new
 * move with its own reference, or a replay, or a quarantine naming the field
 * that failed. Nothing here is simulated and nothing is pre-computed.
 *
 * The four presets exist because the interesting behaviours are the ones a
 * visitor would not think to try. Sending the same idempotency key twice, or
 * the same person through a second channel with a different date, is where the
 * system stops looking like a form and starts looking like an argument.
 */

type Channel = "partner_api" | "csv_upload" | "customer_form";

interface ReferralResponse {
  status?: string;
  httpStatus?: number;
  correlationId?: string;
  moveId?: string;
  reference?: string;
  quarantineId?: string;
  issues?: Array<{ path: string; message: string }>;
  duplicate?: { ofReference: string; score: number; verdict: string } | null;
  conflictFields?: string[];
  message?: string;
  error?: string;
}

/**
 * Synthetic throughout, and named so in the payload itself.
 *
 * `example.com` is reserved for documentation and the 555 exchange is reserved
 * for fiction, so nothing here can collide with a real person even by accident.
 * That matters more than usual on a public demo: this endpoint writes to a real
 * database, and an invented customer is the only kind that belongs in it.
 */
function makeBase(tag: string) {
  return {
    customer: {
      first_name: "Dana",
      last_name: `Okafor-${tag}`,
      email: `dana.okafor+${tag}@example.com`,
      phone: `469-555-${tag}`,
    },
    move: { date: "2026-09-02", to_address: "88 Larkspur Ln, Frisco, TX 75034" },
    services: ["electric", "internet"],
    referral: { partner_slug: "bluebonnet-realty" },
  };
}

const pretty = (v: unknown) => JSON.stringify(v, null, 2);

type Preset = {
  id: string;
  label: string;
  teaches: string;
  channel: Channel;
  key: string;
  body: string;
};

/**
 * A fresh synthetic identity per session.
 *
 * Duplicate detection scores on email, name and phone, which is exactly what it
 * should do — and it means a fixed customer would be a duplicate of whoever ran
 * this panel before. A reviewer pressing "A new referral" would read
 * `attached · certain_duplicate` under a button labelled "creates", and
 * reasonably conclude the thing was broken.
 *
 * So the identity carries a per-session tag. The four presets share it, which
 * keeps the duplicate and conflict cases honest against each other, and a page
 * reload starts a clean person. The tag is also the phone's last four digits,
 * staying inside the 555 fiction range.
 */
function buildPresets(tag: string): Preset[] {
  const base = makeBase(tag);
  return [
    {
      id: "create",
      label: "A new referral",
      teaches: "Creates a move with full field provenance.",
      channel: "partner_api",
      key: `your-referral-${tag}-1`,
      body: pretty(base),
    },
    {
      id: "replay",
      label: "Send it again, same key",
      teaches: "Persisted idempotency — replays, never creates a second.",
      channel: "partner_api",
      key: `your-referral-${tag}-1`,
      body: pretty(base),
    },
    {
      id: "conflict",
      label: "Same person, different date",
      teaches: "Detects the duplicate and surfaces the disagreement for a human.",
      channel: "customer_form",
      key: `your-referral-${tag}-2`,
      body: pretty({
        customer: base.customer,
        move: { date: "2026-09-05", to_address: base.move.to_address },
        services: ["electric", "internet", "security"],
      }),
    },
    {
      id: "broken",
      label: "Break the contract",
      teaches: "Quarantines with a machine-readable reason. Never force-fed.",
      channel: "partner_api",
      key: `your-referral-${tag}-3`,
      body: pretty({
        customer: { ...base.customer, email: "not-an-email" },
        move: { move_date: "2026-09-02", to_address: base.move.to_address },
      }),
    },
  ];
}

export function ReferralConsole({ actor = "user:concierge-7" }: { actor?: string }) {
  // Built once per mount and never regenerated, so editing the body does not
  // silently change who the customer is halfway through a demonstration.
  // Generated on the client only — a value computed during render on the server
  // would differ from the client's and trip hydration.
  const [presets] = useState(() =>
    buildPresets(String(Math.floor(Math.random() * 9000) + 1000)),
  );

  const [channel, setChannel] = useState<Channel>(presets[0]!.channel);
  const [key, setKey] = useState(presets[0]!.key);
  const [body, setBody] = useState(presets[0]!.body);
  const [active, setActive] = useState(presets[0]!.id);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReferralResponse | null>(null);

  const apply = (p: Preset) => {
    setActive(p.id);
    setChannel(p.channel);
    setKey(p.key);
    setBody(p.body);
  };

  const send = useCallback(async () => {
    // Parse before sending, so a typo in the editor reads as a typo rather
    // than as the server rejecting the request.
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (err) {
      toast.error(`That is not valid JSON — ${err instanceof Error ? err.message : "parse failed"}`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/referrals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-actor": actor,
          ...(key.trim() ? { "idempotency-key": key.trim() } : {}),
        },
        body: JSON.stringify({ channel, payload }),
      });
      const json = (await res.json()) as ReferralResponse;
      setResult(json);

      // Narrate the outcome the way the system understands it, not the way a
      // form would. A quarantine is a correct result here, not an error.
      if (json.status === "created") toast.success(`Move ${json.reference} created.`);
      else if (json.status === "replayed") toast.info(`Replayed — ${json.reference} already existed.`);
      else if (json.status === "attached")
        toast.warning(`Duplicate of ${json.duplicate?.ofReference}. A human decides.`);
      else if (json.status === "quarantined")
        toast.warning(`Quarantined — ${json.issues?.length ?? 0} contract issue(s).`);
      else if (json.error) toast.error(json.error);
    } catch {
      toast.error("network error");
    } finally {
      setBusy(false);
    }
  }, [body, channel, key, actor]);

  const accent: Accent =
    result?.status === "created"
      ? "verified"
      : result?.status === "replayed"
        ? "recovered"
        : result?.status === "attached" || result?.status === "quarantined"
          ? "conflict"
          : "verified";

  return (
    <div
      className="rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-white">Send your own referral</h3>
        <span
          className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
          style={{ borderColor: accentColor("verified", 0.5), color: accentColor("verified", 1) }}
        >
          Built and functioning
        </span>
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
        This is <code className="font-mono text-[12px] text-white/80">POST /api/v1/referrals</code>,
        the same endpoint every channel uses. Edit the body, press send, and read what comes back —
        a new move with its own reference, a replay, a duplicate that needs a person, or a
        quarantine naming the field that failed. Use synthetic data; it writes to a real database.
      </p>

      {/* The presets are the teaching surface. The editor underneath is the proof
          that they are not four buttons wired to four canned responses. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {presets.map((p) => {
          const on = active === p.id;
          return (
            <button
              key={p.id}
              onClick={() => apply(p)}
              className="rounded-lg border px-3 py-2 text-left transition-all"
              style={{
                borderColor: on ? accentColor("verified", 0.8) : "rgba(255,255,255,0.09)",
                background: on ? accentColor("verified", 0.12) : "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: on ? accentColor("verified", 1) : "rgba(255,255,255,0.88)" }}
              >
                {p.label}
              </div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/50">{p.teaches}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-white/50">
          Channel
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-[12px] text-white/90"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            <option value="partner_api">partner_api</option>
            <option value="csv_upload">csv_upload</option>
            <option value="customer_form">customer_form</option>
          </select>
        </label>
        <label className="text-xs text-white/50">
          Idempotency-Key
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            spellCheck={false}
            className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-[12px] text-white/90"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs text-white/50">
        Request body
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
          rows={12}
          className="mt-1 w-full resize-y rounded-lg border bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-white/85"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={send}
          disabled={busy}
          className="rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-50"
          style={{ background: accentColor("verified", 1) }}
        >
          {busy ? "sending…" : "Send referral"}
        </button>
        <a href="/moves" className="text-xs font-semibold" style={{ color: accentColor("verified", 1) }}>
          See every move the system holds →
        </a>
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.correlationId ?? "r"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE.outQuart }}
            className="mt-4 rounded-lg border p-3"
            style={{ borderColor: accentColor(accent, 0.7), background: accentColor(accent, 0.08) }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className="font-mono text-sm font-bold uppercase tracking-wide"
                style={{ color: accentColor(accent, 1) }}
              >
                {result.status ?? "error"}
              </span>
              {result.reference && (
                <span className="font-mono text-xs text-white/70">{result.reference}</span>
              )}
              {result.httpStatus && (
                <span className="font-mono text-[11px] text-white/40">HTTP {result.httpStatus}</span>
              )}
            </div>

            {/*
              A replay returns the *stored* response, verbatim — which is the
              whole point of persisted idempotency and also genuinely confusing
              to read cold: the badge says REPLAYED and the message underneath
              describes whatever happened the first time, which may have been a
              conflict. Without this line it looks like the panel contradicting
              itself rather than the system doing exactly what it promised.
            */}
            {result.status === "replayed" && (
              <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                This exact request was already processed. Nothing new was written — the original
                response is returned below, unchanged.
              </p>
            )}

            {result.message && (
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{
                  color: result.status === "replayed" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.75)",
                }}
              >
                {result.status === "replayed" ? `Originally: ${result.message}` : result.message}
              </p>
            )}

            {result.issues && result.issues.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {result.issues.map((i, n) => (
                  <li key={n} className="font-mono text-[11px]" style={{ color: accentColor("conflict", 1) }}>
                    {i.path}: {i.message}
                  </li>
                ))}
              </ul>
            )}

            {result.conflictFields && result.conflictFields.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Now needs a human decision
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {result.conflictFields.map((f) => (
                    <span
                      key={f}
                      className="rounded-md border px-2 py-0.5 font-mono text-[11px]"
                      style={{
                        borderColor: accentColor("conflict", 0.4),
                        color: accentColor("conflict", 1),
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.correlationId && (
              <div className="mt-2 font-mono text-[10px] text-white/35">
                correlation {result.correlationId}
                {result.quarantineId ? ` · quarantine ${result.quarantineId}` : ""}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
