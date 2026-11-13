import type { NextConfig } from "next";

// Served at https://naukhangreenwin.github.io/snow-log/ (GitHub Pages project site).
const BASE = "/snow-log";

const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: BASE },
  poweredByHeader: false,
};

export default nextConfig;
