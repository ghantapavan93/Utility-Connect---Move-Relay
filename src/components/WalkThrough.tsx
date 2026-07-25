"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, DepthOfField } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { motion, useScroll, useTransform, useReducedMotion, type MotionValue } from "framer-motion";
import * as THREE from "three";

/**
 * The walk-through.
 *
 * Scroll does not orbit a model here — it WALKS. The camera is at eye height
 * (1.62m), moves along a floor-level path from the street, up the steps,
 * through the door, and room to room, and looks where a person would look. The
 * scene is built at human scale around that path: you pass a doorway, the wall
 * fills your periphery, a lamp is beside you rather than across a lawn.
 *
 * That is the difference between "a render of a house" and "being in one", and
 * no amount of lighting on a distant exterior gets you there.
 *
 * Interior is real geometry — floor, ceiling, walls with actual door openings,
 * a kitchen island with a counter and stools, a sofa, a rug, a table lamp, a
 * pendant, a fridge, cabinetry. Each service in the story lights a real fixture
 * you stand next to: electric brings the lamps, internet the router's blink,
 * security the door sensor.
 */

// ---------------------------------------------------------------------------
// The walk path — position + look target at eye height
// ---------------------------------------------------------------------------

const EYE = 1.62;

interface Station {
  at: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov?: number;
}

const WALK: Station[] = [
  // On the street. Far enough back that the whole house reads before the walk
  // begins — an approach that starts on the porch is not an approach.
  { at: 0.0, pos: [1.2, EYE, 26], look: [0, 2.1, 0], fov: 55 },
  { at: 0.1, pos: [0.8, EYE, 19], look: [0, 2.1, 0], fov: 55 },
  // Up the path, house still fully in frame
  { at: 0.19, pos: [0.3, EYE, 12], look: [0, 2.0, 0], fov: 56 },
  // At the foot of the steps, looking up at the porch
  { at: 0.26, pos: [0, EYE, 7.2], look: [0, 2.1, 0], fov: 58 },
  // Through the doorway — the threshold moment
  { at: 0.34, pos: [0, EYE, 3.1], look: [0, 1.6, -1], fov: 62 },
  // Standing in the entry, looking into the living room
  { at: 0.45, pos: [0, EYE, 1.2], look: [-1.6, 1.5, -2.2], fov: 64 },
  // Walking to the living room, turning toward the sofa
  { at: 0.56, pos: [-1.1, EYE, -0.9], look: [-2.6, 1.2, -2.8], fov: 62 },
  // Turning to the kitchen
  { at: 0.68, pos: [-0.6, EYE, -2.0], look: [2.2, 1.3, -2.6], fov: 60 },
  // At the island
  { at: 0.8, pos: [1.0, EYE, -2.4], look: [2.6, 1.1, -3.4], fov: 58 },
  // Turning back to the window, looking out
  { at: 0.91, pos: [1.4, EYE, -2.2], look: [3.6, 1.5, 0.4], fov: 58 },
  // Settled, facing the room
  { at: 1.0, pos: [0.6, EYE, -1.4], look: [-1.2, 1.4, -3.2], fov: 60 },
];

const ease = (t: number) => t * t * (3 - 2 * t);

function walkAt(p: number, pos: THREE.Vector3, look: THREE.Vector3): number {
  let i = 0;
  while (i < WALK.length - 2 && p > WALK[i + 1]!.at) i++;
  const a = WALK[i]!;
  const b = WALK[i + 1]!;
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
  return THREE.MathUtils.lerp(a.fov ?? 58, b.fov ?? 58, t);
}

// ---------------------------------------------------------------------------
// Story beats — which fixtures are alive
// ---------------------------------------------------------------------------

const BEAT = {
  outside: [0.0, 0.3],
  threshold: [0.3, 0.44],
  electric: [0.44, 0.6],
  internet: [0.6, 0.72],
  silence: [0.72, 0.86],
  recovery: [0.86, 1.0],
} as const;

const lv = (p: number, [a, b]: readonly [number, number]) =>
  THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

// ---------------------------------------------------------------------------
// Interior
// ---------------------------------------------------------------------------

const WARM = "#ffc27a";

function Interior({ progress }: { progress: MotionValue<number> }) {
  const lampMat = useRef<THREE.MeshStandardMaterial>(null);
  const lampLight = useRef<THREE.PointLight>(null);
  const pendantMat = useRef<THREE.MeshStandardMaterial>(null);
  const pendantLight = useRef<THREE.PointLight>(null);
  const routerMat = useRef<THREE.MeshStandardMaterial>(null);
  const sensorMat = useRef<THREE.MeshStandardMaterial>(null);
  const kitchenLight = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.elapsedTime;

    const elec = lv(p, BEAT.electric);
    const net = lv(p, BEAT.internet);
    const sil = lv(p, BEAT.silence);
    const rec = lv(p, BEAT.recovery);

    // Electric: the lamp and pendant come up. During the silence the kitchen
    // circuit — the last one requested — stalls half-lit and stutters, then
    // completes on recovery. You are standing in the room when it happens.
    const stall = sil > 0 && rec < 1 ? 0.7 + 0.3 * Math.abs(Math.sin(t * 8.5) * Math.sin(t * 2.7)) : 1;

    if (lampMat.current) lampMat.current.emissiveIntensity = elec * 3.2;
    if (lampLight.current) lampLight.current.intensity = elec * 5.5;
    if (pendantMat.current) pendantMat.current.emissiveIntensity = elec * 2.6;
    if (pendantLight.current) pendantLight.current.intensity = elec * 3.4;

    const kitchen = Math.min(elec, 0.45 + rec * 0.55) * (sil > 0 ? stall * (1 - rec) + rec : 1);
    if (kitchenLight.current) kitchenLight.current.intensity = kitchen * 6;

    // Internet: the router blinks — the small, specific detail that says a
    // service actually arrived rather than a light turning on.
    if (routerMat.current) {
      const blink = net > 0 ? (Math.sin(t * 6) > 0.2 ? 1 : 0.25) : 0;
      routerMat.current.emissiveIntensity = net * blink * 4;
    }
    // Security: the door sensor settles to a steady verified cyan.
    if (sensorMat.current) sensorMat.current.emissiveIntensity = rec * 3;
  });

  return (
    <group>
      {/* ── Shell ───────────────────────────────────────────── */}
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#4a3728" roughness={0.55} metalness={0.05} envMapIntensity={0.7} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.7, -2]}>
        <planeGeometry args={[9, 9]} />
        <meshStandardMaterial color="#1b2028" roughness={0.95} />
      </mesh>

      {/* back wall */}
      <mesh position={[0, 1.35, -6.4]} receiveShadow>
        <boxGeometry args={[9, 2.7, 0.16]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      {/* left wall */}
      <mesh position={[-4.4, 1.35, -2]} receiveShadow>
        <boxGeometry args={[0.16, 2.7, 9]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      {/* right wall with a window opening: built as three pieces */}
      <mesh position={[4.4, 1.35, -4.6]} receiveShadow>
        <boxGeometry args={[0.16, 2.7, 3.6]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[4.4, 0.45, -1.4]} receiveShadow>
        <boxGeometry args={[0.16, 0.9, 2.8]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[4.4, 2.42, -1.4]} receiveShadow>
        <boxGeometry args={[0.16, 0.55, 2.8]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      {/* the night beyond the window */}
      <mesh position={[4.52, 1.5, -1.4]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.8, 1.4]} />
        <meshBasicMaterial color="#0a1420" />
      </mesh>
      {/* window casing */}
      {([[-1.4, 0.94], [-1.4, 2.12]] as const).map(([z, y], i) => (
        <mesh key={i} position={[4.36, y, z]}>
          <boxGeometry args={[0.1, 0.09, 3.0]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
        </mesh>
      ))}

      {/* front wall with the door opening */}
      <mesh position={[-2.35, 1.35, 2.4]} receiveShadow>
        <boxGeometry args={[4.3, 2.7, 0.16]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[2.35, 1.35, 2.4]} receiveShadow>
        <boxGeometry args={[4.3, 2.7, 0.16]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, 2.46, 2.4]} receiveShadow>
        <boxGeometry args={[1.4, 0.48, 0.16]} />
        <meshStandardMaterial color="#2b333f" roughness={0.85} envMapIntensity={0.6} />
      </mesh>
      {/* door jamb */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 1.1, 2.4]}>
          <boxGeometry args={[0.12, 2.24, 0.22]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
        </mesh>
      ))}
      {/* the open door, swung inward */}
      <mesh position={[-1.05, 1.1, 1.75]} rotation={[0, Math.PI / 2.6, 0]} castShadow>
        <boxGeometry args={[1.3, 2.2, 0.08]} />
        <meshStandardMaterial color="#123344" roughness={0.55} metalness={0.15} envMapIntensity={1.0} />
      </mesh>

      {/* ── Living room ─────────────────────────────────────── */}
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.2, 0.012, -2.6]} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color="#3d3340" roughness={0.95} />
      </mesh>
      {/* sofa: seat, back, two arms */}
      <group position={[-2.9, 0, -3.4]}>
        <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.42, 0.95]} />
          <meshStandardMaterial color="#3a4450" roughness={0.92} envMapIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.72, -0.4]} castShadow>
          <boxGeometry args={[2.3, 0.62, 0.22]} />
          <meshStandardMaterial color="#3a4450" roughness={0.92} envMapIntensity={0.6} />
        </mesh>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} position={[x, 0.55, 0]} castShadow>
            <boxGeometry args={[0.22, 0.72, 0.95]} />
            <meshStandardMaterial color="#333d48" roughness={0.92} />
          </mesh>
        ))}
      </group>
      {/* side table + lamp — the fixture electric actually lights */}
      <group position={[-1.45, 0, -3.5]}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.56, 8]} />
          <meshStandardMaterial color="#2a2f36" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.57, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.03, 20]} />
          <meshStandardMaterial color="#5a4632" roughness={0.6} envMapIntensity={0.9} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.13, 0.19, 0.32, 20, 1, true]} />
          <meshStandardMaterial
            ref={lampMat}
            color="#f0dfc4"
            emissive={WARM}
            emissiveIntensity={0}
            side={THREE.DoubleSide}
            roughness={0.9}
          />
        </mesh>
        <pointLight ref={lampLight} position={[0, 0.78, 0]} color={WARM} intensity={0} distance={7} decay={2} castShadow />
      </group>
      {/* router on the table — internet's small, specific tell */}
      <group position={[-1.45, 0.6, -3.28]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.045, 0.14]} />
          <meshStandardMaterial color="#15191f" roughness={0.5} metalness={0.3} />
        </mesh>
        <mesh position={[0.055, 0.03, 0.03]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial ref={routerMat} color="#3da76a" emissive="#3da76a" emissiveIntensity={0} />
        </mesh>
      </group>

      {/* ── Kitchen ─────────────────────────────────────────── */}
      <group position={[2.6, 0, -3.6]}>
        {/* island base + counter */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.9, 1.0]} />
          <meshStandardMaterial color="#232a33" roughness={0.7} envMapIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.93, 0]} castShadow>
          <boxGeometry args={[2.35, 0.06, 1.12]} />
          <meshStandardMaterial color="#cfd4da" roughness={0.25} metalness={0.35} envMapIntensity={1.3} />
        </mesh>
        {/* stools */}
        {[-0.6, 0.6].map((x) => (
          <group key={x} position={[x, 0, 0.95]}>
            <mesh position={[0, 0.62, 0]} castShadow>
              <cylinderGeometry args={[0.18, 0.18, 0.06, 16]} />
              <meshStandardMaterial color="#4a3728" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.31, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.05, 0.62, 10]} />
              <meshStandardMaterial color="#2a2f36" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
        ))}
        {/* pendant over the island */}
        <mesh position={[0, 2.66, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
          <meshStandardMaterial color="#1a1f26" />
        </mesh>
        <mesh position={[0, 2.3, 0]}>
          <coneGeometry args={[0.26, 0.3, 20, 1, true]} />
          <meshStandardMaterial
            ref={pendantMat}
            color="#e8dcc8"
            emissive={WARM}
            emissiveIntensity={0}
            side={THREE.DoubleSide}
            roughness={0.85}
          />
        </mesh>
        <pointLight ref={pendantLight} position={[0, 2.2, 0]} color={WARM} intensity={0} distance={6} decay={2} />
        <pointLight ref={kitchenLight} position={[0.6, 2.3, -1.2]} color="#ffd9a8" intensity={0} distance={6} decay={2} />
      </group>
      {/* back counter + fridge */}
      <mesh position={[3.3, 0.45, -5.6]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.9, 0.6]} />
        <meshStandardMaterial color="#232a33" roughness={0.7} />
      </mesh>
      <mesh position={[3.3, 0.93, -5.6]}>
        <boxGeometry args={[2.1, 0.06, 0.68]} />
        <meshStandardMaterial color="#cfd4da" roughness={0.25} metalness={0.35} envMapIntensity={1.3} />
      </mesh>
      <mesh position={[1.55, 0.9, -5.9]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.72]} />
        <meshStandardMaterial color="#8d949c" roughness={0.3} metalness={0.75} envMapIntensity={1.4} />
      </mesh>

      {/* Security sensor by the door — recovery's steady cyan */}
      <group position={[0.78, 2.05, 2.28]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.16, 0.05]} />
          <meshStandardMaterial color="#1a1f26" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.032]}>
          <sphereGeometry args={[0.016, 10, 10]} />
          <meshStandardMaterial ref={sensorMat} color="#0087b5" emissive="#0087b5" emissiveIntensity={0} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Exterior shell seen on approach
// ---------------------------------------------------------------------------

function Facade() {
  return (
    <group>
      {/* front face around the doorway, seen from the street */}
      <mesh position={[-2.35, 1.35, 2.56]} castShadow receiveShadow>
        <boxGeometry args={[4.3, 2.7, 0.16]} />
        <meshStandardMaterial color="#26303c" roughness={0.85} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[2.35, 1.35, 2.56]} castShadow receiveShadow>
        <boxGeometry args={[4.3, 2.7, 0.16]} />
        <meshStandardMaterial color="#26303c" roughness={0.85} envMapIntensity={0.7} />
      </mesh>
      {/* porch roof and columns you pass under */}
      <mesh position={[0, 2.85, 3.9]} castShadow>
        <boxGeometry args={[5.4, 0.16, 2.8]} />
        <meshStandardMaterial color="#2a3340" roughness={0.6} metalness={0.2} envMapIntensity={1.0} />
      </mesh>
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.4, 4.9]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 2.8, 12]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
        </mesh>
      ))}
      {/* porch deck + steps you walk up */}
      <mesh position={[0, 0.06, 4.0]} receiveShadow>
        <boxGeometry args={[5.4, 0.12, 3.0]} />
        <meshStandardMaterial color="#3f3428" roughness={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.045 + i * 0.05, 5.85 - i * 0.34]} receiveShadow>
          <boxGeometry args={[3.0, 0.1, 0.36]} />
          <meshStandardMaterial color="#3a3025" roughness={0.9} />
        </mesh>
      ))}
      {/* Front windows — something to actually see on the approach, and the
          first evidence from outside that the house is coming alive. */}
      {([-3.0, 3.0] as const).map((x) => (
        <group key={x} position={[x, 1.55, 2.66]}>
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[1.0, 1.2, 0.1]} />
            <meshStandardMaterial color="#0d1219" roughness={1} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.9, 1.1]} />
            <meshStandardMaterial color="#241c12" emissive={WARM} emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[0, 0.64, 0.03]}>
            <boxGeometry args={[1.18, 0.1, 0.1]} />
            <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
          </mesh>
          <mesh position={[0, -0.64, 0.05]}>
            <boxGeometry args={[1.24, 0.11, 0.16]} />
            <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
          </mesh>
          {[-0.55, 0.55].map((sx) => (
            <mesh key={sx} position={[sx, 0, 0.03]}>
              <boxGeometry args={[0.09, 1.3, 0.1]} />
              <meshStandardMaterial color="#e8e4dc" roughness={0.5} envMapIntensity={1.1} />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.03]}>
            <boxGeometry args={[0.04, 1.1, 0.05]} />
            <meshStandardMaterial color="#dcd8d0" roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* upper storey + roof, so the house has a silhouette from the street */}
      <mesh position={[0, 3.55, 1.4]} castShadow>
        <boxGeometry args={[9, 1.6, 2.6]} />
        <meshStandardMaterial color="#26303c" roughness={0.85} envMapIntensity={0.7} />
      </mesh>
      <mesh position={[0, 4.9, 0.4]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[6.6, 1.9, 4]} />
        <meshStandardMaterial color="#2a3340" roughness={0.62} metalness={0.2} flatShading envMapIntensity={1.0} />
      </mesh>

      {/* porch light */}
      <mesh position={[1.0, 2.35, 2.7]}>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshStandardMaterial color="#ffe0ad" emissive={WARM} emissiveIntensity={2.6} />
      </mesh>
      <pointLight position={[1.0, 2.3, 2.9]} color={WARM} intensity={2.4} distance={7} decay={2} />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 6]} receiveShadow>
        <planeGeometry args={[60, 30]} />
        <meshStandardMaterial color="#12181f" roughness={0.9} envMapIntensity={0.5} />
      </mesh>
      {/* path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 9.5]} receiveShadow>
        <planeGeometry args={[1.6, 8]} />
        <meshStandardMaterial color="#1b222b" roughness={0.85} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rig
// ---------------------------------------------------------------------------

function Rig({ progress }: { progress: MotionValue<number> }) {
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const smoothPos = useRef(new THREE.Vector3(0.4, EYE, 13.5));
  const smoothLook = useRef(new THREE.Vector3(0, 1.9, 0));

  useFrame(({ camera, clock }, delta) => {
    const p = progress.get();
    const t = clock.elapsedTime;
    const fov = walkAt(p, pos.current, look.current);

    // Head bob and sway — small, at walking cadence. Without it the camera
    // glides like a drone and the body disappears from the experience.
    const moving = 1;
    pos.current.y += Math.sin(t * 5.4) * 0.012 * moving;
    pos.current.x += Math.sin(t * 2.7) * 0.008 * moving;

    // Damped follow so scrubbing never snaps.
    const k = 1 - Math.pow(0.0015, delta);
    smoothPos.current.lerp(pos.current, k);
    smoothLook.current.lerp(look.current, k);

    camera.position.copy(smoothPos.current);
    camera.lookAt(smoothLook.current);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, fov, k);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

const CAPTIONS: Array<{ range: [number, number]; eyebrow: string; title: string; body: string; tone?: "amber" | "cyan" }> = [
  { range: [0.01, 0.12], eyebrow: "The Living Move", title: "You have the keys.\nNothing is on yet.", body: "Scroll to walk up to the house." },
  { range: [0.15, 0.28], eyebrow: "Chapter 1 · Three sources", title: "One move arrived three times", body: "Her agent's system, a spreadsheet, and Maya herself — and no two of them agree on the date." },
  { range: [0.31, 0.42], eyebrow: "Chapter 2 · The threshold", title: "A named human decided", body: "concierge-7 approved one canonical record. Only then can anything be ordered.", tone: "cyan" },
  { range: [0.46, 0.58], eyebrow: "Chapter 3 · Electric", title: "The room comes on around you", body: "The lamp beside you, the pendant over the island. This is the first service actually landing." },
  { range: [0.61, 0.7], eyebrow: "Chapter 4 · Internet", title: "The router finds the line", body: "A small green blink on the side table — the tell that a service arrived, not just a light." },
  { range: [0.74, 0.84], eyebrow: "Chapter 5 · The silence", title: "The kitchen stalls half-lit", body: "The provider created the order, then the response was lost. UNKNOWN. No blind retry, no duplicate — so the light waits.", tone: "amber" },
  { range: [0.88, 1.0], eyebrow: "Chapter 6 · Recovery", title: "Ask the provider. Finish the light.", body: "Reconciliation found the order that existed all along. The kitchen completes; the door sensor settles verified.", tone: "cyan" },
];

function Caption({ progress, def }: { progress: MotionValue<number>; def: (typeof CAPTIONS)[number] }) {
  const [a, b] = def.range;
  const opacity = useTransform(progress, [a, a + 0.02, b - 0.02, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [18, -18]);
  const accent = def.tone === "amber" ? "var(--color-state-conflict)" : def.tone === "cyan" ? "var(--color-state-verified)" : "rgba(255,255,255,0.6)";

  return (
    <motion.div style={{ opacity, y }} className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-6 pb-14">
      <div className="max-w-xl rounded-2xl px-6 py-5 text-center" style={{ background: "linear-gradient(180deg, rgba(4,7,11,0.5), rgba(4,7,11,0.86))" }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>{def.eyebrow}</div>
        <h2 className="mt-2 whitespace-pre-line text-2xl font-bold leading-tight text-white sm:text-3xl">{def.title}</h2>
        <p className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: "rgba(255,255,255,0.76)" }}>{def.body}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function WalkThrough() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  const [webgl, setWebgl] = useState(true);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const hint = useTransform(scrollYProgress, [0, 0.03], [1, 0]);
  const hintShow = useTransform(scrollYProgress, (v) => (v > 0.04 ? "none" : "flex"));

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setWebgl(false);
    } catch {
      setWebgl(false);
    }
  }, []);

  if (reduce || !webgl) {
    return (
      <section className="px-6 py-24" style={{ background: "#070b10" }}>
        <div className="mx-auto max-w-2xl space-y-12">
          {CAPTIONS.map((c) => (
            <div key={c.range[0]}>
              <div className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: c.tone === "amber" ? "var(--color-state-conflict)" : "var(--color-state-verified)" }}>{c.eyebrow}</div>
              <h2 className="mt-2 whitespace-pre-line text-2xl font-bold text-white">{c.title}</h2>
              <p className="mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div ref={ref} style={{ height: "800vh", background: "#070b10" }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Canvas
          camera={{ position: [0.4, EYE, 13.5], fov: 58, near: 0.05, far: 200 }}
          dpr={[1, 1.75]}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          gl={{ antialias: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={["#070b10"]} />
          <fog attach="fog" args={["#070b10", 12, 46]} />

          <Environment resolution={128} frames={1}>
            <Lightformer intensity={0.4} color="#8fb0d8" position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[24, 24, 1]} />
            <Lightformer intensity={0.5} color="#ffc27a" position={[0, 2, 3]} scale={[8, 4, 1]} />
            <Lightformer intensity={0.25} color="#0087b5" position={[-10, 4, -8]} scale={[12, 8, 1]} />
          </Environment>

          <ambientLight intensity={0.18} color="#6b86a8" />
          <directionalLight
            position={[10, 16, -6]}
            intensity={0.5}
            color="#9fb8dc"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.03}
            shadow-camera-left={-14}
            shadow-camera-right={14}
            shadow-camera-top={14}
            shadow-camera-bottom={-14}
          />

          <Facade />
          <Interior progress={scrollYProgress} />
          <ContactShadows position={[0, 0.015, -2]} scale={16} resolution={1024} blur={2.6} opacity={0.75} far={6} color="#000308" frames={1} />
          <Rig progress={scrollYProgress} />

          <EffectComposer multisampling={0}>
            {/* A hint of focus falloff only. Aggressive DoF inside a room
                blurs the very surfaces that prove you are standing in one —
                the floor grain, the counter edge, the wall a metre away. */}
            <DepthOfField focusDistance={0.035} focalLength={0.18} bokehScale={1.4} height={480} />
            <Bloom intensity={1.15} luminanceThreshold={0.3} luminanceSmoothing={0.4} kernelSize={KernelSize.LARGE} mipmapBlur />
            <Vignette eskil={false} offset={0.2} darkness={0.9} />
          </EffectComposer>
        </Canvas>

        {CAPTIONS.map((c) => (
          <Caption key={c.range[0]} progress={scrollYProgress} def={c} />
        ))}

        <motion.div style={{ opacity: hint, display: hintShow }} className="pointer-events-none absolute inset-x-0 bottom-6 justify-center">
          <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">scroll to walk in</span>
        </motion.div>

        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <motion.div style={{ scaleX: bar, transformOrigin: "left" }} className="h-full">
            <div className="h-full w-full" style={{ background: "var(--color-state-verified)" }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
