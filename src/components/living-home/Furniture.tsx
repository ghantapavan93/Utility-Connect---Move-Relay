"use client";

import * as THREE from "three";
import { MATERIAL } from "./palette";
import { RoundedBox } from "./Geometry";

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
      <RoundedBox args={[2.4, 0.055, 1.0]} radius={0.014} position={[0, 0.74, 0]} castShadow receiveShadow>
        {wood(MATERIAL.walnut, 0.42)}
      </RoundedBox>
      {/* apron */}
      <RoundedBox args={[2.16, 0.06, 0.84]} radius={0.01} position={[0, 0.685, 0]} castShadow>
        {wood("#5c3f28", 0.6)}
      </RoundedBox>
      {/* Blade legs, inset and slimmer. They were 7cm slabs the full 80cm depth
          of the table, which from across the room read as two solid black walls
          under the top and hid the floor behind them — the single heaviest
          object in the dining shot was the part you are not supposed to notice. */}
      {[-0.92, 0.92].map((x) => (
        <group key={x}>
          <RoundedBox args={[0.045, 0.65, 0.52]} radius={0.012} position={[x, 0.33, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.55} envMapIntensity={1.2} />
          </RoundedBox>
          {/* foot, so the blade lands on something */}
          <RoundedBox args={[0.06, 0.022, 0.62]} radius={0.008} position={[x, 0.012, 0]} castShadow>
            <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.55} />
          </RoundedBox>
        </group>
      ))}
      {/* stretcher between them */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 1.84, 10]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.55} />
      </mesh>
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
      {/*
        A chair is mostly edges, and every one of them was square.

        The old version was a 5cm slab, a flat back panel and four identical
        posts — the silhouette of a chair icon rather than a chair. What reads
        at a glance is the taper: a seat is thicker at the front than the back,
        a back rest is narrower at the shoulder than the seat, the rear legs
        rake backward, and every edge is radiused. None of that costs geometry
        worth counting, and without it six chairs around a table look like six
        diagrams.
      */}
      <RoundedBox args={[0.46, 0.055, 0.44]} radius={0.02} position={[0, 0.45, 0.01]} castShadow receiveShadow>
        {wood(MATERIAL.walnut, 0.55)}
      </RoundedBox>
      {/* seat rail, so the seat is not floating on four sticks */}
      <RoundedBox args={[0.42, 0.04, 0.4]} radius={0.012} position={[0, 0.415, 0.01]} castShadow>
        {wood("#5c3f28", 0.62)}
      </RoundedBox>

      {/* back: two uprights and a shaped rest, reclined */}
      {[-0.19, 0.19].map((x) => (
        <mesh key={x} position={[x, 0.66, -0.185]} rotation={[-0.11, 0, 0]} castShadow>
          <cylinderGeometry args={[0.017, 0.019, 0.44, 8]} />
          {wood(MATERIAL.walnut, 0.55)}
        </mesh>
      ))}
      <RoundedBox
        args={[0.42, 0.19, 0.042]}
        radius={0.019}
        position={[0, 0.83, -0.205]}
        rotation={[-0.11, 0, 0]}
        castShadow
      >
        {wood(MATERIAL.walnut, 0.5)}
      </RoundedBox>
      <RoundedBox
        args={[0.4, 0.075, 0.036]}
        radius={0.016}
        position={[0, 0.63, -0.183]}
        rotation={[-0.11, 0, 0]}
        castShadow
      >
        {wood(MATERIAL.walnut, 0.55)}
      </RoundedBox>

      {/* Legs stand on y = 0 like every other piece here. The rear pair rakes
          back a few degrees, which is both how a chair is built and the reason
          it reads as one from any angle. */}
      {(
        [
          [-0.19, -0.17, 0.05],
          [0.19, -0.17, 0.05],
          [-0.19, 0.18, -0.04],
          [0.19, 0.18, -0.04],
        ] as const
      ).map(([x, z, tilt], i) => (
        <mesh key={i} position={[x, 0.225, z]} rotation={[tilt, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.021, 0.45, 8]} />
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
      {/*
        Foliage.

        This was five 85cm slabs arranged in a fan, which at any distance read
        as painted cardboard — the giveaway was that a houseplant had five
        surfaces and a straight edge on every one. A plant's silhouette is made
        of many small overlapping leaves at unrelated angles, so that is what
        this is: eighteen leaves on arcing stems, each one a flattened sphere,
        each on its own tilt. Same triangle budget as a chair, and it is the
        difference between a plant and a prop.
      */}
      {Array.from({ length: 18 }, (_, i) => {
        // Deterministic scatter — a seeded hash rather than random, so the
        // plant is identical on every render and in every baked frame.
        const h = Math.sin(i * 127.1) * 43758.5453;
        const r1 = h - Math.floor(h);
        const g = Math.sin(i * 311.7) * 24634.6345;
        const r2 = g - Math.floor(g);

        const a = (i / 18) * Math.PI * 2 * 2.3 + r1 * 0.5;
        const lean = 0.35 + r1 * 0.55;
        const height = 0.42 + r2 * 0.62;
        const len = 0.16 + r2 * 0.13;

        return (
          <group key={i} rotation={[0, a, 0]}>
            {/* stem, arcing outward */}
            <mesh
              position={[Math.sin(lean) * height * 0.42, 0.62 + height * 0.42, 0]}
              rotation={[0, 0, -lean * 0.8]}
              castShadow
            >
              <cylinderGeometry args={[0.006, 0.011, height, 6]} />
              <meshStandardMaterial color="#5f7a52" roughness={0.9} />
            </mesh>
            {/* leaf */}
            <mesh
              position={[Math.sin(lean) * height * 0.86, 0.62 + height * 0.86, 0]}
              rotation={[r1 * 0.9 - 0.45, 0, -lean - 0.25]}
              scale={[len, 0.022, len * 0.52]}
              castShadow
            >
              <sphereGeometry args={[1, 10, 7]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#5c7350" : i % 3 === 1 ? MATERIAL.foliage : "#6f8a5f"}
                roughness={0.82}
                envMapIntensity={0.85}
              />
            </mesh>
          </group>
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


/**
 * Three-seat sofa.
 *
 * The previous one was two boxes: a slab for the seat and a slab for the back.
 * At that point no amount of light helps, because what the eye reads first in
 * upholstery is not material or shading — it is the *articulation*. A real sofa
 * is a frame, separate seat cushions with gaps between them, separate back
 * cushions that sit slightly proud, arms with their own mass, and feet that
 * lift the whole thing off the floor so light passes underneath. Every one of
 * those is a silhouette cue, and a box has none of them.
 *
 * The gaps matter most. A continuous 3m beige surface reads as a wall; the same
 * volume cut into three cushions with 2cm shadow lines between them reads as
 * something you sit on.
 */
export function Sofa({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  const seatW = 0.78;
  const linen = (tone: string) => (
    <meshStandardMaterial color={tone} roughness={0.96} metalness={0} envMapIntensity={0.7} />
  );

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* feet — the gap under a sofa is what stops it looking poured in place */}
      {([[-1.12, -0.36], [1.12, -0.36], [-1.12, 0.36], [1.12, 0.36]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.07, z]} castShadow>
          <cylinderGeometry args={[0.028, 0.022, 0.14, 10]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} />
        </mesh>
      ))}

      {/* frame */}
      <RoundedBox
        args={[2.46, 0.2, 0.95]}
        radius={0.03}
        position={[0, 0.24, 0]}
        castShadow
        receiveShadow
      >
        {linen("#b9b1a3")}
      </RoundedBox>

      {/* seat cushions, with a shadow gap between each */}
      {[-0.82, 0, 0.82].map((x) => (
        <RoundedBox
          key={x}
          args={[seatW, 0.17, 0.86]}
          radius={0.055}
          position={[x, 0.42, 0.02]}
          castShadow
          receiveShadow
        >
          {linen(MATERIAL.linen)}
        </RoundedBox>
      ))}

      {/* back cushions, reclined a few degrees the way a loaded back sits */}
      {[-0.82, 0, 0.82].map((x) => (
        <RoundedBox
          key={x}
          args={[seatW, 0.52, 0.2]}
          radius={0.06}
          position={[x, 0.72, -0.35]}
          rotation={[-0.13, 0, 0]}
          castShadow
        >
          {linen("#cbc3b5")}
        </RoundedBox>
      ))}

      {/* back frame behind them, so the gaps do not read straight through */}
      <RoundedBox args={[2.46, 0.46, 0.12]} radius={0.03} position={[0, 0.66, -0.45]} castShadow receiveShadow>
        {linen("#aca493")}
      </RoundedBox>

      {/* arms */}
      {[-1.17, 1.17].map((x) => (
        <RoundedBox key={x} args={[0.22, 0.44, 0.95]} radius={0.08} position={[x, 0.5, 0]} castShadow receiveShadow>
          {linen("#c2baac")}
        </RoundedBox>
      ))}

      {/* a throw cushion, because a perfectly tidy sofa reads as a showroom */}
      <RoundedBox
        args={[0.4, 0.4, 0.13]}
        radius={0.07}
        position={[-0.72, 0.66, -0.2]}
        rotation={[-0.22, 0.3, 0.12]}
        castShadow
      >
        {linen("#8d9a8a")}
      </RoundedBox>
    </group>
  );
}

/**
 * Low sideboard on legs.
 *
 * Same problem as the sofa: it was a single walnut box. A carcass lifted on
 * legs with recessed drawer fronts gives three separate horizontal lines and a
 * shadow underneath, which is most of what makes a cabinet look like joinery
 * rather than a crate.
 */
export function Sideboard({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {([[-0.86, -0.18], [0.86, -0.18], [-0.86, 0.18], [0.86, 0.18]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.11, z]} rotation={[0, 0, x > 0 ? -0.06 : 0.06]} castShadow>
          <cylinderGeometry args={[0.022, 0.017, 0.22, 10]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.45} metalness={0.5} />
        </mesh>
      ))}
      <RoundedBox args={[1.96, 0.46, 0.46]} radius={0.012} position={[0, 0.45, 0]} castShadow receiveShadow>
        {wood(MATERIAL.walnut, 0.5)}
      </RoundedBox>
      {/* drawer fronts, proud of the carcass so each casts its own line */}
      {[-0.49, 0.49].map((x) => (
        <RoundedBox key={x} args={[0.92, 0.38, 0.02]} radius={0.008} position={[x, 0.45, 0.242]} castShadow>
          {wood("#5f4229", 0.45)}
        </RoundedBox>
      ))}
      {/* recessed finger pulls */}
      {[-0.49, 0.49].map((x) => (
        <mesh key={x} position={[x, 0.6, 0.253]}>
          <boxGeometry args={[0.34, 0.018, 0.01]} />
          <meshStandardMaterial color="#2b2620" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}


/** Upholstered ottoman — the thing that stops a seating group being one object. */
export function Ottoman({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {([[-0.28, -0.2], [0.28, -0.2], [-0.28, 0.2], [0.28, 0.2]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.05, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.016, 0.1, 8]} />
          <meshStandardMaterial color={MATERIAL.walnut} roughness={0.5} />
        </mesh>
      ))}
      <RoundedBox args={[0.74, 0.28, 0.56]} radius={0.07} position={[0, 0.24, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#b3ab9c" roughness={0.96} envMapIntensity={0.7} />
      </RoundedBox>
    </group>
  );
}

/** Slim floor lamp — a vertical in a room that is otherwise all horizontals. */
export function FloorLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.17, 0.024, 20]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.014, 1.54, 10]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.35} metalness={0.7} />
      </mesh>
      {/* linen drum, open at the bottom so it reads as a shade not a cylinder */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.2, 0.26, 22, 1, true]} />
        <meshStandardMaterial color="#e6dfd2" roughness={0.95} side={THREE.DoubleSide} envMapIntensity={0.9} />
      </mesh>
    </group>
  );
}

/** Woven basket — soft mass at floor level, which is what a bare corner lacks. */
export function Basket({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.21, 0.17, 0.4, 18]} />
        <meshStandardMaterial color="#bda57e" roughness={0.95} envMapIntensity={0.7} />
      </mesh>
      {/* rolled rim */}
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.21, 0.022, 8, 20]} />
        <meshStandardMaterial color="#a98f68" roughness={0.92} />
      </mesh>
      {/* a folded throw spilling over the edge */}
      <RoundedBox args={[0.3, 0.12, 0.26]} radius={0.05} position={[0.04, 0.44, 0.02]} rotation={[0.1, 0.4, 0.06]} castShadow>
        <meshStandardMaterial color="#8d9a8a" roughness={0.97} />
      </RoundedBox>
    </group>
  );
}

/** Side table — a small horizontal beside a sofa arm. */
export function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.012, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.18, 0.024, 18]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.016, 0.02, 0.48, 10]} />
        <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.035, 24]} />
        {wood(MATERIAL.walnut, 0.45)}
      </mesh>
      {/* a mug, because an empty side table is still an empty surface */}
      <mesh position={[0.06, 0.56, 0.03]} castShadow>
        <cylinderGeometry args={[0.042, 0.036, 0.09, 14]} />
        <meshStandardMaterial color="#cfc9bf" roughness={0.35} envMapIntensity={1.2} />
      </mesh>
    </group>
  );
}
