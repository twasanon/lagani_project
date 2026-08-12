# Website audit report

**Audit date:** August 12, 2026  
**Scope:** source, dependency posture, rendering architecture, product claims, navigation, legal routes, responsive behavior, accessibility, security headers, CI, and container deployment  
**Outcome:** technical deployment path passes; founder-owned launch inputs remain before public release

## Executive assessment

The original page compiled, but it was not launch-ready. It advertised “real-time” data that the system does not provide, all store and legal destinations were `#`, store anchors were nested inside buttons, an app image used a relative SVG URL, and the dependency tree contained a critical Next.js advisory. The page also carried many unused animation/UI packages and components, had no legal routes, no deploy configuration, no CI workflow, and stale documentation that claimed unfinished links worked.

The implementation is now a static-first product site aligned with the audited API and mobile behavior. It has truthful cache/freshness language, safe unreleased-store states, public legal pages, validated configuration, security headers, strict checks, production container support, and responsive real-browser evidence. Next.js was upgraded to 16.3.0 and unused runtime dependencies were removed. Both `npm audit` and `npm audit --omit=dev` report zero known vulnerabilities at the recorded audit date.

## Findings and dispositions

| Severity | Finding | Risk | Disposition |
| --- | --- | --- | --- |
| Critical | Next.js 15.3.0 was affected by multiple production advisories | Remote compromise, denial of service, cache/security defects depending on deployment features | Upgraded to Next.js 16.3.0; full and production audits now return zero |
| High | Page described data as “real-time” | Investors could mistake cached/scraped data for an exchange feed | Replaced with latest-available language, freshness explanation, and explicit terms |
| High | App Store, Play Store, privacy, and terms links used `href="#"` | Dead conversion path, misleading release status, inaccessible interaction | Store URLs are validated; missing URLs render non-interactive badges; legal routes are real |
| High | Anchor elements were children of button elements | Invalid HTML, unpredictable keyboard/screen-reader behavior | Replaced with a single semantic anchor or disabled non-control per store |
| High | No privacy or usage terms existed | Mobile data behavior, delayed market data, alerts, and simulations were undisclosed | Added `/privacy` and `/terms`; legal review remains a launch gate |
| Medium | Large client animation/component dependency surface was mostly unused | Hydration complexity, random layout behavior, bundle growth, audit exposure | Removed unused Magic UI, motion, icon, Radix, shadcn, and utility code |
| Medium | Landing-page ticker displayed company symbols without a reliable data contract | Suggested a market feed despite being hard-coded | Removed; the website does not display quotes or fake market state |
| Medium | No validated configuration boundary | Invalid/malicious schemes or missing values could become public controls/metadata | Central URL/email parser fails closed; smoke checks cover both release states |
| Medium | No security header policy | Framing, excess browser capability, MIME/referrer exposure | Added CSP, frame denial, MIME, referrer, permissions, and opener headers |
| Medium | No CI or reproducible container | Regressions and deployment drift were likely | Added verification and container-smoke GitHub Actions plus multi-stage Dockerfile |
| Medium | Metadata was generic and canonical/sitemap behavior was absent | Weak sharing/search signals and duplicate-origin risk | Added canonical metadata, Open Graph/Twitter basics, robots, and sitemap routes |
| Low | Google font was fetched at build time and CSS referenced the wrong font variable | Fragile builds and inconsistent typography | Uses a system font stack; removed stale theme/config layers |
| Low | Product image path was relative inside an SVG wrapper | Asset could resolve incorrectly on nested routes | Uses Next Image with root-relative assets and explicit dimensions/alt text |
| Low | Documentation overstated completed behavior | Operators could deploy with missing links and assumptions | Replaced with architecture, audit, deployment, testing, and exact release gates |

## Verification evidence

Automated checks completed against the repaired site:

- `npm run lint` — passed with zero warnings;
- `npm run typecheck` — passed in strict mode;
- `npm run build` — generated `/`, `/privacy`, `/terms`, `/robots.txt`, `/sitemap.xml`, and static 404 output;
- `npm run smoke` — validated critical content, legal pages, sitemap/robots, no bare `href="#"`, no “real-time data” claim, and the correct store release state;
- `npm audit --omit=dev` — zero known vulnerabilities;
- `npm audit` — zero known vulnerabilities.

Production server browser checks:

- desktop viewport: 1440 × 1000;
- phone viewport: 390 × 844 (375 CSS-pixel content width with browser scrollbar accounting);
- no horizontal page overflow in either viewport;
- zero browser console errors or warnings;
- correct page titles for home, privacy, and terms;
- coherent `h1`/`h2`/`h3` outline and labelled landmarks;
- four missing-store appearances rendered with `aria-disabled="true"` and no buttons;
- all homepage anchors resolved to internal sections/pages; no bare placeholder link;
- privacy “Data stored on your device” and terms “Market data is not real time” sections rendered; and
- mobile header retained one clear “Get the app” action while secondary navigation collapsed.

The configured-store branch is also exercised by the generated-build smoke script whenever the corresponding environment variables are present; CI supplies representative HTTPS URLs.

## Residual launch gates

These are not code defects and should not be guessed by an engineer:

1. **Canonical production origin:** set the final HTTPS `NEXT_PUBLIC_SITE_URL`.
2. **Monitored contact:** set a real public `NEXT_PUBLIC_SUPPORT_EMAIL` owned by the Lagani founders.
3. **Store listings:** add only published, verified App Store and Google Play URLs. Leaving one absent is supported and honest.
4. **Legal review:** have qualified Nepal-specific counsel review privacy, terms, financial-disclaimer, company/entity, jurisdiction, age, and consumer-law language before commercial release.
5. **Entity identity:** replace generic “Lagani” ownership language if a legal company/person must be identified.
6. **Screenshot refresh:** recapture `app_home.png` and `app_virtual_trade.png` from the exact release build so sample figures, market status, and navigation match production. Current images are presentation assets, not proof of current market data.
7. **Edge controls:** enable HTTPS redirect and HSTS at the deployed CDN/load balancer, then verify the app headers are preserved.
8. **Production-domain QA:** repeat link, metadata, CSP, phone, desktop, and 404 checks at the final origin.
9. **Provider disclosure:** update privacy/legal content before adding analytics, crash reporting, forms, accounts, email capture, ads, or another data processor.

## Release recommendation

The website code is suitable for staging and production infrastructure deployment. Do not market the deployment as a public launch until all residual gates above are closed. In particular, a successful build cannot substitute for verified store destinations or legal review.
