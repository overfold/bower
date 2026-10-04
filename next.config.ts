import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RE2 loads its WASM next to its Node entrypoint; bundling changes that path.
  serverExternalPackages: ["re2-wasm"],
  outputFileTracingIncludes: { "/*": ["./node_modules/re2-wasm/build/wasm/re2.wasm"] },
  ...(process.env.OUTPUT_MODE && { output: process.env.OUTPUT_MODE as NextConfig["output"] }),
};

export default nextConfig;
