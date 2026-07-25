import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Baked global illumination fitness functions.
 *
 * A baked lighting solution has one failure mode that matters: going stale. The
 * bake encodes where the light was when it ran, so if the sun moves or a wall
 * moves and nobody regenerates it, the scene ships with bounce light arriving
 * from a direction the direct light no longer comes from. That looks worse than
 * having no bounce at all, and nothing about it is obvious on screen.
 *
 * Runtime already refuses to apply a bake whose vertex counts no longer match
 * the geometry. These cover the parts that can be checked without a renderer.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const bake = JSON.parse(read("src/generated/gi-bake.json")) as {
  stats?: { surfaces: number; vertices: number; samples: number };
  surfaces: Record<string, number[]>;
};

describe("the bake is present and well-formed", () => {
  it("covers the shell surfaces", () => {
    const names = Object.keys(bake.surfaces);
    expect(names.length).toBeGreaterThanOrEqual(10);
    for (const n of names) expect(n).toMatch(/^gi:(wall|floor|roof):/);
  });

  it("stores three channels per vertex", () => {
    for (const [name, values] of Object.entries(bake.surfaces)) {
      expect(values.length % 3, `${name} is not a whole number of RGB triples`).toBe(0);
      expect(values.length, `${name} is empty`).toBeGreaterThan(0);
    }
  });

  it("contains only finite, non-negative irradiance", () => {
    for (const [name, values] of Object.entries(bake.surfaces)) {
      for (const v of values) {
        // A negative or NaN sample means the sampler escaped its hemisphere or
        // divided by a zero-area triangle — both produce black speckle on the
        // wall that is very hard to trace back from the render.
        expect(Number.isFinite(v), `${name} has a non-finite sample`).toBe(true);
        expect(v, `${name} has a negative sample`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("actually carries light rather than a field of zeros", () => {
    const all = Object.values(bake.surfaces).flat();
    const mean = all.reduce((a, b) => a + b, 0) / all.length;
    expect(mean).toBeGreaterThan(0.01);
  });

  it("puts more bounce on the ceiling than the floor", () => {
    // The physical signature of real GI in a sunlit room: the ceiling sees the
    // brightly lit floor, so it receives more indirect light than the floor
    // does. If this ever inverts, the sampler is gathering the wrong
    // hemisphere — which is easy to do and nearly invisible by eye.
    const meanOf = (prefix: string) => {
      const vals = Object.entries(bake.surfaces)
        .filter(([n]) => n.startsWith(prefix))
        .flatMap(([, v]) => v);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    expect(meanOf("gi:roof:")).toBeGreaterThan(meanOf("gi:floor:"));
  });
});

describe("the bake cannot silently drift from the renderer", () => {
  it("the sun is defined once and used by both", () => {
    const film = read("src/components/living-home/LivingHome.tsx");
    expect(film).toMatch(/export const GI_SUN_POSITION/);
    expect(film).toMatch(/export const GI_SUN_INTENSITY/);
    // The light must read the shared constants, not restate them.
    expect(film).toMatch(/position=\{GI_SUN_POSITION/);
    expect(film).toMatch(/intensity=\{GI_SUN_INTENSITY\}/);
    expect(film).toMatch(/sunDir: new THREE\.Vector3\(\.\.\.GI_SUN_POSITION\)/);
  });

  it("the shell surfaces are named by the same helper the bake keys on", () => {
    const res = read("src/components/living-home/Residence.tsx");
    expect(res).toMatch(/export const giName/);
    expect(res).toMatch(/name=\{giName\("wall"/);
    expect(res).toMatch(/name=\{giName\("floor"/);
    expect(res).toMatch(/name=\{giName\("roof"/);
  });

  it("runtime refuses to apply a bake that no longer fits the geometry", () => {
    const apply = read("src/components/living-home/gi-apply.ts");
    expect(apply).toMatch(/values\.length !== pos\.count \* 3/);
    expect(apply).toMatch(/mismatched/);
  });
});
