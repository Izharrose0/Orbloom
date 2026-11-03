// Base body geometries (the six genome forms), built once per quality level.
//
// All forms are welded (indexed, shared vertices) so that displacing along the
// normal can never tear seams open — the 1.x cube showed cracks along its edges —
// and so the GPU transforms each vertex once instead of ~6×.

import * as THREE from 'three';
import { RoundedBoxGeometry, mergeVertices } from 'three-stdlib';

function weld(g: THREE.BufferGeometry, radialNormals = false): THREE.BufferGeometry {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const merged = mergeVertices(g, 1e-4);
  g.dispose();
  if (radialNormals) {
    const pos = merged.attributes.position;
    const nrm = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
    }
    merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  } else {
    merged.computeVertexNormals();
  }
  merged.computeBoundingSphere();
  return merged;
}

/** Faceted bipyramid relaxed 35% toward a sphere: reads as crystal, still organic. */
function crystalGeometry(detail: number): THREE.BufferGeometry {
  const base = new THREE.OctahedronGeometry(1.05, 0);
  const g = new THREE.BufferGeometry();
  // subdivide each face without projecting to the sphere
  const src = base.attributes.position;
  const out: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const p = new THREE.Vector3();
  const n = Math.max(2, Math.round(detail / 2));
  const vert = (i: number, j: number) => {
    // barycentric grid point on triangle (a,b,c)
    const u = i / n, v = j / n;
    p.copy(a).multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v);
    const r = p.length();
    p.multiplyScalar((1 - 0.35) + 0.35 * (1.05 / r)); // relax toward sphere
    // stretch along Y a little: crystals are taller than wide
    out.push(p.x * 0.92, p.y * 1.12, p.z * 0.92);
  };
  for (let f = 0; f < src.count; f += 3) {
    a.fromBufferAttribute(src, f); b.fromBufferAttribute(src, f + 1); c.fromBufferAttribute(src, f + 2);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        vert(i, j); vert(i + 1, j); vert(i, j + 1);
        if (j < n - i - 1) { vert(i + 1, j); vert(i + 1, j + 1); vert(i, j + 1); }
      }
    }
  }
  base.dispose();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return weld(g, true);
}

export function makeBodyGeometries(detail: number): THREE.BufferGeometry[] {
  const k = detail / 64;
  return [
    weld(new THREE.IcosahedronGeometry(1, detail), true),                                          // 0 Sphere
    weld(new THREE.CapsuleGeometry(0.85, 0.9, Math.round(14 * k), Math.round(56 * k))),            // 1 Capsule
    weld(new THREE.TorusGeometry(0.9, 0.42, Math.round(32 * k), Math.round(110 * k))),             // 2 Torus
    crystalGeometry(detail),                                                                       // 3 Crystal
    weld(new RoundedBoxGeometry(1.5, 1.5, 1.5, Math.max(4, Math.round(12 * k)), 0.32)),           // 4 Cube (beveled)
    weld(new THREE.TorusKnotGeometry(0.7, 0.3, Math.round(170 * k), Math.round(28 * k), 3, 4)),   // 5 Knot
  ];
}

export type SurfaceAnchors = {
  positions: Float32Array; // xyz per vertex
  normals: Float32Array;
  dirs: Float32Array;      // normalized position (for patch/biome lookups)
  count: number;
};

export function surfaceAnchors(g: THREE.BufferGeometry): SurfaceAnchors {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const count = pos.count;
  const dirs = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    dirs[i * 3] = x / l; dirs[i * 3 + 1] = y / l; dirs[i * 3 + 2] = z / l;
  }
  return {
    positions: (pos.array as Float32Array).slice(),
    normals: (nrm.array as Float32Array).slice(),
    dirs,
    count,
  };
}

/** Find the surface vertex whose direction best matches `dir` (brute force; called O(budget) times at build). */
export function nearestAnchor(a: SurfaceAnchors, dx: number, dy: number, dz: number, stride = 1): number {
  let best = 0;
  let bestDot = -2;
  for (let i = 0; i < a.count; i += stride) {
    const d = a.dirs[i * 3] * dx + a.dirs[i * 3 + 1] * dy + a.dirs[i * 3 + 2] * dz;
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return best;
}
