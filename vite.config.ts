// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import "./scripts/prepare-pdfjs-assets.mjs";
import { execFileSync } from "node:child_process";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Server routes need non-VITE_ env vars (service role key, API keys) in process.env.
const serverEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

const gitRevision = () => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const releaseSha = [
  process.env["GITHUB_SHA"],
  process.env["CF_PAGES_COMMIT_SHA"],
  process.env["COMMIT_SHA"],
  gitRevision(),
].find((value) => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value)) ?? "development";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      __CERTIVOIQ_BUILD_SHA__: JSON.stringify(releaseSha.toLowerCase()),
    },
  },
});
