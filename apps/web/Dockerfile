FROM node:22-bookworm-slim AS build
WORKDIR /app

ARG VITE_SECURITY_MODE
ARG VITE_API_URL
ARG VITE_MAIL_UI_URL
ENV VITE_SECURITY_MODE=${VITE_SECURITY_MODE}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_MAIL_UI_URL=${VITE_MAIL_UI_URL}

COPY package.json package.json
COPY package-lock.json package-lock.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tests/functional/package.json tests/functional/package.json
COPY tests/security/package.json tests/security/package.json
RUN npm ci --workspace @bookguard/web --include-workspace-root

COPY apps/web apps/web
RUN npm run build --workspace @bookguard/web

FROM nginx:1.27-alpine
ARG VITE_SECURITY_MODE=secure
ARG VITE_API_URL=http://localhost:4002
COPY apps/web/nginx.conf /tmp/nginx.baseline.conf
COPY apps/web/nginx.secure.conf /tmp/nginx.secure.conf
COPY apps/web/nginx.secure.headers.conf /etc/nginx/bookguard-secure-headers.conf
RUN sed -i "s|__API_URL__|${VITE_API_URL}|g" /tmp/nginx.secure.conf
RUN sed -i "s|__API_URL__|${VITE_API_URL}|g" /etc/nginx/bookguard-secure-headers.conf
RUN cp "/tmp/nginx.${VITE_SECURITY_MODE}.conf" /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
