// Procedural meshes for rooted growth structures. Every mesh is authored with
// its root at y = 0 and its tip at y ≈ 1 so the shader can use `position.y`
// as "height along the growth" (for sway, glow and grow-in).
//
// A per-vertex `aPart` attribute marks regions for shading:
//   0 = stem / body, 1 = cap / tip / crystal / orb

import * as THREE from 'three';
import { mergeBufferGeometries } from 'three-stdlib';

function withPart(g: THREE.BufferGeometry, part: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute('uv');
  const count = ng.attributes.position.count;
  ng.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(count).fill(part), 1));
  return ng;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeBufferGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Luminous fungal cap on a curved stalk. */
export function fungalGeometry(): THREE.BufferGeometry {
  const stalk = new THREE.CylinderGeometry(0.07, 0.12, 0.78, 7, 4, true);
  stalk.translate(0, 0.39, 0);
  // slight S-curve so a field of them doesn't look like pins
  const p = stalk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + Math.sin(y * 3.2) * 0.05);
  }
  const cap = new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
  cap.scale(1, 0.55, 1);
  cap.translate(0.03, 0.74, 0);
  const gill = new THREE.CircleGeometry(0.29, 12);
  gill.rotateX(Math.PI / 2);
  gill.translate(0.03, 0.74, 0);
  return merge([withPart(stalk, 0), withPart(cap, 1), withPart(gill, 1)]);
}

/** Cluster of three living-glass prisms. */
export function crystalGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const specs: [number, number, number, number][] = [
    // height, radius, tiltX, tiltZ
    [1.0, 0.13, 0.0, 0.0],
    [0.7, 0.1, 0.38, 0.12],
    [0.55, 0.085, -0.25, -0.4],
  ];
  for (const [h, r, tx, tz] of specs) {
    const body = new THREE.CylinderGeometry(r, r * 1.08, h * 0.78, 6, 1, true);
    body.translate(0, h * 0.39, 0);
    const tip = new THREE.ConeGeometry(r, h * 0.22, 6, 1, true);
    tip.translate(0, h * 0.78 + h * 0.11, 0);
    const prism = merge([withPart(body, 0.4), withPart(tip, 1)]);
    prism.rotateX(tx);
    prism.rotateZ(tz);
    parts.push(prism);
  }
  return merge(parts);
}

/** Branching coral: a trunk splitting into three curling tubes with glowing tips. */
export function coralGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const branch = (pts: [number, number, number][], radius: number) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
    const tube = new THREE.TubeGeometry(curve, 8, radius, 5, false);
    // taper toward the tip
    const pos = tube.attributes.position;
    const nrm = tube.attributes.normal;
    const ringSize = 6; // radialSegments + 1
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / ringSize);
      const tt = ring / 8;
      const shrink = 1 - tt * 0.55;
      const c = curve.getPointAt(Math.min(1, tt));
      pos.setXYZ(i,
        c.x + (pos.getX(i) - c.x) * shrink,
        c.y + (pos.getY(i) - c.y) * shrink,
        c.z + (pos.getZ(i) - c.z) * shrink);
      void nrm;
    }
    tube.computeVertexNormals();
    return withPart(tube, 0);
  };
  parts.push(branch([[0, 0, 0], [0.02, 0.25, 0], [0.0, 0.45, 0.02]], 0.08));
  parts.push(branch([[0.0, 0.42, 0.02], [0.18, 0.62, 0.05], [0.24, 0.9, -0.02]], 0.055));
  parts.push(branch([[0.0, 0.42, 0.02], [-0.16, 0.6, -0.08], [-0.2, 0.82, -0.18]], 0.05));
  parts.push(branch([[0.0, 0.42, 0.02], [0.02, 0.66, 0.16], [-0.04, 1.0, 0.2]], 0.05));
  for (const tip of [[0.24, 0.9, -0.02], [-0.2, 0.82, -0.18], [-0.04, 1.0, 0.2]] as [number, number, number][]) {
    const bulb = new THREE.IcosahedronGeometry(0.06, 1);
    bulb.translate(...tip);
    parts.push(withPart(bulb, 1));
  }
  return merge(parts);
}

/** Spore pod: thin tether + a floating glowing orb. */
export function sporeGeometry(): THREE.BufferGeometry {
  const tether = new THREE.CylinderGeometry(0.012, 0.03, 0.75, 4, 6, true);
  tether.translate(0, 0.375, 0);
  const orb = new THREE.IcosahedronGeometry(0.16, 1);
  orb.translate(0, 0.86, 0);
  const halo = new THREE.IcosahedronGeometry(0.07, 0);
  halo.translate(0.12, 0.62, 0.05);
  return merge([withPart(tether, 0), withPart(orb, 1), withPart(halo, 1)]);
}

/** A single cilium: a thin tapered filament. */
export function ciliumGeometry(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.035, 1, 3, 5, true);
  g.translate(0, 0.5, 0);
  return withPart(g, 0);
}

export const ARCHETYPE_GEOMETRY = [fungalGeometry, crystalGeometry, coralGeometry, sporeGeometry];
