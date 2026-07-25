"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { MATERIAL, SERVICE, LIGHT } from "./palette";
import { DiningTable, Chair, Stool, CoffeeTable, Shelving, Planter, Artwork, Rug } from "./Furniture";
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

export const CHAPTER = {
  arrival: [0.0, 0.09],
  garage: [0.09, 0.2],
  foyer: [0.2, 0.32],
  living: [0.32, 0.45],
  kitchen: [0.45, 0.58],
  utility: [0.58, 0.68],
  security: [0.68, 0.76],
  silence: [0.76, 0.87],
  recovery: [0.87, 0.94],
  continuum: [0.94, 1.0],
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
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
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
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial {...maps} color={color} metalness={0.04} envMapIntensity={0.95} />
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
  const kitchenPendant = useRef<THREE.MeshStandardMaterial>(null);
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
    root.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material | undefined;
      const soft = mat?.transparent === true;
      m.castShadow = !soft;
      m.receiveShadow = !soft;
    });
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
    if (kitchenPendant.current) kitchenPendant.current.emissiveIntensity = kitchen * 3.2;
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
        Treeline behind the house.

        The arrival shot was giving 40% of its frame to flat sky, and the fix is
        not a longer lens — a 40m-long house cannot fill a frame vertically and
        still read as long. What removes empty sky in real property photography
        is that there is always something behind the building. This is a mass,
        not a set of trees: desaturated and cool, far enough back that the fog
        takes it, so it sits behind the residence instead of competing with it.
      */}
      {Array.from({ length: 26 }, (_, i) => {
        const x = -46 + i * 3.7;
        // Deterministic jitter — a perfectly even row reads as a fence.
        const j = Math.sin(i * 12.9898) * 43758.5453;
        const r = j - Math.floor(j);
        return { x, z: -24 - r * 9, h: 5.4 + r * 4.6, w: 2.2 + r * 1.5, i };
      }).map((t) => (
        <group key={t.i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h * 0.34, 0]}>
            <cylinderGeometry args={[0.16, 0.24, t.h * 0.68, 6]} />
            <meshStandardMaterial color="#5b5344" roughness={0.95} />
          </mesh>
          <mesh position={[0, t.h * 0.78, 0]}>
            <icosahedronGeometry args={[t.w, 1]} />
            <meshStandardMaterial color="#6d7d63" roughness={1} envMapIntensity={0.35} />
          </mesh>
        </group>
      ))}

      {/*
        Courtyard planting. These sit within a few metres of the arrival camera,
        which is why they get three canopy masses at a higher subdivision and no
        flat shading: a single flat-shaded icosahedron is readable as foliage at
        forty metres and unmistakably a polyhedron at five. Overlapping lobes of
        slightly different greens is what gives a canopy its silhouette.
      */}
      {[-19, -13, 8, 14, 19].map((x, i) => {
        const j = Math.sin(i * 78.233) * 43758.5453;
        const r = j - Math.floor(j);
        return (
          <group key={x} position={[x, 0, 12]} rotation={[0, r * Math.PI, 0]}>
            <mesh position={[0, 1.0, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.13, 2.0, 10]} />
              <meshStandardMaterial color={MATERIAL.walnut} roughness={0.9} />
            </mesh>
            {(
              [
                [0, 2.35, 0, 1.05, "#6f8560"],
                [0.52, 2.05, 0.3, 0.72, "#7d9068"],
                [-0.45, 2.6, -0.28, 0.62, "#627a56"],
              ] as const
            ).map(([px, py, pz, rad, tone], k) => (
              <mesh key={k} position={[px, py + r * 0.2, pz]} castShadow>
                <icosahedronGeometry args={[rad * (0.9 + r * 0.25), 3]} />
                <meshStandardMaterial color={tone} roughness={0.98} envMapIntensity={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* ── Slab, roof plane, back wall — the long horizontal gesture ── */}
      <Floor position={[-1, 0.02, 0]} size={[40, 12]} color={MATERIAL.limestone} maps={limestone} />
      {/* oak in the living volume */}
      <Floor position={[-2, 0.03, -1]} size={[9, 9]} color={MATERIAL.oak} maps={oak} />
      {/* roof plane, cantilevered */}
      <mesh position={[-1, 3.42, 1]} castShadow receiveShadow>
        <boxGeometry args={[42, 0.35, 15]} />
        <meshStandardMaterial {...ceilingMaps} color={MATERIAL.concrete} roughness={0.92} envMapIntensity={0.7} />
      </mesh>
      {/*
        Exposed walnut joists at 1.6m centres.

        An interior's ceiling is roughly a quarter of every frame shot at eye
        height, and a single untextured plane up there reads as an unfinished
        render however good the floor is. Structure fixes it three ways at once:
        it gives the plane a scale reference, it casts the long parallel shadows
        that tell the eye the light has a direction, and it carries the horizon
        line down the length of the house so the rooms feel connected.
      */}
      {Array.from({ length: 19 }, (_, i) => -19.2 + i * 1.94).map((x) => (
        <mesh key={x} position={[x, 3.18, 0.4]} castShadow receiveShadow>
          <boxGeometry args={[0.13, 0.2, 11.6]} />
          {/*
            Pale oak and no texture map. Walnut turned the ceiling into a dark
            grid that fought the room for attention, and a map tiled for a 2m
            panel moirés badly when stretched down an 11m joist. At this
            distance the grain is below a pixel anyway — the joist's job here is
            rhythm and shadow, not material detail.
          */}
          <meshStandardMaterial color="#c8ae86" roughness={0.7} envMapIntensity={0.9} />
        </mesh>
      ))}
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
      <group position={[-3.6, 0, -3.4]}>
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.4, 1.0]} />
          <meshStandardMaterial {...linen} color={MATERIAL.linen} envMapIntensity={0.75} />
        </mesh>
        {/* 2.88 rather than 3.0: a back exactly as wide as the seat puts their
            end faces on the same plane, and coplanar same-facing surfaces are
            a depth-buffer tie. Insetting it is also how upholstery is built. */}
        <mesh position={[0, 0.68, -0.42]} castShadow>
          <boxGeometry args={[2.88, 0.58, 0.2]} />
          <meshStandardMaterial {...linen} color={MATERIAL.linen} envMapIntensity={0.75} />
        </mesh>
      </group>
      {/* walnut console with the router — internet's diegetic fixture */}
      <group position={[-0.6, 0, -3.9]}>
        <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.68, 0.5]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.55} envMapIntensity={0.9} />
        </mesh>
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
        {/* island */}
        <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.92, 1.15]} />
          <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[3.6, 0.07, 1.3]} />
          <meshStandardMaterial {...stone} color="#efece6" metalness={0.18} envMapIntensity={1.6} />
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
        {/* pendants */}
        {[-0.9, 0.9].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2.6, 0]}>
              <cylinderGeometry args={[0.011, 0.011, 1.3, 6]} />
              <meshStandardMaterial color={MATERIAL.charcoal} />
            </mesh>
            <mesh position={[0, 1.92, 0]}>
              <coneGeometry args={[0.24, 0.28, 20, 1, true]} />
              <meshStandardMaterial
                ref={x < 0 ? kitchenPendant : undefined}
                color="#f5ead6"
                emissive={LIGHT.practical}
                emissiveIntensity={0}
                side={THREE.DoubleSide}
                roughness={0.88}
              />
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
        {/* back run + tall units */}
        <mesh position={[0, 0.46, -3.2]} castShadow receiveShadow>
          <boxGeometry args={[5.4, 0.92, 0.65]} />
          <meshStandardMaterial {...walnut} color={MATERIAL.walnut} envMapIntensity={0.95} />
        </mesh>
        <mesh position={[0, 0.95, -3.2]}>
          <boxGeometry args={[5.5, 0.07, 0.72]} />
          <meshStandardMaterial {...stone} color="#efece6" metalness={0.18} envMapIntensity={1.6} />
        </mesh>
        <mesh position={[3.1, 1.15, -3.2]} castShadow>
          <boxGeometry args={[0.9, 2.3, 0.75]} />
          <meshStandardMaterial color={MATERIAL.metal} roughness={0.28} metalness={0.8} envMapIntensity={1.5} />
        </mesh>
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
        <mesh position={[0, 0, 0.045]}>
          <sphereGeometry args={[0.022, 10, 10]} />
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
      {/* solar array on the roof plane */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[12.4 + i * 2.3, 3.63, -1.6]} rotation={[-0.16, 0, 0]} castShadow>
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
