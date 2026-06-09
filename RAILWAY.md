# Deploying Signal Catalyst to Railway

Signal Catalyst is a single Express server that serves both the API and the
built React client on one port. In production it runs the bundled
`dist/index.cjs`. This guide covers a Docker-based deploy on
[Railway](https://railway.app).

## TL;DR

1. Push this repo to GitHub (or use the Railway CLI).
2. Create a new Railway project → **Deploy from GitHub repo**.
3. Railway detects the `Dockerfile` (also pinned via `railway.json`).
4. Set the environment variables below.
5. Deploy. Railway assigns a public URL and injects `PORT` automatically.

## How it builds and runs

- **Build:** `npm run build` compiles the client with Vite and bundles the
  server with esbuild into `dist/index.cjs`.
- **Start:** `node dist/index.cjs` with `NODE_ENV=production`. The server reads
  `process.env.PORT` and falls back to `5000` if it is not set, so it works both
  locally and on Railway (which provides `PORT`).
- The `Dockerfile` is multi-stage: it installs build tools so the native
  `better-sqlite3` module compiles, builds, then ships a slim runtime image.

## Environment variables

| Variable                              | Required | Notes                                                                                  |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`                   | For live Claude | Standard Anthropic API key. Without it, the app runs in "mock mode" (still fully functional, just no live model). |
| `ANTHROPIC_BASE_URL`                  | Optional | Defaults to `https://api.anthropic.com`. Only override for a proxy/gateway.            |
| `ANTHROPIC_MODEL`                     | Optional | Defaults to `claude-sonnet-4-20250514`.                                                |
| `NODE_ENV`                            | Recommended | Set to `production`.                                                                 |
| `PORT`                                | Auto     | Railway sets this. Do not hard-code it; the server respects it and defaults to 5000.   |
| `CUSTOM_CRED_API_ANTHROPIC_COM_URL`   | Optional | Secure-credential proxy URL (used only if `ANTHROPIC_API_KEY` is absent).              |
| `CUSTOM_CRED_API_ANTHROPIC_COM_TOKEN` | Optional | Secure-credential proxy token (used only if `ANTHROPIC_API_KEY` is absent).            |

Credential resolution priority (first complete pair wins):

1. `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_BASE_URL`)
2. `CUSTOM_CRED_API_ANTHROPIC_COM_TOKEN` + `CUSTOM_CRED_API_ANTHROPIC_COM_URL`
3. Legacy `CUSTOM_CRED_PLATFORM_CLAUDE_COM_*` (fallback only)

All Anthropic calls happen server-side. The API key is never sent to the
browser — the client only ever calls `POST /api/companies/:ticker/generate-analysis`.

## ⚠️ SQLite caveat (important)

The app uses a local SQLite file (`data.db`) via `better-sqlite3`. On Railway,
the container filesystem is **ephemeral** — it resets on every deploy/restart.
The DB is auto-seeded on boot, so the app always works, but **any runtime
writes (e.g. watchlist additions) are lost on redeploy.**

To make data durable, pick one:

- **Railway Volume** — attach a persistent volume and point the DB path at it
  (e.g. mount `/data` and open `/data/data.db`). This is the smallest change.
- **Postgres** — provision Railway Postgres and migrate the Drizzle schema from
  the SQLite driver to `drizzle-orm/node-postgres`. Recommended for multi-user
  or production-grade durability.

For a personal research tool with seeded data, the ephemeral default is fine.

## Local production smoke test

```bash
npm install
npm run build
NODE_ENV=production PORT=5000 node dist/index.cjs
# open http://localhost:5000
```

## Railway CLI (alternative to GitHub)

```bash
npm i -g @railway/cli
railway login
railway init
railway up
railway variables set ANTHROPIC_API_KEY=sk-ant-... NODE_ENV=production
```
