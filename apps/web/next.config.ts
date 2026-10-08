import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDir, "../../.env");

if (!process.env.NEXT_PUBLIC_API_URL && existsSync(rootEnvPath)) {
  const rawEnvBuffer = readFileSync(rootEnvPath);
  const envContents = (
    rawEnvBuffer.includes(0)
      ? rawEnvBuffer.toString("utf16le")
      : rawEnvBuffer.toString("utf8")
  ).replace(/^\uFEFF/, "");
  const envLines = envContents.split(/\r?\n/);
  const apiUrlLine = envLines.find((line) => line.startsWith("NEXT_PUBLIC_API_URL="));
  if (apiUrlLine) {
    process.env.NEXT_PUBLIC_API_URL = apiUrlLine.slice("NEXT_PUBLIC_API_URL=".length).trim();
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(currentDir, "../.."),
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL
  },
  transpilePackages: ["@kadenatrace/shared", "@kadenatrace/pact"],
  turbopack: {},
  webpack(config) {
    if (config.resolve) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        crypto: false
      };
    }
    return config;
  }
};

export default nextConfig;
