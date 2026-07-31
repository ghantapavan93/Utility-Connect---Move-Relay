"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { MATERIAL, SERVICE, LIGHT } from "./palette";
import { DiningTable, Chair, Stool, CoffeeTable, Shelving, Planter, Artwork, Rug, Sofa, Sideboard, Ottoman, FloorLamp, Basket, SideTable } from "./Furniture";
import { ServiceFixtures } from "./ServiceFixtures";
import { Vegetation } from "./Vegetation";
import { applyGIBake } from "./gi-apply";
import { oakMaps, walnutMaps, concreteMaps, stoneMaps, limestoneMaps, linenMaps } from "./materials";

/**
 * The residence.
 *
 * A single-storey architect-led home laid out along one long axis, so the
 * camera can travel it in one continuous move and every room stays in a
 * cinematic sightline from the next. Left to right:
 *
 *   GARAGE ─ FOYER ─ LIVING ─ KITCHEN ─ UTILITY ─ STAIR/ROOF
 *   x −17     −9      −2       +5       +11      +15
 *
 * Each room is a chapter, and each chapter owns one service. The room does not
 * illustrate the service — the room IS the service: the living room lights when
 * internet lands, the kitchen when electricity and water do, the utility room
 * when the provider's response is lost and the circuit stalls half-finished.
 *
 * Materials are light and warm on purpose (see palette.ts). The only saturated
 * colour in frame is a utility signal doing a job.
 */

// ---------------------------------------------------------------------------
// Chapter timing — one scalar drives the whole house
// ---------------------------------------------------------------------------

/*
  Chapter timing.

  The security beat used to run from 0.68 to 0.76, by which point the camera was
  eleven metres away in the utility room — so a caption about the entry sensor
  played over a shot of a washing machine. The entry sensor is at the front
  door, where an entry sensor belongs, so the beat moved to just after the foyer
  instead of the fixture moving to suit the schedule. Utility likewise now
  starts once the camera is actually through the utility doorway rather than
  while it is still at the kitchen island.
*/
export const CHAPTER = {
  arrival: [0.0, 0.085],
  garage: [0.085, 0.19],
  foyer: [0.19, 0.29],
  security: [0.29, 0.37],
  living: [0.37, 0.47],
  kitchen: [0.47, 0.58],
  utility: [0.58, 0.7],
  silence: [0.7, 0.83],
  recovery: [0.83, 0.92],
  continuum: [0.92, 1.0],
} as const;

export const lv = (p: number, [a, b]: readonly [number, number]) =>
  THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

/**
 * The height furniture stands at.
 *
 * Every piece in Furniture.tsx is authored to stand on y = 0, but the floors
 * are slabs at y = 0.02 (limestone) and y = 0.03 (oak). Placing furniture at 0
 * therefore sank all of it 2-3cm into the ground, and in one case sank it
 * exactly: the counter stool's base was a 2cm disc whose top face landed
 * precisely on the limestone plane. Two coplanar upward-facing surfaces give
 * the depth buffer a tie it cannot break, so the winner flipped from frame to
 * frame and the stools strobed as the camera moved.
 *
 * One constant clear of the highest slab fixes the whole class of defect
 * rather than the one place it happened to become visible.
 */
const FURNITURE_Y = 0.034;

/**
 * Rugs sit 4mm proud of the furniture base, not below it. A rug has thickness,
 * and a leg standing on one should stop at the pile rather than beside it — so
 * the bottom few millimetres of each leg pass under the rug plane and the leg
 * reads as resting on it. Both heights stay clear of both floor slabs.
 */
const RUG_Y = 0.038;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/**
 * Vertex spacing for baked global illumination, in metres.
 *
 * Bounce light is low-frequency — it has no sharp edges — so half a metre is
 * ample to carry it, and it keeps the shell under about 15k bakeable vertices.
 */
export const GI_GRID = 0.5;

/**
 * Stable name for a bakeable surface.
 *
 * The bake is stored on disk and matched back to meshes by name, so the name
 * has to survive a re-render and be independent of traversal order. Position is
 * the one thing about a wall that is both unique and stable.
 */
export const giName = (kind: string, [x, y, z]: readonly [number, number, number] | number[]) =>
  `gi:${kind}:${x.toFixed(2)}_${y.toFixed(2)}_${z.toFixed(2)}`;

function Wall({
  position,
  size,
  color = MATERIAL.concrete,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color?: string;
}) {
  // Board-formed concrete: the mottling and faint board lines are a real
  // normal map, so a grazing light rakes across the surface instead of
  // landing on it flat.
  const maps = useMemo(() => concreteMaps([Math.max(1, size[0] / 4), Math.max(1, size[1] / 3)]), [size]);
  // Subdivided on a ~0.5m grid. The bake stores one irradiance value per
  // vertex, so an unsubdivided 40m wall would hold exactly four samples of
  // bounce light and interpolate a flat wash between them. Resolution here is
  // lighting resolution.
  const seg = (n: number) => Math.max(1, Math.round(n / GI_GRID));
  return (
    <mesh name={giName("wall", position)} position={position} castShadow receiveShadow>
      <boxGeometry args={[...size, seg(size[0]), seg(size[1]), seg(size[2])]} />
      <meshStandardMaterial {...maps} color={color} metalness={0.02} envMapIntensity={0.85} />
    </mesh>
  );
}

function Floor({
  position,
  size,
  color,
  maps,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
  maps: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
}) {
  const seg = (n: number) => Math.max(1, Math.round(n / GI_GRID));
  return (
    <mesh
      name={giName("floor", position)}
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    >
      <planeGeometry args={[size[0], size[1], seg(size[0]), seg(size[1])]} />
      <meshStandardMaterial {...maps} color={color} metalness={0.06} roughness={0.62} envMapIntensity={1.25} />
    </mesh>
  );
}

/** Floor-to-ceiling glazing with charcoal mullions — the courtyard side. */
function Glazing({ x, z, width }: { x: number; z: number; width: number }) {
  const bays = Math.max(2, Math.round(width / 1.6));
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.6, 0]}>
        <planeGeometry args={[width, 3.2]} />
        <meshPhysicalMaterial
          color={MATERIAL.glass}
          roughness={0.06}
          metalness={0}
          transmission={0.82}
          thickness={0.4}
          transparent
          opacity={0.5}
          envMapIntensity={1.4}
        />
      </mesh>
      {Array.from({ length: bays + 1 }, (_, i) => (
        <mesh key={i} position={[-width / 2 + (i * width) / bays, 1.6, 0.03]} castShadow>
          <boxGeometry args={[0.07, 3.24, 0.09]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} envMapIntensity={1.2} />
        </mesh>
      ))}
      {[0.04, 3.2].map((y) => (
        <mesh key={y} position={[0, y, 0.03]} castShadow>
          <boxGeometry args={[width, 0.09, 0.11]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// The residence
// ---------------------------------------------------------------------------

export function Residence({ progress }: { progress: MotionValue<number> }) {
  const root = useRef<THREE.Group>(null);

  // Real PBR map sets, generated procedurally and shared across surfaces.
  const oak = useMemo(() => oakMaps([4, 4]), []);
  const limestone = useMemo(() => limestoneMaps([10, 4]), []);
  const walnut = useMemo(() => walnutMaps([2, 2]), []);
  const stone = useMemo(() => stoneMaps([2, 1]), []);
  const linen = useMemo(() => linenMaps([3, 3]), []);
  // Coarse tiling: the ceiling is one 42×15m slab, so the plaster grain has to
  // repeat at architectural scale or it turns into visible noise.
  const ceilingMaps = useMemo(() => concreteMaps([14, 5]), []);
  const groundMaps = useMemo(() => limestoneMaps([26, 18]), []);

  // Service fixtures, each owned by its room.
  const garageKey = useRef<THREE.MeshStandardMaterial>(null);
  const foyerCore = useRef<THREE.MeshStandardMaterial>(null);
  const foyerLight = useRef<THREE.PointLight>(null);
  const routerLed = useRef<THREE.MeshStandardMaterial>(null);
  const livingLamp = useRef<THREE.MeshStandardMaterial>(null);
  const livingLight = useRef<THREE.PointLight>(null);
  /**
   * Shared by both pendants' lit surfaces and both bulbs.
   *
   * Same trap as the breaker rail: a ref binds only to the last mesh that
   * claims it, so splitting one ref across four surfaces left three of them
   * permanently dark and lit exactly one bulb. Four meshes that light together
   * need one material, not one ref.
   */
  const pendantLit = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#fff3df"),
        emissive: new THREE.Color(LIGHT.practical),
        emissiveIntensity: 0,
        roughness: 0.9,
        side: THREE.BackSide,
      }),
    [],
  );
  const pendantBulb = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#fff6e6"),
        emissive: new THREE.Color(LIGHT.practical),
        emissiveIntensity: 0,
        roughness: 0.5,
      }),
    [],
  );
  const kitchenLight = useRef<THREE.PointLight>(null);
  const waterMat = useRef<THREE.MeshStandardMaterial>(null);
  /**
   * One material instance shared by every breaker on the provider-dependent
   * rail. A ref can only ever bind to the last mesh that claims it, so driving
   * the row through a ref would have left five of the six indicators dark and
   * reduced "the circuit stalls half-lit" back to a single lamp standing in for
   * a whole circuit.
   */
  const stallMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1a1d22",
        emissive: new THREE.Color(SERVICE.electricity),
        emissiveIntensity: 0,
      }),
    [],
  );
  const utilityLight = useRef<THREE.PointLight>(null);
  const securityMat = useRef<THREE.MeshStandardMaterial>(null);
  const solarMat = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    const group = root.current;
    if (!group) return;
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material | undefined;
      const soft = mat?.transparent === true;
      m.castShadow = !soft;
      m.receiveShadow = !soft;
    });

    // Baked bounce light. Applied after the shadow pass above so the materials
    // are patched once, on materials that already exist.
    const report = applyGIBake(group);
    if (process.env.NODE_ENV !== "production" && (report.missing.length || report.mismatched.length)) {
      // A stale bake is worse than none — it lights surfaces from a geometry
      // that no longer exists. Say so loudly rather than shipping it quietly.
      console.warn(
        `[gi] bake is stale. Re-run window.__bakeGI().`,
        { missing: report.missing, mismatched: report.mismatched },
      );
    }
  }, []);

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.elapsedTime;

    const garage = lv(p, CHAPTER.garage);
    const foyer = lv(p, CHAPTER.foyer);
    const living = lv(p, CHAPTER.living);
    const kitchen = lv(p, CHAPTER.kitchen);
    const utility = lv(p, CHAPTER.utility);
    const security = lv(p, CHAPTER.security);
    const silence = lv(p, CHAPTER.silence);
    const recovery = lv(p, CHAPTER.recovery);
    const continuum = lv(p, CHAPTER.continuum);

    // Garage: the referral key arrives and pulses until the foyer resolves it.
    if (garageKey.current) {
      garageKey.current.emissiveIntensity = garage * (2.4 + Math.sin(t * 3) * 0.6) * (1 - foyer * 0.7);
    }

    // Foyer: three conflicting records converge. Amber while contested, then
    // Utility Connect blue the moment a human approves.
    if (foyerCore.current) {
      const resolved = foyer > 0.55;
      foyerCore.current.emissive.set(resolved ? SERVICE.verified : SERVICE.conflict);
      foyerCore.current.emissiveIntensity = foyer > 0 ? 1.4 + foyer * 2.6 : 0;
    }
    if (foyerLight.current) {
      foyerLight.current.color.set(foyer > 0.55 ? SERVICE.verified : SERVICE.conflict);
      foyerLight.current.intensity = foyer * 3.5;
    }

    // Living: internet lands. The router blinks — the specific tell that a
    // service arrived, not merely that a light came on.
    if (routerLed.current) {
      const blink = living > 0.25 ? (Math.sin(t * 5.5) > 0 ? 1 : 0.22) : 0;
      routerLed.current.emissiveIntensity = living * blink * 4.5;
    }
    if (livingLamp.current) livingLamp.current.emissiveIntensity = living * 3.0;
    if (livingLight.current) livingLight.current.intensity = living * 5.5;

    // Kitchen: electricity and water. The utility circuit is requested LAST,
    // which is why it is the one caught by the provider's silence.
    pendantLit.emissiveIntensity = kitchen * 2.6;
    // The bulb runs hotter than the shade it sits in, which is what gives the
    // fitting a bright core instead of one even glow.
    pendantBulb.emissiveIntensity = kitchen * 6.5;
    if (kitchenLight.current) kitchenLight.current.intensity = kitchen * 6;
    if (waterMat.current) waterMat.current.emissiveIntensity = kitchen * 1.6;

    // Utility room: comes up, then STALLS half-lit through the silence and
    // stutters, completing only when reconciliation resolves the truth.
    const stall =
      silence > 0 && recovery < 1
        ? 0.62 + 0.38 * Math.abs(Math.sin(t * 7.5) * Math.sin(t * 2.3))
        : 1;
    const utilityLevel = Math.min(utility, 0.42 + recovery * 0.58) * (silence > 0 ? stall * (1 - recovery) + recovery : 1);
    stallMaterial.emissive.set(
      recovery > 0.4 ? SERVICE.recovered : silence > 0 ? SERVICE.unknown : SERVICE.electricity,
    );
    stallMaterial.emissiveIntensity = utilityLevel * 4;
    if (utilityLight.current) utilityLight.current.intensity = utilityLevel * 5;

    // Security: settles to a steady verified state once approved.
    if (securityMat.current) {
      securityMat.current.emissive.set(recovery > 0.3 ? SERVICE.verified : SERVICE.security);
      securityMat.current.emissiveIntensity = security * (2.2 + recovery * 1.6);
    }

    // Roof: solar is a published service category, so it earns a real fixture.
    if (solarMat.current) solarMat.current.emissiveIntensity = continuum * 2.2;
  });

  return (
    <group ref={root}>
      {/* The twelve services the house was not previously showing, as ordinary
          objects rather than symbols. See ServiceFixtures.tsx. */}
      <ServiceFixtures />

      {/* ── Ground and courtyard ─────────────────────────────── */}
      {/*
        The ground carries a texture for one reason: on the arrival shot it is
        a third of the frame, and a single flat colour that large announces the
        render before the house gets a chance to speak. The limestone maps are
        reused at a coarse tiling and tinted to planting green, so the surface
        breaks up tonally the way mown ground does without needing its own map.
      */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[140, 90]} />
        <meshStandardMaterial {...groundMaps} color="#93a083" roughness={0.97} envMapIntensity={0.5} />
      </mesh>
      {/* A paved apron under the cantilever, so the house meets the site on a
          hard edge rather than floating on lawn. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, 0.0, 7.4]} receiveShadow>
        <planeGeometry args={[46, 5.6]} />
        <meshStandardMaterial {...groundMaps} color={MATERIAL.limestone} roughness={0.72} envMapIntensity={0.7} />
      </mesh>
      {/* reflecting pool along the courtyard side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.01, 9.5]} receiveShadow>
        <planeGeometry args={[26, 4.5]} />
        <meshPhysicalMaterial color="#3f5c6b" roughness={0.05} metalness={0.35} envMapIntensity={1.6} />
      </mesh>
      {/*
        The planting — treeline mass behind the house, specimens in the
        courtyard. Placement logic lives with the canopy construction in
        Vegetation.tsx: the icosahedron trees that used to stand here were the
        single most-cited "this is fake" tell on the page, because a
        flat-shaded polyhedron does not behave like foliage at any distance.
        The replacements are alpha-tested leaf cards with wind — one draw call
        for every canopy in the scene.
      */}
      <Vegetation />

      {/* ── Slab, roof plane, back wall — the long horizontal gesture ── */}
      <Floor position={[-1, 0.02, 0]} size={[40, 12]} color={MATERIAL.limestone} maps={limestone} />
      {/* oak in the living volume */}
      <Floor position={[-2, 0.03, -1]} size={[9, 9]} color={MATERIAL.oak} maps={oak} />
      {/*
        Roof, in two slabs with a rooflight slot between them.

        This is the change that finally got sunlight into the house. Measuring
        the sun ray against the scene showed direct light reaching the floor
        only between z=+6 and z=+1.3 — the strip just inside the glass — because
        a solid 15m-deep slab shades everything beyond it. Every camera station
        stands around z=0 and looks toward z=−3, so the lit floor was always
        behind the lens. The rooms were lit entirely by ambient and IBL, which
        is why they read as a clay model however the exposure was tuned.

        A deep-plan house solves this the same way: you cut a slot. The width is
        arithmetic, not taste — a ray leaving the back wall has to clear the far
        slab's leading edge before it rises past the slab's own thickness, and
        at 1.2m the first attempt grazed that corner and stayed shadowed. At
        2.5m the light drops through cleanly and lands as a band roughly 60cm to
        1.4m up the back wall, directly in the view of every interior shot,
        with the joists and glazing bars breaking it into bars. That rhythm of
        light is the thing the reference photography is actually made of.
      */}
      {(
        [
          [-4.05, 4.9],
          [4.7, 7.6],
        ] as const
      ).map(([z, depth]) => (
        <mesh key={z} name={giName("roof", [-1, 3.42, z])} position={[-1, 3.42, z]} castShadow receiveShadow>
          <boxGeometry args={[42, 0.35, depth, 84, 1, Math.max(1, Math.round(depth / GI_GRID))]} />
          <meshStandardMaterial {...ceilingMaps} color={MATERIAL.concrete} roughness={0.92} envMapIntensity={0.7} />
        </mesh>
      ))}
      {/*
        Roof finish.

        The slab's top face was the same pale plaster as its underside, and on
        the approach that meant a 42m band of near-white clipping to paper
        across the top third of the frame. No roof is finished in the same
        material as the ceiling below it — this is the weathered membrane a flat
        roof actually carries, laid 1cm proud of the slab so the two never share
        a plane.
      */}
      {(
        [
          [-4.05, 4.9],
          [4.7, 7.6],
        ] as const
      ).map(([z, depth]) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[-1, 3.605, z]} receiveShadow>
          <planeGeometry args={[42, depth]} />
          <meshStandardMaterial color="#8f8b83" roughness={0.94} envMapIntensity={0.5} />
        </mesh>
      ))}

      {/* Glazing bars across the slot. They are structure, and they are also
          what turns one wash of light into a measured rhythm of it. */}
      {Array.from({ length: 15 }, (_, i) => -18.5 + i * 2.6).map((x) => (
        <mesh key={x} position={[x, 3.36, -0.35]} castShadow>
          <boxGeometry args={[0.075, 0.11, 2.5]} />
          {/* Mill-finish aluminium, not charcoal. Seen from directly below
              against open sky these are pure silhouette, and at charcoal they
              read as a row of black voids punched through the ceiling rather
              than as the framing of a rooflight. */}
          <meshStandardMaterial color="#a9aeb4" roughness={0.42} metalness={0.7} envMapIntensity={1.3} />
        </mesh>
      ))}
      {/*
        Exposed walnut joists at 1.6m centres.

        An interior's ceiling is roughly a quarter of every frame shot at eye
        height, and a single untextured plane up there reads as an unfinished
        render however good the floor is. Structure fixes it three ways at once:
        it gives the plane a scale reference, it casts the long parallel shadows
        that tell the eye the light has a direction, and it carries the horizon
        line down the length of the house so the rooms feel connected.
      */}
      {/*
        Joists stop either side of the rooflight rather than running through it.
        They were spanning the full 11.6m depth, which put a timber grille
        directly under the slot and strangled the light down to a thin line. No
        roof is framed that way — the joists are trimmed around an opening and
        the rooflight sits in the gap.

        They also stop 4cm short of the slab edge rather than flush with it. Cut
        to the exact edge, the joist's end face and the slab's end face land on
        one plane, and coplanar same-facing surfaces are a depth-buffer tie —
        which would strobe along the whole rooflight, in the one place the
        camera is looking up.

        And they hang 2cm clear of the ceiling rather than buried in it. At
        y=3.18 they spanned 3.08 to 3.28 while the ceiling underside sits at
        3.245, so every joist drove 3.5cm up into the slab. That is invisible
        from below — until the GI bake runs, at which point every ceiling vertex
        that landed inside a joist was fully enclosed, returned zero irradiance
        because every ray it cast hit the inside of a beam, and interpolated
        into a wide black band across the ceiling. A shadow gap is also simply
        how exposed joists are detailed.
      */}
      {Array.from({ length: 19 }, (_, i) => -19.2 + i * 1.94).flatMap((x) =>
        (
          [
            [-3.54, 3.72],
            [3.59, 5.22],
          ] as const
        ).map(([z, depth]) => (
        <mesh key={`${x}:${z}`} position={[x, 3.125, z]} castShadow receiveShadow>
          <boxGeometry args={[0.13, 0.2, depth]} />
          {/*
            Pale oak and no texture map. Walnut turned the ceiling into a dark
            grid that fought the room for attention, and a map tiled for a 2m
            panel moirés badly when stretched down an 11m joist. At this
            distance the grain is below a pixel anyway — the joist's job here is
            rhythm and shadow, not material detail.
          */}
          <meshStandardMaterial color="#c8ae86" roughness={0.7} envMapIntensity={0.9} />
        </mesh>
        )),
      )}
      <Wall position={[-1, 1.7, -5.9]} size={[40, 3.4, 0.3]} />

      {/* ── GARAGE — the partner handoff ─────────────────────── */}
      <Wall position={[-20.8, 1.7, 0]} size={[0.3, 3.4, 12]} />
      <Wall position={[-13.4, 1.7, -2.6]} size={[0.3, 3.4, 6.8]} />
      {/* open garage door header */}
      <Wall position={[-17, 3.05, 5.8]} size={[7.4, 0.7, 0.3]} />
      {/*
        Moving boxes. Three identical cartons in an otherwise empty concrete bay
        read as three primitives; a real moving day is a stack of mismatched
        sizes, some closed, some open, leaning against each other. The variation
        is what makes the room look inhabited on the morning the keys change
        hands — which is the entire premise of this chapter.
      */}
      {(
        [
          [-18.4, 0.4, 3.2, 0.35, 0.82, 0.78],
          [-17.5, 0.34, 2.5, 0.2, 0.68, 0.66],
          [-19.25, 0.31, 1.7, -0.4, 0.74, 0.6],
          [-18.35, 1.09, 3.15, 0.12, 0.66, 0.56],
          [-19.3, 0.86, 1.62, -0.22, 0.6, 0.5],
          [-17.15, 0.28, 1.35, 0.62, 0.56, 0.54],
          [-19.7, 0.36, 3.5, -0.15, 0.7, 0.7],
        ] as const
      ).map(([x, y, z, r, w, h], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0, r, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, h, w * 0.86]} />
          {/* Alternating card tones — one carton colour across a whole stack
              is the tell that they came out of a loop. */}
          <meshStandardMaterial color={i % 3 === 0 ? "#c2a179" : i % 3 === 1 ? "#b8946c" : "#cbab84"} roughness={0.95} />
        </mesh>
      ))}
      {/* the referral key — the agent's handoff, made physical. It sits over
          the stack rather than out on the empty wall, so the shot that frames
          the boxes frames the key with them. */}
      <mesh position={[-18.35, 1.62, 3.15]}>
        <torusGeometry args={[0.17, 0.045, 10, 24]} />
        <meshStandardMaterial
          ref={garageKey}
          color={MATERIAL.metal}
          emissive={SERVICE.verified}
          emissiveIntensity={0}
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>

      {/* ── FOYER — the Move Digital Twin ────────────────────── */}
      {/* entry portal */}
      {[-11.9, -6.1].map((x) => (
        <Wall key={x} position={[x, 1.7, 5.85]} size={[0.35, 3.4, 0.35]} />
      ))}
      {/* the canonical record, suspended in the double-height entry */}
      <mesh position={[-9, 2.1, 1.4]}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshStandardMaterial
          ref={foyerCore}
          color="#f2efe9"
          emissive={SERVICE.conflict}
          emissiveIntensity={0}
          wireframe
        />
      </mesh>
      <pointLight ref={foyerLight} position={[-9, 2.1, 1.4]} color={SERVICE.conflict} intensity={0} distance={9} decay={2} />

      {/* ── LIVING — internet and connectivity ───────────────── */}
      {/* sunken seating: sofa, rug, console */}
      {/* 4.3 wide, not 5.4: at 5.4 this rug ran under the dining rug at the
          same height, and two coplanar planes overlapping by ~0.5 x 2.2m is the
          largest depth-fighting surface the scene had. They now stop short of
          each other with the circulation gap a real room would have. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.7, RUG_Y, -1.5]} receiveShadow>
        <planeGeometry args={[4.3, 4]} />
        <meshStandardMaterial color={MATERIAL.linen} roughness={0.98} />
      </mesh>
      <Sofa position={[-3.6, FURNITURE_Y, -3.35]} />
      {/*
        Floor density.

        The circulation band read as an empty white void, and the fix is two
        things rather than one. The limestone itself was clipping to paper under
        a 3.6 sun and taking its own texture with it, which is handled in the
        palette. The rest is that a real room has mass at floor level — a lamp
        beside the sofa, a table at the other arm, an ottoman off-axis, a basket
        by the console — and without any of it the eye has nothing to measure
        the floor against, so it reads as a plane rather than a room.

        Every one of these sits in the far band, z between −1.9 and −3.8. The
        camera walks the corridor at z ≈ 0.2 to 1.5 and a real house does not
        put furniture in a walkway, so the objects fill the frame without ever
        standing in the shot.
      */}
      <FloorLamp position={[-5.45, FURNITURE_Y, -3.5]} />
      <SideTable position={[-1.95, FURNITURE_Y, -3.25]} />
      <Ottoman position={[-1.75, FURNITURE_Y, -2.35]} rotation={0.22} />
      <Basket position={[-1.88, FURNITURE_Y, -3.78]} scale={0.95} />
      {/*
        A runner down the circulation axis. This is the one piece of floor the
        camera actually crosses, so it gets a rug rather than an obstacle — and
        it sits at z 0.8 to 2.6, clear of both the seating rug (which ends at
        0.5) and the dining rug (which ends at −1.3), so no two rugs share a
        plane and fight for it.
      */}
      <Rug position={[-1.5, RUG_Y, 1.7]} size={[9.5, 1.8]} color="#bfb6a6" />
      {/* walnut console with the router — internet's diegetic fixture */}
      <group position={[-0.6, 0, -3.9]}>
        <Sideboard position={[0, FURNITURE_Y, 0]} />
        <mesh position={[0.55, 0.74, 0]} castShadow>
          <boxGeometry args={[0.26, 0.06, 0.18]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh position={[0.63, 0.78, 0.05]}>
          <sphereGeometry args={[0.017, 10, 10]} />
          <meshStandardMaterial ref={routerLed} color={SERVICE.internet} emissive={SERVICE.internet} emissiveIntensity={0} />
        </mesh>
      </group>
      {/* floor lamp */}
      <group position={[-5.6, 0, -3.9]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.028, 0.028, 1.5, 8]} />
          <meshStandardMaterial color={MATERIAL.charcoal} metalness={0.65} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.62, 0]}>
          <cylinderGeometry args={[0.15, 0.22, 0.34, 20, 1, true]} />
          <meshStandardMaterial
            ref={livingLamp}
            color="#f5ead6"
            emissive={LIGHT.practical}
            emissiveIntensity={0}
            side={THREE.DoubleSide}
            roughness={0.9}
          />
        </mesh>
        <pointLight
          ref={livingLight}
          position={[0, 1.6, 0]}
          color={LIGHT.practical}
          intensity={0}
          distance={9}
          decay={2}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-normalBias={0.04}
          shadow-radius={4}
          shadow-camera-near={0.12}
          shadow-camera-far={10}
        />
      </group>

      {/* ── KITCHEN — electricity, gas, water ────────────────── */}
      <group position={[5, 0, -2.2]}>
        {/*
          Island.

          It was one 3.4m walnut box, which is a plinth, not cabinetry. Real
          joinery at this size is a run of doors with shadow gaps between them,
          set back above a recessed toe kick so the whole thing appears to float
          rather than sit in a puddle of its own colour. Those two lines — the
          vertical gaps and the dark reveal at the floor — are what the eye uses
          to read a kitchen, and neither costs meaningful geometry.
        */}
        {/* recessed toe kick */}
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <boxGeometry args={[3.24, 0.12, 1.0]} />
          <meshStandardMaterial color="#2e241b" roughness={0.8} />
        </mesh>
        {/* carcass */}
        <mesh position={[0, 0.53, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.82, 1.15]} />
          <meshStandardMaterial {...walnut} color="#4a3320" envMapIntensity={0.8} />
        </mesh>
        {/* door fronts, proud of the carcass with a gap between each */}
        {[-1.275, -0.425, 0.425, 1.275].map((x) => (
          <mesh key={x} position={[x, 0.53, 0.585]} castShadow>
            <boxGeometry args={[0.8, 0.78, 0.022]} />
            <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
          </mesh>
        ))}
        {/* slim finger pulls along the top of each door */}
        {[-1.275, -0.425, 0.425, 1.275].map((x) => (
          <mesh key={x} position={[x, 0.9, 0.598]}>
            <boxGeometry args={[0.62, 0.012, 0.008]} />
            <meshStandardMaterial color="#221c15" roughness={0.7} />
          </mesh>
        ))}
        {/* worktop, overhanging the fronts */}
        <mesh position={[0, 0.955, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 0.06, 1.3]} />
          <meshStandardMaterial {...stone} color="#efece6" metalness={0.18} roughness={0.22} envMapIntensity={1.6} />
        </mesh>
        {/* tap + water */}
        <mesh position={[-1.1, 1.22, 0]} castShadow>
          <cylinderGeometry args={[0.026, 0.026, 0.48, 10]} />
          <meshStandardMaterial color={MATERIAL.metal} metalness={0.9} roughness={0.15} envMapIntensity={1.6} />
        </mesh>
        <mesh position={[-1.1, 0.86, 0]}>
          <cylinderGeometry args={[0.012, 0.02, 0.6, 8]} />
          <meshStandardMaterial
            ref={waterMat}
            color={SERVICE.water}
            emissive={SERVICE.water}
            emissiveIntensity={0}
            transparent
            opacity={0.55}
          />
        </mesh>
        {/*
          Pendants.

          These were one cone, double-sided, with the emissive applied to the
          whole thing — so the painted outside of the shade glowed exactly as
          hard as the lit inside, and at any real intensity the entire fitting
          clipped to a white blob that bloom then smeared across the counter.

          A lamp is not a glowing object. It is an opaque shade lit from within:
          the outside takes only room light, the inside is bright, and the bulb
          is brighter still. Splitting it into those three surfaces is what lets
          the intensity go up without the shade blowing out — and it puts a real
          tonal gradient down the cone, which is most of what makes a pendant
          read as a metal object rather than a light source.
        */}
        {[-0.9, 0.9].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2.6, 0]}>
              <cylinderGeometry args={[0.011, 0.011, 1.3, 6]} />
              <meshStandardMaterial color={MATERIAL.charcoal} />
            </mesh>
            {/* ceiling rose */}
            <mesh position={[0, 3.24, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
              <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* outer shell — painted, never emissive */}
            <mesh position={[0, 1.92, 0]} castShadow>
              <coneGeometry args={[0.24, 0.28, 24, 1, true]} />
              <meshStandardMaterial
                color="#efe6d6"
                side={THREE.FrontSide}
                roughness={0.42}
                metalness={0.15}
                envMapIntensity={1.2}
              />
            </mesh>
            {/* inner surface — this is the part that lights */}
            <mesh position={[0, 1.921, 0]}>
              <coneGeometry args={[0.236, 0.275, 24, 1, true]} />
              <primitive object={pendantLit} attach="material" />
            </mesh>
            {/* the bulb, just inside the mouth */}
            <mesh position={[0, 1.86, 0]}>
              <sphereGeometry args={[0.052, 14, 10]} />
              <primitive object={pendantBulb} attach="material" />
            </mesh>
          </group>
        ))}
        {/*
          The pendants cast. Without this the island and stools are lit but
          throw nothing, so the counter floats and the stools have no contact
          with the floor — the same weightlessness the building had before it
          got a ground shadow.

          Point-light shadows render six cube faces, so the map stays small and
          the range is clamped to the room. normalBias rather than bias:
          on thin geometry like a 5cm counter slab, a flat bias detaches the
          shadow from the object that casts it.
        */}
        <pointLight
          ref={kitchenLight}
          position={[0, 2.0, 0]}
          color={LIGHT.practical}
          intensity={0}
          distance={10}
          decay={2}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-normalBias={0.04}
          shadow-radius={4}
          shadow-camera-near={0.15}
          shadow-camera-far={11}
        />
        {/* back run — same construction as the island: toe kick, carcass,
            separate fronts with gaps, worktop overhanging the lot. */}
        <mesh position={[0, 0.06, -3.28]} receiveShadow>
          <boxGeometry args={[5.24, 0.12, 0.5]} />
          <meshStandardMaterial color="#2e241b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.53, -3.2]} castShadow receiveShadow>
          <boxGeometry args={[5.4, 0.82, 0.65]} />
          <meshStandardMaterial {...walnut} color="#4a3320" envMapIntensity={0.8} />
        </mesh>
        {[-2.05, -1.23, -0.41, 0.41, 1.23, 2.05].map((x) => (
          <mesh key={x} position={[x, 0.53, -2.86]} castShadow>
            <boxGeometry args={[0.78, 0.78, 0.022]} />
            <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
          </mesh>
        ))}
        {[-2.05, -1.23, -0.41, 0.41, 1.23, 2.05].map((x) => (
          <mesh key={x} position={[x, 0.9, -2.847]}>
            <boxGeometry args={[0.6, 0.012, 0.008]} />
            <meshStandardMaterial color="#221c15" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, 0.955, -3.2]} castShadow receiveShadow>
          <boxGeometry args={[5.5, 0.06, 0.72]} />
          <meshStandardMaterial {...stone} color="#efece6" metalness={0.18} roughness={0.22} envMapIntensity={1.6} />
        </mesh>

        {/*
          The fridge.

          It was a single grey box 0.9 x 2.3 x 0.75 — the shape of a fridge and
          nothing else about one. A tall appliance is read from three things: the
          split between fridge and freezer, the vertical handles beside that
          split, and the fact that its doors are inset in a surround rather than
          being the outside of the box. The brushed finish also has to be
          anisotropic-ish — high metalness with mid roughness, so it takes the
          window as a soft vertical smear instead of a mirror dot.
        */}
        <group position={[3.1, 0, -3.2]}>
          {/* housing */}
          <mesh position={[0, 1.15, -0.02]} castShadow receiveShadow>
            <boxGeometry args={[0.94, 2.3, 0.72]} />
            <meshStandardMaterial color="#7b8189" roughness={0.45} metalness={0.55} envMapIntensity={1.1} />
          </mesh>
          {/* two doors, inset, with a shadow gap between them */}
          {(
            [
              [1.615, 1.29],
              [0.5, 0.88],
            ] as const
          ).map(([cy, h]) => (
            <mesh key={cy} position={[0, cy, 0.35]} castShadow receiveShadow>
              <boxGeometry args={[0.88, h, 0.04]} />
              <meshStandardMaterial
                color="#c8ced6"
                roughness={0.34}
                metalness={0.86}
                envMapIntensity={1.7}
              />
            </mesh>
          ))}
          {/* vertical bar handles, both on the same side of the split */}
          {[1.42, 0.78].map((y) => (
            <mesh key={y} position={[0.33, y, 0.4]} castShadow>
              <cylinderGeometry args={[0.014, 0.014, y > 1 ? 0.66 : 0.44, 10]} />
              <meshStandardMaterial color="#8f959c" roughness={0.22} metalness={0.95} envMapIntensity={1.8} />
            </mesh>
          ))}
          {/* plinth so it meets the floor the way the cabinets do */}
          <mesh position={[0, 0.05, 0.1]} receiveShadow>
            <boxGeometry args={[0.9, 0.1, 0.5]} />
            <meshStandardMaterial color="#2e241b" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* ── UTILITY — the room the silence catches ───────────── */}
      {/*
        The dividing wall carries a real doorway. Without it the camera walked
        from the kitchen into solid concrete and framed blank plaster for the
        whole transition — a room the walk must pass through needs a way in.
        Two piers and a header, with a 1.15m opening between them.
      */}
      <Wall position={[9.2, 1.7, -4.15]} size={[0.3, 3.4, 3.7]} />
      <Wall position={[9.2, 1.7, -0.15]} size={[0.3, 3.4, 2.1]} />
      {/* 0.28 deep, not 0.30 — flush with the wall it sits in would put four
          faces on two shared planes. */}
      <Wall position={[9.2, 2.95, -1.77]} size={[0.28, 0.9, 1.15]} />
      {/* door lining, so the opening reads as an opening */}
      {[-2.32, -1.22].map((z) => (
        <mesh key={z} position={[9.2, 1.25, z]} castShadow receiveShadow>
          <boxGeometry args={[0.36, 2.5, 0.08]} />
          <meshStandardMaterial color="#f2efe9" roughness={0.5} envMapIntensity={1.1} />
        </mesh>
      ))}
      <group position={[11.6, 0, -3.2]}>
        {/* washer + dryer stack */}
        {[-0.75, 0.75].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.72, 0.88, 0.7]} />
              <meshStandardMaterial color="#e9e6e0" roughness={0.35} metalness={0.15} envMapIntensity={1.2} />
            </mesh>
            <mesh position={[0, 0.52, 0.36]}>
              <circleGeometry args={[0.21, 24]} />
              <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.2} metalness={0.5} />
            </mesh>
          </group>
        ))}
        {/*
          The consumer unit — the fixture that stalls, and the single most
          important object in the film.

          It used to be a flat emissive rectangle on a grey box, and the chapter
          that carries the whole UNKNOWN story was resting on a colour swatch.
          A real unit is an enclosure, a DIN rail, and a row of individually
          switched breakers, and building it that way makes the narrative
          literal rather than symbolic: "the circuit stalls half-lit" stops
          being a metaphor when you can see which breakers came up and which
          row is still waiting on a provider that never answered.

          The shared `utilityLed` material drives only the stalled row, so the
          existing state animation keeps working untouched.
        */}
        <group position={[0, 1.3, -0.28]}>
          {/* enclosure and recessed door frame */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.46, 0.11]} />
            <meshStandardMaterial color="#d9d6d0" roughness={0.42} metalness={0.18} envMapIntensity={1.1} />
          </mesh>
          <mesh position={[0, 0, 0.056]} receiveShadow>
            <boxGeometry args={[0.52, 0.38, 0.012]} />
            <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.55} metalness={0.25} />
          </mesh>
          {/* two DIN rails */}
          {[0.077, -0.077].map((y) => (
            <mesh key={y} position={[0, y, 0.064]}>
              <boxGeometry args={[0.48, 0.022, 0.014]} />
              <meshStandardMaterial color="#8c9099" roughness={0.35} metalness={0.7} />
            </mesh>
          ))}
          {/*
            Twelve breakers, six per rail. The upper rail is the household
            circuits and is simply on; the lower rail is the provider-dependent
            one, and its indicators carry the shared stall material.
          */}
          {([0.077, -0.077] as const).map((railY, rail) =>
            Array.from({ length: 6 }, (_, i) => {
              const x = -0.2 + i * 0.08;
              const stalled = rail === 1;
              return (
                <group key={`${rail}-${i}`} position={[x, railY, 0.076]}>
                  {/* body */}
                  <mesh castShadow>
                    <boxGeometry args={[0.066, 0.115, 0.05]} />
                    <meshStandardMaterial color="#efece6" roughness={0.5} envMapIntensity={0.9} />
                  </mesh>
                  {/* toggle — the stalled rail sits down, the live rail up */}
                  <mesh position={[0, stalled ? -0.026 : 0.026, 0.032]} castShadow>
                    <boxGeometry args={[0.03, 0.042, 0.022]} />
                    <meshStandardMaterial color={stalled ? "#b9bcc2" : "#3c4149"} roughness={0.45} />
                  </mesh>
                  {/* indicator */}
                  <mesh position={[0, 0.044, 0.027]}>
                    <planeGeometry args={[0.03, 0.012]} />
                    {stalled ? (
                      <primitive object={stallMaterial} attach="material" />
                    ) : (
                      <meshStandardMaterial color="#1a1d22" emissive={SERVICE.verified} emissiveIntensity={1.6} />
                    )}
                  </mesh>
                </group>
              );
            }),
          )}
        </group>
        <pointLight
          ref={utilityLight}
          position={[0, 1.9, 0.6]}
          color={LIGHT.practical}
          intensity={0}
          distance={7}
          decay={2}
          castShadow
          shadow-mapSize={[512, 512]}
          shadow-normalBias={0.04}
          shadow-radius={4}
          shadow-camera-near={0.15}
          shadow-camera-far={8}
        />
        {/* counter over the machines */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <boxGeometry args={[2.4, 0.07, 0.78]} />
          <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
        </mesh>
      </group>

      {/* ── ENTRY / SECURITY ─────────────────────────────────── */}
      <group position={[-6.35, 2.15, 5.7]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.22, 0.07]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.45} />
        </mesh>
        {/* The indicator faces into the house, not out at the street. It was
            on the +z face, which is the side nobody standing in their own
            hallway can see — so the one shot of the security fixture was a shot
            of the back of it. A real entry sensor shows you its status as you
            come in. */}
        <mesh position={[0, 0, -0.045]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial ref={securityMat} color={SERVICE.security} emissive={SERVICE.security} emissiveIntensity={0} />
        </mesh>
      </group>

      {/* ── STAIR + ROOF ENERGY ──────────────────────────────── */}
      <group position={[15.4, 0, -1]}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[0, 0.19 + i * 0.19, -i * 0.29]} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.1, 0.3]} />
            <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
          </mesh>
        ))}
      </group>
      {/*
        Solar array, on the slab and clear of the rooflight.

        It was at z −1.9, which put three 2x3m near-black panels directly over
        the slot at z −1.6 to 0.9 — so the foyer's view up through its own
        rooflight was the underside of the array, and the ceiling read as a row
        of black rectangles. It reads as a lighting bug and it is a placement
        bug: the one opening in the roof had the one opaque thing on the roof
        parked on top of it.

        Now at z −4.2, sitting entirely on the deep slab, and raised to 3.88 so
        the tilted panels clear the roof membrane rather than slicing through
        it — which is also how an array is really mounted, on rails above the
        finish.
      */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-13.6 + i * 2.3, 3.88, -4.2]} rotation={[-0.16, 0, 0]} castShadow>
          <boxGeometry args={[2.0, 0.06, 3.0]} />
          <meshStandardMaterial
            ref={i === 1 ? solarMat : undefined}
            color="#1e2733"
            emissive={SERVICE.solar}
            emissiveIntensity={0}
            roughness={0.25}
            metalness={0.6}
            envMapIntensity={1.4}
          />
        </mesh>
      ))}

      {/* ── Furnishing ───────────────────────────────────────
          Real dimensions throughout (see Furniture.tsx). These are also what
          give each chapter a subject — several camera stations were framing
          blank plaster because the rooms had walls but nothing in them. */}

      {/* Foyer: a runner, a planter, and art to look at on approach */}
      <Rug position={[-9, RUG_Y, 3.2]} size={[2.2, 5.5]} color="#cdc4b6" />
      <Planter position={[-11.4, FURNITURE_Y, 0.6]} scale={1.1} />
      <Artwork position={[-9, 1.75, -5.7]} w={1.5} h={1.05} tone="#7f8f93" />

      {/* Living: coffee table on the rug, shelving on the back wall, planting */}
      <CoffeeTable position={[-3.4, FURNITURE_Y, -1.9]} />
      <Shelving position={[-7.6, FURNITURE_Y, -5.5]} />
      {/* Against the wall, not in the walking line — a planter parked in the
          circulation path becomes a green wall across every mid-house shot. */}
      <Planter position={[-0.5, FURNITURE_Y, -5.1]} scale={0.9} />
      <Artwork position={[-4.6, 1.85, -5.72]} w={1.1} h={1.4} tone="#8a7f6c" />

      {/* Dining — the room between living and kitchen. Its absence was the
          dead zone the mid-house camera kept pointing into. */}
      <Rug position={[1.4, RUG_Y, -2.6]} size={[3.4, 2.6]} color="#c4bcae" />
      <DiningTable position={[1.4, FURNITURE_Y, -2.6]} />
      <Chair position={[0.55, FURNITURE_Y, -1.85]} rotation={Math.PI} />
      <Chair position={[1.4, FURNITURE_Y, -1.85]} rotation={Math.PI} />
      <Chair position={[2.25, FURNITURE_Y, -1.85]} rotation={Math.PI} />
      <Chair position={[0.55, FURNITURE_Y, -3.35]} />
      <Chair position={[1.4, FURNITURE_Y, -3.35]} />
      <Chair position={[2.25, FURNITURE_Y, -3.35]} />

      {/* Kitchen: stools at the island */}
      <Stool position={[4.1, FURNITURE_Y, -1.35]} />
      <Stool position={[5.0, FURNITURE_Y, -1.35]} />
      <Stool position={[5.9, FURNITURE_Y, -1.35]} />

      {/* Utility: a planter softens the hardest-working room, set back
          against the dividing wall so it never crosses the walk */}
      <Planter position={[9.6, FURNITURE_Y, -4.6]} scale={0.8} />

      {/* ── Courtyard glazing — the long sightline ───────────── */}
      <Glazing x={-2} z={5.9} width={16} />
      <Glazing x={11} z={5.9} width={8} />
    </group>
  );
}
