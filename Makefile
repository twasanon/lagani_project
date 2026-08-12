.PHONY: verify api mobile website live-api compose-config build-images

verify: api mobile website

api:
	$(MAKE) -C lagani_api test-race vet

mobile:
	cd lagani && npm run verify

website:
	cd lagani_website && npm run verify

live-api:
	$(MAKE) -C lagani_api test-live

compose-config:
	docker compose --env-file .env.example config --quiet

build-images: compose-config
	docker compose --env-file .env.example build
