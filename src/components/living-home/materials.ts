"use client";

import * as THREE from "three";

/**
 * PBR material sets — photographic where the camera lingers, procedural where
 * it does not.
 *
 * The first version of this module was all-procedural and proud of it: albedo,
 * normal and roughness derived from one height field, Sobel normals, the lot.
 * That machinery was correct and it is still here — but the critique that the
 * house "looks 3D rendered" was pointing at exactly this file. A height field
 * can make grain that BEHAVES like wood; it cannot make the thousand accidents
 * of real wood, and the eye prices surfaces by their accidents. So the four
 * materials that dominate the frame by area — the lawn, the oak floor, the
 * stone paving, the concrete — are now photographs of the real thing, and the
 * counter got real marble.
 *
 * The photographs are ambientCG scans (CC0 — no attribution required, given
 * anyway): Grass001, WoodFloor051, Travertine008, Concrete034, Marble023,
 * each downsized to ≤1K JPEG in public/textures/ (~1.3MB for all fifteen
 * maps). `photo-materials.test.ts` fails if any file this module names stops
 * existing.
 *
 * Walnut, linen and the artwork stay procedural: they cover small areas, they
 * read as intended, and a photograph would spend bytes on surfaces the film
 * never holds in close-up.
 */

type HeightFn = (x: number, y: number) => number;
type ColorFn = (x: number, y: number, h: number) => [number, number, number];

const SIZE = 512;

// --- value noise -----------------------------------------------------------

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

// --- map generation --------------------------------------------------------

function buildCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  return [c, c.getContext("2d")!];
}

/**
 * Generates albedo, normal and roughness from a single height field, so all
 * three agree — the grain that shows in the colour is the same grain that
 * deflects the light and the same grain that varies the gloss.
 */
function generateMaps(
  height: HeightFn,
  color: ColorFn,
  roughness: (h: number) => number,
  normalStrength: number,
): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  // Sample the height field once.
  const h = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) h[y * SIZE + x] = height(x / SIZE, y / SIZE);
  }

  const [albedoC, albedoCtx] = buildCanvas();
  const [normalC, normalCtx] = buildCanvas();
  const [roughC, roughCtx] = buildCanvas();

  const albedo = albedoCtx.createImageData(SIZE, SIZE);
  const normal = normalCtx.createImageData(SIZE, SIZE);
  const rough = roughCtx.createImageData(SIZE, SIZE);

  const at = (x: number, y: number) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]!;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const hv = h[y * SIZE + x]!;

      const [r, g, b] = color(x / SIZE, y / SIZE, hv);
      albedo.data[i] = r;
      albedo.data[i + 1] = g;
      albedo.data[i + 2] = b;
      albedo.data[i + 3] = 255;

      // Sobel over the height field — the same operation a baker performs.
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      const nx = dx * normalStrength;
      const ny = dy * normalStrength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      normal.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      normal.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normal.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      normal.data[i + 3] = 255;

      const rg = Math.max(0, Math.min(1, roughness(hv))) * 255;
      rough.data[i] = rough.data[i + 1] = rough.data[i + 2] = rg;
      rough.data[i + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedo, 0, 0);
  normalCtx.putImageData(normal, 0, 0);
  roughCtx.putImageData(rough, 0, 0);

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  return {
    map: tex(albedoC, true),
    normalMap: tex(normalC, false),
    roughnessMap: tex(roughC, false),
  };
}

// --- photographic sets -----------------------------------------------------

export interface MapSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/** The photo sets this module is allowed to reference — the test walks this. */
export const PHOTO_SETS = ["grass", "oak", "travertine", "concrete", "marble"] as const;
type PhotoSet = (typeof PHOTO_SETS)[number];

const photoCache = new Map<string, MapSet>();

/**
 * One photographed material at one repeat.
 *
 * Cached per (set, repeat) rather than cloned from a shared load: a texture
 * cloned before its image arrives can miss the upload, and the browser's HTTP
 * cache already deduplicates the fetch. The GPU carries at most a handful of
 * repeat variants per set — this scene uses fewer than twenty textures total.
 */
function photoMaps(name: PhotoSet, [rx, ry]: [number, number]): MapSet {
  const key = `${name}:${rx}x${ry}`;
  let m = photoCache.get(key);
  if (!m) {
    const loader = new THREE.TextureLoader();
    const load = (file: string, srgb: boolean) => {
      const t = loader.load(`/textures/${name}/${file}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };
    m = {
      map: load("color", true),
      normalMap: load("normal", false),
      roughnessMap: load("rough", false),
    };
    photoCache.set(key, m);
  }
  return m;
}

/** Mown lawn — the photograph that retired the green-tinted stone grid. */
export function grassMaps(repeat: [number, number] = [30, 20]): MapSet {
  return photoMaps("grass", repeat);
}

// --- material recipes ------------------------------------------------------

const cache = new Map<string, ReturnType<typeof generateMaps>>();

function cached(key: string, build: () => ReturnType<typeof generateMaps>) {
  let m = cache.get(key);
  if (!m) {
    m = build();
    cache.set(key, m);
  }
  return m;
}

/** Oak plank flooring — WoodFloor051. */
export function oakMaps(repeat: [number, number] = [6, 6]): MapSet {
  return photoMaps("oak", repeat);
}

/** Walnut: tighter, darker, more figured than oak. */
export function walnutMaps(repeat: [number, number] = [2, 2]) {
  const m = cached("walnut", () =>
    generateMaps(
      (x, y) => fbm(x * 2.2 + fbm(x * 1.6, y * 1.6, 2) * 1.2, y * 14, 4) * 0.8 + 0.2,
      (_x, _y, h) => {
        const t = 0.6 + h * 0.65;
        return [Math.min(255, 107 * t), Math.min(255, 74 * t), Math.min(255, 47 * t)];
      },
      (h) => 0.34 + (1 - h) * 0.26,
      1.1,
    ),
  );
  return applyRepeat(m, repeat);
}

/** Cast concrete — Concrete034. */
export function concreteMaps(repeat: [number, number] = [4, 2]): MapSet {
  return photoMaps("concrete", repeat);
}

/** Honed marble counter — Marble023. */
export function stoneMaps(repeat: [number, number] = [2, 1]): MapSet {
  return photoMaps("marble", repeat);
}

/** Linen upholstery: a woven cross-hatch. */
export function linenMaps(repeat: [number, number] = [4, 4]) {
  const m = cached("linen", () =>
    generateMaps(
      (x, y) => {
        const warp = Math.sin(x * Math.PI * 180) * 0.5 + 0.5;
        const weft = Math.sin(y * Math.PI * 180) * 0.5 + 0.5;
        return (warp * weft) * 0.5 + fbm(x * 30, y * 30, 3) * 0.35 + 0.15;
      },
      (_x, _y, h) => {
        const t = 0.82 + h * 0.35;
        return [Math.min(255, 201 * t), Math.min(255, 193 * t), Math.min(255, 180 * t)];
      },
      () => 0.94,
      1.8,
    ),
  );
  return applyRepeat(m, repeat);
}

/** Large-format pale stone — Travertine008. Its predecessor Travertine013 turned out to be a blue-green veined stone that read as swirled marble across every floor. */
export function limestoneMaps(repeat: [number, number] = [8, 4]): MapSet {
  return photoMaps("travertine", repeat);
}

/**
 * Textures are shared from the cache, so repeat is applied to clones —
 * otherwise a fabric tiling 4× would force every cushion to tile 4× too.
 */
function applyRepeat(
  m: ReturnType<typeof generateMaps>,
  [rx, ry]: [number, number],
) {
  const clone = (t: THREE.CanvasTexture) => {
    const c = t.clone();
    c.needsUpdate = true;
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(rx, ry);
    c.anisotropy = 8;
    return c;
  };
  return { map: clone(m.map), normalMap: clone(m.normalMap), roughnessMap: clone(m.roughnessMap) };
}


/**
 * A canvas for the framed work on the walls.
 *
 * The alternative was a flat tinted rectangle, which is what was there, and a
 * flat rectangle inside a frame reads as a swatch rather than a picture — the
 * eye needs some internal variation before it will accept a surface as an
 * image.
 *
 * Deliberately restrained: a soft horizon field in the building's own material
 * tones, with a little canvas tooth over it. The design system bans decoration,
 * and a loud abstract on the wall of a project about provenance would be
 * exactly that. This is the painting a room like this actually has.
 */
export function artworkTexture(seed: number, base: [number, number, number]): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);

  // Deterministic per artwork, so a given frame always holds the same picture.
  const rnd = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // The horizon sits off-centre, because a band across the middle reads as a
  // flag rather than a landscape.
  const horizon = 0.56 + (rnd(seed, 1) - 0.5) * 0.16;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;

      // Soft vertical gradient either side of the horizon, plus a slow warp so
      // the band is not perfectly straight.
      const warp = fbm(u * 2.2, seed * 3.1, 3) * 0.06 - 0.03;
      const d = v - (horizon + warp);
      const above = d < 0;
      const t = Math.min(1, Math.abs(d) * (above ? 2.6 : 3.4));

      // Two fields drawn from the base tone: lighter above, deeper below.
      const lift = above ? 1.18 - t * 0.3 : 0.72 + t * 0.16;
      // Canvas tooth.
      const tooth = 0.97 + fbm(u * 90, v * 90, 2) * 0.06;

      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, base[0] * lift * tooth);
      img.data[i + 1] = Math.min(255, base[1] * lift * tooth);
      img.data[i + 2] = Math.min(255, base[2] * lift * tooth);
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
