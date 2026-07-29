"use client";

import { useEffect, useRef } from "react";

import { useStillness } from "@/lib/use-stillness";

/**
 * A flow field behind the architecture page.
 *
 * Particles are steered by a noise field rather than drifting freely, and they
 * leave trails, so what accumulates is the *shape of the field* rather than the
 * particles themselves. That is why this belongs on this page specifically:
 * every decision documented below is about constraining where data may go, and
 * a field whose paths are unpredictable in detail yet obviously governed in
 * aggregate is the same idea drawn.
 *
 * The reference shifts hue continuously over the whole colour wheel. That is
 * the one thing this cannot do — a background cycling through purple and
 * magenta would make the accent colours in the content meaningless, since the
 * page would already be showing every colour it owns. The drift here stays
 * inside the cyan band the palette actually contains, so the field breathes
 * without ever claiming a state.
 *
 * Trails come from painting the page's own ground over the previous frame at
 * low alpha instead of clearing it. That is what makes this a light show rather
 * than a swarm, and it costs one fill per frame instead of storing history.
 */

/* The page ground. Trails fade toward this, so they dissolve into the page
   rather than into black. Must match the `<main>` background. */
const GROUND = "4,7,11";

/* The cyan band, as RGB. The field drifts between these three and no further. */
const BAND: [number, number, number][] = [
  [0, 135, 181], // #0087b5 — the brand
  [77, 168, 200], // #4da8c8 — transit
  [36, 152, 191], // #2498bf — cyan ink
];

/* Integer hash → [0,1). Deterministic, so the field is the same on every visit
   and a reader who scrolls back sees the picture they left. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise. Cheaper than simplex and indistinguishable once it is steering
    a curve rather than being displayed directly. */
function noise2(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const n00 = hash(x0, y0);
  const n10 = hash(x0 + 1, y0);
  const n01 = hash(x0, y0 + 1);
  const n11 = hash(x0 + 1, y0 + 1);
  return (n00 * (1 - fx) + n10 * fx) * (1 - fy) + (n01 * (1 - fx) + n11 * fx) * fy;
}

interface Mote {
  x: number;
  y: number;
  /** Previous position: a trail is a line between two frames, not a dot. */
  px: number;
  py: number;
  life: number;
  maxLife: number;
  /** Where in the cyan band this mote sits, so the field is not one flat tone. */
  tone: number;
}

export function AuroraCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const still = useStillness();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let motes: Mote[] = [];
    let raf = 0;
    let t = 0;

    /* Field scale. Small enough that a curve bends several times crossing the
       screen, large enough that neighbouring motes agree with each other — at
       finer scales the field stops reading as a field and becomes noise. */
    const SCALE = 0.0022;
    const SPEED = 0.9;

    /*
      Stroke alpha and fade rate are a pair, and the pair is what sets peak
      brightness — not either one alone.

      A mote advances `SPEED` pixels per frame, so a given pixel is drawn for
      roughly `lineWidth / SPEED` frames, and the fade decays what is already
      there by `FADE` each frame. Peak ≈ alpha × channel × frames-on-pixel. At
      0.16 and 0.055 that arrived at 62 of 255 on the blue channel, measured —
      a field technically present and practically invisible.
    */
    const ALPHA = 0.45;
    const FADE = 0.045;

    const spawn = (m: Mote) => {
      m.x = Math.random() * w;
      m.y = Math.random() * h;
      m.px = m.x;
      m.py = m.y;
      m.life = 0;
      // Lifetimes vary so motes do not all expire on the same frame, which
      // would show as the whole field blinking.
      m.maxLife = 120 + Math.random() * 260;
      m.tone = Math.random();
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A resize discards the accumulated trails, so repaint the ground rather
      // than leaving the stretched remains of the previous size.
      ctx.fillStyle = `rgb(${GROUND})`;
      ctx.fillRect(0, 0, w, h);

      /*
        Density by area, and generous with it.

        Unlike a linked particle field, nothing here compares motes to each
        other — the cost is one short line per mote per frame, so this is O(n)
        and a few hundred draws is negligible. At the density a linked field
        needs, this one covers well under a percent of the canvas and reads as
        scattered noise rather than as a field.
      */
      const target = Math.min(420, Math.max(120, Math.round((w * h) / 2600)));
      if (motes.length > target) motes.length = target;
      while (motes.length < target) {
        const m: Mote = { x: 0, y: 0, px: 0, py: 0, life: 0, maxLife: 0, tone: 0 };
        spawn(m);
        motes.push(m);
      }
    };

    /** The band position for a mote, drifting slowly with time. */
    const colourOf = (tone: number): [number, number, number] => {
      const p = (tone + t * 0.00035) % 1;
      const i = Math.floor(p * BAND.length);
      const f = p * BAND.length - i;
      const a = BAND[i % BAND.length]!;
      const b = BAND[(i + 1) % BAND.length]!;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };

    const step = (alpha: number) => {
      for (const m of motes) {
        m.px = m.x;
        m.py = m.y;

        // Two octaves of noise, the second at a quarter weight, so the field has
        // both a broad sweep and a fine wobble. One octave alone reads as
        // uniformly curved and slightly mechanical.
        const n =
          noise2(m.x * SCALE, m.y * SCALE + t * 0.0016) * 0.8 +
          noise2(m.x * SCALE * 3.1, m.y * SCALE * 3.1) * 0.2;
        const angle = n * Math.PI * 4;

        m.x += Math.cos(angle) * SPEED;
        m.y += Math.sin(angle) * SPEED;
        m.life++;

        if (m.life > m.maxLife || m.x < -10 || m.x > w + 10 || m.y < -10 || m.y > h + 10) {
          spawn(m);
          continue;
        }

        // Fade in and out across the lifetime, so nothing appears or vanishes
        // mid-stroke.
        const age = m.life / m.maxLife;
        const envelope = Math.sin(age * Math.PI);
        const [r, g, b] = colourOf(m.tone);
        ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha * envelope})`;
        ctx.beginPath();
        ctx.moveTo(m.px, m.py);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();
      }
      t++;
    };

    const frame = () => {
      /*
        The fade. Painting the ground over the last frame leaves a tail about a
        second long — enough to read as a path, short enough that the field
        never saturates into a solid wash.
      */
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(${GROUND},${FADE})`;
      ctx.fillRect(0, 0, w, h);

      // Additive, so crossing trails brighten. That overlap is the entire glow;
      // a shadowBlur would cost far more for a softer version of the same thing.
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.2;
      step(ALPHA);

      raf = requestAnimationFrame(frame);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (still) {
      /*
        One settled image rather than an empty canvas or a frozen first frame.

        Running the simulation forward without presenting it produces the field
        someone would have seen after a few seconds of watching — the picture,
        without the motion. Stopping at frame zero would show scattered dots and
        no field at all, which is not a calmer version of this, it is a
        different and worse one.
      */
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.2;
      // Much lower per-step alpha than the live loop, because nothing fades
      // here: 150 steps at the live value would accumulate to solid white.
      for (let i = 0; i < 150; i++) step(0.035);
      ctx.globalCompositeOperation = "source-over";
      return () => ro.disconnect();
    }

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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

export default AuroraCanvas;
