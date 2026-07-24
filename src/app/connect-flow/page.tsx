"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MarketingHeader } from "@/components/MarketingHeader";

/**
 * The enrollment experience — a premium reimagining of Utility Connect's own
 * /connect intake. Their form collects an address, services, and contact details
 * under specific TCPA consent wording. This keeps that exact shape and consent
 * language, and adds a stepped, animated flow.
 *
 * It does not submit anywhere. The final step hands the customer to the live
 * demo, where the same fields become a real Move Record. All data is synthetic.
 */

const SERVICES = [
  "Electric", "Internet", "Security", "Gas", "Water", "Cable",
  "Satellite", "Insurance", "Home Warranty", "Solar", "Pest Control", "Mail Forwarding",
];

export default function ConnectFlow() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(["Electric", "Internet"]));

  const toggle = (s: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  return (
    <div className="theme-light" style={{ background: "var(--color-ground-0)", minHeight: "100dvh" }}>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-6 py-20">
        {/* progress */}
        <div className="mb-8 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ background: i <= step ? "var(--color-state-verified)" : "var(--color-ground-3)" }} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <Step key="addr" title="Where are you moving?">
              <label className="mb-4 block">
                <span className="mb-1.5 block text-sm font-medium">New address</span>
                <input defaultValue="1420 Windhaven Pkwy, Plano, TX 75093" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
              </label>
              <label className="mb-6 block">
                <span className="mb-1.5 block text-sm font-medium">Move date</span>
                <input defaultValue="2026-08-16" className="w-full rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
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
                <input placeholder="Full name" defaultValue="Maya Patel" className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
                <input placeholder="Email" defaultValue="maya.patel@example.com" className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
                <input placeholder="Phone" defaultValue="469-555-0142" className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
                <input placeholder="State" defaultValue="TX" className="rounded-lg border bg-transparent px-4 py-3 text-sm" style={{ borderColor: "var(--color-ground-3)" }} />
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
                <Link href="/demo" className="flex-1 rounded-full px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide" style={{ background: "var(--color-state-verified)", color: "white" }}>
                  See this become a verified move →
                </Link>
              </div>
            </Step>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
          Demonstration only — nothing is submitted. These same fields become a real Move
          Record in the live demo. All data is synthetic.
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
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </motion.div>
  );
}

function Next({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)", color: "white" }}>
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
