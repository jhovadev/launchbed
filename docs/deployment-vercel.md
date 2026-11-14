# Kotlaunch — deploy Astro Initializr to Vercel

## Architecture and scope

- The deployable app is `apps/web`, not the entire monorepo.
- It uses Astro 7 SSR + SolidJS islands. The API routes `/api/catalog`, `/api/presets`, `/api/plan` and `/api/generate` **must** run server-side.
- In Vercel builds (`VERCEL=1`) Astro uses `@astrojs/vercel` 11.0.22; outside Vercel the existing `@astrojs/node` adapter continues to serve the Docker/standalone workflow.
- The Android Gradle SDK, emulators, ADB and Docker Compose are **not** needed to generate ZIPs on Vercel. The server is not an Android APK build service.
- The generated archive uses deterministic in-memory data from trusted, embedded templates; no database or cloud account is required.

## Prepare once, on a clean checkout

From the **repository root** after applying F1.7A:

```bash
bun install                         # regenerates bun.lock with @astrojs/vercel
bun install --frozen-lockfile       # confirms CI/Vercel reproducibility
node scripts/deployment/preflight.mjs
bun run typecheck
bun run check:astro
bun test packages tests
node --test scripts/deployment/vercel-smoke.node.test.mjs
bun run build                       # preserves Node standalone build
bun run deploy:ssr-smoke            # renders GET / through the real Node SSR server and checks ZIP APIs
KOTLAUNCH_DEPLOY_TARGET=vercel bun run build  # builds Vercel SSR adapter
```

**Important:** F1.7A modifies `apps/web/package.json`; its `.patch` does not contain a fabricated `bun.lock`. Bun must regenerate that file using the pinned dependency and you must commit the resulting `bun.lock` together with the patch before using `bun install --frozen-lockfile` in CI. `deploy:check` is designed to fail until the lock is updated.

## Import GitHub into Vercel (recommended)

1. In the [Vercel Dashboard](https://vercel.com/new), import **`jhovadev/kotlaunch`**.
2. Name the Vercel project `kotlaunch` if available (the platform assigns the actual domain; do not assume availability).
3. **Framework preset:** Astro.
4. **Root Directory:** `apps/web`.
5. In Project Settings → Build and Deployment → Root Directory, confirm **Include source files outside of the Root Directory in the Build Step** is enabled. Workspace packages in `packages/*` are mandatory.
6. **Install Command:** use the Bun auto-detected default (`bun install`) or explicitly `bun install --frozen-lockfile` when the root lockfile has been updated and detected.
7. **Build Command:** `KOTLAUNCH_DEPLOY_TARGET=vercel bun run build` (from `apps/web`; the override explicitly selects Vercel's SSR adapter even if the Vercel system-variable exposure setting is disabled).
8. **Output Directory:** leave as framework default; do not force `dist` or `build` for the Vercel SSR adapter.
9. **Node.js Runtime:** select a Vercel-supported Node.js 24 version where possible. The repository uses Node 24 locally.
10. Deploy production only after CI passes. Production branch `main`; new Git pushes create deployments.

Do not set a repository-level `vercel.json` `rootDirectory` as a substitute for the project setting. Linking a Vercel project is an explicit action under your Vercel account.

### Optional CLI path

From repository root:

```bash
bunx vercel login
bunx vercel link --repo
bunx vercel project inspect --non-interactive
bunx vercel deploy --prod
```

Check the target project/organization before `--prod`. Use the Dashboard import method if linking is ambiguous.

## Verify actual production, not just build logs

Set `KOTLAUNCH_DEPLOY_URL` to the **real** URL returned by Vercel:

```bash
KOTLAUNCH_DEPLOY_URL='https://your-actual-domain.vercel.app' bun run deploy:smoke
# or
node scripts/deployment/vercel-smoke.mjs --url 'https://your-actual-domain.vercel.app'
```

The smoke checks the homepage, the catalog and presets endpoints, POST `/api/plan`, and two POST `/api/generate` calls. It compares response metadata and SHA-256 of the ZIP, without saving the generated app or invoking Android SDK tools. A homepage rendering alone is insufficient.

### Troubleshooting

- `Cannot resolve @android-initializr/...` or missing ZIP template: verify root `apps/web`, workspace access beyond root, and frozen Bun installation. Do not copy packages manually.
- `Cannot find @astrojs/vercel`: run `bun install` in repository root, commit `bun.lock`, and rerun `deploy:check`.
- `@astrojs/node` adapter in production: check `VERCEL=1` at build; the special adapter override `KOTLAUNCH_DEPLOY_TARGET=vercel` is available for CI and local verification.
- API 404/500 while homepage works: confirm SSR adapter build, serverless function logs, and monorepo tracing. Do **not** convert the project to a static site to hide the error.
- POST returns 413/400/422: verify the payload against the generator's strict Zod request schema and configured size limits.
- Bun install and npm install at the same time: use only the repository's Bun workspace and lockfile; avoid introducing a second lockfile.

## Operational limits

Public ZIP generation consumes function CPU and bandwidth. Existing Zod/ZIP limits prevent oversized input and output, but they are **not** rate limiting. Configure platform abuse protection/rate limits and observe function logs before promoting heavy traffic. Do not store credentials inside generated ZIPs or assume the preview renders actual Jetpack Compose.

This deployment does not claim that Android device tests, release signing or APK publication have passed. Those remain separately gated by the existing runtime and release checks.

## SSR hydration regression (F1.7A.1)

The homepage uses `<Configurator client:load />` and renders the Solid component on the server before hydrating. `createMemo()` evaluates its initial callback synchronously, so signals referenced by it must be declared earlier. In F1.7A the `availableScreens` memo used `selectedAddons` before initialization, causing runtime `ReferenceError` on Vercel despite successful TypeScript and Astro builds.

F1.7A.1 moves the `selectedAddons` signal above that memo and adds a real HTTP SSR smoke to CI. The live deployment smoke now requires both the configurator section and the actual generated form; a shell-only SSR response cannot pass. Do not replace `client:load` with `client:only` to mask future SSR issues. Run `bun run build && bun run deploy:ssr-smoke` before `KOTLAUNCH_DEPLOY_TARGET=vercel bun run build`.
