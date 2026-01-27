import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@pricewatch/db"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
