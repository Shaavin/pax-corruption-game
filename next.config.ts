import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** Short git commit of this build, stamped into game records for troubleshooting. */
function gitBuild(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    PAX_BUILD: gitBuild(),
  },
};

export default nextConfig;
