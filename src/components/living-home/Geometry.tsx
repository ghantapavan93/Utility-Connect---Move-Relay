"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Beveled geometry.
 *
 * The claim that better geometry "needs modelling" was half wrong. The single
 * largest geometry cue in an architectural render is not polygon count — it is
 * that **nothing real has a perfectly sharp edge**. Every physical object has a
 * chamfer or a radius, and that edge catches a highlight the flat faces do not.
 * A scene of exact 90° boxes reads as CAD no matter how good the materials are,
 * because the eye has never seen an edge like that.
 *
 * RoundedBox builds a box whose corners are radiused, with smooth normals
 * across the fillet so the highlight travels around it. Applied to counters,
 * table tops, seats and cabinetry, it is the difference between furniture and
 * primitives — and it costs a few hundred triangles, not an asset pipeline.
 */

/** A box with radiused edges and correctly welded normals. */
export function RoundedBox({
  args,
  radius,
  segments = 3,
  ...rest
}: {
  args: [number, number, number];
  radius?: number;
  segments?: number;
} & Omit<React.ComponentProps<"mesh">, "args">) {
  const geometry = useMemo(() => {
    const [w, h, d] = args;
    // Never let the radius exceed half the smallest dimension, or the box
    // inverts itself — a 5cm counter slab with a 3cm radius has no flat left.
    const r = Math.min(radius ?? Math.min(w, h, d) * 0.06, Math.min(w, h, d) / 2 - 0.001);
    return roundedBoxGeometry(w, h, d, r, segments);
  }, [args, radius, segments]);

  return <mesh geometry={geometry} {...rest} />;
}

/**
 * Builds a rounded box by extruding a rounded rectangle and then shaping the
 * depth with a bevel, which gives radiused edges on all three axes rather than
 * only the profile.
 */
function roundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments: number,
): THREE.BufferGeometry {
  const bevel = Math.min(radius, depth / 2 - 0.0005);
  const w = width - bevel * 2;
  const h = height - bevel * 2;
  const r = Math.max(0.0005, Math.min(radius, Math.min(w, h) / 2 - 0.0005));

  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: segments,
    curveSegments: segments * 2,
  });

  geom.translate(0, 0, -(depth - bevel * 2) / 2);
  geom.computeVertexNormals();
  return geom;
}
