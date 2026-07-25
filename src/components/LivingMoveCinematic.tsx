"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { DetailedHouse } from "./HouseModel";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import * as THREE from "three";

/**
 * The Living Move — the cinematic.
 *
 * One continuous 3D scene; scroll is the timeline. The camera travels a
 * choreographed path through seven chapters while the scene itself acts the
 * story: a dark house at night, three referral signals flying in, a conflict
 * flaring amber above the roof, the merge igniting the core, the windows
 * waking room by room, the power line going silent mid-glow (UNKNOWN — the
 * lights PAUSE, they do not go red), the recovery completing the light and
 * drawing the protection ring, and finally the pull-back into a neighborhood
 * where every home joins the verified network.
 *
 * Everything animates from one scalar — scroll progress — so the experience is
 * fully scrubbable, deterministic, and interruptible. Reduced-motion and
 * no-WebGL fall back to a static telling. No external assets: the house, the
 * night, and the network are all built from primitives and light.
 */

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const CH = {
  prologue: [0.0, 0.14],
  referral: [0.14, 0.3],
  conflict: [0.3, 0.44],
  wake: [0.44, 0.6],
  failure: [0.6, 0.73],
  recovery: [0.73, 0.86],
  continuum: [0.86, 1.0],
} as const;

const local = (p: number, [a, b]: readonly [number, number]) =>
  THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

// Camera keyframes: [progress, position, lookAt]
// The house is ~6.4 wide and ~5 tall; every station keeps the whole silhouette
// in frame. Earlier keyframes sat close enough to be INSIDE the facade, which
// turned the frame into abstract glowing rectangles — a cinematic needs the
// subject readable, so the camera orbits rather than intrudes.
const CAM: Array<[number, THREE.Vector3, THREE.Vector3]> = [
  [0.0, new THREE.Vector3(19, 6.5, 22), new THREE.Vector3(0, 2.2, 0)],
  [0.14, new THREE.Vector3(15, 7.5, 17), new THREE.Vector3(0, 2.6, 0)],
  [0.3, new THREE.Vector3(9, 8.5, 15), new THREE.Vector3(0, 3.6, 0)],
  [0.44, new THREE.Vector3(12, 4.5, 14), new THREE.Vector3(0, 2.2, 0)],
  [0.6, new THREE.Vector3(-14, 5, 12), new THREE.Vector3(-3, 2.8, 1)],
  [0.73, new THREE.Vector3(-9, 5.5, 16), new THREE.Vector3(0, 2.2, 0)],
  [0.86, new THREE.Vector3(11, 9, 19), new THREE.Vector3(0, 1.6, 0)],
  // The final pull-back must still read as a neighborhood seen from above the
  // hero house — too high and the subject shrinks to a speck in empty night.
  [1.0, new THREE.Vector3(4, 22, 34), new THREE.Vector3(0, 1.5, 0)],
];

function cameraAt(p: number, pos: THREE.Vector3, look: THREE.Vector3): void {
  let i = 0;
  while (i < CAM.length - 2 && p > CAM[i + 1]![0]) i++;
  const [p0, a0, l0] = CAM[i]!;
  const [p1, a1, l1] = CAM[i + 1]!;
  const t = ease(THREE.MathUtils.clamp((p - p0) / (p1 - p0), 0, 1));
  pos.lerpVectors(a0, a1, t);
  look.lerpVectors(l0, l1, t);
}

const CYAN = new THREE.Color("#0087b5");
const AMBER = new THREE.Color("#e8a33d");

// --- Sky ------------------------------------------------------------------

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  varying vec3 vDir;
  void main() {
    // Brighter toward the horizon, where there is more atmosphere to scatter
    // light, and deepest overhead. The curve is steep so most of the frame
    // stays dark and the house keeps the eye.
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
    gl_FragColor = vec4(c, 1.0);
  }
`;

const SKY_UNIFORMS = {
  uZenith: { value: new THREE.Color("#05080c") },
  uHorizon: { value: new THREE.Color("#16263a") },
};

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

function Scene({ progress }: { progress: MotionValue<number> }) {
  const orbRefs = useRef<(THREE.Mesh | null)[]>([]);
  const conflictMat = useRef<THREE.MeshStandardMaterial>(null);
  const conflictMesh = useRef<THREE.Mesh>(null);
  const wireMat = useRef<THREE.MeshStandardMaterial>(null);
  const ringMesh = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshStandardMaterial>(null);
  const hoodGroup = useRef<THREE.Group>(null);

  // Referral flight paths: three arcs from the night sky to the core.
  const paths = useRef(
    [
      [new THREE.Vector3(-14, 9, 6), new THREE.Vector3(-6, 7, 4)],
      [new THREE.Vector3(15, 8, -2), new THREE.Vector3(7, 6.5, 1)],
      [new THREE.Vector3(2, 12, 14), new THREE.Vector3(1, 8, 7)],
    ].map(
      ([a, b]) => new THREE.QuadraticBezierCurve3(a, b, new THREE.Vector3(0, 2.4, 0.4)),
    ),
  );

  const camPos = useRef(new THREE.Vector3());
  const camLook = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    const p = progress.get();
    const t = clock.elapsedTime;

    // ── Camera ──────────────────────────────────────────────
    cameraAt(p, camPos.current, camLook.current);
    // A breath of drift so held frames stay alive.
    camera.position.set(
      camPos.current.x + Math.sin(t * 0.3) * 0.15,
      camPos.current.y + Math.sin(t * 0.23) * 0.1,
      camPos.current.z,
    );
    camera.lookAt(camLook.current);

    // ── Referral orbs ───────────────────────────────────────
    const fly = local(p, CH.referral);
    orbRefs.current.forEach((orb, i) => {
      if (!orb) return;
      const t0 = THREE.MathUtils.clamp(fly * 1.3 - i * 0.15, 0, 1);
      paths.current[i]!.getPoint(ease(t0), orb.position);
      const dissolve = local(p, CH.conflict);
      const s = (0.17 + 0.05 * Math.sin(t * 4 + i)) * (1 - dissolve);
      orb.scale.setScalar(p < CH.referral[0] ? 0 : Math.max(s, 0.0001));
    });

    // ── Conflict flare above the roof ───────────────────────
    const con = local(p, CH.conflict);
    const conOut = local(p, CH.wake);
    if (conflictMesh.current && conflictMat.current) {
      const vis = Math.min(con * 2, 1) * (1 - conOut);
      conflictMesh.current.scale.setScalar(Math.max(vis * (0.5 + 0.08 * Math.sin(t * 14)), 0.0001));
      conflictMesh.current.rotation.y = t * 1.5;
      // Well above 1.0 so bloom catches it and the flare actually burns.
      conflictMat.current.emissiveIntensity = vis * (4.5 + Math.sin(t * 14) * 1.8);
    }

    // Wire state still needs these beats; the house owns its own windows.
    const wake = local(p, CH.wake);
    const fail = local(p, CH.failure);
    const recover = local(p, CH.recovery);

    // ── The power line: silent ≠ dead ───────────────────────
    if (wireMat.current) {
      const base = wake > 0.2 ? 1 : 0.25;
      const wf = fail > 0 && recover < 1 ? 0.3 + 0.7 * Math.abs(Math.sin(t * 22)) : 1;
      wireMat.current.emissive = fail > 0 && recover < 1 ? AMBER : CYAN;
      wireMat.current.emissiveIntensity = base * wf * (1.2 + recover * 2.4);
    }

    // ── Recovery draws the protection ring ──────────────────
    if (ringMesh.current && ringMat.current) {
      const r = ease(recover) * (1 - local(p, CH.continuum) * 0.4);
      ringMesh.current.scale.setScalar(Math.max(r, 0.0001));
      ringMesh.current.rotation.z = t * 0.4;
      ringMat.current.opacity = Math.min(recover * 2, 1) * 0.8;
    }

    // ── The continuum: a neighborhood joins the network ─────
    const hood = local(p, CH.continuum);
    if (hoodGroup.current) {
      hoodGroup.current.visible = hood > 0;
      hoodGroup.current.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
        if (mat && "opacity" in mat) {
          mat.opacity = ease(hood);
          if (mat.emissive) mat.emissiveIntensity = ease(hood) * 1.2;
        }
      });
    }
  });

  return (
    <>
      <fog attach="fog" args={["#0a0f15", 22, 75]} />

      {/*
        A procedural night environment.

        Matte surfaces with nothing to reflect are the deepest tell of a fake
        render — a real wall samples the sky, the ground, and every light around
        it. These Lightformers are baked into an env map in-engine (no HDRI
        download, works offline), giving every PBR material something true to
        sample: cool sky above, warm bounce at porch height, cyan rim behind.
      */}
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={0.55} color="#8fb0d8" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
        <Lightformer intensity={0.35} color="#ffc65c" position={[0, 2, 9]} scale={[10, 4, 1]} />
        <Lightformer intensity={0.4} color="#0087b5" position={[-12, 5, -10]} scale={[14, 8, 1]} />
        <Lightformer intensity={0.2} color="#16202c" position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>

      {/* Moonlight — the only shadow-caster, so the house drops one clean,
          directional shadow instead of a muddy overlap of several. */}
      <ambientLight intensity={0.34} color="#6b86a8" />
      {/* The moon sits high and BEHIND-RIGHT so the house throws its shadow
          toward the camera side. A shadow cast away from the viewer is a
          shadow nobody sees — which is the same as having none. */}
      <directionalLight
        position={[15, 19, -7]}
        intensity={1.5}
        color="#9fb8dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.035}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      {/* Rim light from behind-right: separates the roofline from the night sky
          so the silhouette reads as architecture, not a hole in the frame. */}
      <directionalLight position={[14, 9, -12]} intensity={0.6} color="#4da8c8" />

      {/*
        Sky dome. Flat black is not night — real night has a gradient, brighter
        near the horizon where the atmosphere is thickest. Rendered on the
        inside of a sphere, unlit, behind everything.
      */}
      <mesh scale={[-1, 1, 1]}>
        <sphereGeometry args={[120, 32, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={SKY_UNIFORMS}
          vertexShader={SKY_VERT}
          fragmentShader={SKY_FRAG}
        />
      </mesh>

      <Stars />

      {/* Ground — receives the house's shadow, which is what puts the house ON
          the ground rather than above a picture of it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#0f151d" roughness={0.85} metalness={0.1} envMapIntensity={0.6} />
      </mesh>

      {/*
        Contact shadow — the grounding pass.

        A directional shadow map alone gets washed out by ambient and
        environment fill, which is exactly why the house still looked like it
        was hovering. This renders the silhouette from below into its own
        texture, so there is always a dense pool of darkness where the building
        meets the earth. It is the single cue that says "this object has
        weight".
      */}
      <ContactShadows
        position={[0, 0.02, 0]}
        scale={26}
        resolution={1024}
        blur={2.4}
        opacity={0.85}
        far={9}
        color="#000308"
        frames={1}
      />

      {/* Ground haze — a soft light pool under the house. Depth without cost:
          the frame reads atmospheric rather than as objects floating in void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 1]}>
        <circleGeometry args={[14, 48]} />
        <meshBasicMaterial color="#12202c" transparent opacity={0.55} depthWrite={false} />
      </mesh>

      {/* ── The house — modeled, with custom shaders ───────── */}
      <DetailedHouse progress={progress} wake={CH.wake} fail={CH.failure} recover={CH.recovery} />

      {/* Referral signals */}
      {[CYAN, AMBER, new THREE.Color("#4da8c8")].map((c, i) => (
        <mesh
          key={i}
          ref={(m) => {
            orbRefs.current[i] = m;
          }}
          scale={0.0001}
        >
          <sphereGeometry args={[1, 20, 20]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.2} />
        </mesh>
      ))}

      {/* Conflict flare */}
      <mesh ref={conflictMesh} position={[0, 4.9, 0.4]} scale={0.0001}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={conflictMat} color={AMBER} emissive={AMBER} emissiveIntensity={0} />
      </mesh>

      {/* Power pole + line — the provider connection */}
      <group>
        <mesh position={[-8, 1.9, 2]}>
          <cylinderGeometry args={[0.09, 0.11, 3.8, 8]} />
          <meshStandardMaterial color="#1a222c" />
        </mesh>
        <mesh position={[-8, 3.5, 2]}>
          <boxGeometry args={[1.3, 0.09, 0.09]} />
          <meshStandardMaterial color="#1a222c" />
        </mesh>
        <mesh position={[-5.5, 3.1, 1.6]} rotation={[0, 0, -0.16]}>
          <cylinderGeometry args={[0.022, 0.022, 5.2, 6]} />
          <meshStandardMaterial ref={wireMat} color="#28323c" emissive={CYAN} emissiveIntensity={0.25} />
        </mesh>
      </group>

      {/* Protection ring */}
      <mesh ref={ringMesh} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.0001}>
        <torusGeometry args={[5.4, 0.05, 12, 80]} />
        <meshStandardMaterial ref={ringMat} color={CYAN} emissive={CYAN} emissiveIntensity={1.4} transparent opacity={0} />
      </mesh>

      {/* Neighborhood */}
      <group ref={hoodGroup} visible={false}>
        {NEIGHBORHOOD.map((h, i) => (
          <group key={i} position={[h.x, 0, h.z]}>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={[2.2, 1.4, 1.8]} />
              <meshStandardMaterial color="#18202a" transparent opacity={0} />
            </mesh>
            <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[1.7, 0.9, 4]} />
              <meshStandardMaterial color="#121a23" transparent opacity={0} flatShading />
            </mesh>
            <mesh position={[0, 0.75, 0.91]}>
              <planeGeometry args={[0.5, 0.5]} />
              <meshStandardMaterial color="#0e1319" emissive={CYAN} emissiveIntensity={0} transparent opacity={0} />
            </mesh>
            {/*
              These lines live inside a group translated to (h.x, h.z), so an
              endpoint of (-h.x, -h.z) resolves to the WORLD ORIGIN — every
              house fired a beam straight through the hero home, producing a
              starburst. The link must end just outside this house instead,
              suggesting a mesh rather than a hub-and-spoke.
            */}
            <Line
              points={[
                [0, 1.4, 0],
                [-Math.sign(h.x) * 3.2, 1.2, -Math.sign(h.z) * 3.0],
              ]}
              color="#0087b5"
              lineWidth={1}
              transparent
              opacity={0.22}
            />
          </group>
        ))}
      </group>
    </>
  );
}

const NEIGHBORHOOD = (() => {
  const out: Array<{ x: number; z: number }> = [];
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      if (Math.abs(gx) < 2 && Math.abs(gz) < 2) continue; // keep the hero house clear
      out.push({ x: gx * 9 + (((gx * 7 + gz * 13) % 5) - 2) * 0.6, z: gz * 8 + (((gx * 5 + gz * 11) % 5) - 2) * 0.6 });
    }
  }
  return out;
})();

function Stars() {
  const geom = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    if (!geom.current) return;
    const n = 350;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 80 + ((i * 37) % 40);
      const theta = ((i * 61) % 360) * (Math.PI / 180);
      const phi = (((i * 23) % 70) + 8) * (Math.PI / 180);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geom.current.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  }, []);
  return (
    <points>
      <bufferGeometry ref={geom} />
      <pointsMaterial size={0.22} color="#9db4d0" transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

interface OverlayDef {
  range: readonly [number, number];
  eyebrow: string;
  title: string;
  body: string;
  side: "left" | "center" | "right";
  tone?: "amber" | "cyan";
}

const OVERLAYS: OverlayDef[] = [
  {
    range: [0.015, 0.125],
    eyebrow: "The Living Move",
    title: "Moving gives you a new address.\nConnecting it makes it a home.",
    body: "A house at night, keys in hand, nothing switched on. Scroll.",
    side: "center",
  },
  {
    range: [0.16, 0.28],
    eyebrow: "Chapter 1 · The referral",
    title: "One move arrives three times",
    body: "Her agent's system, a hand-exported spreadsheet, and Maya herself — three signals racing toward one record.",
    side: "left",
  },
  {
    range: [0.32, 0.42],
    eyebrow: "Chapter 2 · The disagreement",
    title: "August 14. August 16.\nOne digit off.",
    body: "The sources collide. The system scores the conflict and waits — amber, not red. A disagreement is not a failure; it is a question for a human.",
    side: "right",
    tone: "amber",
  },
  {
    range: [0.46, 0.58],
    eyebrow: "Chapter 3 · The merge",
    title: "A named human decides.\nThe house wakes.",
    body: "concierge-7 approves the record. The core turns verified-cyan and the rooms light one by one — electric, internet, security.",
    side: "left",
    tone: "cyan",
  },
  {
    range: [0.62, 0.71],
    eyebrow: "Chapter 4 · The silence",
    title: "The provider goes quiet.\nThe lights pause.",
    body: "The order was created — the response was lost. The system calls it UNKNOWN and refuses to guess. No blind retry. No duplicate. The wire hums amber.",
    side: "right",
    tone: "amber",
  },
  {
    range: [0.75, 0.84],
    eyebrow: "Chapter 5 · The recovery",
    title: "Ask the provider.\nFinish the light.",
    body: "Reconciliation finds the order that existed all along. The last rooms complete, and the protection ring closes around the home. One order. Never two.",
    side: "left",
    tone: "cyan",
  },
  {
    range: [0.885, 1.0],
    eyebrow: "Chapter 6 · The continuum",
    title: "Every home, one verified network",
    body: "The move ends; the relationship doesn't. Every house that joins keeps its truth — attributable, consented, auditable.",
    side: "center",
  },
];

function Overlay({ progress, def }: { progress: MotionValue<number>; def: OverlayDef }) {
  const [a, b] = def.range;
  const opacity = useTransform(progress, [a, a + 0.025, b - 0.025, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [26, -26]);
  const accent = def.tone === "amber" ? "var(--color-state-conflict)" : "var(--color-state-verified)";

  return (
    <motion.div
      style={{ opacity, y }}
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-end px-6 pb-16 sm:px-14 ${
        def.side === "center" ? "justify-center text-center" : def.side === "right" ? "justify-end text-right" : "justify-start"
      }`}
    >
      {/*
        Copy sits in the lower third with its own scrim. Centred text fought
        the house for the middle of the frame and lost — a cinematic keeps the
        subject clear and the words beneath it, legible over any brightness.
      */}
      <div
        className="max-w-md rounded-2xl px-5 py-4 backdrop-blur-[2px]"
        style={{ background: "linear-gradient(180deg, rgba(6,10,14,0.55), rgba(6,10,14,0.82))" }}
      >
        <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
          {def.eyebrow}
        </div>
        <h2 className="mt-2 whitespace-pre-line text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
          {def.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: "rgba(255,255,255,0.78)" }}>
          {def.body}
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function LivingMoveCinematic() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  const [webgl, setWebgl] = useState(true);
  const barScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);
  const hintDisplay = useTransform(scrollYProgress, (v) => (v > 0.05 ? "none" : "flex"));

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl2") && !c.getContext("webgl")) setWebgl(false);
    } catch {
      setWebgl(false);
    }
  }, []);

  if (reduce || !webgl) return <StaticStory />;

  return (
    <div ref={ref} style={{ height: "700vh", background: "#0a0f15" }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Canvas
          camera={{ position: [16, 5.5, 18], fov: 42 }}
          dpr={[1, 1.6]}
          shadows={{ type: THREE.PCFSoftShadowMap }}
          gl={{ antialias: true }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Scene progress={scrollYProgress} />

          {/*
            The post pipeline is what separates "lit primitives" from a
            cinematic frame. Emissive surfaces alone do not glow — bloom is
            what makes a warm window bleed into the night, the conflict flare
            burn, and the verified core read as light rather than paint.
            Vignette pulls focus to the house; a whisper of chromatic
            aberration gives the frame a lens instead of a render.
          */}
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={1.5}
              luminanceThreshold={0.25}
              luminanceSmoothing={0.35}
              kernelSize={KernelSize.LARGE}
              mipmapBlur
            />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={[0.0006, 0.0009]}
              radialModulation={false}
              modulationOffset={0}
            />
            <Vignette eskil={false} offset={0.22} darkness={0.85} />
          </EffectComposer>
        </Canvas>

        {OVERLAYS.map((def) => (
          <Overlay key={def.range[0]} progress={scrollYProgress} def={def} />
        ))}

        {/* scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity, display: hintDisplay }}
          className="pointer-events-none absolute inset-x-0 bottom-8 justify-center"
        >
          <div className="flex flex-col items-center gap-2 text-white/50">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">scroll to begin</span>
            <span className="animate-bounce text-xl" aria-hidden>↓</span>
          </div>
        </motion.div>

        {/* progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <motion.div
            style={{ scaleX: barScale, transformOrigin: "left" }}
            className="h-full"
            // brand cyan carries the story's progress — the verified line, filling
            // as the move completes
          >
            <div className="h-full w-full" style={{ background: "var(--color-state-verified)" }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** The same story, told still — reduced-motion and no-WebGL both land here. */
function StaticStory() {
  return (
    <section className="px-6 py-24" style={{ background: "#0a0f15" }}>
      <div className="mx-auto max-w-2xl space-y-14">
        {OVERLAYS.map((o) => (
          <div key={o.range[0]}>
            <div
              className="text-xs font-bold uppercase tracking-[0.3em]"
              style={{ color: o.tone === "amber" ? "var(--color-state-conflict)" : "var(--color-state-verified)" }}
            >
              {o.eyebrow}
            </div>
            <h2 className="mt-2 whitespace-pre-line text-2xl font-bold text-white">{o.title}</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>{o.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
