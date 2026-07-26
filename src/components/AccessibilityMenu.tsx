"use client";

import { useCallback, useEffect, useState } from "react";
import { Accessibility, X } from "lucide-react";

/**
 * The accessibility menu.
 *
 * Most sites that ship one of these ship a third-party overlay widget, and the
 * accessibility community has spent years explaining why those are worse than
 * nothing: they sit on top of the page, guess at fixes, frequently break the
 * screen reader experience they claim to improve, and let a team believe the
 * problem is handled. This is not one of those. It sets a handful of attributes
 * on the document root and lets the stylesheet respond — the same mechanism the
 * design system already uses, with no interception of anything.
 *
 * Each control exists because it fixes a real, specific barrier:
 *
 * - **Text size** is the single most requested adjustment on the web, and
 *   browser zoom scales layout as well as type, which breaks columns.
 * - **Contrast** matters here more than on most sites, because the brand palette
 *   is mid-tone blue on dark navy, and mid-tone on dark is exactly where
 *   contrast ratios fail.
 * - **Reduced motion** is already honoured throughout from the OS setting, but
 *   the OS setting is buried and a visitor on a borrowed machine cannot change
 *   it. This is the same switch, reachable.
 * - **Underlined links** restores the second visual cue for anyone who cannot
 *   rely on colour alone to find them, which is the most common form of colour
 *   vision deficiency.
 *
 * Preferences persist, because having to set them again on every page is its
 * own barrier.
 */

type Prefs = {
  scale: number;
  contrast: boolean;
  stillness: boolean;
  underline: boolean;
};

const DEFAULTS: Prefs = { scale: 1, contrast: false, stillness: false, underline: false };
const STORAGE_KEY = "uc-a11y";

const SCALES = [
  { value: 1, label: "Default" },
  { value: 1.15, label: "Large" },
  { value: 1.3, label: "Larger" },
];

function apply(p: Prefs) {
  const root = document.documentElement;
  // Scaling the root font size lets every `rem` in the design system follow,
  // which is why the tokens were written in rem in the first place.
  root.style.fontSize = `${p.scale * 100}%`;
  root.toggleAttribute("data-a11y-contrast", p.contrast);
  root.toggleAttribute("data-a11y-still", p.stillness);
  root.toggleAttribute("data-a11y-underline", p.underline);
}

export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  // Restore on mount rather than during render: the server has no localStorage,
  // and reading it while rendering would produce markup the client disagrees
  // with.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = { ...DEFAULTS, ...(JSON.parse(saved) as Partial<Prefs>) };
        setPrefs(parsed);
        apply(parsed);
      }
    } catch {
      // A blocked or full localStorage is not a reason to break the page.
    }
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* preferences simply do not persist; they still apply */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULTS);
    apply(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  // Escape closes it. A panel that traps someone who opened it by accident is
  // the wrong thing to put on an accessibility control.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-label="Accessibility options"
        className="fixed bottom-5 left-5 z-[60] grid h-12 w-12 place-items-center rounded-full text-white shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--color-state-verified)" }}
      >
        {open ? <X className="h-5 w-5" /> : <Accessibility className="h-6 w-6" />}
      </button>

      {open && (
        <div
          id="a11y-panel"
          role="dialog"
          aria-label="Accessibility options"
          className="fixed bottom-20 left-5 z-[60] w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border p-4 shadow-2xl"
          style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
        >
          <h2 className="text-sm font-semibold text-white">Accessibility</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            These change the page itself and are remembered on this device.
          </p>

          <fieldset className="mt-4">
            <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              Text size
            </legend>
            <div className="mt-2 flex gap-1.5">
              {SCALES.map((s) => {
                const on = prefs.scale === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => update({ scale: s.value })}
                    aria-pressed={on}
                    className="flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      borderColor: on ? "var(--color-state-verified)" : "rgba(255,255,255,0.12)",
                      background: on ? "color-mix(in oklab, var(--color-state-verified) 16%, transparent)" : "transparent",
                      color: on ? "var(--color-state-verified)" : "rgba(255,255,255,0.75)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 space-y-2">
            <Toggle
              label="Higher contrast"
              hint="Stronger text and border contrast throughout."
              on={prefs.contrast}
              onChange={(v) => update({ contrast: v })}
            />
            <Toggle
              label="Reduce motion"
              hint="Stops drift, parallax and looping animation."
              on={prefs.stillness}
              onChange={(v) => update({ stillness: v })}
            />
            <Toggle
              label="Underline links"
              hint="Marks links without relying on colour."
              on={prefs.underline}
              onChange={(v) => update({ underline: v })}
            />
          </div>

          <button
            onClick={reset}
            className="mt-4 w-full rounded-lg border px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:text-white"
            style={{ borderColor: "rgba(255,255,255,0.12)" }}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors"
      style={{
        borderColor: on ? "var(--color-state-verified)" : "rgba(255,255,255,0.12)",
        background: on ? "color-mix(in oklab, var(--color-state-verified) 12%, transparent)" : "transparent",
      }}
    >
      <span
        aria-hidden
        className="mt-0.5 grid h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors"
        style={{ background: on ? "var(--color-state-verified)" : "rgba(255,255,255,0.18)" }}
      >
        <span
          className="block h-3 w-3 rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(12px)" : "translateX(0)" }}
        />
      </span>
      <span>
        <span className="block text-xs font-semibold text-white/90">{label}</span>
        <span className="block text-[11px] leading-snug text-white/50">{hint}</span>
      </span>
    </button>
  );
}
