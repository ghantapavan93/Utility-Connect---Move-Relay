"use client";

import { MATERIAL, SERVICE } from "./palette";

/**
 * Fixtures for the services the residence was not yet showing.
 *
 * Utility Connect's enrollment form offers eighteen services. The house was
 * built around six of them — the six that light up well — and named about nine.
 * The rest were absent, which quietly made the film a highlight reel rather
 * than a representation of what the company actually connects.
 *
 * Every object here is the thing itself: a crate, a mailbox, a dish, a shelf of
 * binders. None of them is a floating icon or a glowing symbol, because a
 * service represented by an icon is a service the room is not really providing.
 * The rule from the design system holds — if it is decorative, it is wrong — so
 * these are dressed as ordinary contents of an ordinary house, and it is the
 * caption that names which service each one stands for.
 *
 * They are also deliberately unlit. The six services that animate do so because
 * they carry narrative state (electricity arrives, the circuit stalls, the
 * record resolves). These twelve are simply present, the way a mailbox is
 * present. Making all eighteen pulse would turn the house into a dashboard.
 *
 * Positions are world-space, matching the room layout in Residence.tsx:
 * garage x −17 · foyer x −9 · living x −2 · kitchen x +5 · utility x +11.
 */

const CARD = "#c2a179";
const STEEL = "#9aa0a8";
const FILM = "#dfe3e6";

export function ServiceFixtures() {
  return (
    <group>
      {/* ── GARAGE ─────────────────────────────────────────────
          Furniture · Appliance Rentals · Storage — the three services that
          arrive as objects in a bay on moving day. */}

      {/* Furniture: a wrapped flat item leaning against the wall, the way a
          delivered table top or headboard actually turns up. */}
      <group position={[-20.3, 0, -0.6]} rotation={[0, 0.12, -0.07]}>
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 1.7, 1.25]} />
          <meshStandardMaterial color={FILM} roughness={0.34} metalness={0.05} envMapIntensity={1.2} />
        </mesh>
        {/* strapping */}
        {[0.5, 1.25].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow>
            <boxGeometry args={[0.14, 0.045, 1.29]} />
            <meshStandardMaterial color="#6f6a60" roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* Appliance Rentals: a slatted timber crate. */}
      <group position={[-15.9, 0, 1.1]} rotation={[0, -0.28, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 1.0, 0.72]} />
          <meshStandardMaterial color="#a98c66" roughness={0.92} />
        </mesh>
        {[0.16, 0.5, 0.84].map((y) => (
          <mesh key={y} position={[0, y, 0.375]} castShadow>
            <boxGeometry args={[0.82, 0.09, 0.03]} />
            <meshStandardMaterial color="#8a6f4e" roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Storage: a steel rack, loaded unevenly. */}
      <group position={[-20.35, 0, 2.9]}>
        {[-0.55, 0.55].map((z) => (
          <mesh key={z} position={[0, 0.95, z]} castShadow>
            <boxGeometry args={[0.05, 1.9, 0.05]} />
            <meshStandardMaterial color={STEEL} roughness={0.45} metalness={0.65} />
          </mesh>
        ))}
        {[0.42, 0.95, 1.48].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.42, 0.035, 1.2]} />
            <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.6} />
          </mesh>
        ))}
        {/* boxes on the rack, two shelves only — a full rack reads as a prop */}
        {(
          [
            [0.62, -0.28, 0.36],
            [0.6, 0.3, 0.3],
            [1.15, -0.1, 0.34],
          ] as const
        ).map(([y, z, h], i) => (
          <mesh key={i} position={[0, y + h / 2 - 0.16, z]} castShadow receiveShadow>
            <boxGeometry args={[0.34, h, 0.4]} />
            <meshStandardMaterial color={i % 2 ? "#b8946c" : CARD} roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* ── FOYER ──────────────────────────────────────────────
          Mail Forwarding — the one service whose whole point is that it follows
          you to the new address, so it belongs at the door of the new one. */}
      <group position={[-12.55, 0, 5.55]}>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.07, 1.44, 0.07]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 1.52, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.2, 0.42]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.42} metalness={0.45} envMapIntensity={1.2} />
        </mesh>
        {/* the flag — the universal tell that this is a mailbox and not a box */}
        <mesh position={[0.15, 1.62, -0.14]} castShadow>
          <boxGeometry args={[0.02, 0.16, 0.05]} />
          <meshStandardMaterial color="#b8563a" roughness={0.7} />
        </mesh>
      </group>

      {/* ── LIVING ─────────────────────────────────────────────
          Cable and Telephone, alongside the router that already stood for
          Internet. All three arrive on the same line and belong together. */}

      {/* Cable: a wall-mounted screen above the console. Dark, off, and matte —
          a lit screen would pull every eye in the room to the one object that
          is not carrying any state. */}
      <group position={[-0.6, 1.58, -5.72]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.86, 0.05]} />
          <meshStandardMaterial color="#23262b" roughness={0.55} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.028]}>
          <planeGeometry args={[1.42, 0.79]} />
          <meshStandardMaterial color="#15181c" roughness={0.24} metalness={0.1} envMapIntensity={1.4} />
        </mesh>
      </group>

      {/* Telephone: a handset on its cradle at the other end of the console. */}
      <group position={[-1.35, 0.68, -3.86]}>
        <mesh position={[0, 0.03, 0]} castShadow>
          <boxGeometry args={[0.2, 0.05, 0.15]} />
          <meshStandardMaterial color={MATERIAL.charcoal} roughness={0.5} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.085, 0]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.055, 0.06, 0.19]} />
          <meshStandardMaterial color="#3a3f46" roughness={0.45} />
        </mesh>
      </group>

      {/* ── UTILITY ────────────────────────────────────────────
          Insurance and Cleaning — the paperwork and the supplies that live in
          the room nobody photographs, which is exactly where they really are. */}
      <group position={[12.9, 0, -5.66]}>
        {[1.02, 1.46].map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.15, 0.04, 0.28]} />
            <meshStandardMaterial color={MATERIAL.walnut} roughness={0.6} />
          </mesh>
        ))}
        {/* Insurance: upright binders, the least glamorous object in the film */}
        {(
          [
            [-0.42, "#5f6b7a"],
            [-0.33, "#7a6a5c"],
            [-0.24, "#4f5a66"],
            [-0.15, "#6b6257"],
          ] as const
        ).map(([x, c], i) => (
          <mesh key={i} position={[x, 1.62, 0]} castShadow>
            <boxGeometry args={[0.07, 0.28, 0.24]} />
            <meshStandardMaterial color={c} roughness={0.88} />
          </mesh>
        ))}
        {/* Cleaning: bottles and a folded cloth on the lower shelf */}
        {(
          [
            [0.18, 0.26, "#8fa8b8"],
            [0.32, 0.22, "#c9c2b4"],
            [0.45, 0.28, "#9db08e"],
          ] as const
        ).map(([x, h, c], i) => (
          <mesh key={i} position={[x, 1.04 + h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.05, h, 12]} />
            <meshStandardMaterial color={c} roughness={0.4} envMapIntensity={1.1} />
          </mesh>
        ))}
        <mesh position={[-0.4, 1.09, 0]} castShadow>
          <boxGeometry args={[0.22, 0.07, 0.2]} />
          <meshStandardMaterial color="#cdd3cf" roughness={0.95} />
        </mesh>
      </group>

      {/* ── EXTERIOR ───────────────────────────────────────────
          Satellite and Pest Control. Both are genuinely outdoor services, and
          both are things you would only ever notice on the approach — which is
          the one shot that sees them. */}

      {/* Satellite: a dish on the roof edge, angled south the way a real one is. */}
      <group position={[-5.4, 3.62, 7.6]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.44, 10]} />
          <meshStandardMaterial color={STEEL} roughness={0.45} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.5, 0.06]} rotation={[Math.PI * 0.34, 0, 0]} castShadow>
          <sphereGeometry args={[0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.32]} />
          <meshStandardMaterial color="#e2e5e6" roughness={0.4} metalness={0.15} side={2} envMapIntensity={1.2} />
        </mesh>
        {/* the LNB arm — without it a dish is just a bowl */}
        <mesh position={[0, 0.4, 0.3]} rotation={[0.5, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.34, 8]} />
          <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.6} />
        </mesh>
      </group>

      {/* Pest Control: the small perimeter marker a treated property carries.
          Deliberately tiny — it is a real thing that exists at ankle height and
          scaling it up to be noticed would make it signage. */}
      <group position={[-13.9, 0, 10.4]} rotation={[0, -0.3, 0]}>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[0.014, 0.34, 0.014]} />
          <meshStandardMaterial color="#5a5f57" roughness={0.8} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.36, 0]} castShadow>
          <boxGeometry args={[0.16, 0.11, 0.008]} />
          <meshStandardMaterial
            color="#f0ece2"
            roughness={0.7}
            emissive={SERVICE.verified}
            emissiveIntensity={0.12}
          />
        </mesh>
      </group>
    </group>
  );
}
