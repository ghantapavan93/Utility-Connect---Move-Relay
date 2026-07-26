"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { EASE, SPRING } from "@/lib/motion";
import { accentColor, type Accent } from "@/lib/accents";

/**
 * Cinematic primitives.
 *
 * The vocabulary the vision pages are composed from: a Stage that holds a live
 * mockup, a chapter marker, a card that tilts to the cursor, a one-shot burst
 * when a row arrives, film grain over the whole thing. Pages compose these and
 * never redefine them, which is the only reason a long scrolling narrative
 * holds together instead of drifting into eight different visual languages.
 *
 * One rule governs the palette and it is inherited from the design system: an
 * accent here is a *utility state*, never a decoration. There is no "violet
 * because this card needed to look different from the last one". Verified is
 * Utility Connect's own blue, a conflict is amber because a disagreement needs
 * judgement rather than alarm, an unknown outcome is held amber, a recovery is
 * green, and the service colours belong to the services that own them. If a
 * colour on this page does not name a state, it is a bug.
 */

/* ───────────────────────────── accents ──────────────────────────────────── */

/*
  Re-exported from lib so the palette has one home. It moved out of this file
  because it is a pure lookup with no React in it, and server components — the
  architecture page among them — have every right to ask what colour "verified"
  is without importing a client module.
*/
export { accentColor, accentRgb, type Accent } from "@/lib/accents";

/* ───────────────────────────── film grain ──────────────────────────────── */

/**
 * A whisper of grain over the whole viewport.
 *
 * Digital gradients are perfectly smooth in a way nothing photographed ever is,
 * and large dark fields band visibly on 8-bit displays. Four percent of noise
 * breaks the banding and reads as film. Any more and it looks like an effect.
 */
export function FilmGrain({ id = "fg" }: { id?: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full opacity-[.035] mix-blend-overlay"
    >
      <filter id={`grain-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${id})`} />
    </svg>
  );
}

/* ───────────────────────────── tilt card ───────────────────────────────── */

/**
 * Mouse-follow tilt, capped at a few degrees.
 *
 * Springs rather than a direct transform, because the point is that the card
 * has mass — it should lag the cursor slightly and settle. Disabled entirely
 * under reduced-motion and on coarse pointers, where there is no cursor to
 * follow and the effect would only fire on tap.
 */
export function Tilt3DCard({
  children,
  max = 5,
  className = "",
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, (v) => -v * max), SPRING.gentle);
  const ry = useSpring(useTransform(x, (v) => v * max), SPRING.gentle);

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - r.left) / r.width - 0.5);
        y.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ perspective: 1200 }}
      className={className}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </div>
  );
}

/* ───────────────────────────── in-view burst ───────────────────────────── */

/** One-shot particle burst the first time a row enters the viewport. */
export function InViewBurst({ accent = "verified", count = 10 }: { accent?: Accent; count?: number }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30% 0px -30% 0px" });
  const color = accentColor(accent, 0.8);

  // Deterministic scatter — a re-render must not reshuffle the burst.
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const h = Math.sin(i * 127.1) * 43758.5453;
        const r = h - Math.floor(h);
        return {
          angle: (i / count) * Math.PI * 2 + r * 0.6,
          distance: 80 + r * 60,
          delay: r * 0.1,
          size: 2 + r * 2.5,
        };
      }),
    [count],
  );

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {inView && !reduce && (
          <>
            {dots.map((d, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: d.size, height: d.size, background: color, boxShadow: `0 0 ${d.size * 4}px ${color}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(d.angle) * d.distance,
                  y: Math.sin(d.angle) * d.distance,
                  opacity: 0,
                  scale: 0.4,
                }}
                transition={{ duration: 0.9, delay: d.delay, ease: EASE.outQuart }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────── particles ───────────────────────────────── */

/** Slow drifting motes inside a Stage. Deliberately few — this is air, not snow. */
export function Particles({ count = 6, accent = "verified" }: { count?: number; accent?: Accent }) {
  const reduce = useReducedMotion();
  const color = accentColor(accent, 0.5);
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const h = Math.sin(i * 311.7) * 24634.6345;
        const r = h - Math.floor(h);
        return { left: `${8 + r * 84}%`, delay: r * 6, duration: 9 + r * 7, size: 1.5 + r * 2 };
      }),
    [count],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{ left: m.left, width: m.size, height: m.size, background: color }}
          initial={{ y: "105%", opacity: 0 }}
          animate={{ y: "-10%", opacity: [0, 0.9, 0] }}
          transition={{ duration: m.duration, delay: m.delay, repeat: Infinity, ease: EASE.linear }}
        />
      ))}
    </div>
  );
}

/* ───────────────────────────── live badge ─────────────────────────────── */

/** The pulsing chip that tells you a mockup is running, not a screenshot. */
export function LiveBadge({ label = "LIVE", accent = "recovered" }: { label?: string; accent?: Accent }) {
  const reduce = useReducedMotion();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
      style={{
        borderColor: accentColor(accent, 0.35),
        background: accentColor(accent, 0.1),
        color: accentColor(accent, 0.95),
      }}
    >
      <motion.span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: accentColor(accent, 1) }}
        animate={reduce ? undefined : { opacity: [1, 0.25, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      {label}
    </span>
  );
}

/* ───────────────────────────── stage ───────────────────────────────────── */

/**
 * The frame a live mockup sits in.
 *
 * Every concept on these pages is shown as something running rather than
 * described in a paragraph, and the Stage is what makes that legible: a dark
 * instrument panel, a wash of the accent from below, a hairline along the top,
 * and a LIVE chip in the corner. The chip matters — without it a moving mockup
 * still reads as decoration, and with it the same mockup reads as a feed.
 */
export function Stage({
  children,
  accent = "verified",
  height = 440,
  live = false,
  liveLabel = "LIVE",
  liveAccent,
}: {
  children: ReactNode;
  accent?: Accent;
  height?: number;
  live?: boolean;
  liveLabel?: string;
  liveAccent?: Accent;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border"
      style={{
        height,
        borderColor: "rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg,#0d141c 0%,#05080c 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 100%, ${accentColor(accent, 0.12)}, transparent 62%)` }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <Particles accent={accent} />
      {live && (
        <div className="absolute right-3 top-3 z-20">
          <LiveBadge label={liveLabel} accent={liveAccent ?? "recovered"} />
        </div>
      )}
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

/* ───────────────────────────── chapter marker ──────────────────────────── */

/** The numbered rule that separates one act from the next. */
export function ChapterMarker({ n, label }: { n: string; label: string }) {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE.outCubic }}
        className="flex items-center gap-4 py-10"
      >
        <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-white/40">{n}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/55">{label}</span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </motion.div>
    </div>
  );
}

/* ───────────────────────────── pill ────────────────────────────────────── */

export function Pill({ children, accent = "verified" }: { children: ReactNode; accent?: Accent }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{
        borderColor: accentColor(accent, 0.3),
        background: accentColor(accent, 0.08),
        color: accentColor(accent, 0.9),
      }}
    >
      {children}
    </span>
  );
}

/* ───────────────────────────── reveal heading ──────────────────────────── */

/** Fades a heading up once, on arrival. */
export function RevealHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.h2
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: EASE.outQuart }}
      className={className}
    >
      {children}
    </motion.h2>
  );
}

/* ───────────────────────────── magnetic link ───────────────────────────── */

/**
 * A control that leans toward the cursor as it approaches.
 *
 * A few pixels only. The effect is not meant to be noticed; it is meant to make
 * the button feel like it wants to be pressed.
 */
export function MagneticLink({
  href,
  children,
  className = "",
  strength = 6,
}: {
  /* Next 16 generates typed routes, so this borrows Link's own href type
     rather than taking a string and casting the check away. */
  href: React.ComponentProps<typeof Link>["href"];
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, SPRING.gentle);
  const sy = useSpring(y, SPRING.gentle);

  return (
    <motion.span style={{ x: sx, y: sy, display: "inline-block" }}>
      <Link
        ref={ref}
        href={href}
        className={className}
        onMouseMove={(e) => {
          if (reduce) return;
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          x.set(((e.clientX - r.left) / r.width - 0.5) * strength * 2);
          y.set(((e.clientY - r.top) / r.height - 0.5) * strength * 2);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {children}
      </Link>
    </motion.span>
  );
}

/* ───────────────────────────── cycle phase ────────────────────────────── */

/**
 * Steps 0,1,2,… on an interval — the clock every live mockup runs on.
 *
 * Returns a frozen 0 under reduced motion rather than stopping wherever it
 * happened to be, so a paused mockup shows its first and most legible state
 * instead of an arbitrary mid-cycle frame.
 */
export function useCyclePhase(phaseCount: number, intervalMs = 1600): number {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % phaseCount), intervalMs);
    return () => clearInterval(id);
  }, [phaseCount, intervalMs, reduce]);

  return reduce ? 0 : phase;
}

/* ───────────────────────────── interaction ─────────────────────────────── */

/**
 * A phase that plays itself until someone takes the wheel.
 *
 * The autoplay is there so a diagram is never a still frame waiting to be
 * understood — a visitor who scrolls past sees the mechanism move and gets the
 * idea for free. But the moment they click, hover-scrub or use a key, autoplay
 * stops for good and does not resume, because a control that keeps moving under
 * your hand is worse than one that never moved at all.
 *
 * Under reduced motion it never autoplays; it simply starts at frame 0 and
 * waits, fully operable.
 */
export function useInteractivePhase(count: number, intervalMs = 1600) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [driving, setDriving] = useState(false);

  useEffect(() => {
    if (driving || reduce) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs, driving, reduce]);

  const take = useCallback(
    (next: number) => {
      setDriving(true);
      setPhase(((next % count) + count) % count);
    },
    [count],
  );

  return {
    phase,
    /** True once the visitor has taken control — used to swap the badge. */
    driving,
    next: () => take(phase + 1),
    prev: () => take(phase - 1),
    goTo: take,
  };
}

/**
 * The transport under a live mockup.
 *
 * Dots rather than a slider: there are never more than six phases, each one is
 * a named state rather than a position on a continuum, and a dot you can hit
 * directly beats a handle you have to aim. Arrow keys work because a diagram
 * you can only operate with a mouse is a diagram half the audience cannot
 * operate at all.
 */
export function PhaseScrubber({
  count,
  phase,
  goTo,
  next,
  prev,
  accent = "verified",
  labels,
}: {
  count: number;
  phase: number;
  goTo: (n: number) => void;
  next: () => void;
  prev: () => void;
  accent?: Accent;
  labels?: string[];
}) {
  return (
    <div
      role="group"
      aria-label="Step through this diagram"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      }}
      className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-2 rounded-b-3xl bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-6 outline-none focus-visible:ring-1 focus-visible:ring-white/40"
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => goTo(i)}
          aria-label={labels?.[i] ?? `Step ${i + 1}`}
          aria-current={i === phase}
          className="group/dot relative h-6 px-0.5"
        >
          <span
            className="block h-1.5 rounded-full transition-all duration-300"
            style={{
              width: i === phase ? 22 : 8,
              background: i === phase ? accentColor(accent, 1) : "rgba(255,255,255,0.28)",
            }}
          />
          {labels?.[i] && (
            <span className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/85 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-white/80 opacity-0 transition-opacity group-hover/dot:opacity-100">
              {labels[i]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────────── live data ───────────────────────────────── */

/**
 * Reads a real endpoint, once, when the diagram first scrolls into view.
 *
 * Deferring to first sight rather than firing on mount matters on this page:
 * there are eight diagrams and only three of them are wired, and none of them
 * should cost a request until someone is actually looking at it.
 */
export function useLiveData<T>(url: string | null) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!url || !inView || state !== "idle") return;
    let cancelled = false;
    setState("loading");
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setData(j as T);
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [url, inView, state]);

  return { ref, data, state };
}

/**
 * States what a diagram actually is.
 *
 * This is the honesty rule from the design system, applied to the one place it
 * is easiest to cheat. A moving diagram implies a running system, and five of
 * the eight modules on the vision page are not running anything. So a mockup
 * reading a real endpoint says READING LIVE DATA and names the endpoint; a
 * mockup that is an argument drawn in SVG says CONCEPT · NOT WIRED and does not
 * pretend otherwise. The label is more valuable than the illusion.
 */
export function DataBadge({ endpoint, state }: { endpoint?: string; state?: "idle" | "loading" | "ready" | "error" }) {
  if (!endpoint) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
        Concept · not wired
      </span>
    );
  }
  const ok = state === "ready";
  const accent: Accent = state === "error" ? "conflict" : "recovered";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
      style={{
        borderColor: accentColor(accent, 0.35),
        background: accentColor(accent, 0.1),
        color: accentColor(accent, 0.95),
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: accentColor(accent, 1), opacity: ok ? 1 : 0.4 }}
      />
      {state === "error" ? "endpoint unreachable" : ok ? `live · ${endpoint}` : `reading ${endpoint}`}
    </span>
  );
}
