.PHONY: build docker-build test test-race test-live vet run

build:
	mkdir -p bin
	go build -trimpath -o bin/lagani-api ./cmd/server

# wasmer-go v1.0.4 does not enable its bundled Linux arm64 linker path.
docker-build:
	docker build --platform linux/amd64 -t lagani-api .

test:
	go test ./...

test-race:
	go test -race ./...

test-live:
	go test -tags=integration ./internal/scraper -run '^TestLive' -v

vet:
	go vet ./...

run:
	go run ./cmd/server
