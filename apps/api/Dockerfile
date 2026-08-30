# One image for both halves: the api serves the frontend bundle from the same
# domain it answers routes on. No CORS, no preflight, and the presence WebSocket
# is same-origin.

FROM node:24.19-alpine AS web
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @drive-in/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @drive-in/web build

FROM node:24.19-alpine
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @drive-in/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY --from=web /app/apps/web/dist ./web

ENV NODE_ENV=production
ENV WEB_ROOT=/app/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@drive-in/api", "start"]
