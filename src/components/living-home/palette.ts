/**
 * The Living Home — material and light system.
 *
 * The governing correction: this is an architect-led residence, not a
 * cyberpunk interior. Dark materials in dim light read as murk; LIGHT
 * materials in dim light read as architecture. White concrete, limestone,
 * warm oak and walnut carry the space, and the only saturated colour in the
 * frame is a service signal doing a job.
 *
 * Every accent below is semantic. If a colour appears and does not name a
 * utility state, it is a bug.
 */

export const MATERIAL = {
  /** Board-formed architectural concrete — the primary wall. */
  concrete: "#e6e2db",
  concreteShadow: "#cfc9bf",
  /** Limestone floor in circulation spaces. */
  limestone: "#c9c0b1",
  /** Warm oak — floors in living spaces. */
  oak: "#b08b5c",
  /** Walnut — cabinetry, stair treads, furniture. */
  walnut: "#6b4a2f",
  /** Charcoal — window mullions, steel, fixtures. */
  charcoal: "#2f3237",
  /** Brushed metal — appliances, hardware. */
  metal: "#a8adb4",
  /** Glass tint for floor-to-ceiling glazing. */
  glass: "#cfe0e6",
  /** Landscape greenery in the courtyard. */
  foliage: "#4a6b4f",
  /** Textile — sofa, rug. */
  linen: "#c9c1b4",
} as const;

/**
 * Service accents. Each names one utility and appears only when that service
 * is doing something: arriving, active, uncertain, or recovered.
 */
export const SERVICE = {
  electricity: "#f0b429",   // warm current
  internet: "#4da8c8",      // cool data
  water: "#5b9dd9",         // clear flow
  gas: "#e08a2e",           // controlled amber
  security: "#8b7bd8",      // muted protective violet
  solar: "#f5c451",         // captured sunlight
  verified: "#0087b5",      // Utility Connect's own blue — confirmed
  conflict: "#e8a33d",      // needs a human, not an error
  unknown: "#d98c3f",       // ambiguity, held
  recovered: "#3da76a",     // continuity restored
} as const;

/** Light temperatures by moment in the narrative. */
export const LIGHT = {
  dusk: "#7d93b5",
  practical: "#ffd9a0",
  daylight: "#e8f0ff",
  courtyard: "#9fb89c",
} as const;

export type ServiceKey = keyof typeof SERVICE;
