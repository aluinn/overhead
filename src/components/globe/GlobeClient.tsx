"use client";

import dynamic from "next/dynamic";

/** three.js touches `window`/WebGL, so the globe is client-only and code-split. */
export const GlobeClient = dynamic(() => import("./Globe").then((m) => m.Globe), {
  ssr: false,
});
