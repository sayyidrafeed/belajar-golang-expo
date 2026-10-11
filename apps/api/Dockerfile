# syntax=docker/dockerfile:1
# Build context: apps/api
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.22
RUN adduser -D -u 10001 app && mkdir /data && chown app /data
COPY --from=build /out/api /usr/local/bin/api
USER app
ENV API_ADDR=0.0.0.0:8080 TODOS_DB=/data/todos.db
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["api"]
