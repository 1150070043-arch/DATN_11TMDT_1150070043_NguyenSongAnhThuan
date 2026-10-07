FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tests/functional/package.json tests/functional/package.json
COPY tests/security/package.json tests/security/package.json
RUN npm ci --workspace @bookguard/functional-tests --include-workspace-root

COPY tsconfig.base.json tsconfig.base.json
COPY tests/functional tests/functional
COPY tests/security/src/http-session.ts tests/security/src/http-session.ts
CMD ["npm", "run", "test", "--workspace", "@bookguard/functional-tests"]
