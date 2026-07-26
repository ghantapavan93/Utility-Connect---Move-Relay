import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SERVICE_CATALOGUE, ROOMS, servicesInRoom } from "../service-catalogue";

/**
 * Service coverage fitness functions.
 *
 * The claim the Living Home makes is that the residence represents the services
 * Utility Connect actually offers — not a photogenic subset of them. That claim
 * is easy to make and easy to quietly break: someone adds a room, someone
 * rewrites a caption, and three services stop being shown without anyone
 * noticing, because nothing fails.
 *
 * These tests read the researched source of truth directly, so the build breaks
 * the moment the catalogue and the observed form disagree.
 */

const root = process.cwd();

/**
 * Read a document with its line endings normalised.
 *
 * Without the normalisation these tests pass on the machine they were written
 * on and fail on a fresh Windows clone, because git checks the file out with
 * CRLF and the paragraph break the parser looks for is `\r\n\r\n` rather than
 * `\n\n`. That is the worst possible shape for a defect in this repository: the
 * headline instruction to a reviewer is `npm run verify`, and it would have
 * greeted half of them with two red tests and no clue why.
 *
 * `.gitattributes` now normalises on checkout as well. This stays because it is
 * the layer that does not depend on the reviewer's git configuration being the
 * one we expected.
 */
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");

/**
 * Extracts the service names from the route audit, which is where the `[FACT]`
 * observation of the enrollment form lives. Parsing the document rather than
 * restating it is deliberate: a hardcoded copy in the test would agree with a
 * hardcoded copy in the catalogue forever, and prove nothing.
 */
function servicesFromResearch(): string[] {
  const doc = read("research/utility-connect-route-audit.md");
  const marker = doc.indexOf("**18 selectable services**");
  expect(marker, "the route audit must still record the observed service list").toBeGreaterThan(-1);

  // The list runs from the colon after the marker to the end of that bullet,
  // which is the first blank line.
  const tail = doc.slice(marker);
  const colon = tail.indexOf("`:");
  const end = tail.indexOf("\n\n");
  return tail
    .slice(colon + 2, end)
    .replace(/\n\s+/g, " ")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("the catalogue matches what Utility Connect actually offers", () => {
  it("carries every service observed on the enrollment form, and no invented ones", () => {
    const observed = servicesFromResearch();
    const carried = SERVICE_CATALOGUE.map((s) => s.label);

    // Set comparison in both directions: a missing service means the house is
    // under-representing them, an extra one means we invented a capability.
    expect([...carried].sort()).toEqual([...observed].sort());
  });

  it("records eighteen services, the number the audit observed", () => {
    expect(SERVICE_CATALOGUE).toHaveLength(18);
    expect(servicesFromResearch()).toHaveLength(18);
  });

  it("uses stable, unique ids", () => {
    const ids = SERVICE_CATALOGUE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z_]*$/);
  });
});

describe("every service has an honest physical home", () => {
  it("assigns each service to a room the camera actually visits", () => {
    for (const s of SERVICE_CATALOGUE) {
      expect(ROOMS, `${s.label} is assigned to an unknown room`).toContain(s.room);
    }
  });

  it("gives each service a named fixture rather than a floating icon", () => {
    for (const s of SERVICE_CATALOGUE) {
      expect(s.fixture.length, `${s.label} has no fixture`).toBeGreaterThan(3);
    }
  });

  it("leaves no room empty — a room with no service is not a chapter", () => {
    for (const room of ROOMS) {
      expect(servicesInRoom(room).length, `${room} carries no service`).toBeGreaterThan(0);
    }
  });
});

describe("every surface reads the catalogue rather than restating it", () => {
  it("the intake form offers all eighteen, from the catalogue", () => {
    const form = read("src/app/connect-flow/page.tsx");
    expect(form).toMatch(/from "@\/lib\/service-catalogue"/);
    expect(form).toMatch(/SERVICE_CATALOGUE\.map/);

    // The failure this guards against is concrete: the hardcoded list had
    // drifted to twelve services and renamed Solar Energy to "Solar".
    expect(form, "the service list must not be re-typed here").not.toMatch(
      /const SERVICES\s*=\s*\[\s*"/,
    );
  });
});

describe("the residence renders the catalogue rather than restating it", () => {
  it("the film reads service names from the catalogue, not from hardcoded strings", () => {
    const film = read("src/components/living-home/LivingHome.tsx");
    expect(film).toMatch(/from "@\/lib\/service-catalogue"|from "\.\.\/\.\.\/lib\/service-catalogue"/);
    expect(film).toMatch(/roomServiceLine/);
  });

  it("binds every room to a chapter, so all eighteen reach the screen", () => {
    const film = read("src/components/living-home/LivingHome.tsx");
    // The caption renders roomServiceLine(c.catalogueRoom) dynamically, so the
    // thing that actually guarantees coverage is that each room is claimed by
    // a chapter. A room nobody claims is a set of services nobody ever sees.
    for (const room of ROOMS) {
      expect(film, `no chapter claims the ${room} services`).toMatch(
        new RegExp(`catalogueRoom:\\s*"${room}"`),
      );
    }
  });

  it("covers all eighteen services across the claimed rooms", () => {
    const film = read("src/components/living-home/LivingHome.tsx");
    const claimed = ROOMS.filter((r) => new RegExp(`catalogueRoom:\\s*"${r}"`).test(film));
    const shown = claimed.flatMap((r) => servicesInRoom(r).map((s) => s.label));
    expect(new Set(shown).size).toBe(SERVICE_CATALOGUE.length);
  });
});
