"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows, Sky } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO, DepthOfField } from "@react-three/postprocessing";
import { KernelSize, type DepthOfFieldEffect } from "postprocessing";
import {
  AnimatePresence,
  cubicBezier,
  motion,
  motionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
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
  /**
   * How the camera arrives at THIS station. "transit" is the silk curve for
   * walks between rooms; "settle" front-loads the move and spends the rest of
   * the segment easing into stillness — the film language of a push-in that
   * arrives at its subject and holds, rather than gliding past it at constant
   * speed. The uniform smoothstep this replaces was most of why the walk read
   * as a drone flight: every move had the same weightless rhythm.
   */
  ease?: "transit" | "settle";
}

/*
  The two easing characters, from the cinematic-scroll playbook: a symmetric
  "silk" bezier for transits and a hard-arriving, soft-settling curve for
  push-ins. Micro-adjustments here change the perceived weight of the whole
  camera, which is exactly why they are named rather than inlined.
*/
const EASE_TRANSIT = cubicBezier(0.45, 0.05, 0.55, 0.95);
const EASE_SETTLE = cubicBezier(0.16, 0.85, 0.3, 1);

/**
 * The walk. Left to right along the house, at eye height, with the courtyard
 * glazing on the right so the camera always has depth to look through.
 *
 * Every station is aimed at a SUBJECT that exists at those coordinates — the
 * referral key at (−18.35, 1.62, 3.15), the Move Record core at (−9, 2.1, 1.4),
 * the router LED at (−0.05, 0.78, −3.85), the island at (5, 0.95, −2.2), the
 * circuit panel on the rear wall at (11.6, 1.45, −5.7). An earlier pass aimed at empty space
 * between rooms and framed blank plaster; a station with no subject is a
 * missing shot, not a transition.
 */
const WALK: Station[] = [
  // Arrival — through the gate and down the drive, the way anyone actually
  // reaches a house. The film used to open mid-lawn with no threshold at all;
  // it now opens on the street side of an open gate, the drive running dead
  // straight to the garage, the covered car answering "someone lives here".
  // Then the camera swings off the drive into the three-quarter approach that
  // lets the cantilever read as something you walk under.
  { at: 0.0, pos: [-17, 1.8, 27.5], look: [-11, 2.0, 2], fov: 46 },
  { at: 0.045, pos: [-17.3, 1.85, 19.5], look: [-12, 2.0, 1.5], fov: 48 },
  { at: 0.08, pos: [-22.5, 2.3, 12.5], look: [-11.5, 2.0, 0], fov: 50 },
  // Garage — down to eye level, framing the referral key on the boxes. The
  // camera used to look straight down the bay at x ≈ −17 while the whole stack
  // sat at −17.5 to −19.7, so the subject of the chapter was off-frame left and
  // the shot was a blank wall with a ring floating in front of it.
  { at: 0.15, pos: [-15.9, 1.66, 7.6], look: [-18.3, 1.15, 2.8], fov: 56 },
  { at: 0.2, pos: [-16.6, EYE, 5.5], look: [-18.4, 1.1, 2.7], fov: 50, ease: "settle" },
  // Foyer — the Move Digital Twin, held in the double-height entry.
  // The aim sits just below eye height even though the core hangs above it:
  // aiming *at* the core pitched the lens up and gave away half the frame to
  // blank ceiling. Framing the room and letting the core enter the upper third
  // is how an interior photographer shoots a pendant — you never point at it.
  { at: 0.27, pos: [-13.6, EYE, 5.8], look: [-9.2, 1.5, 0.4], fov: 56 },
  { at: 0.32, pos: [-11.8, 1.66, 4.3], look: [-8.8, 1.52, 0.2], fov: 50, ease: "settle" },
  // Entry · security — turn back toward the front door, where the sensor is.
  // This beat used to play while the camera stood in the utility room eleven
  // metres away, so a caption about the entry sensor ran over a washing
  // machine. Turning at the threshold keeps the "never cut between rooms" rule
  // while still putting the subject in frame.
  { at: 0.335, pos: [-8.3, 1.66, 3.3], look: [-6.5, 2.02, 5.5], fov: 46 },
  { at: 0.37, pos: [-7.35, 1.86, 4.5], look: [-6.38, 2.11, 5.62], fov: 34, ease: "settle" },
  // Living — across the seating group to the router on the console
  { at: 0.42, pos: [-7.4, EYE, 1.5], look: [-3.4, 1.1, -2.6], fov: 58 },
  { at: 0.46, pos: [-4.4, EYE, 0.2], look: [-0.05, 0.95, -3.7], fov: 50, ease: "settle" },
  // Dining — the room between, so the mid-house move has a subject
  { at: 0.52, pos: [-1.6, EYE, 0.6], look: [1.4, 0.9, -2.6], fov: 55 },
  // Kitchen — the island, stools and pendants
  { at: 0.55, pos: [2.2, EYE, 0.8], look: [5.0, 1.0, -2.2], fov: 54 },
  { at: 0.6, pos: [4.6, EYE, -0.2], look: [5.4, 1.05, -2.4], fov: 48, ease: "settle" },
  // Through the doorway — the camera lines up with the 1.15m opening at
  // z ≈ −1.77 before crossing, so the transition frames the utility room
  // through the door rather than walking into the pier beside it.
  { at: 0.635, pos: [8.1, EYE, -1.77], look: [11.4, 1.3, -2.6], fov: 56 },
  // Utility — the machines and the shelf, then in tight on the circuit panel
  { at: 0.67, pos: [10.2, EYE, -1.6], look: [11.7, 1.4, -5.2], fov: 52 },
  { at: 0.78, pos: [11.5, 1.62, -2.0], look: [11.6, 1.45, -5.7], fov: 38, ease: "settle" },
  // Recovery — pull back down the length of the house, shot FROM the doorway
  // line so the retreat from the wall-mounted panel exits through the actual
  // opening. The previous position sat in the open zone at z 2.9, and the
  // transit from the new panel close-up grazed the dividing wall face-on —
  // a full frame of plaster, caught by the beat screenshots.
  { at: 0.88, pos: [8.8, 1.86, -1.77], look: [-2.4, 1.3, -1.9], fov: 58 },
  // Continuum — the closing, in two beats.
  //
  // First the ground hero: the whole length of the house, low enough to see
  // the lit interior through the glazing — the warm-inside-against-cool-
  // outside contrast that is the emotional payload of the reference work.
  // Then the camera cranes up and away to a high three-quarter where the
  // solar array, the rooflight, the courtyard, the pool, the drive and the
  // gate all read in one frame. An earlier attempt at an aerial failed from
  // 17m straight overhead — it framed nothing but roof membrane. The fix is
  // distance and angle, not altitude alone: far enough out that the facade
  // survives, high enough that the array is unmistakably a solar roof. The
  // Continuum chapter claims the home's ONGOING relationship — renewals,
  // solar, seasonal work — and this is the one camera position where that
  // future is visible instead of narrated.
  { at: 0.94, pos: [-24, 4.4, 27], look: [-6, 2.0, 1.0], fov: 54 },
  { at: 1.0, pos: [-27, 16.5, 24], look: [-6.5, 1.8, -1.5], fov: 46, ease: "settle" },
];

function walkAt(p: number, pos: THREE.Vector3, look: THREE.Vector3): number {
  let i = 0;
  while (i < WALK.length - 2 && p > WALK[i + 1]!.at) i++;
  const a = WALK[i]!;
  const b = WALK[i + 1]!;
  const ease = b.ease === "settle" ? EASE_SETTLE : EASE_TRANSIT;
  const t = ease(THREE.MathUtils.clamp((p - a.at) / (b.at - a.at), 0, 1));
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

/**
 * What the rig knows that the lens needs: the distance from the camera to the
 * current subject. The depth-of-field effect reads it every frame, so focus
 * tracks the push-ins automatically — tight on the referral key, the room
 * behind it softens; pull back for a transit and everything sharpens up.
 * A module-level channel rather than context because both readers live inside
 * useFrame, where a React re-render per scroll tick is the wrong currency.
 */
const rigState = { focus: 10 };

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
    rigState.focus = pos.current.distanceTo(look.current);

    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, k);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

/**
 * Depth of field that follows the walk.
 *
 * The focus plane is the rig's current subject distance, eased so a scrub
 * never snaps the lens. The focus RANGE scales with distance — tight shots get
 * a shallow plane that melts the room behind the referral key; wide transits
 * get a deep one, so the effect reads as a photographer pulling focus rather
 * than a blur filter switching on. This is the second half of what makes the
 * push-ins feel operated: the easing gives the camera weight, the focus gives
 * it attention.
 */
function CinematicDof() {
  const ref = useRef<DepthOfFieldEffect>(null);
  useFrame(() => {
    const effect = ref.current;
    if (!effect) return;
    const coc = effect.cocMaterial;
    coc.worldFocusDistance = THREE.MathUtils.lerp(coc.worldFocusDistance || rigState.focus, rigState.focus, 0.14);
    /*
      1.5× the focus distance, floored at 3.5m — wider than a photographer's
      instinct, and deliberately so. At 0.9× the background melt was beautiful
      on the courtyard tree and catastrophic on the utility glazing: its thin
      charcoal mullions, ten metres out against sun-blown grass, smeared into
      a diagonal of fat floating slabs that read as broken geometry rather
      than as bokeh. (An hour of hunting for the "floating slabs" ended at
      this line, not in the scene graph.) Thin dark lines on blown white are
      the pathological case for big bokeh; the wider in-focus field keeps
      them structural while close subjects still separate.
    */
    coc.worldFocusRange = Math.max(3.5, coc.worldFocusDistance * 1.5);
  });
  return <DepthOfField ref={ref} focusDistance={0.025} focalLength={0.05} bokehScale={1.8} />
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
  /**
   * The world-space fixture this chapter is ABOUT — the referral key, the Move
   * Record core, the router LED. When present (and on a screen wide enough),
   * the caption stops being a plate parked in the corner and anchors to the
   * projected screen position of this point: a dot on the object, a line, and
   * the words fanning out beside it. The card in the corner was legible but
   * disembodied — nothing on screen said which thing in the room the sentence
   * was describing.
   */
  subject?: [number, number, number];
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
    subject: [-18.35, 1.4, 3.15],
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
    subject: [-9, 2.05, 1.4],
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
    subject: [-0.05, 0.86, -3.8],
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
    subject: [5.0, 1.05, -2.2],
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
    subject: [11.6, 1.45, -5.7],
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
    subject: [-6.38, 2.11, 5.62],
    title: "Protection is a decision, not a default",
    body: "Security interest is conditional and price-sensitive. The system records that as a conditional interest rather than an order — AI may explain the options, it may not enrol anyone.",
    service: "Security · Home protection",
    accent: SERVICE.security,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.68, 0.85],
    room: "The silence",
    subject: [11.6, 1.45, -5.7],
    title: "The provider created the order. The response never arrived.",
    body: "The utility circuit stalls half-lit. Not red, not failed — UNKNOWN. A blind retry here would enrol this household twice at a real utility, so the system refuses and schedules reconciliation instead.",
    service: "OUTCOME_UNKNOWN · Blind retry blocked",
    accent: SERVICE.unknown,
    label: "BUILT AND FUNCTIONING",
  },
  {
    range: [0.81, 0.938],
    // No subject on purpose: recovery's shot is the pull-back down the whole
    // house, and its "subject" is the length of the room. An anchor here
    // pinned the card to empty mid-air in the centre of the widest frame in
    // the film — the lower third is the right home for a wide shot's caption.
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

/*
  The bridge between the walk and the words.

  The projector (inside the Canvas, where the camera lives) writes the active
  chapter's subject as screen percentages; the caption cards (DOM, outside the
  Canvas) read them as motion values. Module-level because both ends run per
  frame — a React context would re-render the tree at scroll rate to move a
  dot.
*/
const anchor = {
  x: motionValue(50),
  y: motionValue(55),
  /**
   * Index of the chapter that owns the anchor this frame, or −1 when no
   * subject is actually on screen. Ownership is what stops two crossfading
   * captions stacking on one dot, and what sends a caption back to the
   * lower-third plate the moment its subject leaves the frustum — a card
   * pointing at a wall the subject is behind was the first thing the
   * screenshot pass caught.
   */
  owner: motionValue(-1),
};

function SubjectProjector({ progress }: { progress: MotionValue<number> }) {
  const v = useRef(new THREE.Vector3());
  const vv = useRef(new THREE.Vector3());
  useFrame(({ camera }) => {
    const p = progress.get();
    const candidates = CHAPTERS.filter(
      (c) => c.subject && p >= c.range[0] && p <= c.range[1],
    );
    // Chapters overlap at their edges by design; the one whose midpoint is
    // nearest owns the anchor, so a crossfade hands the dot over exactly once.
    const c = candidates.sort(
      (a, b) =>
        Math.abs((a.range[0] + a.range[1]) / 2 - p) - Math.abs((b.range[0] + b.range[1]) / 2 - p),
    )[0];
    if (!c?.subject) {
      anchor.owner.set(-1);
      return;
    }
    /*
      In front of the lens, tested in VIEW space — NDC alone cannot answer
      this. A point behind the camera divides by a negative w on projection,
      which can flip it back inside ±1 and pin a caption to a subject the
      viewer is walking away from.
    */
    vv.current.set(...c.subject).applyMatrix4(camera.matrixWorldInverse);
    if (vv.current.z > -0.5) {
      anchor.owner.set(-1);
      return;
    }
    v.current.set(...c.subject).project(camera);
    /*
      And in the CENTRE of the frame, not merely inside the frustum. The first
      screenshot pass caught the foyer caption anchored to a garage wall: the
      Move Record core sat behind that wall, geometrically inside the frustum,
      and a projection test cannot see occlusion. But the walk is authored so
      that every chapter's subject is centre-frame when its beat peaks — so
      "near the middle" is both the occlusion heuristic and the film grammar:
      the dot lights up when the camera has arrived, and the caption rides the
      lower third while it is still travelling.
    */
    /*
      0.35/0.5, tightened from 0.6/0.72: the looser box let the utility panel
      claim its anchor while the camera was still in the doorway with a
      concrete pier between them — a lit dot on blank plaster. The walk
      centres every subject to within ~0.1 NDC at its settle, so the tight box
      costs nothing at the moments that matter and ends ownership the moment
      a transit begins.
    */
    if (Math.abs(v.current.x) > 0.35 || Math.abs(v.current.y) > 0.5) {
      anchor.owner.set(-1);
      return;
    }
    /*
      Clamped into the frame's safe area rather than allowed to ride the exact
      projection: the dot should sit ON the subject when it can, but a subject
      near the frame edge must not drag the card off screen. The damped rig
      makes the raw projection smooth already; the extra lerp keeps the
      hand-over between chapters from snapping.
    */
    const tx = THREE.MathUtils.clamp(((v.current.x + 1) / 2) * 100, 7, 60);
    const ty = THREE.MathUtils.clamp(((1 - v.current.y) / 2) * 100, 10, 52);
    anchor.x.set(THREE.MathUtils.lerp(anchor.x.get(), tx, 0.16));
    anchor.y.set(THREE.MathUtils.lerp(anchor.y.get(), ty, 0.16));
    anchor.owner.set(CHAPTERS.indexOf(c));
  });
  return null;
}

/**
 * THE CAPTION — one card at a time, set like a title, handed off like a cut.
 *
 * The captions used to be ten independent components, each fading on its own
 * scroll band, which guaranteed the one thing a film's titles must never do:
 * two of them on screen at once, stacked in the same corner, wherever bands
 * overlapped. The critique called the result "generated", and both halves of
 * that were right — the collision was generated, and so was the styling, a
 * workhorse sans doing a title card's job.
 *
 * Now there is ONE card. The dominant chapter owns it; AnimatePresence plays
 * the hand-off, so an arriving caption visibly replaces the departing one — a
 * cut, not a pile-up. The title is set in the film's display serif, the body
 * stays in the working sans, and the only ornament that survives is
 * information: the short rule under the kicker is the chapter's colour, and
 * the hairline along the plate's foot is the chapter's own progress.
 */

/** Which chapter owns the caption at this scroll position. */
function dominantAt(p: number): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < CHAPTERS.length; i++) {
    const [a, b] = CHAPTERS[i]!.range;
    if (p < a || p > b) continue;
    const d = Math.abs((a + b) / 2 - p);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** The title, one word at a time, out of the thing it describes. */
function TitleWords({ title }: { title: string }) {
  return (
    <motion.h2
      className="mt-3 text-[clamp(1.32rem,1.9vw,1.68rem)] font-medium leading-[1.16] tracking-[-0.012em] text-white"
      style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      variants={{ in: { transition: { staggerChildren: 0.042, delayChildren: 0.12 } } }}
    >
      {title.split(" ").map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block whitespace-pre will-change-transform"
          variants={{
            out: { opacity: 0, y: 12, filter: "blur(6px)" },
            in: { opacity: 1, y: 0, filter: "blur(0px)" },
          }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </motion.h2>
  );
}

function CaptionCard({
  c,
  placement,
  progress,
}: {
  c: ChapterCopy;
  placement: "anchor" | "corner";
  progress: MotionValue<number>;
}) {
  const [a, b] = c.range;
  // The plate's foot carries the chapter's own progress — the one ornament
  // on the card that is data rather than decoration.
  const chapterT = useTransform(progress, [a, b], [0, 1]);
  const left = useTransform(anchor.x, (v) => `${v}%`);
  const top = useTransform(anchor.y, (v) => `${v}%`);
  const accent = c.accent ?? "rgba(255,255,255,0.75)";

  const plate = (
    <motion.div
      variants={{
        out: { opacity: 0, y: 16, scale: 0.985, filter: "blur(7px)" },
        in: {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
        },
        exit: {
          opacity: 0,
          y: -12,
          filter: "blur(6px)",
          transition: { duration: 0.3, ease: [0.5, 0, 0.75, 0] },
        },
      }}
      className="pointer-events-none relative w-[24.5rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl px-6 pb-5 pt-[1.15rem] backdrop-blur-md"
      style={{
        background: "linear-gradient(168deg, rgba(9,13,19,0.82), rgba(9,13,19,0.95))",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 50px -18px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.17em]"
          style={{ background: `${LABEL_STYLE[c.label]}1f`, color: LABEL_STYLE[c.label] }}
        >
          <span className="h-1 w-1 rounded-full" style={{ background: LABEL_STYLE[c.label] }} />
          {c.label}
        </span>
        <span className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.3em] text-white/50">
          {c.room}
        </span>
      </div>
      {/* the chapter's colour, stated once, as a rule rather than a wash */}
      <div
        className="mt-3 h-px w-9"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <TitleWords title={c.title} />
      <motion.div
        variants={{
          out: { opacity: 0, y: 8 },
          in: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] } },
        }}
      >
        <p className="mt-2.5 max-w-[60ch] text-[13.5px] leading-[1.62] text-white/72">{c.body}</p>
        {c.service && (
          <div className="mt-3.5 flex items-center gap-2">
            <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent }} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">
              {c.service}
            </span>
          </div>
        )}
        {c.catalogueRoom && (
          <div className="mt-3.5 border-t border-white/[0.08] pt-2.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/38">
              Connected here
            </span>
            <p className="mt-1 text-[11.5px] leading-relaxed text-white/60">
              {roomServiceLine(c.catalogueRoom)}
            </p>
          </div>
        )}
      </motion.div>
      {/* chapter progress, in the chapter's colour, at the plate's foot */}
      <motion.div
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{ scaleX: chapterT, background: accent, opacity: 0.75 }}
      />
    </motion.div>
  );

  if (placement === "anchor") {
    return (
      <motion.div
        initial="out"
        animate="in"
        exit="exit"
        style={{ left, top }}
        className="pointer-events-none absolute hidden md:block"
      >
        {/* the dot on the fixture, and the stem that hands it to the words */}
        <motion.span
          variants={{
            out: { scale: 0, opacity: 0 },
            in: { scale: 1, opacity: 1, transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] } },
            exit: { scale: 0, opacity: 0, transition: { duration: 0.2 } },
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 8, height: 8, background: accent, boxShadow: `0 0 14px 2px ${accent}55` }}
        />
        <motion.span
          variants={{
            out: { scaleY: 0, opacity: 0 },
            in: { scaleY: 1, opacity: 1, transition: { duration: 0.35, delay: 0.12 } },
            exit: { opacity: 0, transition: { duration: 0.2 } },
          }}
          className="absolute left-0 top-1 w-px origin-top"
          style={{ height: 30, background: `linear-gradient(${accent}, transparent)` }}
        />
        <div className="mt-10">{plate}</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial="out"
      animate="in"
      exit="exit"
      className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-start px-6 pb-14 sm:px-14"
    >
      {plate}
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
  /*
    Subject-anchored captions need room beside the subject; below ~768px the
    card would cover the very thing its dot points at, so phones keep the
    lower-third plate.
  */
  const [anchored, setAnchored] = useState(false);
  // The single caption's owner and placement — see the CaptionCard block.
  const [activeChapter, setActiveChapter] = useState(0);
  const [owns, setOwns] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const i = dominantAt(p);
    if (i !== activeChapter) setActiveChapter(i);
  });
  useMotionValueEvent(anchor.owner, "change", (o) => {
    const mine = o >= 0 && o === activeChapter;
    if (mine !== owns) setOwns(mine);
  });
  const placement: "anchor" | "corner" =
    anchored && owns && CHAPTERS[activeChapter]?.subject ? "anchor" : "corner";

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setWebgl(false);
    } catch {
      setWebgl(false);
    }
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setAnchored(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
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
          /*
            1.5, down from 1.75. The composer runs AO, depth-of-field, bloom
            and vignette over every pixel, and on a 2x laptop display the old
            cap asked for that work at 2.6× the pixels of 1.5 — measured as
            the difference between a scroll that keeps up and one that visibly
            drags behind the thumb. At these viewing sizes the film cannot
            show the difference; the frame rate can.
          */
          dpr={[1, 1.5]}
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
            which clips highlights hard and leaves midtones flat. ACES Filmic
            was the previous answer; AgX replaces it because it handles the
            exact failure ACES shows in this scene — saturated emissives (the
            amber core, the cyan router LED) skewing hue as they brighten, and
            sunlit plaster clipping to chalk. AgX is Blender 4's default view
            transform for the same reason: it desaturates into white the way
            over-exposed film does, which is most of what "photographed"
            means. It meters darker than ACES, hence the exposure lift.
          */
          gl={{
            antialias: true,
            toneMapping: THREE.AgXToneMapping,
            // Metered against the two extremes: the security close-up, which
            // frames mostly glazing and blows the sky out above ~1.15, and
            // the recovery interior, which goes muddy below ~1.0.
            toneMappingExposure: 1.08,
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
          {/*
            A physical sky instead of a flat hex. The background colour was the
            quietest fake in the frame: real sky is a gradient that brightens
            toward the sun and pales at the horizon, and every arrival and
            closing shot holds a third of it. The dome uses the same sun
            direction the shadows come from, so the bright quarter of the sky
            sits behind the light — the one relationship a viewer's eye checks
            without knowing it is checking.
          */}
          <Sky
            distance={450}
            sunPosition={GI_SUN_POSITION as unknown as [number, number, number]}
            turbidity={7.5}
            rayleigh={1.6}
            mieCoefficient={0.004}
            mieDirectionalG={0.85}
          />
          <fog attach="fog" args={["#cfdae7", 55, 170]} />
          {/*
            No PCSS, and the absence is a finding rather than an oversight.
            drei's <SoftShadows> injects a chunk that calls unpackRGBAToDepth
            inside shadowmap_pars_fragment — but three r155+ reads shadow maps
            from real depth textures, the RGBA-packed path is gone from that
            chunk, and the injected shader fails to compile on every standard
            material in the scene (verified: Shader Error 0, VALIDATE_STATUS
            false, on this exact build). PCFSoft at 4096 with a tight frustum
            is the working ceiling for penumbra quality on this three version.
          */}

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
          <SubjectProjector progress={scrollYProgress} />

          <EffectComposer multisampling={0}>
            {/*
              Ambient occlusion — the closest a browser gets to baked global
              illumination without an offline bake. What reads as "baked GI" in
              an architectural render is mostly contact darkening: light does
              not reach the inside of a corner, the gap under a counter, or the
              seam where a stool meets the floor.

              N8AO replaces the old SSAO pass. Same cue, better estimator — it
              is a ground-truth-matched horizon-based AO with its own
              denoiser, so it reads world-space distances (a 0.5m crease is a
              0.5m crease at any camera distance) and does not shimmer on the
              scrub the way the sampled SSAO did. It also needs no separate
              normal pass, which pays for the depth-of-field pass below.
            */}
            <N8AO aoRadius={0.55} distanceFalloff={1} intensity={3.4} quality="medium" halfRes />
            <CinematicDof />
            <Bloom intensity={0.62} luminanceThreshold={0.8} luminanceSmoothing={0.4} kernelSize={KernelSize.LARGE} mipmapBlur />
            <Vignette eskil={false} offset={0.32} darkness={0.42} />
          </EffectComposer>
        </Canvas>

        {/*
          The letterbox. A constant pair of slim bars, not a scroll-driven
          performance: the widescreen crop is the single cheapest signal that
          what is playing is a film rather than a viewport, and a bar that
          animated its own height would spend that credibility on a gimmick.
          The captions render above the bars — subtitles sit on the letterbox,
          which is exactly where a viewer's eye expects words.
        */}
        <div aria-hidden data-letterbox className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[4svh] bg-black/90" />
        <div aria-hidden data-letterbox className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[4svh] bg-black/90" />

        <div className="absolute inset-0 z-20">
          {/*
            One caption at a time. The key carries both the chapter and the
            placement, so a chapter whose card moves from the lower third to
            its subject anchor re-deals visibly rather than teleporting — and
            two chapters can never stack, because there is nothing to stack.
          */}
          <AnimatePresence mode="popLayout">
            {activeChapter >= 0 && (
              <CaptionCard
                key={`${activeChapter}-${placement}`}
                c={CHAPTERS[activeChapter]!}
                placement={placement}
                progress={scrollYProgress}
              />
            )}
          </AnimatePresence>
        </div>

        <motion.div
          style={{ opacity: hintOpacity, display: hintShow }}
          className="pointer-events-none absolute inset-x-0 bottom-12 z-20 justify-center"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">
            scroll to enter
          </span>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 z-20 h-[2px] bg-white/10">
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
            <h2 className="mt-3 text-2xl font-medium leading-tight text-white" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>{c.title}</h2>
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
