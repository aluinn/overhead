/** Object categories, in render/priority order (higher wins when an object is in several groups). */
export const ObjectKind = {
  Other: 0,
  Debris: 1,
  Starlink: 2,
  Station: 3,
} as const;
export type ObjectKind = (typeof ObjectKind)[keyof typeof ObjectKind];

/** CelesTrak groups OVERHEAD pulls, and the kind each one implies. */
export const GP_GROUPS = {
  active: ObjectKind.Other,
  starlink: ObjectKind.Starlink,
  stations: ObjectKind.Station,
  "cosmos-2251-debris": ObjectKind.Debris,
  "iridium-33-debris": ObjectKind.Debris,
  "fengyun-1c-debris": ObjectKind.Debris,
  "cosmos-1408-debris": ObjectKind.Debris,
} as const satisfies Record<string, ObjectKind>;
export type GpGroup = keyof typeof GP_GROUPS;

export function isGpGroup(value: string): value is GpGroup {
  return Object.prototype.hasOwnProperty.call(GP_GROUPS, value);
}

/**
 * Wire format for one GP (mean element set). A positional tuple instead of the
 * verbose OMM JSON object: ~4x smaller over the wire, which matters when the
 * `active` group is ~14,000 objects.
 *
 * [noradId, name, epochMs, meanMotion (rev/day), eccentricity, inclination°,
 *  RAAN°, argOfPerigee°, meanAnomaly°, bstar, meanMotionDot, meanMotionDdot]
 */
export type CompactGp = readonly [
  noradId: number,
  name: string,
  epochMs: number,
  meanMotion: number,
  eccentricity: number,
  inclination: number,
  raan: number,
  argOfPerigee: number,
  meanAnomaly: number,
  bstar: number,
  meanMotionDot: number,
  meanMotionDdot: number,
];

export type DataSource = "celestrak" | "stale-cache" | "sample";

export interface GpResponse {
  group: GpGroup;
  source: DataSource;
  /** ISO timestamp of when the upstream data was fetched. */
  fetchedAt: string;
  records: CompactGp[];
}

/** One catalog entry as held by the client after merging all groups. */
export interface CatalogObject {
  gp: CompactGp;
  kind: ObjectKind;
}

export interface Conjunction {
  id: string;
  noradId1: number;
  name1: string;
  noradId2: number;
  name2: string;
  /** Time of closest approach, epoch ms (UTC). */
  tcaMs: number;
  /** Miss distance, km. */
  rangeKm: number;
  /** Relative speed at TCA, km/s. */
  relSpeedKmS: number;
  /** Maximum collision probability reported by SOCRATES, when available. */
  maxProbability: number | null;
}

export interface ConjunctionResponse {
  source: "socrates" | "stale-cache" | "sample";
  fetchedAt: string;
  conjunctions: Conjunction[];
}

export interface GeodeticPoint {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export interface Observer {
  latDeg: number;
  lonDeg: number;
  altKm: number;
  label: string;
}
