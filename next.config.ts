import type { NextConfig } from "next";

// Served at https://itrapidsupport.github.io/snow-log/ (folder snow-log/ in the itrapidsupport.github.io Pages repo).
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
