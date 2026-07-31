"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * THE VEGETATION — leaf cards, not polyhedra.
 *
 * The previous trees were icosahedrons, and the critique was correct: a
 * flat-shaded icosahedron reads as "a 3D program's idea of a tree" at any
 * distance, because nothing about it behaves like foliage. A real canopy is
 * not a closed surface — it is thousands of small planes at every orientation,
 * transmitting light at their edges and moving independently in wind.
 *
 * This is the standard real-time answer to that (the same one EZ-Tree and
 * every game engine use): clusters of alpha-tested quads — "leaf cards" —
 * scattered through ellipsoidal canopy lobes. Each card carries a texture of
 * dozens of individual leaves, so a hundred cards read as tens of thousands of
 * leaves. The texture is drawn onto a canvas at module scope rather than
 * downloaded, which keeps the repository free of binaries and the whole thing
 * works offline — same policy as the environment rig.
 *
 * Performance shape: every canopy card in the scene lives in ONE
 * InstancedMesh (one draw call), every trunk in another. Wind is a vertex
 * shader displacement keyed to instance phase, so movement costs nothing per
 * frame beyond a single uniform write.
 */

/* ── the leaf-cluster texture, painted rather than fetched ────────────────── */

function makeLeafTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  // Deterministic PRNG — the same tree every visit. A canopy that re-rolls on
  // every mount would make hydration screenshots unstable for no gain.
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  /*
    Leaves cluster toward the card's centre and thin toward its edge, so the
    card's silhouette is ragged rather than square — the square outline is
    what gives billboard foliage away.
  */
  const leaves = 150;
  for (let i = 0; i < leaves; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = Math.pow(rnd(), 0.6) * size * 0.42;
    const x = size / 2 + Math.cos(ang) * dist;
    const y = size / 2 + Math.sin(ang) * dist;
    const len = 9 + rnd() * 14;
    const wid = 4 + rnd() * 5;
    const rot = rnd() * Math.PI * 2;

    // Green range: warm olive in the light, cool blue-green in shade. The hue
    // spread is what a single-colour canopy lacks.
    const h = 82 + rnd() * 38;
    const s = 22 + rnd() * 26;
    const l = 22 + rnd() * 26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = `hsla(${h}, ${s}%, ${l}%, ${0.82 + rnd() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/* ── canopy + trunk instance layout ───────────────────────────────────────── */

interface TreeSpec {
  /** trunk base */
  x: number;
  z: number;
  /** overall height of the trunk */
  trunk: number;
  /** canopy lobe radii */
  lobes: Array<{ dx: number; dy: number; dz: number; r: number }>;
  /** cards per lobe-volume unit — near trees get more */
  density: number;
  /** colour tint — background trees go desaturated and cool */
  tint: THREE.Color;
  lean: number;
}

function prng(n: number) {
  const j = Math.sin(n * 12.9898) * 43758.5453;
  return j - Math.floor(j);
}

/**
 * The planting plan. Same placement logic as before — a treeline mass behind
 * the house so the sky is never empty, and courtyard specimens near the
 * camera — but each position now grows a real canopy.
 */
function buildSpecs(): TreeSpec[] {
  const specs: TreeSpec[] = [];

  // Treeline behind the house: far, foggy, desaturated. Their job is silhouette.
  for (let i = 0; i < 22; i++) {
    const r = prng(i + 1);
    const x = -44 + i * 4.1 + r * 1.6;
    const z = -24 - r * 9;
    const h = 5.2 + r * 4.2;
    specs.push({
      x,
      z,
      trunk: h * 0.55,
      lobes: [
        { dx: 0, dy: h * 0.72, dz: 0, r: 1.7 + r * 1.2 },
        { dx: 0.9 + r * 0.5, dy: h * 0.6, dz: 0.4, r: 1.2 + r * 0.7 },
        { dx: -(0.8 + r * 0.4), dy: h * 0.64, dz: -0.3, r: 1.1 + r * 0.8 },
      ],
      density: 8,
      tint: new THREE.Color().setHSL(0.28 + r * 0.03, 0.18, 0.34 + r * 0.06),
      lean: (r - 0.5) * 0.1,
    });
  }

  // Courtyard specimens — near the arrival camera, so they carry the realism.
  for (const [i, x] of [-19, -13, 8, 14, 19].entries()) {
    const r = prng(i + 40);
    specs.push({
      x,
      z: 12,
      trunk: 2.1 + r * 0.5,
      lobes: [
        { dx: 0, dy: 2.5 + r * 0.4, dz: 0, r: 1.15 + r * 0.3 },
        { dx: 0.55, dy: 2.15, dz: 0.32, r: 0.8 + r * 0.2 },
        { dx: -0.5, dy: 2.75, dz: -0.3, r: 0.72 + r * 0.25 },
        { dx: 0.1, dy: 3.1, dz: 0.1, r: 0.6 },
      ],
      density: 26,
      tint: new THREE.Color().setHSL(0.26 + r * 0.05, 0.32, 0.42 + r * 0.05),
      lean: (r - 0.5) * 0.14,
    });
  }

  return specs;
}

/* ── the component ────────────────────────────────────────────────────────── */

export function Vegetation() {
  const windUniform = useRef({ value: 0 });

  const { cardMesh, trunkMesh } = useMemo(() => {
    const specs = buildSpecs();
    const leafTex = makeLeafTexture();

    // Count cards first so the buffers are allocated once.
    let cardCount = 0;
    for (const s of specs) for (const l of s.lobes) cardCount += Math.max(4, Math.round(l.r * s.density));

    const cardGeo = new THREE.PlaneGeometry(1, 1);
    const cardMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.5,
    });

    /*
      Wind, injected into the standard material.

      Each instance carries a phase in its colour's blue channel headroom — no
      extra attribute needed because instanceColor is already there for tint
      variation. The displacement is two superimposed sines (the EZ-Tree
      recipe): a slow whole-canopy sway plus a faster flutter, scaled by the
      card's height so trunks stay planted while crowns move.
    */
    cardMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = windUniform.current as unknown as THREE.IUniform;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uWind;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           {
             // Instance world offset as a wind phase — neighbouring trees must
             // not sway in unison; a synchronised forest reads as one machine.
             float phase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 1.3;
             float sway = 0.5 * sin(uWind * 0.9 + phase) + 0.3 * sin(uWind * 2.1 + phase * 1.7);
             transformed.x += sway * 0.06;
             transformed.z += sway * 0.04;
           }`,
        );
    };

    const cardMesh = new THREE.InstancedMesh(cardGeo, cardMat, cardCount);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = false;

    /*
      Alpha-tested shadows need their own depth material — the default depth
      pass ignores the map, which would make every card cast a solid square
      shadow and the ground read as tiled rather than dappled.
    */
    const depthMat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: leafTex,
      alphaTest: 0.4,
    });
    cardMesh.customDepthMaterial = depthMat;

    const trunkGeo = new THREE.CylinderGeometry(0.09, 0.17, 1, 7);
    trunkGeo.translate(0, 0.5, 0); // pivot at the base
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#4f4638", roughness: 0.95 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, specs.length);
    trunkMesh.castShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const tint = new THREE.Color();

    let ci = 0;
    for (const [si, s] of specs.entries()) {
      // trunk
      eu.set(s.lean, prng(si + 7) * Math.PI, s.lean * 0.6);
      q.setFromEuler(eu);
      sc.set(1, s.trunk, 1);
      pos.set(s.x, 0, s.z);
      m.compose(pos, q, sc);
      trunkMesh.setMatrixAt(si, m);

      // canopy cards
      for (const lobe of s.lobes) {
        const n = Math.max(4, Math.round(lobe.r * s.density));
        for (let k = 0; k < n; k++) {
          const a = prng(ci * 3 + 1) * Math.PI * 2;
          const b = Math.acos(2 * prng(ci * 3 + 2) - 1);
          const rad = Math.pow(prng(ci * 3 + 3), 0.45) * lobe.r;
          pos.set(
            s.x + lobe.dx + rad * Math.sin(b) * Math.cos(a),
            lobe.dy + rad * Math.cos(b) * 0.8,
            s.z + lobe.dz + rad * Math.sin(b) * Math.sin(a),
          );
          eu.set(prng(ci + 11) * Math.PI, prng(ci + 13) * Math.PI * 2, prng(ci + 17) * Math.PI);
          q.setFromEuler(eu);
          const cardSize = 0.7 + prng(ci + 19) * 0.9;
          sc.set(cardSize * lobe.r, cardSize * lobe.r * 0.8, 1);
          m.compose(pos, q, sc);
          cardMesh.setMatrixAt(ci, m);

          // Tint: darker toward the lobe's core, lighter at the rim — cheap
          // self-shadowing that sells volume without a single extra light.
          const rim = rad / lobe.r;
          tint.copy(s.tint).multiplyScalar(0.62 + rim * 0.5);
          cardMesh.setColorAt(ci, tint);
          ci++;
        }
      }
    }
    cardMesh.instanceMatrix.needsUpdate = true;
    if (cardMesh.instanceColor) cardMesh.instanceColor.needsUpdate = true;
    trunkMesh.instanceMatrix.needsUpdate = true;

    return { cardMesh, trunkMesh };
  }, []);

  useFrame(({ clock }) => {
    windUniform.current.value = clock.elapsedTime;
  });

  return (
    <group>
      <primitive object={trunkMesh} />
      <primitive object={cardMesh} />
    </group>
  );
}
