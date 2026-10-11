# syntax=docker/dockerfile:1
# Build context: repository root (npm workspace lockfile lives there)
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
RUN npm ci
COPY apps/mobile apps/mobile
# EXPO_PUBLIC_* values are inlined into the public bundle at build time.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN test -n "$EXPO_PUBLIC_API_URL" || (echo "EXPO_PUBLIC_API_URL build arg is required" && exit 1)
RUN cd apps/mobile && npx expo export --platform web --output-dir dist

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/mobile/dist /usr/share/nginx/html
EXPOSE 8080
