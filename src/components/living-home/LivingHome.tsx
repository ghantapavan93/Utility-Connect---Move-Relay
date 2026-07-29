"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, SSAO } from "@react-three/postprocessing";
import { KernelSize, BlendFunction } from "postprocessing";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import * as THREE from "three";
import { Residence, CHAPTER, lv } from "./Residence";
import { SERVICE, LIGHT } from "./palette";
import { roomServiceLine, type Room } from "@/lib/service-catalogue";

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

/**
 * The lighting the bake integrates against.
 *
 * These must stay in step with the <directionalLight> and <Environment> below.
 * If the sun moves and the bake is not regenerated, the bounce light will be
 * arriving from a direction the direct light no longer comes from, which is
 * worse than having no bounce at all — `gi-bake.test.ts` fails the build if
 * these values drift from the ones the renderer uses.
 */
export const GI_SUN_POSITION = [18, 14, 31] as const;
export const GI_SUN_INTENSITY = 3.6;

const GI_LIGHTING = {
  sunDir: new THREE.Vector3(...GI_SUN_POSITION).normalize(),
  sunColor: new THREE.Color(LIGHT.daylight),
  sunIntensity: GI_SUN_INTENSITY,
  skyColor: new THREE.Color("#cfe0f5"),
  skyIntensity: 0.55,
  groundColor: new THREE.Color("#93a083"),
  groundIntensity: 0.22,
};

interface Station {
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
}

/**
 * The walk. Left to right along the house, at eye height, with the courtyard
 * glazing on the right so the camera always has depth to look through.
 *
 * Every station is aimed at a SUBJECT that exists at those coordinates — the
 * referral key at (−18.35, 1.62, 3.15), the Move Record core at (−9, 2.1, 1.4),
 * the router LED at (−0.05, 0.78, −3.85), the island at (5, 0.95, −2.2), the
 * circuit panel at (11.6, 1.28, −3.5). An earlier pass aimed at empty space
 * between rooms and framed blank plaster; a station with no subject is a
 * missing shot, not a transition.
 */
const WALK: Station[] = [
  // Arrival — the residence from the drive. Shot low and close rather than
  // high and wide: from 7.5m the house flattened into a strip with half the
  // frame given to empty sky, which is the one composition luxury-property
  // photography never uses. Standing height and a three-quarter approach lets
  // the cantilever read as something you walk under.
  { at: 0.0, pos: [-30, 2.6, 17.5], look: [-8, 2.1, 0.5], fov: 52 },
  { at: 0.08, pos: [-22.5, 2.3, 12.5], look: [-11.5, 2.0, 0], fov: 50 },
  // Garage — down to eye level, framing the referral key on the boxes. The
  // camera used to look straight down the bay at x ≈ −17 while the whole stack
  // sat at −17.5 to −19.7, so the subject of the chapter was off-frame left and
  // the shot was a blank wall with a ring floating in front of it.
  { at: 0.15, pos: [-15.9, 1.66, 7.6], look: [-18.3, 1.15, 2.8], fov: 56 },
  { at: 0.2, pos: [-16.6, EYE, 5.5], look: [-18.4, 1.1, 2.7], fov: 50 },
  // Foyer — the Move Digital Twin, held in the double-height entry.
  // The aim sits just below eye height even though the core hangs above it:
  // aiming *at* the core pitched the lens up and gave away half the frame to
  // blank ceiling. Framing the room and letting the core enter the upper third
  // is how an interior photographer shoots a pendant — you never point at it.
  { at: 0.27, pos: [-13.6, EYE, 5.8], look: [-9.2, 1.5, 0.4], fov: 56 },
  { at: 0.32, pos: [-11.8, 1.66, 4.3], look: [-8.8, 1.52, 0.2], fov: 50 },
  // Entry · security — turn back toward the front door, where the sensor is.
  // This beat used to play while the camera stood in the utility room eleven
  // metres away, so a caption about the entry sensor ran over a washing
  // machine. Turning at the threshold keeps the "never cut between rooms" rule
  // while still putting the subject in frame.
  { at: 0.335, pos: [-8.3, 1.66, 3.3], look: [-6.5, 2.02, 5.5], fov: 46 },
  { at: 0.37, pos: [-7.35, 1.86, 4.5], look: [-6.38, 2.11, 5.62], fov: 34 },
  // Living — across the seating group to the router on the console
  { at: 0.42, pos: [-7.4, EYE, 1.5], look: [-3.4, 1.1, -2.6], fov: 58 },
  { at: 0.46, pos: [-4.4, EYE, 0.2], look: [-0.05, 0.95, -3.7], fov: 50 },
  // Dining — the room between, so the mid-house move has a subject
  { at: 0.52, pos: [-1.6, EYE, 0.6], look: [1.4, 0.9, -2.6], fov: 55 },
  // Kitchen — the island, stools and pendants
  { at: 0.55, pos: [2.2, EYE, 0.8], look: [5.0, 1.0, -2.2], fov: 54 },
  { at: 0.6, pos: [4.6, EYE, -0.2], look: [5.4, 1.05, -2.4], fov: 48 },
  // Through the doorway — the camera lines up with the 1.15m opening at
  // z ≈ −1.77 before crossing, so the transition frames the utility room
  // through the door rather than walking into the pier beside it.
  { at: 0.635, pos: [8.1, EYE, -1.77], look: [11.4, 1.3, -2.6], fov: 56 },
  // Utility — the machines and the shelf, then in tight on the circuit panel
  { at: 0.67, pos: [10.2, EYE, -1.9], look: [11.9, 1.2, -3.4], fov: 52 },
  { at: 0.78, pos: [11.5, 1.55, -1.5], look: [11.6, 1.28, -3.45], fov: 40 },
  // Recovery — pull back down the length of the house. Held in the open
  // circulation zone rather than the utility threshold: the earlier position
  // put the doorway pier straight down the middle of the shot.
  { at: 0.88, pos: [8.6, 1.86, 2.9], look: [-2.4, 1.3, -1.9], fov: 58 },
  // Continuum — the closing image.
  //
  // This was shot from 17m up, which on a single-storey house with a solid roof
  // frames exactly one thing: the roof. The last frame of the film was a blank
  // white plane. A closing hero is taken from the ground, far enough back to
  // read the whole length, low enough to see the lit interior through the
  // glazing — the warm-inside-against-cool-outside contrast that is the entire
  // emotional payload of the reference work.
  { at: 1.0, pos: [-24, 4.4, 27], look: [-6, 2.0, 1.0], fov: 54 },
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

/**
 * Held while a still is being captured.
 *
 * The rig drives the camera from scroll position on every frame, so a capture
 * that simply moves the camera and waits for the next frame gets the rig's
 * position back, not the one it asked for. The original hook solved that by
 * calling `gl.render` directly — which also skipped the EffectComposer, and
 * therefore captured every still without ambient occlusion, bloom or vignette.
 *
 * Locking the rig instead lets the normal composed frame render at the
 * requested camera. The postprocessing is the difference between a viewport
 * render and a photograph of the room.
 */
const captureLock = { held: false };

function Rig({ progress }: { progress: MotionValue<number> }) {
  const target = useRef(new THREE.Vector3());
  const aim = useRef(new THREE.Vector3());
  const pos = useRef(new THREE.Vector3(-30, 4.2, 22));
  const look = useRef(new THREE.Vector3(-6, 2, 0));

  useFrame(({ camera, clock }, delta) => {
    if (captureLock.held) return;
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
  const dusk = new THREE.Color(LIGHT.daylight);
  const warm = new THREE.Color(LIGHT.practical);

  useFrame(() => {
    const p = progress.get();
    const alive = lv(p, [CHAPTER.foyer[0], CHAPTER.kitchen[1]] as const);
    // Daylight holds steady. Only the warmth shifts as the practicals join it,
    // so the room never dims — the services add light, they do not replace it.
    if (light.current) {
      light.current.intensity = GI_SUN_INTENSITY;
      light.current.color.lerpColors(dusk, warm, alive * 0.28);
    }
    if (amb.current) amb.current.intensity = 0.08 + alive * 0.03;
  });

  return (
    <>
      {/*
        Ambient is now almost off. It exists only as a floor for the furniture,
        which is not in the bake. The shell gets its fill from baked irradiance
        instead, which is the same quantity computed properly: it knows where
        the windows are, it knows the floor is warm and the sky is blue, and it
        varies across a wall the way real bounce does. Leaving ambient up as
        well would double-count that light and flatten it straight back out.
      */}
      <ambientLight ref={amb} intensity={0.08} color={LIGHT.daylight} />
      {/*
        The sun, at 15° elevation.

        This is the change that matters most, and it is geometric rather than
        aesthetic. The roof slab overhangs the glazing by 2.6m and its underside
        sits at y=3.245. A sun at the old 35° elevation lands its light 4.7m in
        from the roof edge — which is outside the glass, on the terrace. Not one
        photon of direct sun was reaching the floor of any room the camera walks
        through, so every interior shot was lit purely by ambient and image-based
        light. That is why it looked flat and dead however the exposure was
        tuned: there was no sunlight in the house.

        The angle is arithmetic, not taste. The roof edge sits at z=8.5, its
        underside at y=3.245, so the deepest a ray can reach past the glass is
        z = 8.5 − 3.245/tan(elevation). At 35° that is z=3.8 — outside on the
        terrace. At 15° it overshoots to z=−3.6, which is the strip of floor
        hidden behind the kitchen counter. At 21° it lands at z≈0, which means
        the sunlit floor runs from the glass line all the way to the middle of
        the plan — straight through the open floor every interior station looks
        across. That band, and the long shadows furniture throws along it, is
        the single most recognisable feature of every interior photograph in the
        reference set.

        Azimuth is swung 40° off the courtyard axis so the sun still rakes
        across the facade on the approach rather than flattening it head-on.
      */}
      <directionalLight
        ref={light}
        position={GI_SUN_POSITION as unknown as [number, number, number]}
        intensity={GI_SUN_INTENSITY}
        color={LIGHT.daylight}
        castShadow
        // 4096 over a frustum tightened to the building: ~1.3cm shadow texels,
        // which is what keeps the mullion bars on the floor crisp instead of
        // smearing them into a grey wash.
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.022}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-far={100}
      />
      {/* Cool sky fill from the opposite side, so shadow interiors are blue
          rather than black — a shadow outdoors is lit by the sky, not by
          nothing. */}
      <directionalLight position={[-24, 16, -20]} intensity={0.45} color="#b9cfe8" />
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
  /** The narrative beat for this chapter — what is happening to the record. */
  service?: string;
  /**
   * The room of the residence this chapter stands in, if it is one the service
   * catalogue assigns services to. Kept separate from `service` on purpose: the
   * accent line is the story, this is the list of real Utility Connect services
   * connected in this room. Collapsing them would let a narrative rewrite
   * silently drop a service from the catalogue.
   */
  catalogueRoom?: Room;
  accent?: string;
  label: "BUILT AND FUNCTIONING" | "INTERACTIVE CONCEPT" | "FUTURE HYPOTHESIS";
}

const CHAPTERS: ChapterCopy[] = [
  {
    range: [0.0, 0.105],
    room: "Arrival",
    catalogueRoom: "arrival",
    title: "An address becomes a home only when everything begins working together.",
    body: "The keys are handed over. The electricity is unconfirmed, the internet inactive, the security unconfigured — and three different systems each believe something different about this move.",
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.065, 0.209],
    room: "Garage · The handoff",
    catalogueRoom: "garage",
    title: "One move can begin in several places at once",
    body: "An agent refers a client. A brokerage uploads a spreadsheet. The customer fills the form herself. Three sources, three versions, and no two agree on the move date.",
    service: "Partner API · CSV · Customer form",
    accent: SERVICE.verified,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.169, 0.308],
    room: "Foyer · The Move Record",
    catalogueRoom: "foyer",
    title: "One move. Every source preserved. Every decision explainable.",
    body: "The conflicting records hang unresolved — amber, because a disagreement needs judgement, not an error message. A named concierge approves one canonical value, and only then does the record turn verified.",
    service: "Provenance · Human approval",
    accent: SERVICE.conflict,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.3535, 0.49],
    room: "Living room · Connectivity",
    catalogueRoom: "living",
    title: "The router finds the line",
    body: "Internet and television are requested against the confirmed address. A small green blink on the console is the tell that a service actually arrived — not that a light was switched on.",
    service: "Internet · Television · Home phone",
    accent: SERVICE.internet,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.45, 0.60],
    room: "Kitchen · Essential utilities",
    catalogueRoom: "kitchen",
    title: "The services nobody notices until they are missing",
    body: "Electricity reaches the pendants, water reaches the tap. The house stops being an architectural shell and becomes somewhere you can live.",
    service: "Electricity · Gas · Water",
    accent: SERVICE.electricity,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.56, 0.72],
    room: "Utility room · Home systems",
    catalogueRoom: "utility",
    title: "The last circuit is requested",
    body: "Laundry, home protection, warranty — the systems that run underneath a home. This is the request that goes out last, which is why it is the one the provider's silence will catch.",
    service: "Home warranty · Protection · Appliance readiness",
    accent: SERVICE.electricity,
    label: "INTERACTIVE CONCEPT",
  },
  {
    range: [0.268, 0.3935],
    room: "Entry · Security",
    title: "Protection is a decision, not a default",
    body: "Security interest is conditional and price-sensitive. The system records that as a conditional interest rather than an order — AI may explain the options, it may not enrol anyone.",
    service: "Security · Home protection",
    accent: SERVICE.security,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.68, 0.85],
    room: "The silence",
    title: "The provider created the order. The response never arrived.",
    body: "The utility circuit stalls half-lit. Not red, not failed — UNKNOWN. A blind retry here would enrol this household twice at a real utility, so the system refuses and schedules reconciliation instead.",
    service: "OUTCOME_UNKNOWN · Blind retry blocked",
    accent: SERVICE.unknown,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.81, 0.938],
    room: "Recovery",
    title: "Ask the provider. Finish the light.",
    body: "Reconciliation finds the order that existed all along. The stalled circuit completes and the entry sensor settles verified. One order. Never two. Every transition in the audit trail.",
    service: "Reconciled · One logical order",
    accent: SERVICE.recovered,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.898, 1.0],
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
  /*
    The bands tile the scroll and overlap at their edges, so one chapter is
    always fading in as the one before it fades out.

    They used to sit apart with a two-percent gap between each pair, and each
    band spent 0.036 of its width in a fade — which measured out as **half the
    scroll showing no caption at all**: 52 of 103 sampled positions had nothing
    on screen. A viewer got long stretches of a beautiful empty house and no
    idea what they were looking at, which is the one thing a scroll-driven story
    cannot afford.
  */
  const opacity = useTransform(progress, [a, a + 0.02, b - 0.02, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [22, -22]);

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start px-6 pb-12 sm:px-14"
    >
      {/*
        The copy carries its own scrim. Once the interior is daylit, white text
        over a white wall is unreadable — and a caption that cannot be read is
        not a caption. A dark, softly blurred plate keeps the type legible over
        any part of the room without dimming the room itself.
      */}
      <div
        className="max-w-md rounded-xl px-5 py-4 backdrop-blur-[3px]"
        style={{ background: "linear-gradient(180deg, rgba(10,14,20,0.84), rgba(10,14,20,0.94))" }}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ background: `${LABEL_STYLE[c.label]}22`, color: LABEL_STYLE[c.label] }}
          >
            {c.label}
          </span>
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
            {c.room}
          </span>
        </div>
        <h2 className="mt-2.5 text-xl font-semibold leading-[1.18] tracking-tight text-white sm:text-[1.6rem]">
          {c.title}
        </h2>
        <p className="mt-2.5 text-[13px] leading-relaxed text-white/70 sm:text-sm">{c.body}</p>
        {c.service && (
          <div
            className="mt-4 inline-flex items-center gap-2 border-l-2 pl-3 text-xs font-medium tracking-wide"
            style={{ borderColor: c.accent, color: "rgba(255,255,255,0.8)" }}
          >
            {c.service}
          </div>
        )}
        {/*
          The services Utility Connect actually connects in this room, read from
          the catalogue rather than typed into the caption. Set quieter than the
          narrative line because it is reference, not story — but present in
          every room, so the film covers all eighteen offered services instead
          of the six that happened to look good on screen.
        */}
        {c.catalogueRoom && (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Connected here
            </span>
            <p className="mt-1 text-[11px] leading-relaxed text-white/60">
              {roomServiceLine(c.catalogueRoom)}
            </p>
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
      {/*
        `100svh`, not `h-screen`. On a phone `100vh` is the URL-bar-hidden
        height, so while the bar is showing a fixed-height sticky stage extends
        past the visible area and its lowest content is cut off — and the lowest
        caption here sits 42px from the stage's bottom edge, well inside what
        the bar covers.

        `dvh` would also avoid the clip, but it tracks the bar as it collapses,
        which means the stage resizes mid-scroll and the WebGL drawing buffer is
        reallocated on the way down. `svh` is the smallest viewport: nothing is
        ever hidden and the height never changes, so the canvas is sized once.
      */}
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Canvas
          camera={{ position: [-30, 4.2, 22], fov: 52, near: 0.05, far: 400 }}
          dpr={[1, 1.75]}
          /*
            Development-only handle on the scene graph.

            Z-fighting is invisible in source and obvious on screen: two opaque
            faces on the same plane give the depth buffer a tie it cannot break,
            so the winner flips as the camera moves and the surface strobes. It
            is not findable by reading code, because the two surfaces are
            usually authored in different files by different components that
            happen to agree on a number.

            Exposing the built scene makes it findable by measurement — walk
            every mesh, compare world-space faces, report same-facing pairs that
            share a plane and overlap. That audit is what turned "the stools are
            flashing" into a list of four real defects across the sofa, the
            shelving, the rugs and a door header. Stripped in production.
          */
          onCreated={({ scene, gl, camera }) => {
            if (process.env.NODE_ENV !== "production") {
              const w = window as unknown as { __scene?: unknown; __bakeGI?: unknown; __captureHero?: unknown };
              w.__scene = scene;
              /*
                Renders a still from the residence at print resolution and POSTs
                it to /api/dev/hero, which writes it into public/.

                Utility Connect's own hero is a photograph of a kitchen with an
                island and stools, desaturated and pushed blue. Their photograph
                is theirs, so this renders ours: the same subject, from the same
                kind of angle, out of the scene that is already built. The
                marketing hero and the 3D film then come from one source, which
                is the honest version of matching their art direction.
              */
              w.__captureHero = async (
                pos: [number, number, number],
                look: [number, number, number],
                fov = 42,
                name = "residence-hero",
                width = 2400,
                height = 1350,
              ) => {
                const cam = camera as THREE.PerspectiveCamera;
                const prevSize = new THREE.Vector2();
                gl.getSize(prevSize);
                const prevPos = cam.position.clone();
                const prevFov = cam.fov;
                const prevQuat = cam.quaternion.clone();
                const prevRatio = cam.aspect;

                // Hold the rig, or the next frame puts the camera back where
                // scroll says it should be rather than where we aimed it.
                captureLock.held = true;
                gl.setSize(width, height, false);
                cam.aspect = width / height;
                cam.fov = fov;
                cam.position.set(...pos);
                cam.lookAt(new THREE.Vector3(...look));
                cam.updateProjectionMatrix();

                /*
                  Let R3F draw its own frames rather than calling `gl.render`.

                  The direct call was the whole reason these stills looked like
                  viewport screenshots: it renders the scene straight to the
                  canvas and never touches the EffectComposer, so every capture
                  lost the SSAO, the bloom and the vignette that the on-screen
                  film has. Ambient occlusion in particular is what puts objects
                  on the floor instead of floating over it.

                  Three frames, not one. The first re-renders at the new size,
                  the second lets SSAO's normal pass settle against the new
                  depth buffer, and the third is the one worth keeping.
                */
                const frame = () => new Promise((r) => requestAnimationFrame(r));
                await frame();
                await frame();
                await frame();
                const data = gl.domElement.toDataURL("image/png");

                gl.setSize(prevSize.x, prevSize.y, false);
                cam.aspect = prevRatio;
                cam.fov = prevFov;
                cam.position.copy(prevPos);
                cam.quaternion.copy(prevQuat);
                cam.updateProjectionMatrix();
                captureLock.held = false;

                const res = await fetch("/api/dev/hero", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ data, name }),
                });
                return res.json();
              };
              // Regenerating the bake: run window.__bakeGI() in the console with
              // the dev server up. It raytraces the live scene and POSTs the
              // result to /api/dev/gi-bake, which writes src/generated.
              w.__bakeGI = async (samples = 64) => {
                const { bakeGI } = await import("./gi-bake");
                const result = bakeGI(scene, { samples, bounces: 2, secondarySamples: 10, lighting: GI_LIGHTING });
                const res = await fetch("/api/dev/gi-bake", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(result),
                });
                return { ...(await res.json()), stats: result.stats };
              };
            }
          }}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          /*
            Tone mapping is the difference between a render that looks like a
            game and one that looks photographed. Three.js defaults to none,
            which clips highlights hard and leaves midtones flat — the reason
            every previous pass read as "3D" rather than as a photograph of a
            room. ACES Filmic rolls the highlights off the way film does, so
            the pendants bloom into warmth instead of blowing to white, and the
            exposure lift keeps the architectural surfaces reading light.
          */
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.78,
            /*
              Development only, and deliberately not in production.

              `toDataURL` reads the drawing buffer, which the browser is free to
              clear once a frame has been composited — so a capture that waits
              for frames to settle, as `__captureHero` now does, reads back
              blank without this. Keeping the buffer costs every visitor a copy
              on every frame, which is a poor trade for a hook only ever run at
              a dev console, so it is switched off in the build people actually
              load.
            */
            preserveDrawingBuffer: process.env.NODE_ENV === "development",
          }}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={["#c3d2e2"]} />
          <fog attach="fog" args={["#cfdae7", 55, 170]} />

          {/*
            A dusk environment. Cool sky above, warm bounce at floor level, and
            a soft fill through the courtyard glazing — so every light material
            in the house has something true to sample. Baked in-engine; no HDRI
            download, works offline.
          */}
          {/*
            A bright daylight environment.

            Image-based lighting is what makes architectural visualisation read
            as photographed rather than rendered — every surface samples a real
            sky, a real ground bounce and real fill. The previous dusk rig was
            the reason the interior stayed muddy no matter what else changed:
            there simply was not enough light in the room to reveal a material.

            The narrative still works, and works better: the architecture is
            beautifully daylit throughout, and the SERVICES are what switch on.
            A premium home is not a dark home.
          */}
          <Environment resolution={256} frames={1}>
            {/* sky dome */}
            <Lightformer intensity={1.3} color="#eaf2ff" position={[0, 20, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[60, 60, 1]} />
            {/* sun card through the courtyard glazing */}
            <Lightformer intensity={2.2} color="#fff4e2" position={[6, 9, 22]} scale={[26, 14, 1]} />
            {/* cool sky fill from behind */}
            <Lightformer intensity={0.7} color="#cfe0f5" position={[-26, 10, -18]} scale={[26, 14, 1]} />
            {/* warm ground bounce — the light that fills the underside of things */}
            <Lightformer intensity={0.45} color="#d8cbb4" position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[60, 60, 1]} />
          </Environment>

          <KeyLight progress={scrollYProgress} />
          <Residence progress={scrollYProgress} />
          <ContactShadows position={[0, 0.05, 0]} scale={54} resolution={1024} blur={2.5} opacity={0.32} far={8} color="#5a6470" frames={1} />
          <Rig progress={scrollYProgress} />

          <EffectComposer multisampling={0} enableNormalPass>
            {/*
              Ambient occlusion — the closest a browser gets to baked global
              illumination without an offline bake.

              What reads as "baked GI" in an architectural render is mostly one
              thing: contact darkening. Light does not reach the inside of a
              corner, the gap under a counter, or the seam where a stool meets
              the floor. Real-time lights cannot express that — they light
              every exposed surface equally — which is precisely why earlier
              passes looked flat no matter how the lights were tuned.

              SSAO samples the depth and normal buffers to darken those
              occluded creases each frame. Computed rather than pre-baked, so
              it costs GPU time instead of a Blender pipeline, but it is the
              same visual cue.
            */}
            {/*
              Radius back to 0.11 and intensity to 18. These had been cut to
              0.06/7 while the scene was over-exposed, when the occlusion was
              reading as grime — but the real problem then was the exposure, and
              with that fixed the near-zero setting just made every junction
              between a wall and a floor look like a decal. Contact darkening is
              most of what tells the eye two surfaces are touching.
            */}
            <SSAO
              blendFunction={BlendFunction.MULTIPLY}
              samples={24}
              radius={0.11}
              intensity={18}
              luminanceInfluence={0.6}
              worldDistanceThreshold={12}
              worldDistanceFalloff={2}
              worldProximityThreshold={2}
              worldProximityFalloff={1}
            />
            <Bloom intensity={0.62} luminanceThreshold={0.8} luminanceSmoothing={0.4} kernelSize={KernelSize.LARGE} mipmapBlur />
            <Vignette eskil={false} offset={0.32} darkness={0.42} />
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
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span
                className="whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                style={{ background: `${LABEL_STYLE[c.label]}22`, color: LABEL_STYLE[c.label] }}
              >
                {c.label}
              </span>
              <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">{c.room}</span>
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
