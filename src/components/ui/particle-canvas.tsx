"use client";

import { useEffect, useRef } from "react";

import { useStillness } from "@/lib/use-stillness";

/**
 * The field behind the demo: records in flight, coloured by what the database
 * currently says about them.
 *
 * A particle canvas is the single effect this design system names and bans —
 * "meaningless particle fields" — and the ban is right. On this page more than
 * any other, an ambient drift of dots would be a claim that something is
 * happening while the console below it is idle, on the one screen whose entire
 * argument is that the picture never runs ahead of the data.
 *
 * So the mechanic is kept and the meaninglessness is not. Every particle is a
 * record in transit and wears a state colour from the same vocabulary the
 * constellation uses. The mix and the speed are driven by which act of the demo
 * is actually running, and the phase changes because a database row changed.
 *
 * The moment worth building this for is `silence`. When the provider's reply is
 * lost and the outcome is UNKNOWN, the field very nearly stops and drains to
 * grey — because that is the truth of that state. The system does not know, so
 * nothing moves. A background that kept cheerfully drifting through the one
 * real failure in the story would be lying about it.
 */

export type FieldPhase = "idle" | "arrival" | "judgement" | "silence" | "recovery";

type RGB = [number, number, number];

/* The state vocabulary, as RGB so colours can be interpolated rather than cut. */
const VERIFIED: RGB = [0, 135, 181];
const CONFLICT: RGB = [232, 163, 61];
const PENDING: RGB = [138, 143, 152];
const TRANSIT: RGB = [77, 168, 200];
const RECOVERED: RGB = [61, 167, 106];

/**
 * What each act of the demo looks like.
 *
 * `weights` is the mix of states drawn from when a phase begins; `speed`
 * multiplies drift; `link` is how far a connection will reach, which is the
 * visual difference between a field of separate dots and a network.
 */
const PHASE: Record<FieldPhase, { weights: [RGB, number][]; speed: number; link: number }> = {
  // Nothing has run. Mostly unresolved, barely moving.
  idle: { weights: [[PENDING, 7], [VERIFIED, 2], [TRANSIT, 1]], speed: 0.45, link: 108 },
  // Three channels arriving at once: the busiest the field ever gets.
  arrival: { weights: [[TRANSIT, 5], [VERIFIED, 3], [CONFLICT, 2]], speed: 1, link: 126 },
  // Disagreement surfaced and waiting on a person.
  judgement: { weights: [[CONFLICT, 5], [VERIFIED, 4], [PENDING, 2]], speed: 0.7, link: 118 },
  // The provider went quiet. The outcome is UNKNOWN and so is the field.
  silence: { weights: [[PENDING, 9], [CONFLICT, 1]], speed: 0.06, link: 74 },
  // The existing order is found and the record settles.
  recovery: { weights: [[RECOVERED, 5], [VERIFIED, 4], [TRANSIT, 1]], speed: 0.8, link: 130 },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Current colour, eased toward `target` so a phase change reads as a wave. */
  rgb: RGB;
  target: RGB;
}

/** Weighted pick, so a phase's dominant state actually dominates. */
function pick(weights: [RGB, number][]): RGB {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let n = Math.random() * total;
  for (const [c, w] of weights) {
    n -= w;
    if (n <= 0) return c;
  }
  return weights[0]![0];
}

export function ParticleCanvas({ phase = "idle" }: { phase?: FieldPhase }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const still = useStillness();

  /*
    The phase is read through a ref inside the animation loop rather than being
    a dependency of it. Restarting the loop on every phase change would reseed
    the particles, and records that vanish and reappear the instant a step runs
    would be exactly the kind of motion this page cannot afford.
  */
  const phaseRef = useRef<FieldPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let lastPhase: FieldPhase | null = null;
    const pointer = { x: -9999, y: -9999 };

    const resize = () => {
      /*
        The canvas is sized in device pixels and scaled back down in CSS, so
        hairlines stay hairlines on a high-density display instead of blurring
        to two pixels. Capped at 2: beyond that the pixel count triples for a
        difference nobody can see on a field of soft dots.
      */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /*
        Density by area rather than a fixed count, so a phone does not run a
        desktop's worth of particles through an O(n²) link pass. The cap is what
        keeps that pass bounded on an ultrawide.
      */
      const target = Math.min(96, Math.max(26, Math.round((w * h) / 15000)));
      const mix = PHASE[phaseRef.current].weights;
      if (particles.length > target) particles.length = target;
      while (particles.length < target) {
        const c = pick(mix);
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.34,
          vy: (Math.random() - 0.5) * 0.34,
          r: 1 + Math.random() * 1.7,
          rgb: [...c] as RGB,
          target: c,
        });
      }
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const clearPointer = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const frame = () => {
      const cfg = PHASE[phaseRef.current];

      // A phase change hands every particle a new target colour; the eased
      // approach below is what turns that into a sweep rather than a cut.
      if (phaseRef.current !== lastPhase) {
        lastPhase = phaseRef.current;
        for (const p of particles) p.target = pick(cfg.weights);
      }

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        // Colour eases at 4% a frame: about half a second to arrive, which is
        // slow enough to see and short enough to finish before the next step.
        p.rgb[0] += (p.target[0] - p.rgb[0]) * 0.04;
        p.rgb[1] += (p.target[1] - p.rgb[1]) * 0.04;
        p.rgb[2] += (p.target[2] - p.rgb[2]) * 0.04;

        p.x += p.vx * cfg.speed;
        p.y += p.vy * cfg.speed;

        // Wrap rather than bounce. A record leaving one edge and arriving at the
        // other reads as traffic passing through; bouncing reads as a box.
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        const [r, g, b] = p.rgb;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.62)`;
        ctx.fill();
      }

      /*
        Links, drawn once per pair.

        This is the constellation's own vocabulary: a line between two records
        means they are related, and it fades with distance because certainty
        does. Alpha is kept low — at full strength a field this dense becomes a
        mesh, and a mesh behind body copy is unreadable.
      */
      const linkSq = cfg.link * cfg.link;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkSq) continue;
          const alpha = (1 - d2 / linkSq) * 0.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${a.rgb[0] | 0},${a.rgb[1] | 0},${a.rgb[2] | 0},${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      /*
        The pointer draws its own links to whatever is near it.

        Not a gimmick: this page is an operator console, and the thing an
        operator does is look at one part of the record at a time. Reaching for
        an area and having it connect up is the same gesture the demo is about.
      */
      if (pointer.x > -9000) {
        for (const p of particles) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > linkSq) continue;
          const alpha = (1 - d2 / linkSq) * 0.34;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.strokeStyle = `rgba(${p.rgb[0] | 0},${p.rgb[1] | 0},${p.rgb[2] | 0},${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          // A gentle pull, capped so nothing is ever yanked across the screen.
          p.vx -= (dx / Math.max(Math.sqrt(d2), 1)) * 0.006;
          p.vy -= (dy / Math.max(Math.sqrt(d2), 1)) * 0.006;
          p.vx = Math.max(-0.9, Math.min(0.9, p.vx));
          p.vy = Math.max(-0.9, Math.min(0.9, p.vy));
        }
      }

      raf = requestAnimationFrame(frame);
    };

    resize();

    if (still) {
      /*
        One static frame under stillness, not an empty canvas.

        A visitor who asked for no motion still gets the field — it simply does
        not move. Removing it would change the page's composition for exactly
        the people least able to tolerate a layout that differs from everyone
        else's description of it.
      */
      lastPhase = phaseRef.current;
      for (const p of particles) p.rgb = [...p.target] as RGB;
      const cfg = PHASE[phaseRef.current];
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.rgb[0] | 0},${p.rgb[1] | 0},${p.rgb[2] | 0},0.62)`;
        ctx.fill();
      }
      const linkSq = cfg.link * cfg.link;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
          if (d2 > linkSq) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${a.rgb[0] | 0},${a.rgb[1] | 0},${a.rgb[2] | 0},${(1 - d2 / linkSq) * 0.2})`;
          ctx.stroke();
        }
      }
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      return () => ro.disconnect();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointer);
    window.addEventListener("pointerleave", clearPointer);

    /*
      Stop entirely in a background tab. `requestAnimationFrame` is already
      throttled there, but not guaranteed to stop, and an O(n²) pass running at
      one frame a second on a tab nobody is looking at is pure cost.
    */
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", clearPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [still]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
