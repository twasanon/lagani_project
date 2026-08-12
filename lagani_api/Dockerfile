# syntax=docker/dockerfile:1
FROM golang:1.23-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/lagani-api ./cmd/server \
    && wasmer_dir="$(go list -m -f '{{.Dir}}' github.com/wasmerio/wasmer-go)" \
    && cp "${wasmer_dir}/wasmer/packaged/lib/linux-amd64/libwasmer.so" /out/libwasmer.so

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 lagani \
    && useradd --system --uid 10001 --gid lagani --home-dir /app lagani \
    && mkdir -p /app /data \
    && chown -R lagani:lagani /app /data

COPY --from=build /out/lagani-api /app/lagani-api
COPY --from=build /out/libwasmer.so /usr/local/lib/libwasmer.so
COPY --chown=lagani:lagani css.wasm /app/css.wasm

USER lagani
WORKDIR /app
ENV PORT=8080 \
    DB_FILE=/data/lagani_cache.db \
    WASM_FILE=/app/css.wasm \
    LD_LIBRARY_PATH=/usr/local/lib
EXPOSE 8080

ENTRYPOINT ["/app/lagani-api"]
