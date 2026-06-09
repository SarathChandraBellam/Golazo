import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The agent package resolves dataset CSVs relative to its own directory and
  // pulls in LangChain's Node-specific code, so keep it out of the bundle.
  serverExternalPackages: ["@golazo/agent"],
};

export default nextConfig;
