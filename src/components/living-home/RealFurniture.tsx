"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import {
  Sofa as SofaPrimitive,
  Chair as ChairPrimitive,
  Stool as StoolPrimitive,
  DiningTable as DiningTablePrimitive,
  CoffeeTable as CoffeeTablePrimitive,
  SideTable as SideTablePrimitive,
  Planter as PlanterPrimitive,
} from "./Furniture";

/**
 * THE REAL FURNITURE — photoscanned pieces where the camera lingers.
 *
 * The last stage of the realism work. Materials became photographs, the sky
 * became physical, the trees became foliage — and the furniture stayed
 * primitives: rounded boxes with good materials, but boxes, and the camera
 * holds three of them in close-up for whole chapters. These are Poly Haven
 * photoscans (CC0): real objects, captured, retopologised and PBR-textured by
 * people who point cameras at furniture for a living.
 *
 * Nine models, 1K textures, 13.7MB verified byte-for-byte against the API's
 * declared sizes at download time. `real-furniture.test.ts` pins every file
 * and the budget, the same contract the photo materials carry.
 *
 * ## The fallback is the primitive
 *
 * Every real piece renders inside a Suspense whose fallback is the primitive
 * it replaces, at the same coordinates. The film is watchable from the first
 * frame — a visitor on a slow connection sees the abstracted room and the
 * scanned pieces resolve into it as they arrive, oldest trick in progressive
 * rendering. It also means a deleted model file degrades the scene instead of
 * blanking it, which is the same posture every read in this repository takes:
 * the missing thing must never take the room down with it.
 */

const MODELS = {
  sofa: "/models/sofa_02/sofa_02_1k.gltf",
  armChair: "/models/modern_arm_chair_01/modern_arm_chair_01_1k.gltf",
  diningChair: "/models/dining_chair_02/dining_chair_02_1k.gltf",
  diningTable: "/models/round_wooden_table_01/round_wooden_table_01_1k.gltf",
  barChair: "/models/bar_chair_round_01/bar_chair_round_01_1k.gltf",
  coffeeTable: "/models/modern_coffee_table_01/modern_coffee_table_01_1k.gltf",
  sideTable: "/models/side_table_01/side_table_01_1k.gltf",
  calathea: "/models/calathea_orbifolia_01/calathea_orbifolia_01_1k.gltf",
  anthurium: "/models/anthurium_botany_01/anthurium_botany_01_1k.gltf",
  coveredCar: "/models/covered_car/covered_car_1k.gltf",
} as const;

/**
 * One scanned piece: cloned scene graph, shadows on, placed like a primitive.
 *
 * The clone matters — useGLTF caches one scene per URL, and six dining chairs
 * rendering the SAME Object3D would each yank it to their own transform,
 * leaving one chair at the last position and five empty groups. SkeletonUtils
 * is unnecessary (nothing here is skinned); `clone(true)` is.
 */
function Scan({
  url,
  position,
  rotationY = 0,
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const { scene } = useGLTF(url);
  const instance = useMemo(() => {
    const s = scene.clone(true);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return s;
  }, [scene]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <primitive object={instance} />
    </group>
  );
}

/* ── the pieces, each with its primitive understudy ───────────────────────── */

export function RealSofa(props: { position: [number, number, number] }) {
  return (
    <Suspense fallback={<SofaPrimitive position={props.position} />}>
      {/* First guess was +π/2 and the verification still aimed at a wall: the
          camera capture showed the seat facing the TV wall sixty centimetres
          behind it. Scans carry no "front" metadata — orientation is only ever
          settled by looking. */}
      <Scan url={MODELS.sofa} position={props.position} rotationY={-Math.PI / 2} />
    </Suspense>
  );
}

export function RealArmChair({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  // No primitive understudy existed for an arm chair; the sofa's silhouette is
  // the nearest stand-in and the piece is additive anyway — nothing breaks if
  // it arrives late.
  return (
    <Suspense fallback={null}>
      <Scan url={MODELS.armChair} position={position} rotationY={rotationY} />
    </Suspense>
  );
}

export function RealDiningChair({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}) {
  return (
    <Suspense fallback={<ChairPrimitive position={position} rotation={rotation} />}>
      {/* The scan's rest pose faces −Z; the primitive's faced +Z, and every
          call site was authored against the primitive — so the scan carries a
          π offset to keep the seating plan's rotations meaning what they said. */}
      <Scan url={MODELS.diningChair} position={position} rotationY={rotation + Math.PI} />
    </Suspense>
  );
}

export function RealDiningTable(props: { position: [number, number, number] }) {
  return (
    <Suspense fallback={<DiningTablePrimitive position={props.position} />}>
      <Scan url={MODELS.diningTable} position={props.position} />
    </Suspense>
  );
}

export function RealStool(props: { position: [number, number, number] }) {
  return (
    <Suspense fallback={<StoolPrimitive position={props.position} />}>
      {/* Seat toward the island — the scan faces +Z at rest. */}
      <Scan url={MODELS.barChair} position={props.position} rotationY={Math.PI} />
    </Suspense>
  );
}

export function RealCoffeeTable(props: { position: [number, number, number] }) {
  return (
    <Suspense fallback={<CoffeeTablePrimitive position={props.position} />}>
      <Scan url={MODELS.coffeeTable} position={props.position} />
    </Suspense>
  );
}

export function RealSideTable(props: { position: [number, number, number] }) {
  return (
    <Suspense fallback={<SideTablePrimitive position={props.position} />}>
      <Scan url={MODELS.sideTable} position={props.position} />
    </Suspense>
  );
}

export function RealPlant({
  position,
  scale = 1,
  variant = "calathea",
}: {
  position: [number, number, number];
  scale?: number;
  variant?: "calathea" | "anthurium";
}) {
  return (
    <Suspense fallback={<PlanterPrimitive position={position} scale={scale} />}>
      <Scan
        url={variant === "calathea" ? MODELS.calathea : MODELS.anthurium}
        position={position}
        scale={scale}
      />
    </Suspense>
  );
}

export function RealCar({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  /*
    A car under a fitted cover, on the drive. The honest choice twice over: a
    scan of a real object rather than a modelled car, and a COVERED one — so
    the film gets the "someone lives here" signal a parked car carries without
    inventing a brand, a plate, or a paint colour the practice would then be
    lying about. Additive scenery, so the fallback is nothing.
  */
  return (
    <Suspense fallback={null}>
      <Scan url={MODELS.coveredCar} position={position} rotationY={rotationY} />
    </Suspense>
  );
}

// Fetch the heavy pieces the moment the module loads rather than when the
// camera first reaches their room — by the kitchen chapter the stools should
// have been resident for half a minute.
for (const url of Object.values(MODELS)) useGLTF.preload(url);
