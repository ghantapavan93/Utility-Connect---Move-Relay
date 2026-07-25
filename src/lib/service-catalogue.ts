/**
 * The service catalogue.
 *
 * These are the eighteen services a mover can select on Utility Connect's own
 * enrollment form. The list is `[FACT]` — observed on the public site and
 * recorded in `research/utility-connect-route-audit.md`. It is not a guess at
 * what they might offer and it is not a superset invented to look thorough.
 *
 * It lives here, in one place, for the same reason the rest of this system
 * insists on a canonical record: a catalogue duplicated across caption strings,
 * 3D fixtures and marketing copy is a catalogue that will silently disagree
 * with itself. Every surface that names a service reads it from here, and
 * `service-catalogue.test.ts` fails the build if this list ever drifts from the
 * researched source.
 *
 * `room` is where the service physically lives in the residence. That mapping
 * is the whole point of the Living Home: a room does not illustrate a service,
 * the room *is* the service. Electricity belongs in the kitchen because that is
 * where you notice it; pest control belongs outside because that is where it
 * happens. A service with no honest physical home would be an icon, and an icon
 * is decoration.
 */

/**
 * Rooms of the residence, in the order the camera walks them.
 *
 * There is no separate "roof" room. The array and the dish are on the roof, but
 * the only shot that ever sees the roof is the approach from the drive — so
 * they belong to `arrival`, which is honestly "everything you can see before
 * you go inside". Inventing a chapter the camera never visits in order to make
 * a list look tidy would be the icon problem in a different costume.
 */
export const ROOMS = ["arrival", "garage", "foyer", "living", "kitchen", "utility"] as const;

export type Room = (typeof ROOMS)[number];

export interface CatalogueService {
  /** Stable key. Never rename — projections and tests key off this. */
  id: string;
  /** Exactly as Utility Connect's enrollment form labels it. */
  label: string;
  /** Where in the residence this service is made visible. */
  room: Room;
  /** The physical object that carries it. Never a floating icon. */
  fixture: string;
}

/**
 * All eighteen, in the order the enrollment form lists them.
 *
 * Source: Utility Connect enrollment form, service checkboxes `[FACT]`.
 */
export const SERVICE_CATALOGUE: readonly CatalogueService[] = [
  { id: "electric", label: "Electric", room: "kitchen", fixture: "pendant lights over the island" },
  { id: "security", label: "Security", room: "foyer", fixture: "entry sensor at the door" },
  { id: "telephone", label: "Telephone", room: "living", fixture: "handset on the console" },
  { id: "cable", label: "Cable", room: "living", fixture: "wall-mounted television" },
  { id: "satellite", label: "Satellite", room: "arrival", fixture: "dish on the roof edge" },
  { id: "water", label: "Water", room: "kitchen", fixture: "tap running at the island" },
  { id: "internet", label: "Internet", room: "living", fixture: "router on the console" },
  { id: "insurance", label: "Insurance", room: "utility", fixture: "document binder on the shelf" },
  { id: "gas", label: "Gas", room: "kitchen", fixture: "cooktop burner ring" },
  { id: "solar", label: "Solar Energy", room: "arrival", fixture: "photovoltaic array on the roof" },
  { id: "cleaning", label: "Cleaning", room: "utility", fixture: "supplies on the utility shelf" },
  { id: "pest_control", label: "Pest Control", room: "arrival", fixture: "perimeter service marker" },
  { id: "home_warranty", label: "Home Warranty", room: "utility", fixture: "consumer unit and appliances" },
  { id: "lawn_care", label: "Lawn Care", room: "arrival", fixture: "maintained lawn and planting" },
  { id: "furniture", label: "Furniture", room: "garage", fixture: "wrapped delivery in the bay" },
  { id: "mail_forwarding", label: "Mail Forwarding", room: "foyer", fixture: "mailbox beside the entry" },
  { id: "appliance_rentals", label: "Appliance Rentals", room: "garage", fixture: "crated appliance" },
  { id: "storage", label: "Storage", room: "garage", fixture: "shelved storage rack" },
] as const;

/** The services a given room is responsible for making visible. */
export function servicesInRoom(room: Room): CatalogueService[] {
  return SERVICE_CATALOGUE.filter((s) => s.room === room);
}

/** Human-readable list for a chapter caption, e.g. "Electric · Water · Gas". */
export function roomServiceLine(room: Room): string {
  return servicesInRoom(room)
    .map((s) => s.label)
    .join(" · ");
}
