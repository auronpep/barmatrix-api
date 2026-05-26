# syntax=docker/dockerfile:1
# BarMatrix API container — multi-stage build for Cloud Run.
# Build context: barmatrix-api repo root.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Cloud Run injects PORT=8080; src/config.ts honors it.
EXPOSE 8080
CMD ["node", "dist/index.js"]
