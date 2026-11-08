import { NextResponse } from "next/server";
import { getGroup } from "@/lib/data/celestrak";
import { isGpGroup } from "@/types";

export const runtime = "nodejs";

/**
 * GET /api/gp/:group — compact GP element sets for one CelesTrak group.
 *
 * The browser never talks to CelesTrak. This handler fetches upstream at most
 * once per ~3h per instance (and `s-maxage` lets Vercel's CDN absorb the rest),
 * degrading to stale data and finally to the bundled sample so it never 5xxs.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/gp/[group]">) {
  const { group } = await ctx.params;
  if (!isGpGroup(group)) {
    return NextResponse.json({ error: `Unknown group "${group}"` }, { status: 404 });
  }

  const { ttlSeconds, ...body } = await getGroup(group);
  return NextResponse.json(body, {
    headers: {
      "cache-control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 4}`,
      "x-overhead-source": body.source,
    },
  });
}
