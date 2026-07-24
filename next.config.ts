import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  // PGlite ships a WASM build of Postgres. The server bundler rewrites its WASM
  // instantiation and breaks it, so it must load as a real external package at
  // runtime rather than being bundled. `pg` is native and must stay external too.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
