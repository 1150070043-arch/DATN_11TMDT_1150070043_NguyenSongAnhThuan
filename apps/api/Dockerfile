FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.base.json tsconfig.base.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tests/functional/package.json tests/functional/package.json
COPY tests/security/package.json tests/security/package.json
RUN npm ci --workspace @bookguard/api --include-workspace-root

COPY apps/api apps/api
RUN npm run build --workspace @bookguard/api

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tests/functional/package.json tests/functional/package.json
COPY tests/security/package.json tests/security/package.json
RUN npm ci --omit=dev --workspace @bookguard/api --include-workspace-root

COPY --from=build /app/apps/api/dist apps/api/dist
WORKDIR /app/apps/api
EXPOSE 4001 4002
CMD ["node", "dist/index.js"]
