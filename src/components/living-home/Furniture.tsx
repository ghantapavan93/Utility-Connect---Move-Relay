"use client";

import * as THREE from "three";
import { MATERIAL } from "./palette";

/**
 * Furniture, at real dimensions.
 *
 * Every piece here is sized from actual furniture: a dining chair seat is
 * 45cm off the floor, a table top is 74cm, a counter is 92cm, a sofa seat is
 * 42cm. Getting these wrong is what makes a rendered room feel like a diagram
 * even when the materials are right — the eye reads scale before it reads
 * anything else.
 *
 * These are also what give the camera something to frame. A room with correct
 * walls and no furniture has no subject, which is exactly why several chapters
 * were pointing at blank plaster.
 */

const wood = (color: string, roughness = 0.5) => (
  <meshStandardMaterial color={color} roughness={roughness} metalness={0.03} envMapIntensity={0.9} />
);

// ---------------------------------------------------------------------------

/** Dining table — solid walnut top on a pair of blade legs. */
export function DiningTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.055, 1.0]} />
        {wood(MATERIAL.walnut, 0.42)}
      </mesh>
      {/* apron */}
      <mesh position={[0, 0.69, 0]} castShadow>
        <boxGeometry args={[2.2, 0.06, 0.86]} />
        {wood("#5c3f28", 0.6)}
      </mesh>
      {[-1.0, 1.0].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.07, 0.7, 0.8]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.55} envMapIntensity={1.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Dining chair — seat at 45cm, back at 88cm. */
export function Chair({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.05, 0.42]} />
        {wood(MATERIAL.walnut, 0.55)}
      </mesh>
      {/* back, slightly reclined */}
      <mesh position={[0, 0.68, -0.19]} rotation={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.045]} />
        {wood(MATERIAL.walnut, 0.55)}
      </mesh>
      {/* Legs stand on y = 0 like every other piece here — they were centred at
          0.22 with a 0.45 length, which put their feet 5mm underground. */}
      {([[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.225, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.022, 0.45, 8]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.45} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Counter stool — seat at 65cm for a 92cm counter. */
export function Stool({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.05, 20]} />
        {wood(MATERIAL.walnut, 0.5)}
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.045, 0.64, 12]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.35} metalness={0.7} envMapIntensity={1.3} />
      </mesh>
      {/* footrest ring */}
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.012, 8, 20]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.35} metalness={0.7} />
      </mesh>
      {/* Weighted base. Deliberately 3cm rather than 2cm: a 2cm disc standing
          on y = 0 put its top face at exactly the height of the limestone slab,
          and two coplanar upward-facing surfaces is what made the stools strobe
          as the camera moved. Depth buffers cannot order a tie. */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.19, 0.2, 0.03, 24]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Low coffee table with a shelf. */
export function CoffeeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.05, 0.7]} />
        {wood(MATERIAL.walnut, 0.42)}
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[1.15, 0.035, 0.58]} />
        {wood("#5c3f28", 0.65)}
      </mesh>
      {([[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} castShadow>
          <boxGeometry args={[0.04, 0.4, 0.04]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.55} />
        </mesh>
      ))}
      {/* a book and a bowl, because empty surfaces read as CAD */}
      <mesh position={[-0.25, 0.44, 0.06]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.24, 0.03, 0.17]} />
        <meshStandardMaterial color="#7d5a4a" roughness={0.85} />
      </mesh>
      <mesh position={[0.3, 0.46, -0.05]} castShadow>
        <sphereGeometry args={[0.11, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfc9bf" roughness={0.3} metalness={0.15} envMapIntensity={1.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Open shelving unit against a wall. */
export function Shelving({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* carcass */}
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 1.05, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.05, 2.1, 0.34]} />
          {wood(MATERIAL.walnut, 0.55)}
        </mesh>
      ))}
      {/* Boards sit *between* the uprights and slightly shallower than them.
          At 1.85 x 0.34 they matched the carcass exactly, which put their front,
          back and topmost faces on the same planes as the uprights — coplanar
          same-facing surfaces that the depth buffer resolves differently from
          frame to frame. Real casework is rebated for the same reason it looks
          right: the shelf is never flush with the end panel. */}
      {[0.35, 0.82, 1.29, 1.76, 2.04].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.75, 0.04, 0.31]} />
          {wood(MATERIAL.walnut, 0.55)}
        </mesh>
      ))}
      {/* books, staggered so it reads as lived-in */}
      {([
        [-0.6, 0.35, 0.42, "#8a6f5c"],
        [-0.42, 0.35, 0.34, "#6b7c6e"],
        [-0.3, 0.35, 0.38, "#a08a6b"],
        [0.35, 0.82, 0.4, "#7d6a80"],
        [0.5, 0.82, 0.32, "#8a6f5c"],
        [-0.5, 1.29, 0.36, "#6b7c6e"],
      ] as const).map(([x, base, h, c], i) => (
        <mesh key={i} position={[x, base + 0.02 + h / 2, 0]} castShadow>
          <boxGeometry args={[0.055, h, 0.24]} />
          <meshStandardMaterial color={c} roughness={0.9} />
        </mesh>
      ))}
      {/* a ceramic piece */}
      <mesh position={[0.55, 1.44, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.26, 16]} />
        <meshStandardMaterial color="#d8cfc0" roughness={0.35} envMapIntensity={1.2} />
      </mesh>
    </group>
  );
}

/** An indoor planter — the thing that makes an interior feel occupied. */
export function Planter({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.19, 0.56, 20]} />
        <meshStandardMaterial color="#b9b1a4" roughness={0.75} envMapIntensity={1.0} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.04, 20]} />
        <meshStandardMaterial color="#3b3128" roughness={1} />
      </mesh>
      {/* fronds */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.16, 0.95 + (i % 2) * 0.22, Math.sin(a) * 0.16]}
            rotation={[Math.cos(a) * 0.35, a, Math.sin(a) * 0.35]}
            castShadow
          >
            <boxGeometry args={[0.05, 0.85, 0.3]} />
            <meshStandardMaterial color={MATERIAL.foliage} roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Framed artwork — gives a blank wall a focal point. */
export function Artwork({
  position,
  rotation = 0,
  w = 0.9,
  h = 1.2,
  tone = "#8a9a8c",
}: {
  position: [number, number, number];
  rotation?: number;
  w?: number;
  h?: number;
  tone?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[w, h, 0.045]} />
        <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} envMapIntensity={1.0} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[w - 0.11, h - 0.11]} />
        <meshStandardMaterial color={tone} roughness={0.92} />
      </mesh>
    </group>
  );
}

/** A runner rug — grounds a circulation space. */
export function Rug({
  position,
  size,
  color = MATERIAL.linen,
}: {
  position: [number, number, number];
  size: [number, number];
  color?: string;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.98} />
    </mesh>
  );
}
