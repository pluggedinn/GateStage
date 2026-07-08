<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

GateStage is a single-product Node/TypeScript app: a custom `tsx` server (`server.ts`) that wraps Next.js 16 + Socket.io. It listens to race events over a WebSocket and drives ESPHome LED gates. See `README.md` for the full command/port reference; notes below are only the non-obvious caveats.

- **Run via the custom server, not `next dev`.** `npm run dev:mocks` starts all three dev services together (mock Next WS+HTTP, 6 mock ESPHome gates, and GateStage) and is the normal way to run locally. App is at `http://127.0.0.1:8080`; mock Next control HTTP at `:9401`; mock ESPHome gates at `:9080–9085`. Health endpoints: `/api/health` (app), `:9401/health`, `:9080/health`.
- **E2E (`npm run test:e2e`) auto-starts the required services** via Playwright's `webServer` (it reuses already-running ones locally). It requires the Playwright chromium browser, which the update script installs.
- **Fresh config has no routines.** On first boot `data/config.json` (gitignored) is created with `"sequences": []`, so race events will NOT light any gates until routines are configured (via the Routines UI, or `POST /api/sequences/<eventType>/steps`). Because of this, `e2e/gate-automation.spec.ts` ("heat.go triggers green RGB") fails on a fresh config since it assumes a `heat.go` routine already exists — this is a pre-existing gap, not an environment problem. The other e2e specs seed their own steps and pass.
- **Lint (`biome check`) currently reports pre-existing errors/warnings on `main`** (mostly formatting). Running the command works; a non-zero exit does not mean your setup is broken.
