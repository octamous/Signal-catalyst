# Signal Catalyst — fullstack (Express + Vite/React + SQLite) production image.
#
# Builds the client (Vite) and server (esbuild -> dist/index.cjs), then runs the
# bundled server. better-sqlite3 is a native module, so we keep the build
# toolchain available during `npm ci` and run the final image on the same base.

FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# --- Dependencies (incl. devDependencies for the build) ---
FROM base AS deps
# python3 + build-essential are required to compile better-sqlite3 from source.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Install everything (dev deps included) so tsx/vite/esbuild are available.
RUN npm ci --include=dev

# --- Build ---
FROM deps AS build
COPY . .
RUN npm run build

# --- Runtime ---
FROM base AS runtime
# Bring in the already-built node_modules (includes the compiled native module)
# and the build output. This avoids recompiling at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Railway provides PORT at runtime; the server falls back to 5000 locally.
ENV PORT=5000
EXPOSE 5000

# Start the bundled production server.
CMD ["node", "dist/index.cjs"]
