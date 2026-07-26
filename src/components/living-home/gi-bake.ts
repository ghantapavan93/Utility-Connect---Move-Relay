import * as THREE from "three";

/**
 * Baked global illumination.
 *
 * This is the gap the visual audit named as the largest and the least
 * reachable: light in the scene arrives directly from the sun and the
 * environment, and then stops. It never bounces. Real rooms are substantially
 * lit by light that has already hit something else — a floor throws warm light
 * onto the ceiling, a sunlit wall fills the shadowed half of the room, and the
 * underside of every surface picks up colour from whatever is beneath it.
 * Without that, an interior reads as a clay model even when the direct light is
 * correct, because every shadowed surface falls to a flat ambient constant.
 *
 * The usual answer is to bake it in Blender with Cycles. That is the wrong tool
 * for this scene: the house is ~370 procedurally generated meshes with no UVs,
 * so a Blender round-trip means exporting, smart-unwrapping all of them into a
 * lightmap atlas, baking, re-importing — and repeating the entire trip every
 * time a wall moves. The bake would be stale by design.
 *
 * So this computes the same quantity directly, against the real scene, and
 * stores it per-vertex instead of per-texel. That is the one simplification:
 * bounce light is low-frequency, it has no sharp edges, so a half-metre vertex
 * grid carries it faithfully and needs no UVs at all.
 *
 * The physics is standard. For each vertex of each receiving surface, sample
 * the hemisphere around its normal with cosine-weighted rays. A ray that
 * escapes collects sky radiance. A ray that hits something collects that
 * surface's albedo times the direct sunlight falling on it, shadow-tested.
 * Average the samples and you have irradiance — the same integral Cycles
 * evaluates, at one bounce.
 */

// --- scene extraction ------------------------------------------------------

interface Tri {
  /** vertices */
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  /** geometric normal */
  n: THREE.Vector3;
  /** linear-space albedo of the surface this triangle belongs to */
  albedo: THREE.Color;
}

interface Bounds {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

function triBounds(t: Tri): Bounds {
  const min = t.a.clone().min(t.b).min(t.c);
  const max = t.a.clone().max(t.b).max(t.c);
  // Degenerate-flat triangles (a floor plane) need a sliver of thickness or
  // the BVH splits degenerate and traversal never prunes.
  min.addScalar(-1e-4);
  max.addScalar(1e-4);
  return { min, max };
}

/** Pulls every shadow-casting opaque triangle out of the scene, in world space. */
export function collectTriangles(scene: THREE.Object3D): Tri[] {
  const tris: Tri[] = [];
  scene.updateMatrixWorld(true);

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mat = m.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    // Glass transmits and the contact-shadow plane is a rendering trick, not
    // geometry. Neither occludes light in the real room.
    if (mat.transparent) return;
    if (m.castShadow === false) return;

    const albedo = mat.color ? mat.color.clone() : new THREE.Color(0.8, 0.8, 0.8);
    const pos = m.geometry.getAttribute("position");
    if (!pos) return;
    const index = m.geometry.getIndex();
    const count = index ? index.count : pos.count;

    const va = new THREE.Vector3();
    const vb = new THREE.Vector3();
    const vc = new THREE.Vector3();

    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      va.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld);
      vb.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld);
      vc.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);

      const n = new THREE.Vector3()
        .subVectors(vc, va)
        .cross(new THREE.Vector3().subVectors(vb, va))
        .normalize();
      if (!Number.isFinite(n.x)) continue; // zero-area triangle

      tris.push({ a: va.clone(), b: vb.clone(), c: vc.clone(), n, albedo });
    }
  });

  return tris;
}

// --- BVH -------------------------------------------------------------------

interface Node {
  bounds: Bounds;
  left?: Node;
  right?: Node;
  tris?: Tri[];
}

function unionBounds(list: Bounds[]): Bounds {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const b of list) {
    min.min(b.min);
    max.max(b.max);
  }
  return { min, max };
}

/**
 * Median-split BVH. Not the fastest build, but this runs once offline and a
 * balanced tree is what keeps the ~2 million traversals below a minute.
 */
export function buildBVH(tris: Tri[], depth = 0): Node {
  const bounds = unionBounds(tris.map(triBounds));
  if (tris.length <= 8 || depth > 28) return { bounds, tris };

  const size = new THREE.Vector3().subVectors(bounds.max, bounds.min);
  const axis: "x" | "y" | "z" = size.x > size.y ? (size.x > size.z ? "x" : "z") : size.y > size.z ? "y" : "z";

  const withKey = tris.map((t) => ({ t, k: (t.a[axis] + t.b[axis] + t.c[axis]) / 3 }));
  withKey.sort((p, q) => p.k - q.k);
  const mid = withKey.length >> 1;
  const l = withKey.slice(0, mid).map((w) => w.t);
  const r = withKey.slice(mid).map((w) => w.t);
  if (!l.length || !r.length) return { bounds, tris };

  return { bounds, left: buildBVH(l, depth + 1), right: buildBVH(r, depth + 1) };
}

function hitBounds(ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, b: Bounds, tMax: number) {
  let t0 = 0;
  let t1 = tMax;
  let a = (b.min.x - ox) * ix;
  let c = (b.max.x - ox) * ix;
  if (a > c) [a, c] = [c, a];
  t0 = a > t0 ? a : t0;
  t1 = c < t1 ? c : t1;
  if (t1 < t0) return false;
  a = (b.min.y - oy) * iy;
  c = (b.max.y - oy) * iy;
  if (a > c) [a, c] = [c, a];
  t0 = a > t0 ? a : t0;
  t1 = c < t1 ? c : t1;
  if (t1 < t0) return false;
  a = (b.min.z - oz) * iz;
  c = (b.max.z - oz) * iz;
  if (a > c) [a, c] = [c, a];
  t0 = a > t0 ? a : t0;
  t1 = c < t1 ? c : t1;
  return t1 >= t0;
}

/** Möller–Trumbore. Returns distance, or -1. */
function hitTri(o: THREE.Vector3, d: THREE.Vector3, t: Tri): number {
  const e1x = t.b.x - t.a.x, e1y = t.b.y - t.a.y, e1z = t.b.z - t.a.z;
  const e2x = t.c.x - t.a.x, e2y = t.c.y - t.a.y, e2z = t.c.z - t.a.z;
  const px = d.y * e2z - d.z * e2y;
  const py = d.z * e2x - d.x * e2z;
  const pz = d.x * e2y - d.y * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det > -1e-9 && det < 1e-9) return -1;
  const inv = 1 / det;
  const tx = o.x - t.a.x, ty = o.y - t.a.y, tz = o.z - t.a.z;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return -1;
  const qx = ty * e1z - tz * e1y;
  const qy = tz * e1x - tx * e1z;
  const qz = tx * e1y - ty * e1x;
  const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
  if (v < 0 || u + v > 1) return -1;
  const dist = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return dist > 1e-4 ? dist : -1;
}

interface Hit {
  dist: number;
  tri: Tri;
}

function traverse(node: Node, o: THREE.Vector3, d: THREE.Vector3, inv: THREE.Vector3, best: Hit | null, anyHit: boolean): Hit | null {
  if (!hitBounds(o.x, o.y, o.z, inv.x, inv.y, inv.z, node.bounds, best ? best.dist : Infinity)) return best;
  if (node.tris) {
    for (const t of node.tris) {
      const dist = hitTri(o, d, t);
      if (dist > 0 && (!best || dist < best.dist)) {
        best = { dist, tri: t };
        if (anyHit) return best;
      }
    }
    return best;
  }
  if (node.left) best = traverse(node.left, o, d, inv, best, anyHit);
  if (anyHit && best) return best;
  if (node.right) best = traverse(node.right, o, d, inv, best, anyHit);
  return best;
}

// --- the bake --------------------------------------------------------------

export interface BakeLighting {
  /** Direction *toward* the sun, normalised. */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  /** Flat sky radiance for rays that escape the scene. */
  skyColor: THREE.Color;
  skyIntensity: number;
  /** Radiance bounced off the ground plane for downward-escaping rays. */
  groundColor: THREE.Color;
  groundIntensity: number;
}

export interface BakeOptions {
  /** Hemisphere samples per vertex. 64 is visually converged for this scene. */
  samples: number;
  /**
   * How many times light is allowed to bounce.
   *
   * One bounce badly underestimates a pale room. These walls and ceilings are
   * near-white concrete at roughly 0.85 albedo, so the light that has already
   * bounced once still carries most of its energy and bounces again — the
   * series converges slowly when surfaces are bright. Stopping at one leaves
   * every shadowed area darker than it should be, which is the specific way a
   * cheap bake still looks like a render.
   */
  bounces: number;
  /** Samples for each secondary gather. Deep bounces are smooth and need few. */
  secondarySamples: number;
  lighting: BakeLighting;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Fills in vertices that were sealed inside other geometry.
 *
 * A ceiling vertex that happens to sit inside a wall or a beam is enclosed: it
 * has no hemisphere, every ray it casts hits the inside of the thing it is
 * buried in, and it bakes to zero. Interpolated across a half-metre grid, one
 * such vertex drags a metre-wide black smear onto a surface that should be
 * evenly lit — which is exactly what appeared on the ceiling wherever a wall or
 * a joist met the slab.
 *
 * Every lightmap baker has this problem and every one solves it the same way:
 * dilate. Sealed samples take the average of their nearest lit neighbours
 * rather than a value they were never able to measure. Repeated a few times so
 * the fill spreads inward through larger buried patches.
 */
function dilate(values: number[], pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, matrix: THREE.Matrix4): number[] {
  const count = pos.count;
  const world = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(pos as THREE.BufferAttribute, i).applyMatrix4(matrix);
    world[i * 3] = v.x;
    world[i * 3 + 1] = v.y;
    world[i * 3 + 2] = v.z;
  }

  const SEALED = 1e-4;
  const REACH = 0.9; // a little over the vertex grid, so neighbours are found
  const out = values.slice();

  for (let pass = 0; pass < 4; pass++) {
    const sealed: number[] = [];
    for (let i = 0; i < count; i++) {
      if (out[i * 3]! + out[i * 3 + 1]! + out[i * 3 + 2]! <= SEALED) sealed.push(i);
    }
    if (!sealed.length) break;

    const patch = new Map<number, [number, number, number]>();
    for (const i of sealed) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = 0; j < count; j++) {
        if (out[j * 3]! + out[j * 3 + 1]! + out[j * 3 + 2]! <= SEALED) continue;
        const dx = world[i * 3]! - world[j * 3]!;
        const dy = world[i * 3 + 1]! - world[j * 3 + 1]!;
        const dz = world[i * 3 + 2]! - world[j * 3 + 2]!;
        if (dx * dx + dy * dy + dz * dz > REACH * REACH) continue;
        r += out[j * 3]!;
        g += out[j * 3 + 1]!;
        b += out[j * 3 + 2]!;
        n++;
      }
      if (n) patch.set(i, [r / n, g / n, b / n]);
    }
    if (!patch.size) break;
    for (const [i, [r, g, b]] of patch) {
      out[i * 3] = r;
      out[i * 3 + 1] = g;
      out[i * 3 + 2] = b;
    }
  }

  return out;
}

/** Cosine-weighted hemisphere direction around `n`, from two uniform randoms. */
function cosineHemisphere(n: THREE.Vector3, u1: number, u2: number, out: THREE.Vector3) {
  const r = Math.sqrt(u1);
  const theta = 2 * Math.PI * u2;
  const x = r * Math.cos(theta);
  const y = r * Math.sin(theta);
  const z = Math.sqrt(Math.max(0, 1 - u1));

  // Build an orthonormal basis around the normal (Duff et al., branchless).
  const sign = n.z >= 0 ? 1 : -1;
  const a = -1 / (sign + n.z);
  const b = n.x * n.y * a;
  const t1 = new THREE.Vector3(1 + sign * n.x * n.x * a, sign * b, -sign * n.x);
  const t2 = new THREE.Vector3(b, sign + n.y * n.y * a, -n.y);

  out.set(
    t1.x * x + t2.x * y + n.x * z,
    t1.y * x + t2.y * y + n.y * z,
    t1.z * x + t2.z * y + n.z * z,
  ).normalize();
}

/**
 * Deterministic pseudo-random. The bake is committed to the repo, so it must
 * produce the same numbers on every machine that regenerates it — otherwise the
 * "is the bake current" check would fail on noise alone.
 */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface BakeResult {
  /** Per receiver mesh name: flat [r,g,b, ...] per vertex. */
  surfaces: Record<string, number[]>;
  stats: { surfaces: number; vertices: number; triangles: number; samples: number; ms: number };
}

/**
 * Computes irradiance at every vertex of every mesh whose name starts `gi:`.
 *
 * Returned values are the *indirect* term only — the light that arrived by way
 * of another surface, plus sky. Direct sunlight is left to the real-time
 * renderer, so the sun can still move, the shadows stay sharp, and the service
 * fixtures still light the rooms they are supposed to light.
 */
export function bakeGI(scene: THREE.Object3D, opts: BakeOptions): BakeResult {
  const started = Date.now();
  const tris = collectTriangles(scene);
  const bvh = buildBVH(tris);
  const { lighting: L, samples } = opts;
  const bounces = Math.max(1, opts.bounces);
  const secondary = Math.max(1, opts.secondarySamples);

  const receivers: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.name.startsWith("gi:")) receivers.push(m);
  });

  const totalVerts = receivers.reduce((n, m) => n + (m.geometry.getAttribute("position")?.count ?? 0), 0);
  const surfaces: Record<string, number[]> = {};
  let done = 0;

  const sunInv = new THREE.Vector3(1 / L.sunDir.x, 1 / L.sunDir.y, 1 / L.sunDir.z);

  // One scratch set per recursion level. Allocating inside the sample loop is
  // what turns a two minute bake into a twenty minute one.
  const LEVELS = bounces + 1;
  const scratch = Array.from({ length: LEVELS }, () => ({
    dir: new THREE.Vector3(),
    inv: new THREE.Vector3(),
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    out: [0, 0, 0] as [number, number, number],
  }));

  /** Direct sunlight arriving at a point with a given normal, shadow-tested. */
  function directSun(p: THREE.Vector3, n: THREE.Vector3): number {
    const nDotL = n.dot(L.sunDir);
    if (nDotL <= 0) return 0;
    return traverse(bvh, p, L.sunDir, sunInv, null, true) ? 0 : nDotL * L.sunIntensity;
  }

  /**
   * Mean incoming radiance over the hemisphere at (p, n).
   *
   * `depth` is how many further bounces are still permitted. At depth 0 a ray
   * that lands on a surface collects only that surface's direct sunlight, which
   * is where the recursion terminates.
   */
  function gather(p: THREE.Vector3, n: THREE.Vector3, count: number, depth: number, level: number, rng: () => number): [number, number, number] {
    const sc = scratch[level]!;
    let r = 0;
    let g = 0;
    let b = 0;

    for (let s = 0; s < count; s++) {
      cosineHemisphere(n, rng(), rng(), sc.dir);
      sc.inv.set(1 / sc.dir.x, 1 / sc.dir.y, 1 / sc.dir.z);
      const hit = traverse(bvh, p, sc.dir, sc.inv, null, false);

      if (!hit) {
        if (sc.dir.y >= 0) {
          r += L.skyColor.r * L.skyIntensity;
          g += L.skyColor.g * L.skyIntensity;
          b += L.skyColor.b * L.skyIntensity;
        } else {
          r += L.groundColor.r * L.groundIntensity;
          g += L.groundColor.g * L.groundIntensity;
          b += L.groundColor.b * L.groundIntensity;
        }
        continue;
      }

      const t = hit.tri;
      // Box winding gives inward normals on interior faces, so flip the
      // geometric normal back toward the ray that found it.
      const facing = t.n.dot(sc.dir) > 0 ? -1 : 1;
      sc.normal.copy(t.n).multiplyScalar(facing);
      sc.point.copy(sc.dir).multiplyScalar(hit.dist).add(p).addScaledVector(sc.normal, 2e-3);

      const e = directSun(sc.point, sc.normal);
      let ir = 0;
      let ig = 0;
      let ib = 0;
      if (depth > 0) {
        const [br, bg, bb] = gather(sc.point, sc.normal, secondary, depth - 1, level + 1, rng);
        ir = br;
        ig = bg;
        ib = bb;
      }

      r += t.albedo.r * (L.sunColor.r * e + ir);
      g += t.albedo.g * (L.sunColor.g * e + ig);
      b += t.albedo.b * (L.sunColor.b * e + ib);
    }

    // Cosine-weighted sampling already carries the 1/pi and the N·L, so the
    // estimator is just the mean of the samples.
    sc.out[0] = r / count;
    sc.out[1] = g / count;
    sc.out[2] = b / count;
    return sc.out;
  }

  const worldPos = new THREE.Vector3();
  const worldNrm = new THREE.Vector3();

  for (const mesh of receivers) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    const nrm = geo.getAttribute("normal");
    if (!pos || !nrm) continue;

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const out = new Array<number>(pos.count * 3);
    const rng = makeRng(0x9e3779b9);

    for (let v = 0; v < pos.count; v++) {
      worldPos.fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld);
      worldNrm.fromBufferAttribute(nrm, v).applyMatrix3(normalMatrix).normalize();
      // Lift off the surface so the vertex does not shadow itself.
      worldPos.addScaledVector(worldNrm, 2e-3);

      const [r, g, b] = gather(worldPos, worldNrm, samples, bounces - 1, 0, rng);
      out[v * 3] = r;
      out[v * 3 + 1] = g;
      out[v * 3 + 2] = b;

      done++;
      if (opts.onProgress && done % 500 === 0) opts.onProgress(done, totalVerts);
    }

    surfaces[mesh.name] = dilate(out, pos, mesh.matrixWorld);
  }

  return {
    surfaces,
    stats: {
      surfaces: receivers.length,
      vertices: totalVerts,
      triangles: tris.length,
      samples,
      ms: Date.now() - started,
    },
  };
}
