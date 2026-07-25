"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MarketingHeader } from "@/components/MarketingHeader";

/**
 * The enrollment experience — a premium reimagining of Utility Connect's own
 * /connect intake, preserving their TCPA consent wording — and, unlike a
 * mockup, it SUBMITS. The final step posts to /api/v1/referrals, where the
 * payload walks the real gauntlet: contract validation (quarantine on
 * failure), idempotency, exact-duplicate collapse, cross-move deduplication,
 * provenance persistence, and a customer-timeline event. The result panel
 * shows exactly what the engine decided. All data is synthetic.
 */

const SERVICES = [
  "Electric", "Internet", "Security", "Gas", "Water", "Cable",
  "Satellite", "Insurance", "Home Warranty", "Solar", "Pest Control", "Mail Forwarding",
];

interface IntakeResponse {
  status: string;
  moveId?: string;
  reference?: string;
  duplicate?: { ofReference: string; score: number; verdict: string } | null;
  conflictFields?: string[];
  issues?: Array<{ path: string; message: string }>;
  message: string;
}

export default function ConnectFlow() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(["Electric", "Internet"]));
  const [address, setAddress] = useState("1420 Windhaven Pkwy, Plano, TX 75093");
  const [date, setDate] = useState("2026-08-16");
  const [name, setName] = useState("Maya Patel");
  const [email, setEmail] = useState("maya.patel@example.com");
  const [phone, setPhone] = useState("469-555-0142");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<IntakeResponse | null>(null);

  const toggle = (s: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    const [first, ...rest] = name.trim().split(/\s+/);
    const payload = {
      customer: {
        first_name: first || "Customer",
        last_name: rest.join(" ") || "Household",
        email,
        phone,
      },
      move: { date, to_address: address },
      services: [...selected].map((s) => s.toLowerCase()),
      consent: {
        granted: true,
        channels: ["phone", "sms", "email"],
        purposes: ["customer_care", "connection_status", "account_information", "appointment_details"],
        text_version: "uc-2026-07",
      },
    };
    try {
      const res = await fetch("/api/v1/referrals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: "customer_form", payload }),
      });
      setResult(await res.json());
      setStep(3);
    } catch {
      setResult({ status: "error", message: "Network error — is the dev server running?" });
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="theme-light" style={{ background: "var(--color-ground-0)", minHeight: "100dvh" }}>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        {/* progress */}
        <div className="mb-8 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i <= step ? "var(--color-state-verified)" : "var(--color-ground-3)" }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <Step key="addr" title="Where are you moving?">
              <label className="mb-4 block">
                <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>New address</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }} />
              </label>
              <label className="mb-6 block">
                <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-hi)" }}>Move date</span>
                <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }} />
              </label>
              <Next onClick={() => setStep(1)}>Choose services</Next>
            </Step>
          )}

          {step === 1 && (
            <Step key="svc" title="Which services do you need?">
              <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SERVICES.map((s) => {
                  const on = selected.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className="rounded-lg border px-3 py-3 text-sm font-medium transition-colors"
                      style={{
                        borderColor: on ? "var(--color-state-verified)" : "var(--color-ground-3)",
                        background: on ? "color-mix(in oklab, var(--color-state-verified) 12%, transparent)" : "transparent",
                        color: on ? "var(--color-state-verified)" : "var(--color-text-mid)",
                      }}
                    >
                      {on ? "✓ " : ""}{s}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <Back onClick={() => setStep(0)} />
                <Next onClick={() => setStep(2)}>Add contact</Next>
              </div>
            </Step>
          )}

          {step === 2 && (
            <Step key="contact" title="How should your concierge reach you?">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }} />
                <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }} />
                <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }} />
              </div>

              {/* Their exact consent wording, preserved. */}
              <p className="mb-6 rounded-lg border p-4 text-xs leading-relaxed" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
                By continuing you consent to be contacted by Utility Connect via phone, text
                (SMS), and email at the details provided, using automated dialing technology,
                regarding customer care, connection status, account information, and appointment
                details. Message and data rates may apply. Reply STOP to unsubscribe.
              </p>

              <div className="flex gap-3">
                <Back onClick={() => setStep(1)} />
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 rounded-full px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ background: "var(--color-state-verified)" }}
                >
                  {submitting ? "Submitting…" : "Submit my move — for real"}
                </button>
              </div>
            </Step>
          )}

          {step === 3 && result && (
            <Step key="result" title={result.status === "quarantined" ? "The contract caught it" : "The engine answered"}>
              <div
                className="rounded-2xl border p-6"
                style={{
                  borderColor:
                    result.status === "created" ? "var(--color-state-verified)"
                    : result.status === "attached" ? "var(--color-state-conflict)"
                    : "var(--color-ground-3)",
                  background: "var(--color-ground-1)",
                }}
              >
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                  {result.status}
                  {result.reference && <> · {result.reference}</>}
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-hi)" }}>
                  {result.message}
                </p>

                {result.duplicate && (
                  <p className="mt-3 rounded-lg border p-3 text-xs" style={{ borderColor: "var(--color-state-conflict)", color: "var(--color-text-mid)" }}>
                    Matched {result.duplicate.ofReference} — score {result.duplicate.score}, {result.duplicate.verdict}.
                    {result.conflictFields && result.conflictFields.length > 0 && (
                      <> Fields awaiting a human decision: <b>{result.conflictFields.join(", ")}</b>.</>
                    )}
                  </p>
                )}

                {result.issues && (
                  <ul className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-text-mid)" }}>
                    {result.issues.map((i, k) => (
                      <li key={k}>
                        <span className="font-mono">{i.path}</span> — {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {result.moveId && (result.conflictFields?.length ?? 0) > 0 && (
                  <Link
                    href={`/moves/${result.moveId}` as never}
                    className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide"
                    style={{ background: "var(--color-state-conflict)", color: "#1a1207" }}
                  >
                    Resolve the conflicts →
                  </Link>
                )}
                <Link href="/views" className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white" style={{ background: "var(--color-state-verified)" }}>
                  See the three audiences →
                </Link>
                <button onClick={() => { setResult(null); setStep(0); }} className="rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}>
                  Submit another
                </button>
              </div>
            </Step>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
          This form submits to the live engine: contract validation, quarantine,
          deduplication against existing moves, idempotency, and provenance — all real.
          All data is synthetic; nothing goes to any external service.
        </p>
      </main>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1 className="mb-6 text-2xl font-bold tracking-tight" style={{ color: "var(--color-text-hi)" }}>{title}</h1>
      {children}
    </motion.div>
  );
}

function Next({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)" }}>
      {children}
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}>
      Back
    </button>
  );
}
