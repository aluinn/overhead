import { R_EARTH_KM } from "./propagate.ts";

export interface TrainOptions {
  /** Max distance between chained neighbours, km. */
  linkKm?: number;
  /** Minimum members to call it a train. */
  minSize?: number;
  /** Max difference in inclination (deg) / RAAN (deg) / mean motion (rev/day) within a train. */
  maxIncDeg?: number;
  maxRaanDeg?: number;
  maxMeanMotion?: number;
}

export interface Train {
  id: number;
  /** Catalog indices of members, sorted along the cluster. */
  members: number[];
  /** Straight-line extent from first to last member, km. */
  lengthKm: number;
}

/** Orbital-plane descriptors (aligned with positions) used to confirm "same plane". */
export interface PlaneElements {
  inclinationDeg: Float32Array;
  raanDeg: Float32Array;
  meanMotion: Float32Array;
}

const angDiff = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * Find Starlink-style trains: groups of satellites that are physically close
 * (chained within `linkKm`) *and* share an orbital plane and altitude.
 *
 * Fresh launches deploy as a dense, evenly spaced string that spreads over
 * weeks; settled satellites are thousands of km apart and never link. A
 * spatial hash keeps this near-linear in the number of candidates.
 *
 * @param candidates indices into `positions` to consider (e.g. all Starlink)
 * @param positions  scene-space positions (Earth radii), 3 floats per object
 */
export function detectTrains(
  candidates: ArrayLike<number>,
  positions: Float32Array,
  planes: PlaneElements,
  opts: TrainOptions = {},
): Train[] {
  const { linkKm = 200, minSize = 5, maxIncDeg = 0.35, maxRaanDeg = 1.5, maxMeanMotion = 0.06 } = opts;
  const n = candidates.length;
  if (n < minSize) return [];

  const cell = linkKm / R_EARTH_KM; // cell edge in scene units
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number, cz: number) => `${cx},${cy},${cz}`;

  const cellOf = (k: number): [number, number, number] => {
    const o = candidates[k] * 3;
    return [Math.floor(positions[o] / cell), Math.floor(positions[o + 1] / cell), Math.floor(positions[o + 2] / cell)];
  };

  for (let k = 0; k < n; k++) {
    const o = candidates[k] * 3;
    if (positions[o] === 0 && positions[o + 1] === 0 && positions[o + 2] === 0) continue;
    const [cx, cy, cz] = cellOf(k);
    const kk = key(cx, cy, cz);
    const bucket = grid.get(kk);
    if (bucket) bucket.push(k);
    else grid.set(kk, [k]);
  }

  // Union-find over candidate slots.
  const parent = new Int32Array(n).fill(-1).map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const link2 = (linkKm / R_EARTH_KM) ** 2;
  for (const [kk, bucket] of grid) {
    const [cx, cy, cz] = kk.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const other = grid.get(key(cx + dx, cy + dy, cz + dz));
          if (!other) continue;
          for (const a of bucket) {
            const ia = candidates[a];
            const oa = ia * 3;
            for (const b of other) {
              if (b <= a) continue;
              const ib = candidates[b];
              const ob = ib * 3;
              const ex = positions[oa] - positions[ob];
              const ey = positions[oa + 1] - positions[ob + 1];
              const ez = positions[oa + 2] - positions[ob + 2];
              if (ex * ex + ey * ey + ez * ez > link2) continue;
              if (
                Math.abs(planes.inclinationDeg[ia] - planes.inclinationDeg[ib]) <= maxIncDeg &&
                angDiff(planes.raanDeg[ia], planes.raanDeg[ib]) <= maxRaanDeg &&
                Math.abs(planes.meanMotion[ia] - planes.meanMotion[ib]) <= maxMeanMotion
              ) {
                union(a, b);
              }
            }
          }
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let k = 0; k < n; k++) {
    const root = find(k);
    const g = groups.get(root);
    if (g) g.push(candidates[k]);
    else groups.set(root, [candidates[k]]);
  }

  const trains: Train[] = [];
  for (const members of groups.values()) {
    if (members.length < minSize) continue;
    // Extent: the pair of members furthest from the first one, then furthest from that.
    const far = (from: number): number => {
      let best = from;
      let bestD = -1;
      const of = from * 3;
      for (const m of members) {
        const om = m * 3;
        const d = (positions[of] - positions[om]) ** 2 + (positions[of + 1] - positions[om + 1]) ** 2 + (positions[of + 2] - positions[om + 2]) ** 2;
        if (d > bestD) {
          bestD = d;
          best = m;
        }
      }
      return best;
    };
    const endA = far(members[0]);
    const endB = far(endA);
    const oa = endA * 3;
    const ob = endB * 3;
    const lengthKm =
      Math.sqrt((positions[oa] - positions[ob]) ** 2 + (positions[oa + 1] - positions[ob + 1]) ** 2 + (positions[oa + 2] - positions[ob + 2]) ** 2) *
      R_EARTH_KM;

    // Order members along the line between the ends.
    const dirx = positions[ob] - positions[oa];
    const diry = positions[ob + 1] - positions[oa + 1];
    const dirz = positions[ob + 2] - positions[oa + 2];
    const along = (m: number) => (positions[m * 3] - positions[oa]) * dirx + (positions[m * 3 + 1] - positions[oa + 1]) * diry + (positions[m * 3 + 2] - positions[oa + 2]) * dirz;
    members.sort((a, b) => along(a) - along(b));
    trains.push({ id: 0, members, lengthKm });
  }

  trains.sort((a, b) => b.members.length - a.members.length);
  trains.forEach((t, i) => (t.id = i));
  return trains;
}
