import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The scanned furniture, pinned to the files that carry it.
 *
 * RealFurniture.tsx names nine Poly Haven photoscans (CC0) by URL. A model
 * that fails to fetch does not crash the scene — the Suspense fallback keeps
 * the primitive understudy on stage forever, which is the designed behaviour
 * on a slow network and a silent regression if the file is simply gone. These
 * assertions are what tell those two situations apart.
 *
 * Provenance: sofa_02, modern_arm_chair_01, dining_chair_02,
 * round_wooden_table_01, bar_chair_round_01, modern_coffee_table_01,
 * side_table_01, calathea_orbifolia_01, anthurium_botany_01 — Poly Haven,
 * CC0, 1K textures, downloaded with every file's size verified against the
 * API's declared size.
 */

const ROOT = join(process.cwd(), "public", "models");
const COMPONENT = join(process.cwd(), "src", "components", "living-home", "RealFurniture.tsx");

describe("every scan the scene names exists on disk", () => {
  const source = readFileSync(COMPONENT, "utf8");
  const urls = [...source.matchAll(/"\/models\/([^"]+\.gltf)"/g)].map((m) => m[1]!);

  it("names nine models and each resolves to a real file", () => {
    expect(urls).toHaveLength(9);
    for (const rel of urls) {
      const p = join(ROOT, rel);
      expect(existsSync(p), `${rel} is named by RealFurniture.tsx but missing`).toBe(true);
      /*
        A .gltf is a manifest: it references a .bin and textures by relative
        path, and any of those failing leaves the model partially loaded. So
        the whole closure is checked, not just the entry point.
      */
      const gltf = JSON.parse(readFileSync(p, "utf8")) as {
        buffers?: Array<{ uri?: string }>;
        images?: Array<{ uri?: string }>;
      };
      const dir = join(ROOT, rel.split("/")[0]!);
      for (const ref of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
        if (!ref.uri || ref.uri.startsWith("data:")) continue;
        const dep = join(dir, decodeURIComponent(ref.uri));
        expect(existsSync(dep), `${rel} references ${ref.uri}, which is missing`).toBe(true);
        expect(statSync(dep).size, `${ref.uri} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it("stays within the repository's media budget", () => {
    /*
      13.7MB today, 16MB ceiling. Same reasoning as the texture budget, larger
      allowance: these are the heaviest legitimate assets the project will
      ever carry, the repository has purged 143MB of media once already, and
      the difference between a budget and a hope is that one of them fails.
    */
    let total = 0;
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        const s = statSync(p);
        if (s.isDirectory()) walk(p);
        else total += s.size;
      }
    };
    walk(ROOT);
    expect(total).toBeLessThan(16 * 1024 * 1024);
  });

  it("keeps a directory for every named model and no orphans", () => {
    const named = new Set(urls.map((u) => u.split("/")[0]!));
    const present = readdirSync(ROOT).filter((f) => statSync(join(ROOT, f)).isDirectory());
    // An orphaned directory is dead weight shipped to every visitor's cache
    // manifest; a missing one is a fallback that never resolves.
    expect([...named].sort()).toEqual(present.sort());
  });
});
