"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import * as THREE from "three";
import { Residence, CHAPTER, lv } from "./Residence";
import { SERVICE, LIGHT } from "./palette";

/**
 * THE LIVING HOME
 *
 * A scroll-directed journey through an architect-led residence where the house
 * is the navigation, the service catalogue, and the system-status display all
 * at once. The camera travels one continuous path along the home's long axis;
 * each room is a chapter, and each chapter is a service arriving.
 *
 * The discipline that keeps it from being decoration: every light in this
 * house changes for a reason that exists in the domain. The foyer core is
 * amber while sources conflict and turns Utility Connect blue the instant a
 * human approves. The utility-room circuit stalls half-lit through the
 * provider's silence because UNKNOWN is not failure. Nothing pulses because
 * pulsing looks good.
 */

const EYE = 1.62;

interface Station {
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
}

/**
 * The walk. Left to right along the house, at eye height, with the courtyard
 * glazing on the right so the camera always has depth to look through.
 */
const WALK: Station[] = [
  // Arrival — the whole residence from the drive, dusk
  { at: 0.0, pos: [-30, 4.2, 22], look: [-6, 2.0, 0], fov: 52 },
  { at: 0.08, pos: [-24, 2.4, 13], look: [-15, 1.8, 2], fov: 55 },
  // Garage — the partner handoff
  { at: 0.16, pos: [-17.4, EYE, 7.6], look: [-17, 1.4, 0.5], fov: 58 },
  { at: 0.2, pos: [-17.2, EYE, 3.6], look: [-16.6, 1.35, 1.2], fov: 60 },
  // Foyer — the Move Digital Twin
  { at: 0.28, pos: [-11.6, EYE, 3.4], look: [-9, 2.05, 1.4], fov: 60 },
  { at: 0.34, pos: [-8.4, EYE, 3.2], look: [-6, 1.9, -1.5], fov: 62 },
  // Living — internet
  { at: 0.42, pos: [-4.6, EYE, 1.6], look: [-1.4, 1.2, -3.6], fov: 60 },
  { at: 0.48, pos: [-1.8, EYE, 0.4], look: [1.4, 1.3, -2.6], fov: 58 },
  // Kitchen — electricity, gas, water
  { at: 0.56, pos: [3.0, EYE, 1.0], look: [5.2, 1.15, -2.4], fov: 56 },
  { at: 0.62, pos: [5.6, EYE, 0.2], look: [7.6, 1.3, -3.0], fov: 56 },
  // Utility — the room the silence catches
  { at: 0.72, pos: [10.4, EYE, 0.6], look: [11.6, 1.3, -3.0], fov: 55 },
  { at: 0.82, pos: [11.4, EYE, -0.6], look: [11.6, 1.28, -3.4], fov: 48 },
  // Recovery — pull back through the house along the glazing
  { at: 0.9, pos: [9.0, 1.9, 3.4], look: [0, 1.6, -2], fov: 62 },
  // Continuum — rise and look back at the whole home
  { at: 1.0, pos: [-2, 13, 26], look: [-1, 1.2, -1], fov: 50 },
];

const smooth = (t: number) => t * t * (3 - 2 * t);

function walkAt(p: number, pos: THREE.Vector3, look: THREE.Vector3): number {
  let i = 0;
  while (i < WALK.length - 2 && p > WALK[i + 1]!.at) i++;
  const a = WALK[i]!;
  const b = WALK[i + 1]!;
  const t = smooth(THREE.MathUtils.clamp((p - a.at) / (b.at - a.at), 0, 1));
  pos.set(
    THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
    THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
    THREE.MathUtils.lerp(a.pos[2], b.pos[2], t),
  );
  look.set(
    THREE.MathUtils.lerp(a.look[0], b.look[0], t),
    THREE.MathUtils.lerp(a.look[1], b.look[1], t),
    THREE.MathUtils.lerp(a.look[2], b.look[2], t),
  );
  return THREE.MathUtils.lerp(a.fov ?? 56, b.fov ?? 56, t);
}

function Rig({ progress }: { progress: MotionValue<number> }) {
  const target = useRef(new THREE.Vector3());
  const aim = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3(-30, 4.2, 22));
  const look = useRef(new THREE.Vector3(-6, 2, 0));

  useFrame(({ camera, clock }, delta) => {
    const p = progress.get();
    const t = clock.elapsedTime;
    const fov = walkAt(p, target.current, aim.current);

    // Walking cadence, only while inside the house. A camera that glides
    // perfectly is a drone; a small vertical bob restores the body.
    const inside = p > 0.12 && p < 0.9 ? 1 : 0;
    target.current.y += Math.sin(t * 5.1) * 0.011 * inside;
    target.current.x += Math.sin(t * 2.4) * 0.007 * inside;

    // Critically damped follow so scrubbing never snaps.
    const k = 1 - Math.pow(0.0018, delta);
    pos.current.lerp(target.current, k);
    look.current.lerp(aim.current, k);
    camera.position.copy(pos.current);
    camera.lookAt(look.current);

    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, k);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/** Sun/moon that warms as the home comes alive. */
function KeyLight({ progress }: { progress: MotionValue<number> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const dusk = new THREE.Color(LIGHT.dusk);
  const warm = new THREE.Color(LIGHT.practical);

  useFrame(() => {
    const p = progress.get();
    const alive = lv(p, [CHAPTER.foyer[0], CHAPTER.kitchen[1]] as const);
    if (light.current) {
      light.current.intensity = 1.5 - alive * 0.55;
      light.current.color.lerpColors(dusk, warm, alive * 0.35);
    }
    if (amb.current) amb.current.intensity = 0.42 + alive * 0.16;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.42} color={LIGHT.dusk} />
      <directionalLight
        ref={light}
        position={[26, 22, 18]}
        intensity={1.5}
        color={LIGHT.dusk}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-far={90}
      />
      <directionalLight position={[-24, 12, -18]} intensity={0.4} color="#7fa0c8" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Chapters — copy, and the label each carries
// ---------------------------------------------------------------------------

interface ChapterCopy {
  range: readonly [number, number];
  room: string;
  title: string;
  body: string;
  service?: string;
  accent?: string;
  label: "BUILT AND FUNCTIONING" | "INTERACTIVE CONCEPT" | "FUTURE HYPOTHESIS";
}

const CHAPTERS: ChapterCopy[] = [
  {
    range: [0.005, 0.075],
    room: "Arrival",
    title: "An address becomes a home only when everything begins working together.",
    body: "The keys are handed over. The electricity is unconfirmed, the internet inactive, the security unconfigured — and three different systems each believe something different about this move.",
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.1, 0.185],
    room: "Garage · The handoff",
    title: "One move can begin in several places at once",
    body: "An agent refers a client. A brokerage uploads a spreadsheet. The customer fills the form herself. Three sources, three versions, and no two agree on the move date.",
    service: "Partner API · CSV · Customer form",
    accent: SERVICE.verified,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.21, 0.31],
    room: "Foyer · The Move Record",
    title: "One move. Every source preserved. Every decision explainable.",
    body: "The conflicting records hang unresolved — amber, because a disagreement needs judgement, not an error message. A named concierge approves one canonical value, and only then does the record turn verified.",
    service: "Provenance · Human approval",
    accent: SERVICE.conflict,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.335, 0.44],
    room: "Living room · Connectivity",
    title: "The router finds the line",
    body: "Internet and television are requested against the confirmed address. A small green blink on the console is the tell that a service actually arrived — not that a light was switched on.",
    service: "Internet · Television · Home phone",
    accent: SERVICE.internet,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.465, 0.57],
    room: "Kitchen · Essential utilities",
    title: "The services nobody notices until they are missing",
    body: "Electricity reaches the pendants, water reaches the tap. The house stops being an architectural shell and becomes somewhere you can live.",
    service: "Electricity · Gas · Water",
    accent: SERVICE.electricity,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.595, 0.67],
    room: "Utility room · Home systems",
    title: "The last circuit is requested",
    body: "Laundry, home protection, warranty — the systems that run underneath a home. This is the request that goes out last, which is why it is the one the provider's silence will catch.",
    service: "Home warranty · Protection · Appliance readiness",
    accent: SERVICE.electricity,
    label: "INTERACTIVE CONCEPT",
  },
  {
    range: [0.69, 0.755],
    room: "Entry · Security",
    title: "Protection is a decision, not a default",
    body: "Security interest is conditional and price-sensitive. The system records that as a conditional interest rather than an order — AI may explain the options, it may not enrol anyone.",
    service: "Security · Home protection",
    accent: SERVICE.security,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.775, 0.865],
    room: "The silence",
    title: "The provider created the order. The response never arrived.",
    body: "The utility circuit stalls half-lit. Not red, not failed — UNKNOWN. A blind retry here would enrol this household twice at a real utility, so the system refuses and schedules reconciliation instead.",
    service: "OUTCOME_UNKNOWN · Blind retry blocked",
    accent: SERVICE.unknown,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.878, 0.935],
    room: "Recovery",
    title: "Ask the provider. Finish the light.",
    body: "Reconciliation finds the order that existed all along. The stalled circuit completes and the entry sensor settles verified. One order. Never two. Every transition in the audit trail.",
    service: "Reconciled · One logical order",
    accent: SERVICE.recovered,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.945, 1.0],
    room: "The Continuum",
    title: "Utility Connect can connect more than the move",
    body: "Installation checks, renewal windows, seasonal maintenance, a trusted vendor, a referral, the next move. The same verified record carries the whole relationship — with consent, and with attribution intact.",
    service: "Home Continuum · Move Wallet · Partner Growth",
    accent: SERVICE.solar,
    label: "FUTURE HYPOTHESIS",
  },
];

const LABEL_STYLE: Record<ChapterCopy["label"], string> = {
  "BUILT AND FUNCTIONING": SERVICE.recovered,
  "INTERACTIVE CONCEPT": SERVICE.internet,
  "FUTURE HYPOTHESIS": SERVICE.solar,
};

function ChapterCard({ progress, c }: { progress: MotionValue<number>; c: ChapterCopy }) {
  const [a, b] = c.range;
  const opacity = useTransform(progress, [a, a + 0.018, b - 0.018, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [22, -22]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start px-6 pb-16 sm:px-16"
    >
      <div className="max-w-lg">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ background: `${LABEL_STYLE[c.label]}22`, color: LABEL_STYLE[c.label] }}
          >
            {c.label}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
            {c.room}
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold leading-[1.15] tracking-tight text-white sm:text-[2.1rem]">
          {c.title}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">{c.body}</p>
        {c.service && (
          <div
            className="mt-4 inline-flex items-center gap-2 border-l-2 pl-3 text-xs font-medium tracking-wide"
            style={{ borderColor: c.accent, color: "rgba(255,255,255,0.8)" }}
          >
            {c.service}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function LivingHome() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  const [webgl, setWebgl] = useState(true);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.025], [1, 0]);
  const hintShow = useTransform(scrollYProgress, (v) => (v > 0.035 ? "none" : "flex"));

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setWebgl(false);
    } catch {
      setWebgl(false);
    }
  }, []);

  if (reduce || !webgl) return <StaticChapters />;

  return (
    <div ref={ref} style={{ height: "1000vh", background: "#0d1218" }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Canvas
          camera={{ position: [-30, 4.2, 22], fov: 52, near: 0.05, far: 400 }}
          dpr={[1, 1.75]}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          gl={{ antialias: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={["#151d26"]} />
          <fog attach="fog" args={["#151d26", 40, 130]} />

          {/*
            A dusk environment. Cool sky above, warm bounce at floor level, and
            a soft fill through the courtyard glazing — so every light material
            in the house has something true to sample. Baked in-engine; no HDRI
            download, works offline.
          */}
          <Environment resolution={160} frames={1}>
            <Lightformer intensity={0.7} color="#9db8dc" position={[0, 18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[46, 46, 1]} />
            <Lightformer intensity={0.5} color="#ffd9a8" position={[0, 1.6, 16]} scale={[30, 5, 1]} />
            <Lightformer intensity={0.32} color="#7fa0c8" position={[-28, 8, -14]} scale={[22, 12, 1]} />
            <Lightformer intensity={0.22} color="#6d7a68" position={[0, -4, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[46, 46, 1]} />
          </Environment>

          <KeyLight progress={scrollYProgress} />
          <Residence progress={scrollYProgress} />
          <ContactShadows position={[0, 0.05, 0]} scale={54} resolution={1024} blur={2.5} opacity={0.55} far={8} color="#0d1620" frames={1} />
          <Rig progress={scrollYProgress} />

          <EffectComposer multisampling={0}>
            <Bloom intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.4} kernelSize={KernelSize.LARGE} mipmapBlur />
            <Vignette eskil={false} offset={0.22} darkness={0.72} />
          </EffectComposer>
        </Canvas>

        {CHAPTERS.map((c) => (
          <ChapterCard key={c.range[0]} progress={scrollYProgress} c={c} />
        ))}

        <motion.div
          style={{ opacity: hintOpacity, display: hintShow }}
          className="pointer-events-none absolute inset-x-0 bottom-7 justify-center"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">
            scroll to enter
          </span>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
          <motion.div style={{ scaleX: bar, transformOrigin: "left" }} className="h-full">
            <div className="h-full w-full" style={{ background: SERVICE.verified }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** Reduced-motion and no-WebGL both land here: the same story, told still. */
function StaticChapters() {
  return (
    <section className="px-6 py-24" style={{ background: "#0d1218" }}>
      <div className="mx-auto max-w-2xl space-y-12">
        {CHAPTERS.map((c) => (
          <div key={c.range[0]}>
            <div className="flex items-center gap-2.5">
              <span
                className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ background: `${LABEL_STYLE[c.label]}22`, color: LABEL_STYLE[c.label] }}
              >
                {c.label}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">{c.room}</span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">{c.title}</h2>
            <p className="mt-3 leading-relaxed text-white/70">{c.body}</p>
            {c.service && (
              <div className="mt-3 border-l-2 pl-3 text-xs" style={{ borderColor: c.accent, color: "rgba(255,255,255,0.75)" }}>
                {c.service}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
