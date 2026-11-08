import { Vector3 } from "three";

/** Mean Earth radius in km. One scene unit equals one Earth radius. */
export const EARTH_RADIUS_KM = 6371;

/**
 * Map an ECEF vector (X→lon 0°, Y→lon 90°E, Z→north) into three.js scene
 * space (Y-up). This matches how `SphereGeometry` wraps an equirectangular
 * texture, so a point at lat/lon lands on the right spot on the Earth mesh.
 */
export function ecefToScene(x: number, y: number, z: number, out = new Vector3()): Vector3 {
  return out.set(x, z, -y);
}

/** Unit vector on the sphere for a geodetic latitude/longitude in degrees. */
export function latLonToScene(latDeg: number, lonDeg: number, out = new Vector3()): Vector3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return ecefToScene(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat), out);
}
