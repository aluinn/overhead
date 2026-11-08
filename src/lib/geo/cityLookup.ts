import type { Observer } from "@/types";

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** A compact, bundled list of large cities: no geocoding API, no keys, works offline. */
export const CITIES: readonly City[] = [
  { name: "London", country: "UK", lat: 51.5074, lon: -0.1278 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405 },
  { name: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038 },
  { name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964 },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lon: 4.9041 },
  { name: "Dublin", country: "Ireland", lat: 53.3498, lon: -6.2603 },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393 },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lon: 18.0686 },
  { name: "Oslo", country: "Norway", lat: 59.9139, lon: 10.7522 },
  { name: "Helsinki", country: "Finland", lat: 60.1699, lon: 24.9384 },
  { name: "Reykjavik", country: "Iceland", lat: 64.1466, lon: -21.9426 },
  { name: "Warsaw", country: "Poland", lat: 52.2297, lon: 21.0122 },
  { name: "Vienna", country: "Austria", lat: 48.2082, lon: 16.3738 },
  { name: "Athens", country: "Greece", lat: 37.9838, lon: 23.7275 },
  { name: "Istanbul", country: "Türkiye", lat: 41.0082, lon: 28.9784 },
  { name: "Moscow", country: "Russia", lat: 55.7558, lon: 37.6173 },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lon: 30.5234 },
  { name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357 },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792 },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lon: 28.0473 },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241 },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lon: -7.5898 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.03, lon: 38.74 },
  { name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lon: 46.6753 },
  { name: "Tehran", country: "Iran", lat: 35.6892, lon: 51.389 },
  { name: "Tel Aviv", country: "Israel", lat: 32.0853, lon: 34.7818 },
  { name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777 },
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.209 },
  { name: "Bengaluru", country: "India", lat: 12.9716, lon: 77.5946 },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lon: 67.0011 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lon: 90.4125 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lon: 100.5018 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lon: 106.8456 },
  { name: "Manila", country: "Philippines", lat: 14.5995, lon: 120.9842 },
  { name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694 },
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737 },
  { name: "Beijing", country: "China", lat: 39.9042, lon: 116.4074 },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.978 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "Osaka", country: "Japan", lat: 34.6937, lon: 135.5023 },
  { name: "Taipei", country: "Taiwan", lat: 25.033, lon: 121.5654 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631 },
  { name: "Perth", country: "Australia", lat: -31.9505, lon: 115.8605 },
  { name: "Auckland", country: "New Zealand", lat: -36.8485, lon: 174.7633 },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.006 },
  { name: "Boston", country: "USA", lat: 42.3601, lon: -71.0589 },
  { name: "Washington DC", country: "USA", lat: 38.9072, lon: -77.0369 },
  { name: "Miami", country: "USA", lat: 25.7617, lon: -80.1918 },
  { name: "Chicago", country: "USA", lat: 41.8781, lon: -87.6298 },
  { name: "Houston", country: "USA", lat: 29.7604, lon: -95.3698 },
  { name: "Denver", country: "USA", lat: 39.7392, lon: -104.9903 },
  { name: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437 },
  { name: "San Francisco", country: "USA", lat: 37.7749, lon: -122.4194 },
  { name: "Seattle", country: "USA", lat: 47.6062, lon: -122.3321 },
  { name: "Anchorage", country: "USA", lat: 61.2181, lon: -149.9003 },
  { name: "Honolulu", country: "USA", lat: 21.3069, lon: -157.8583 },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832 },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207 },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332 },
  { name: "Bogotá", country: "Colombia", lat: 4.711, lon: -74.0721 },
  { name: "Lima", country: "Peru", lat: -12.0464, lon: -77.0428 },
  { name: "Santiago", country: "Chile", lat: -33.4489, lon: -70.6693 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816 },
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729 },
  { name: "Edinburgh", country: "UK", lat: 55.9533, lon: -3.1883 },
  { name: "Manchester", country: "UK", lat: 53.4808, lon: -2.2426 },
];

const normalise = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Prefix-first, then substring search over name and country. */
export function searchCities(query: string, limit = 6): City[] {
  const q = normalise(query);
  if (q.length === 0) return [];
  const starts: City[] = [];
  const contains: City[] = [];
  for (const c of CITIES) {
    const name = normalise(c.name);
    if (name.startsWith(q)) starts.push(c);
    else if (name.includes(q) || normalise(c.country).startsWith(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Great-circle distance in km (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Name of the closest bundled city, if one is within `maxKm`; used to label a GPS fix ("London"). */
export function nearestCity(lat: number, lon: number, maxKm = 150): City | null {
  let best: City | null = null;
  let bestD = maxKm;
  for (const c of CITIES) {
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Parse "51.5, -0.12" / "51.5 -0.12" / "51.5N 0.12W". Returns null if out of range or unparseable. */
export function parseLatLon(input: string): { lat: number; lon: number } | null {
  const m = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = Number(m[1]);
  let lon = Number(m[3]);
  if (m[2]?.toUpperCase() === "S") lat = -Math.abs(lat);
  if (m[4]?.toUpperCase() === "W") lon = -Math.abs(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function observerFromCity(c: City): Observer {
  return { latDeg: c.lat, lonDeg: c.lon, altKm: 0, label: c.name };
}

export function observerFromCoords(lat: number, lon: number): Observer {
  const near = nearestCity(lat, lon);
  return { latDeg: lat, lonDeg: lon, altKm: 0, label: near ? near.name : `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
}
