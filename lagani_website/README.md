# Lagani website

Lagani's public website is a small, static-first Next.js application that explains the mobile product, establishes accurate expectations about NEPSE data, and directs visitors to verified mobile-store listings. It does not fetch quotes, hold user portfolios, or proxy the Lagani API.

The website was audited and rebuilt on August 12, 2026. Its production build is intentionally simple: six static routes, no client-side application state, no account forms, no analytics SDK, and no live dependency on the market-data API.

## Product scope

The page represents the mobile app's implemented capabilities:

- local portfolio and transaction tracking;
- paper trading with a virtual balance;
- NEPSE company search, movers, and historical charts;
- watchlists and best-effort price alerts;
- Nepal-focused market news; and
- visible market freshness and source timestamps.

The copy deliberately does **not** promise a real-time exchange feed, brokerage execution, guaranteed alerts, investment advice, cloud sync, or an account system. Those distinctions are product and safety requirements, not merely marketing choices.

## Technology

- Next.js 16 App Router
- React 19
- TypeScript in strict mode
- Tailwind CSS 4 for compilation plus project-owned CSS
- Next.js static generation for every public route
- Node.js 20.19 or newer; CI and the container use Node.js 22

No external font, animation, icon, analytics, or component runtime is required. Store icons are inline, decorative SVGs, and the three product images live under `public/`.

## Quick start

```bash
cd lagani_website
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. Empty store URL variables are valid during development: the page renders clearly disabled “Coming soon” badges instead of dead links.

Before submitting any change, run:

```bash
npm run verify
npm audit --omit=dev
```

`npm run verify` runs ESLint, strict TypeScript validation, a production build, and assertions against the generated HTML.

## Public configuration

All variables are build-time public values. Next.js embeds `NEXT_PUBLIC_*` values into the generated pages, so changing them requires a new build and deployment.

| Variable | Required for launch | Purpose | Safe absent behavior |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical HTTPS origin used by metadata, `robots.txt`, and `sitemap.xml` | Uses `http://localhost:3000` |
| `NEXT_PUBLIC_APP_STORE_URL` | When the iOS listing is public | Full App Store listing URL | Shows a disabled App Store badge |
| `NEXT_PUBLIC_PLAY_STORE_URL` | When the Android listing is public | Full Google Play listing URL | Shows a disabled Google Play badge |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | Public support/privacy contact | Omits the support link and explains that one is pending |

The configuration parser accepts only credential-free `http:` or `https:` URLs and a basic valid email shape. The canonical site value must be a bare origin without a path, query, or fragment. Invalid values fail closed: store/contact values are not rendered as links and an invalid site origin falls back to localhost so release smoke review exposes the mistake.

Do not put secrets in these variables. Every `NEXT_PUBLIC_*` value can be read by a visitor.

## Routes

| Route | Rendering | Responsibility |
| --- | --- | --- |
| `/` | Static | Product positioning, app previews, release links, data limitations |
| `/privacy` | Static | Current data-handling disclosure for app, site, and API |
| `/terms` | Static | Educational-use, market-data, alerts, and liability terms |
| `/robots.txt` | Static metadata route | Allows crawling and points to the sitemap |
| `/sitemap.xml` | Static metadata route | Lists the three public HTML pages |
| unknown route | Static 404 | Standard not-found response |

The legal text is an engineering-ready draft and explicitly requires qualified Nepal-specific review before commercial launch.

## Commands

| Command | What it proves |
| --- | --- |
| `npm run dev` | Local development server with fast refresh |
| `npm run lint` | Next.js, React, TypeScript, and accessibility lint rules |
| `npm run typecheck` | Strict type correctness without emitting files |
| `npm run build` | Production compilation and static generation |
| `npm run smoke` | Required text/routes, truthful release state, and no dead root link in generated HTML |
| `npm run verify` | Complete local/CI verification sequence |
| `npm start` | Serves the most recent production build |

## Project map

```text
lagani_website/
├── public/
│   ├── app_home.png
│   ├── app_virtual_trade.png
│   └── lagani_logo.png
├── scripts/
│   └── smoke-build.mjs
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── robots.ts
│   │   └── sitemap.ts
│   ├── components/
│   │   ├── legal-header.tsx
│   │   └── store-cta.tsx
│   └── lib/site-config.ts
├── .env.example
├── Dockerfile
├── next.config.mjs
└── package.json
```

## Deployment posture

The code is deployable to any managed Next.js host or to the included container. Launch still requires the founders to supply the canonical domain, public support address, and whichever verified store URLs exist. Configure HTTPS and HSTS at the hosting edge, then run the production checks in [DEPLOYMENT.md](./DEPLOYMENT.md).

The response configuration adds a restrictive content policy, denies framing, disables unused browser permissions, hides the framework header, and prevents MIME sniffing. The current content policy allows inline scripts/styles because Next.js emits inline bootstrap and style content; introducing third-party scripts requires a deliberate policy and privacy review.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — rendering model, boundaries, invariants, and extension rules
- [AUDIT.md](./AUDIT.md) — findings, corrections, evidence, and remaining launch gates
- [DEPLOYMENT.md](./DEPLOYMENT.md) — environment, managed-host, container, rollout, and rollback procedures
- [TESTING.md](./TESTING.md) — automated and real-browser validation

The API and mobile application have separate, component-specific documentation in their own directories. The repository root documents how all three deployables fit together.
