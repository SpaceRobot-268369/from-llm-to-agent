# syntax=docker/dockerfile:1

# From LLM to Agent: a static single page, built with Vite and served by nginx.
#   docker build -t from-llm-to-agent .
#   docker run --rm -p 8080:8080 from-llm-to-agent   → http://localhost:8080

# ── build: compile the static site ─────────────────────────────────────────
# Vite 8 needs Node ^20.19 || >=22.12
FROM node:22-alpine AS build
WORKDIR /app

# dependencies first, so source edits don't bust the npm layer
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── serve: the built files from nginx, running as a non-root user ──────────
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/healthz || exit 1
