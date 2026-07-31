import { describe, it, expect } from "vitest";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The photographed materials, pinned to the files that carry them.
 *
 * materials.ts names five photo sets and loads three maps from each by path.
 * A texture that fails to load does not crash a three.js scene — the material
 * silently renders black, which on the lawn would mean a black field under
 * the house in production while every test stayed green. So the paths the
 * module can name are asserted against the filesystem here, the same
 * contract the live-badge suite applies to endpoints.
 *
 * Provenance, recorded where the files are checked: all five sets are
 * ambientCG scans, published CC0 — Grass001, WoodFloor051, Travertine008,
 * Concrete034, Marble023 — downsized to ≤1K JPEG. CC0 requires nothing; the
 * IDs are kept so any of them can be re-fetched at full resolution.
 */

const ROOT = join(process.cwd(), "public", "textures");
const SETS = ["grass", "oak", "travertine", "concrete", "marble"] as const;
const MAPS = ["color.jpg", "normal.jpg", "rough.jpg"] as const;

describe("every photo material the scene names exists on disk", () => {
  it("holds three maps for each of the five sets", () => {
    for (const set of SETS) {
      for (const map of MAPS) {
        const p = join(ROOT, set, map);
        expect(existsSync(p), `${set}/${map} is named by materials.ts but missing`).toBe(true);
        // A zero-byte file passes existsSync and still renders black.
        expect(statSync(p).size, `${set}/${map} is empty`).toBeGreaterThan(1024);
      }
    }
  });

  it("stays within the repository's media budget", () => {
    /*
      The repo has already had to purge 143MB of media from its own history,
      and these are exactly the kind of files that creep. Fifteen maps land
      around 1.3MB today; the ceiling leaves room to re-shoot a set at higher
      quality without letting "a texture or two" become another purge.
    */
    let total = 0;
    for (const set of SETS) {
      for (const f of readdirSync(join(ROOT, set))) {
        total += statSync(join(ROOT, set, f)).size;
      }
    }
    expect(total).toBeLessThan(6 * 1024 * 1024);
  });

  it("names no set the loader does not serve", async () => {
    // The other direction: materials.ts's PHOTO_SETS list and the directory
    // tree cannot drift apart without one of these two assertions failing.
    const { PHOTO_SETS } = await import("@/components/living-home/materials");
    expect([...PHOTO_SETS].sort()).toEqual([...SETS].sort());
    expect(readdirSync(ROOT).sort()).toEqual([...SETS].sort());
  });
});
