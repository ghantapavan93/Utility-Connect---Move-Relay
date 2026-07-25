"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { MATERIAL, SERVICE, LIGHT } from "./palette";

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
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.02} envMapIntensity={0.8} />
    </mesh>
  );
}

function Floor({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number];
  color: string;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.04} envMapIntensity={0.9} />
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
  const utilityLed = useRef<THREE.MeshStandardMaterial>(null);
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
    if (utilityLed.current) {
      utilityLed.current.emissive.set(
        recovery > 0.4 ? SERVICE.recovered : silence > 0 ? SERVICE.unknown : SERVICE.electricity,
      );
      utilityLed.current.emissiveIntensity = utilityLevel * 4;
    }
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[140, 90]} />
        <meshStandardMaterial color="#8f9689" roughness={0.95} envMapIntensity={0.5} />
      </mesh>
      {/* reflecting pool along the courtyard side */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2, 0.01, 9.5]} receiveShadow>
        <planeGeometry args={[26, 4.5]} />
        <meshPhysicalMaterial color="#3f5c6b" roughness={0.05} metalness={0.35} envMapIntensity={1.6} />
      </mesh>
      {/* planting */}
      {[-19, -13, 8, 14, 19].map((x) => (
        <group key={x} position={[x, 0, 12]}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.12, 1.8, 8]} />
            <meshStandardMaterial color={MATERIAL.walnut} roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.2, 0]} castShadow>
            <icosahedronGeometry args={[1.1, 1]} />
            <meshStandardMaterial color={MATERIAL.foliage} roughness={0.95} flatShading />
          </mesh>
        </group>
      ))}

      {/* ── Slab, roof plane, back wall — the long horizontal gesture ── */}
      <Floor position={[-1, 0.02, 0]} size={[40, 12]} color={MATERIAL.limestone} />
      {/* oak in the living volume */}
      <Floor position={[-2, 0.03, -1]} size={[9, 9]} color={MATERIAL.oak} />
      {/* roof plane, cantilevered */}
      <mesh position={[-1, 3.42, 1]} castShadow>
        <boxGeometry args={[42, 0.35, 15]} />
        <meshStandardMaterial color={MATERIAL.concreteShadow} roughness={0.9} envMapIntensity={0.7} />
      </mesh>
      <Wall position={[-1, 1.7, -5.9]} size={[40, 3.4, 0.3]} />

      {/* ── GARAGE — the partner handoff ─────────────────────── */}
      <Wall position={[-20.8, 1.7, 0]} size={[0.3, 3.4, 12]} />
      <Wall position={[-13.4, 1.7, -2.6]} size={[0.3, 3.4, 6.8]} />
      {/* open garage door header */}
      <Wall position={[-17, 3.05, 5.8]} size={[7.4, 0.7, 0.3]} />
      {/* moving boxes */}
      {([[-18.4, 0.4, 3.2, 0.35], [-17.4, 0.35, 2.4, 0.2], [-19.2, 0.3, 1.6, -0.4]] as const).map(
        ([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0, r, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.7, 0.7]} />
            <meshStandardMaterial color="#c2a179" roughness={0.95} />
          </mesh>
        ),
      )}
      {/* the referral key — the agent's handoff, made physical */}
      <mesh position={[-17, 1.35, 2.2]}>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.5, 0.04, -1.5]} receiveShadow>
        <planeGeometry args={[5.4, 4]} />
        <meshStandardMaterial color={MATERIAL.linen} roughness={0.98} />
      </mesh>
      <group position={[-3.6, 0, -3.4]}>
        <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.0, 0.4, 1.0]} />
          <meshStandardMaterial color={MATERIAL.linen} roughness={0.95} envMapIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.68, -0.42]} castShadow>
          <boxGeometry args={[3.0, 0.58, 0.2]} />
          <meshStandardMaterial color={MATERIAL.linen} roughness={0.95} />
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
        <pointLight ref={livingLight} position={[0, 1.6, 0]} color={LIGHT.practical} intensity={0} distance={9} decay={2} castShadow />
      </group>

      {/* ── KITCHEN — electricity, gas, water ────────────────── */}
      <group position={[5, 0, -2.2]}>
        {/* island */}
        <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 0.92, 1.15]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} envMapIntensity={0.9} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[3.6, 0.07, 1.3]} />
          <meshStandardMaterial color="#efece6" roughness={0.18} metalness={0.2} envMapIntensity={1.5} />
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
        <pointLight ref={kitchenLight} position={[0, 2.0, 0]} color={LIGHT.practical} intensity={0} distance={10} decay={2} />
        {/* back run + tall units */}
        <mesh position={[0, 0.46, -3.2]} castShadow receiveShadow>
          <boxGeometry args={[5.4, 0.92, 0.65]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.95, -3.2]}>
          <boxGeometry args={[5.5, 0.07, 0.72]} />
          <meshStandardMaterial color="#efece6" roughness={0.18} metalness={0.2} envMapIntensity={1.5} />
        </mesh>
        <mesh position={[3.1, 1.15, -3.2]} castShadow>
          <boxGeometry args={[0.9, 2.3, 0.75]} />
          <meshStandardMaterial color={MATERIAL.metal} roughness={0.28} metalness={0.8} envMapIntensity={1.5} />
        </mesh>
      </group>

      {/* ── UTILITY — the room the silence catches ───────────── */}
      <Wall position={[9.2, 1.7, -2.6]} size={[0.3, 3.4, 6.8]} />
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
        {/* the circuit indicator — this is the fixture that stalls */}
        <mesh position={[0, 1.28, -0.3]} castShadow>
          <boxGeometry args={[0.5, 0.7, 0.14]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.28, -0.21]}>
          <planeGeometry args={[0.32, 0.5]} />
          <meshStandardMaterial
            ref={utilityLed}
            color="#1a1d22"
            emissive={SERVICE.electricity}
            emissiveIntensity={0}
          />
        </mesh>
        <pointLight ref={utilityLight} position={[0, 1.9, 0.6]} color={LIGHT.practical} intensity={0} distance={7} decay={2} />
        {/* counter over the machines */}
        <mesh position={[0, 0.92, 0]} castShadow>
          <boxGeometry args={[2.4, 0.07, 0.78]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} />
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
            <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} envMapIntensity={0.9} />
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

      {/* ── Courtyard glazing — the long sightline ───────────── */}
      <Glazing x={-2} z={5.9} width={16} />
      <Glazing x={11} z={5.9} width={8} />
    </group>
  );
}
