"use client";

import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * The Handoff Constellation, in 3D.
 *
 * Utility Connect's own logo is a ring of orbiting particles around a core. This
 * is that mark, made functional: referral sources orbit a central Move Record,
 * each connected by a line whose STATE is the product's language — verified,
 * conflicting, in-transit, pending. The 3D is not decoration; every node and
 * every line encodes real demo state, which is the bar the design system sets
 * for using 3D at all.
 *
 * It degrades honestly:
 *   - prefers-reduced-motion → renders static, no rotation
 *   - the 2D <Constellation> remains the fallback anywhere WebGL is unwanted
 * and it is performance-budgeted: a handful of nodes, thin lines, no shadows,
 * no post-processing, capped device pixel ratio.
 */

export interface Source3D {
  id: string;
  label: string;
  state: "verified" | "pending" | "conflict" | "transit";
}

const COLOR: Record<Source3D["state"], string> = {
  verified: "#0087b5",
  pending: "#8a8f98",
  conflict: "#e8a33d",
  transit: "#4da8c8",
};

function SourceNode({
  source,
  position,
  reducedMotion,
}: {
  source: Source3D;
  position: [number, number, number];
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const color = COLOR[source.state];

  useFrame((state) => {
    if (!ref.current || reducedMotion) return;
    // A gentle pulse for in-transit and conflict; verified sits calm.
    const t = state.clock.elapsedTime;
    const pulse = source.state === "transit" || source.state === "conflict";
    const s = pulse ? 1 + Math.sin(t * 3) * 0.12 : 1;
    ref.current.scale.setScalar(s);
  });

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={source.state === "verified" ? 0.5 : 0.35}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>
      {/* drei's Html scales children by distanceFactor / distance, so a SMALL
          factor keeps labels compact instead of ballooning as the camera nears
          in a short widget. */}
      <Html center distanceFactor={7} position={[0, 0.42, 0]} zIndexRange={[10, 0]}>
        <div
          style={{
            color: "#c4c9d0",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            letterSpacing: "0.01em",
            textShadow: "0 1px 3px rgba(0,0,0,0.85)",
          }}
        >
          {source.label}
        </div>
      </Html>
    </group>
  );
}

function Core({ converged, reducedMotion }: { converged: boolean; reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.3;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.42, 1]} />
      <meshStandardMaterial
        color={converged ? "#0087b5" : "#202830"}
        emissive={converged ? "#0087b5" : "#0d1418"}
        emissiveIntensity={converged ? 0.6 : 0.2}
        roughness={0.3}
        metalness={0.4}
        wireframe={!converged}
      />
    </mesh>
  );
}

function Scene({
  sources,
  converged,
  reducedMotion,
}: {
  sources: Source3D[];
  converged: boolean;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  // Distribute sources on a ring, tilted for depth.
  const positions = useMemo<[number, number, number][]>(() => {
    const r = 2.1;
    return sources.map((_, i) => {
      const a = (Math.PI * 2 * i) / sources.length;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.55, Math.sin(a) * r * 0.4];
    });
  }, [sources]);

  useFrame((state) => {
    if (!group.current || reducedMotion) return;
    // Slow orbit of the whole system — the logo motif, alive.
    group.current.rotation.y = state.clock.elapsedTime * 0.12;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 4]} intensity={40} color="#4da8c8" />
      <pointLight position={[-4, -2, -2]} intensity={20} color="#0087b5" />

      <group ref={group}>
        <Core converged={converged} reducedMotion={reducedMotion} />

        {sources.map((s, i) => {
          const p = positions[i]!;
          const color = COLOR[s.state];
          return (
            <group key={s.id}>
              <Line
                points={[p, [0, 0, 0]]}
                color={color}
                lineWidth={s.state === "conflict" ? 2.5 : 1.5}
                dashed={s.state === "pending"}
                dashScale={5}
                transparent
                opacity={converged ? 0.85 : 0.5}
              />
              <SourceNode source={s} position={p} reducedMotion={reducedMotion} />
            </group>
          );
        })}
      </group>
    </>
  );
}

export function Constellation3D({
  sources,
  converged = false,
  height = 420,
}: {
  sources: Source3D[];
  converged?: boolean;
  height?: number;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);

    // Cheap WebGL capability probe; fall back to a static SVG-free message.
    try {
      const c = document.createElement("canvas");
      if (!c.getContext("webgl") && !c.getContext("experimental-webgl")) setWebglOk(false);
    } catch {
      setWebglOk(false);
    }
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!webglOk) {
    return (
      <div
        style={{ height }}
        className="grid place-items-center rounded-2xl border text-sm"
      >
        <span style={{ color: "var(--color-text-lo)" }}>
          {sources.length} sources → one verified move
        </span>
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%", maxWidth: "100%" }}>
      <Canvas
        camera={{ position: [0, 0.5, 6], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <Suspense fallback={null}>
          <Scene sources={sources} converged={converged} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
