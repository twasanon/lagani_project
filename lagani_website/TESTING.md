# Website testing guide

## Testing goals

The website test strategy protects four things:

1. it builds and serves reproducibly;
2. it describes the product and NEPSE data accurately;
3. it never presents a dead store control as an available download; and
4. it remains accessible and visually coherent across common viewport sizes.

Because the route tree is static and contains no user workflow or state machine, build assertions and browser testing provide more value than a large component-unit-test harness.

## Automated suite

Run the complete suite:

```bash
npm ci
npm run verify
```

This runs, in order:

### ESLint

```bash
npm run lint
```

Applies Next.js Core Web Vitals, React, hooks, TypeScript, and JSX accessibility rules. Warnings fail the command.

### Strict TypeScript

```bash
npm run typecheck
```

Checks the entire application and route metadata without output.

### Production build

```bash
npm run build
```

Must statically generate home, privacy, terms, robots, sitemap, and not-found output. A development server is not evidence of production correctness.

### Generated-output assertions

```bash
npm run smoke
```

`scripts/smoke-build.mjs` reads generated output and asserts:

- the homepage includes the NEPSE value proposition and latest-available language;
- privacy and terms contain their required safety sections;
- robots points to a sitemap and the sitemap is valid XML output;
- there is no bare `href="#"` placeholder;
- the obsolete “real-time data” phrase is absent;
- an unconfigured build includes non-interactive “Coming soon” state; and
- configured store URLs are present in the built HTML.

### Dependency audit

```bash
npm audit --omit=dev
npm audit
```

The first command is the production gate. The full command also evaluates build/lint tooling. Record and investigate new advisories; do not suppress a vulnerable production framework merely because a specific feature appears unused.

## Release-state matrix

Exercise these states before launch:

| App Store URL | Play URL | Expected hero/final CTA behavior |
| --- | --- | --- |
| absent | absent | Both display “Coming soon”; no store anchor exists |
| present | absent | App Store is an external link; Google Play is disabled |
| absent | present | Google Play is an external link; App Store is disabled |
| present | present | Both are external links with `noopener noreferrer` |
| invalid scheme/value | any | Invalid value behaves as absent |

Example configured verification:

```bash
NEXT_PUBLIC_SITE_URL=https://lagani.example \
NEXT_PUBLIC_APP_STORE_URL=https://apps.apple.com/app/id0000000000 \
NEXT_PUBLIC_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.lagani.app \
NEXT_PUBLIC_SUPPORT_EMAIL=support@lagani.example \
npm run verify
```

The GitHub Actions website workflow runs this configured branch. The local no-environment suite covers the unreleased branch.

## Production server check

```bash
npm run build
npm start
```

In a separate terminal:

```bash
curl --fail http://127.0.0.1:3000/
curl --fail http://127.0.0.1:3000/privacy
curl --fail http://127.0.0.1:3000/terms
curl --fail http://127.0.0.1:3000/robots.txt
curl --fail http://127.0.0.1:3000/sitemap.xml
curl --head http://127.0.0.1:3000/
test "$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3000/not-a-route)" = 404
```

Inspect the header response for CSP, `X-Frame-Options`, `X-Content-Type-Options`, referrer, permissions, and opener policy.

## Browser matrix

At minimum test:

- Chromium desktop at 1440 × 1000;
- Chromium phone at 390 × 844;
- Safari/iPhone or WebKit equivalent before store launch;
- one narrow 320-pixel layout; and
- keyboard-only navigation at desktop width.

For every viewport verify:

- no document-level horizontal overflow;
- brand and “Get the app” remain reachable;
- headline, summary, and CTAs do not overlap;
- product screenshots remain clipped within phone frames;
- text does not collide with the NEPSE badge;
- feature cards and data principles retain reading order;
- legal pages remain readable without tiny text or horizontal scrolling;
- no console error, hydration warning, failed image, or CSP violation;
- each internal link reaches the expected content; and
- focus indicators are clearly visible.

The August 12, 2026 audit completed Chromium checks at 1440 × 1000 and 390 × 844 with no horizontal overflow and zero console warnings/errors.

## Accessibility checklist

Keyboard test order should begin with the skip link and continue through brand/navigation, configured store links, data terms, and footer links. Disabled store badges must not enter the tab order.

Inspect the accessibility tree for:

- exactly one descriptive page `h1`;
- ordered `h2` and card/principle `h3` headings;
- banner, navigation, main, regions, articles, and content-info landmarks;
- unique navigation labels on legal and primary headers;
- appropriate product-image alternatives and empty decorative-logo alternatives;
- no button containing an anchor and no click handler on a non-control; and
- no status copy repeatedly announced because of client rerenders (the current page is static).

Automated linting cannot validate copy accuracy, keyboard experience, or visual contrast in every context. Human review remains required.

## Container test

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://lagani.example -t lagani-website:test .
docker run --rm -p 3000:3000 lagani-website:test
```

Repeat the production curl and browser checks. The repository workflow performs root, privacy, terms, and 404 smoke checks against the container.

## Content regression review

Treat the following as test failures:

- unqualified “live” or “real-time” market claims;
- statements that imply Lagani executes or routes trades;
- claims that alerts are guaranteed;
- promises of profit or outperformance;
- stating that cloud accounts/sync exist when they do not;
- current market values embedded in static marketing content without a source timestamp;
- product screenshots presented as current market evidence; or
- legal/privacy text that no longer matches mobile/API behavior.

Compare any claim about a feature to the mobile tests and API contract before approving it.

## Release checklist

- [ ] `npm ci` succeeds from the lockfile.
- [ ] `npm run verify` succeeds with the production public variables.
- [ ] Production and full dependency audits are clear or explicitly risk-reviewed.
- [ ] App screenshots come from the intended mobile release build.
- [ ] Canonical domain, store URLs, and support email are verified by a founder.
- [ ] Privacy and terms have completed qualified legal review.
- [ ] Desktop, phone, Safari/WebKit, keyboard, and 404 checks pass.
- [ ] Security headers survive the production CDN/proxy.
- [ ] The site works with the Lagani API unavailable.
- [ ] A rollback artifact is retained.
