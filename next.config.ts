import type { NextConfig } from "next";

const WASM_STUB = "./src/lib/utils/wasmStub.ts";

/**
 * Server code reads these with `fs` (sample fallback, OG card background).
 * `public/` isn't bundled into serverless functions by default, so trace them in explicitly.
 */
const SAMPLE = "./public/data/sample-gp.json";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/gp/[group]": [SAMPLE],
    "/api/conjunctions": [SAMPLE],
    "/opengraph-image": ["./public/og-globe.jpg"],
  },
  turbopack: {
    resolveAlias: {
      // See src/lib/utils/wasmStub.ts for why these are stubbed.
      "#wasm-single-thread": WASM_STUB,
      "#wasm-multi-thread": WASM_STUB,
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
