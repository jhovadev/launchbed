import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import solidJs from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

// Vercel exports VERCEL=1 during its build. Explicit override is useful for CI.
// Outside Vercel keep the Node adapter for the existing Docker/standalone workflow.
const deployToVercel = process.env.VERCEL === "1" || process.env.LAUNCHBED_DEPLOY_TARGET === "vercel";

export default defineConfig({
  output: "server",
  adapter: deployToVercel ? vercel() : node({ mode: "standalone" }),
  integrations: [solidJs()],
  vite: { plugins: [tailwindcss()] },
  server: { host: true, port: 4321 },
  devToolbar: { enabled: false },
});
