import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGroup } from "@/lib/data/celestrak";

export const alt = "OVERHEAD: everything in orbit, right now";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/**
 * Rendered per request (the stats come from the cached CelesTrak data, which
 * is a no-store fetch and so can't be prerendered). The CDN header below keeps
 * crawlers from re-rendering it more than every ~3h.
 */
export const dynamic = "force-dynamic";

const fmt = new Intl.NumberFormat("en-US");

/** Live stats for the card; null when we only have offline sample data (never print misleading numbers). */
async function liveStats(): Promise<{ active: number; starlink: number } | null> {
  try {
    const res = await getGroup("active");
    if (res.source === "sample") return null;
    return { active: res.records.length, starlink: res.records.filter((r) => r[1].startsWith("STARLINK")).length };
  } catch {
    return null;
  }
}

async function globeDataUri(): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "og-globe.jpg"));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [stats, globe] = await Promise.all([liveStats(), globeDataUri()]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#03050a", color: "#e6edf5", fontFamily: "sans-serif" }}>
        {globe && (
          <img src={globe} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0, width: 1200, height: 630 }} />
        )}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(90deg, rgba(3,5,10,0.96) 0%, rgba(3,5,10,0.88) 38%, rgba(3,5,10,0) 72%)" }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: 900, height: 630 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 14, height: 14, borderRadius: 14, background: "#38e1ff", marginRight: 18, display: "flex" }} />
            <div style={{ fontSize: 30, letterSpacing: 10, fontWeight: 500, display: "flex" }}>OVERHEAD</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 80, lineHeight: 1.04, fontWeight: 300, letterSpacing: -2, display: "flex", flexDirection: "column" }}>
              <span>Everything in orbit,</span>
              <span style={{ color: "#38e1ff" }}>right now.</span>
            </div>
            {stats && (
              <div style={{ display: "flex", marginTop: 40, fontSize: 28, color: "#8fa0b3", letterSpacing: 2 }}>
                <span style={{ color: "#e6edf5", marginRight: 12 }}>{fmt.format(stats.active)}</span>
                <span style={{ marginRight: 36 }}>ACTIVE SATELLITES</span>
                <span style={{ color: "#38e1ff", marginRight: 12 }}>{fmt.format(stats.starlink)}</span>
                <span>STARLINK</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#6b7b8f" }}>LIVE 3D TRACKER · NO SIGN-UP · BY ALUINN MCDONALD</div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: { "cache-control": "public, s-maxage=10800, stale-while-revalidate=86400" },
    },
  );
}
