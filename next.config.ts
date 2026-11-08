import type { NextConfig } from "next";

const WASM_STUB = "./src/lib/utils/wasmStub.ts";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
