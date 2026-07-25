"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";

/**
 * The house — modeled, not blocked out.
 *
 * The previous pass was six boxes and six glowing rectangles. This is real
 * architecture built procedurally: framed windows with mullions and recessed
 * glass, lap siding driven by a generated texture, a porch with columns and a
 * roof, fascia boards, a paneled door with a step, corner trim, and a chimney
 * with a cap. Everything is still code — no downloaded assets — but it reads
 * as a home rather than a diagram.
 *
 * Two custom shaders do the work bloom alone could not:
 *
 *   WINDOW GLOW  — interior light pools low (lamps sit below eye level), falls
 *   off at the glass edge so the pane reads as light BEHIND glass, and carries
 *   a per-window flicker so the house feels inhabited rather than switched on.
 *
 *   LIGHT SHAFT  — a volumetric cone per window: brightness falls with the
 *   distance travelled, the silhouette softens where the cone turns away from
 *   the camera, and slow dust drifts through the beam. This is what makes warm
 *   light feel like it is moving through night air.
 *
 * All of it is driven by one scalar — scroll progress — so the house wakes,
 * freezes mid-glow during the provider silence, and completes on recovery.
 */

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform float uIntensity;
  uniform float uTime;
  uniform float uSeed;
  uniform vec3  uWarm;
  varying vec2  vUv;

  void main() {
    // Interior light pools toward the lower half of a pane: lamps, counters and
    // screens all sit below eye level. A flat fill is the tell of a fake window.
    float vertical = 0.42 + 0.58 * smoothstep(0.05, 0.9, 1.0 - vUv.y);

    // Soft falloff at the glass edge so the pane reads as light behind glass
    // rather than a glowing sticker pasted on the wall.
    vec2  c    = abs(vUv - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.62, 1.0, max(c.x, c.y));

    // A slow, per-window flicker. A home is not an array of identical bulbs.
    float flicker = 0.93 + 0.07 * sin(uTime * (1.4 + uSeed * 1.7) + uSeed * 6.2831);

    float a = uIntensity * vertical * edge * flicker;
    gl_FragColor = vec4(uWarm * (0.55 + a * 0.9), a);
  }
`;

const SHAFT_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SHAFT_FRAG = /* glsl */ `
  uniform float uIntensity;
  uniform float uTime;
  uniform float uHalf;    // half height of the cone
  uniform vec3  uWarm;
  varying vec3  vPos;
  varying vec3  vWorldPos;
  varying vec3  vWorldNormal;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  void main() {
    // Distance travelled from the window (apex at +Y) toward the far end.
    float d = clamp((uHalf - vPos.y) / (uHalf * 2.0), 0.0, 1.0);

    // Light thins as it travels — quadratic, the way real scatter falls off.
    float travel = pow(1.0 - d, 2.2);

    // The cone's silhouette must soften where it turns away from the camera,
    // otherwise a volumetric beam betrays itself as a solid cone.
    vec3  viewDir = normalize(cameraPosition - vWorldPos);
    float facing  = 1.0 - abs(dot(normalize(vWorldNormal), viewDir));
    facing = pow(clamp(facing, 0.0, 1.0), 1.6);

    // Slow dust drifting through the beam.
    float dust = 0.88 + 0.12 * hash(floor(vWorldPos * 3.0 + vec3(0.0, uTime * 0.35, 0.0)));

    float a = uIntensity * travel * facing * dust * 0.5;
    gl_FragColor = vec4(uWarm, a);
  }
`;

// ---------------------------------------------------------------------------
// Generated siding texture — real lap lines that catch real light
// ---------------------------------------------------------------------------

function useSidingMaps() {
  return useMemo(() => {
    const make = (draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      draw(ctx, c.width, c.height);
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
      return tex;
    };

    // Horizontal lap siding: a board every 16px with a shadow line beneath it.
    const map = make((ctx, w, h) => {
      ctx.fillStyle = "#232c38";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = "#1a2029";
        ctx.fillRect(0, y + 13, w, 3);
        ctx.fillStyle = "#27313e";
        ctx.fillRect(0, y, w, 2);
      }
    });

    // The same lines as height, so the boards catch and drop real light.
    const bump = make((ctx, w, h) => {
      ctx.fillStyle = "#808080";
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        ctx.fillStyle = "#101010";
        ctx.fillRect(0, y + 13, w, 3);
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, y, w, 2);
      }
    });

    return { map, bump };
  }, []);
}

// ---------------------------------------------------------------------------
// Window: frame + mullions + recessed glass + volumetric shaft
// ---------------------------------------------------------------------------

export interface WindowSlot {
  pos: [number, number, number];
  /** Y rotation; the window's outward normal follows it. */
  rotY?: number;
  w?: number;
  h?: number;
}

const WARM = new THREE.Color("#ffc65c");

function HouseWindow({
  slot,
  index,
  glowRef,
  shaftRef,
}: {
  slot: WindowSlot;
  index: number;
  glowRef: (m: THREE.ShaderMaterial | null) => void;
  shaftRef: (m: THREE.ShaderMaterial | null) => void;
}) {
  const w = slot.w ?? 0.95;
  const h = slot.h ?? 1.15;
  const rotY = slot.rotY ?? 0;
  const t = 0.06;

  const glowUniforms = useMemo(
    () => ({
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: (index * 0.37) % 1 },
      uWarm: { value: WARM.clone() },
    }),
    [index],
  );

  const shaftUniforms = useMemo(
    () => ({
      uIntensity: { value: 0 },
      uTime: { value: 0 },
      uHalf: { value: 2.6 },
      uWarm: { value: WARM.clone() },
    }),
    [],
  );

  return (
    <group position={slot.pos} rotation={[0, rotY, 0]}>
      {/* Reveal — the dark opening the glass sits inside, giving real depth.
          It must sit BEHIND the glass in +Z, or the wall occludes the light. */}
      <mesh position={[0, 0, -0.09]}>
        <boxGeometry args={[w, h, 0.12]} />
        <meshStandardMaterial color="#10151c" roughness={1} />
      </mesh>

      {/* Glass — slightly proud of the reveal, recessed behind the casing */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[w - 0.1, h - 0.1]} />
        <shaderMaterial
          ref={glowRef}
          vertexShader={GLOW_VERT}
          fragmentShader={GLOW_FRAG}
          uniforms={glowUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Frame: sill, header, jambs — proportioned like real casing */}
      <mesh position={[0, h / 2 + t / 2, 0.03]}>
        <boxGeometry args={[w + 0.16, t * 1.6, 0.1]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.75} />
      </mesh>
      <mesh position={[0, -h / 2 - t / 2, 0.05]}>
        <boxGeometry args={[w + 0.22, t * 1.8, 0.16]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.75} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w + t)) / 2, 0, 0.03]}>
          <boxGeometry args={[t * 1.4, h + t, 0.1]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.75} />
        </mesh>
      ))}

      {/* Mullions — the cross that makes a rectangle read as a window */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[0.045, h - 0.08, 0.05]} />
        <meshStandardMaterial color="#dcd8d0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, 0.02]}>
        <boxGeometry args={[w - 0.08, 0.045, 0.05]} />
        <meshStandardMaterial color="#dcd8d0" roughness={0.8} />
      </mesh>

      {/* Volumetric shaft: apex at the glass, spilling outward into the night */}
      <mesh position={[0, -0.1, 2.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[1.5, 5.2, 22, 1, true]} />
        <shaderMaterial
          ref={shaftRef}
          vertexShader={SHAFT_VERT}
          fragmentShader={SHAFT_FRAG}
          uniforms={shaftUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The house
// ---------------------------------------------------------------------------

/** Windows in wake order: ground floor first, then upstairs. */
export const WINDOW_SLOTS: WindowSlot[] = [
  { pos: [-1.85, 1.55, 2.08] },
  { pos: [1.85, 1.55, 2.08] },
  { pos: [-3.09, 1.55, 0.4], rotY: -Math.PI / 2 },
  { pos: [3.09, 1.55, 0.4], rotY: Math.PI / 2 },
  { pos: [-1.15, 3.35, 1.78], w: 0.8, h: 0.9 },
  { pos: [1.15, 3.35, 1.78], w: 0.8, h: 0.9 },
];

const CYAN = new THREE.Color("#0087b5");
const AMBER = new THREE.Color("#e8a33d");

export function DetailedHouse({
  progress,
  wake,
  fail,
  recover,
}: {
  progress: MotionValue<number>;
  /** [start, end] scroll ranges for each beat. */
  wake: readonly [number, number];
  fail: readonly [number, number];
  recover: readonly [number, number];
}) {
  const { map, bump } = useSidingMaps();
  const glowMats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const shaftMats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreLight = useRef<THREE.PointLight>(null);
  const spill = useRef<THREE.PointLight>(null);

  const localOf = (p: number, [a, b]: readonly [number, number]) =>
    THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);

  useFrame(({ clock }) => {
    const p = progress.get();
    const t = clock.elapsedTime;
    const w = localOf(p, wake);
    const f = localOf(p, fail);
    const r = localOf(p, recover);

    // During the silence the unfinished rooms stutter — the lights PAUSE, they
    // do not fail. Recovery steadies and completes them.
    const stutter = f > 0 && r < 1 ? 0.72 + 0.28 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 3.1)) : 1;

    for (let i = 0; i < WINDOW_SLOTS.length; i++) {
      // Rooms light in sequence but the whole house is warm well before the
      // chapter ends — a stagger that outruns its own scroll range reads as
      // half the windows being broken.
      const staged = THREE.MathUtils.clamp(w * 3.4 - i * 0.38, 0, 1);
      // Rooms 4-6 were still filling when the response was lost: they hold
      // where the silence caught them until reconciliation finishes the light.
      const held = i >= 3 ? Math.min(staged, 0.45 + r * 0.55) : staged;
      const lit = i >= 3 && f > 0 ? held * (stutter * (1 - r) + r) : staged;

      const g = glowMats.current[i];
      if (g) {
        // A lit pane must sit far above the bloom threshold. Additive blending
        // over a near-black reveal eats low values, so a "half-lit" window at
        // 0.5 intensity simply looks broken — the curve has to start high.
        g.uniforms.uIntensity!.value = lit * 3.0;
        g.uniforms.uTime!.value = t;
      }
      const s = shaftMats.current[i];
      if (s) {
        // Restrained: a shaft should suggest light in the air, not floodlight
        // the lawn. Too strong and the beams read as solid geometry.
        s.uniforms.uIntensity!.value = lit * 0.3;
        s.uniforms.uTime!.value = t;
      }
    }

    if (spill.current) spill.current.intensity = w * 3.2 * (f > 0 ? stutter * (1 - r) + r : 1);
    if (coreMat.current) {
      coreMat.current.emissive = w > 0 ? CYAN : AMBER;
      coreMat.current.emissiveIntensity = 0.6 + w * 4.5;
    }
    if (coreLight.current) coreLight.current.intensity = w * 9;
  });

  return (
    <group>
      {/* Warm spill in front of the facade — the walls must catch the light the
          windows throw, or the house reads as unlit boxes with bright stickers. */}
      <pointLight ref={spill} position={[0, 2, 5]} color="#ffc65c" intensity={0} distance={18} />
      <pointLight ref={coreLight} position={[0, 2.9, 0.4]} color="#0087b5" intensity={0} distance={10} />

      {/* Foundation */}
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <boxGeometry args={[6.7, 0.32, 4.7]} />
        <meshStandardMaterial color="#161c24" roughness={0.95} />
      </mesh>

      {/* Main body — lap siding */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[6.3, 2.85, 4.3]} />
        <meshStandardMaterial map={map} bumpMap={bump} bumpScale={0.035} color="#8ea2b8" roughness={0.88} />
      </mesh>

      {/* Corner trim */}
      {([[-3.16, 2.16], [3.16, 2.16], [-3.16, -2.16], [3.16, -2.16]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.75, z]}>
          <boxGeometry args={[0.16, 2.9, 0.16]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
        </mesh>
      ))}

      {/* Belt course between floors */}
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[6.45, 0.14, 4.45]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
      </mesh>

      {/* Upper floor */}
      <mesh position={[0, 3.75, -0.2]}>
        <boxGeometry args={[5.4, 1.25, 3.6]} />
        <meshStandardMaterial map={map} bumpMap={bump} bumpScale={0.03} color="#8ea2b8" roughness={0.88} />
      </mesh>

      {/* Fascia under the roof — the shadow line that sells a real eave */}
      <mesh position={[0, 4.42, -0.2]}>
        <boxGeometry args={[6.0, 0.18, 4.2]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
      </mesh>

      {/* Hip roof */}
      <mesh position={[0, 5.2, -0.2]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[4.0, 1.7, 4]} />
        <meshStandardMaterial color="#2a3340" roughness={0.95} flatShading metalness={0.1} />
      </mesh>

      {/* Chimney with a cap */}
      <mesh position={[1.9, 5.1, -1.3]}>
        <boxGeometry args={[0.6, 1.7, 0.6]} />
        <meshStandardMaterial color="#1e252e" roughness={1} />
      </mesh>
      <mesh position={[1.9, 6.0, -1.3]}>
        <boxGeometry args={[0.78, 0.12, 0.78]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.85} />
      </mesh>

      {/* ── Porch ───────────────────────────────────────────── */}
      <mesh position={[0, 0.36, 2.9]}>
        <boxGeometry args={[3.4, 0.16, 1.6]} />
        <meshStandardMaterial color="#3a3129" roughness={0.95} />
      </mesh>
      {/* step */}
      <mesh position={[0, 0.14, 3.78]}>
        <boxGeometry args={[2.2, 0.16, 0.5]} />
        <meshStandardMaterial color="#332b24" roughness={0.95} />
      </mesh>
      {/* columns */}
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.4, 3.5]}>
          <cylinderGeometry args={[0.11, 0.13, 2.0, 10]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
        </mesh>
      ))}
      {/* porch roof + fascia */}
      <mesh position={[0, 2.46, 3.0]}>
        <boxGeometry args={[3.6, 0.14, 1.9]} />
        <meshStandardMaterial color="#2a3340" roughness={0.95} />
      </mesh>
      <mesh position={[0, 2.36, 3.9]}>
        <boxGeometry args={[3.6, 0.16, 0.12]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.8} />
      </mesh>

      {/* Front door with panels and a lit fixture */}
      <group position={[0, 1.28, 2.16]}>
        <mesh>
          <boxGeometry args={[1.02, 2.0, 0.1]} />
          <meshStandardMaterial color="#123344" roughness={0.6} metalness={0.15} />
        </mesh>
        {[0.42, -0.42].map((y) => (
          <mesh key={y} position={[0, y, 0.06]}>
            <boxGeometry args={[0.62, 0.62, 0.03]} />
            <meshStandardMaterial color="#0e2a38" roughness={0.65} />
          </mesh>
        ))}
        <mesh position={[0.36, 0, 0.09]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
      {/* porch light */}
      <mesh position={[0.78, 2.05, 2.2]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#ffd88a" emissive="#ffc65c" emissiveIntensity={2.4} />
      </mesh>

      {/* Windows */}
      {WINDOW_SLOTS.map((slot, i) => (
        <HouseWindow
          key={i}
          slot={slot}
          index={i}
          glowRef={(m) => {
            glowMats.current[i] = m;
          }}
          shaftRef={(m) => {
            shaftMats.current[i] = m;
          }}
        />
      ))}

      {/* The Move core — the canonical record, made visible above the roof */}
      <mesh position={[0, 2.9, 0.4]}>
        <icosahedronGeometry args={[0.34, 1]} />
        <meshStandardMaterial ref={coreMat} color="#202830" emissive={AMBER} emissiveIntensity={0.6} wireframe />
      </mesh>
    </group>
  );
}
