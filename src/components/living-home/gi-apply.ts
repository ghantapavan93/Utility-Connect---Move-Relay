import * as THREE from "three";
import bake from "@/generated/gi-bake.json";

/**
 * Applies the baked irradiance to the scene.
 *
 * The bake is stored per-vertex rather than per-texel, so there is no lightmap
 * texture and no second UV set to manage. Each bakeable surface gets a
 * `bakedGI` vertex attribute and a small patch to its shader.
 *
 * The patch adds the baked value to `irradiance` inside `lights_fragment_begin`
 * — deliberately there, and not to the final colour. Three.js multiplies
 * `irradiance` by the surface's own diffuse albedo when it evaluates the
 * indirect term, which is the physically correct thing to do and the reason the
 * bounce reads as light rather than as a glow pasted over the material. Adding
 * it at the end instead would make dark surfaces just as bright as pale ones.
 *
 * Direct sunlight is *not* in the bake. It stays real-time, so shadows stay
 * sharp, the service fixtures still light their own rooms, and nothing about
 * the narrative lighting is frozen into a texture.
 */

const SURFACES = bake.surfaces as Record<string, number[]>;

/**
 * How much of the baked bounce to apply.
 *
 * One at full strength is the physically computed answer. It sits slightly
 * under that because the bake resolves a single bounce: the second and third
 * bounces would add a little more fill, but they would also be progressively
 * dimmer and progressively less directional, and overshooting the first bounce
 * to stand in for them flattens exactly the contrast the bake is there to
 * create.
 */
const GI_INTENSITY = 0.85;

const PATCHED = Symbol("gi-patched");

interface Patchable extends THREE.Material {
  [PATCHED]?: boolean;
}

export interface GIApplyReport {
  applied: string[];
  /** Named `gi:` meshes with no entry in the bake — a stale bake. */
  missing: string[];
  /** Entries whose vertex count no longer matches the mesh — a stale bake. */
  mismatched: string[];
}

export function applyGIBake(root: THREE.Object3D): GIApplyReport {
  const applied: string[] = [];
  const missing: string[] = [];
  const mismatched: string[] = [];

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith("gi:")) return;

    const values = SURFACES[mesh.name];
    if (!values) {
      missing.push(mesh.name);
      return;
    }

    const pos = mesh.geometry.getAttribute("position");
    if (!pos || values.length !== pos.count * 3) {
      // The geometry changed since the bake ran. Applying it anyway would
      // smear one surface's lighting across another's vertices, so refuse.
      mismatched.push(mesh.name);
      return;
    }

    if (!mesh.geometry.getAttribute("bakedGI")) {
      mesh.geometry.setAttribute("bakedGI", new THREE.BufferAttribute(new Float32Array(values), 3));
    }

    const mat = mesh.material as Patchable;
    if (Array.isArray(mesh.material) || mat[PATCHED]) {
      applied.push(mesh.name);
      return;
    }

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.giIntensity = { value: GI_INTENSITY };

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec3 bakedGI;\nvarying vec3 vBakedGI;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBakedGI = bakedGI;");

      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vBakedGI;\nuniform float giIntensity;")
        // irradiance is declared inside this chunk, so the addition has to come
        // after the include rather than before it.
        .replace(
          "#include <lights_fragment_begin>",
          "#include <lights_fragment_begin>\nirradiance += vBakedGI * giIntensity;",
        );
    };
    // Three.js caches compiled programs by material signature; without a
    // distinct key the patched and unpatched variants share one program and
    // whichever compiled first wins.
    mat.customProgramCacheKey = () => "gi-baked";
    mat.needsUpdate = true;
    mat[PATCHED] = true;
    applied.push(mesh.name);
  });

  return { applied, missing, mismatched };
}
