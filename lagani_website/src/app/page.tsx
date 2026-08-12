import Image from "next/image";
import Link from "next/link";

import { StoreCta } from "@/components/store-cta";
import { getPublicSiteConfig } from "@/lib/site-config";

const features = [
  {
    number: "01",
    title: "Portfolio tracking",
    description:
      "Record buys and sells, review average cost, and see unrealized performance using the latest available market price.",
  },
  {
    number: "02",
    title: "Paper trading",
    description:
      "Practice NEPSE trades with virtual cash before putting real capital at risk. Your simulated account stays on your device.",
  },
  {
    number: "03",
    title: "Market context",
    description:
      "Browse listed companies, market movers, historical charts, watchlists, price alerts, and Nepal-focused financial news.",
  },
];

const dataPrinciples = [
  {
    label: "Latest available",
    detail:
      "Lagani shows the source timestamp and does not present cached NEPSE data as a live exchange feed.",
  },
  {
    label: "Local by design",
    detail:
      "Portfolio entries, paper trades, watchlists, and alert targets are stored locally in the mobile app.",
  },
  {
    label: "Decision support",
    detail:
      "Lagani is an educational tracking tool—not a broker, trading venue, or source of investment advice.",
  },
];

export default function Home() {
  const config = getPublicSiteConfig();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Lagani home">
            <Image
              src="/lagani_logo.png"
              alt=""
              width={44}
              height={44}
              priority
            />
            <span>Lagani</span>
          </Link>
          <nav aria-label="Primary navigation">
            <a href="#features">Features</a>
            <a href="#data">How data works</a>
            <a href="#download">Get the app</a>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Built for Nepal&apos;s investing community</p>
            <h1 id="hero-title">
              Your NEPSE portfolio,
              <span> finally in focus.</span>
            </h1>
            <p className="hero-summary">
              Track holdings, practice with virtual trades, follow companies, and
              understand the latest available market data in one focused app.
            </p>
            <div className="hero-actions" id="download">
              <StoreCta
                store="apple"
                url={config.appStoreUrl}
                className="store-cta-primary"
              />
              <StoreCta store="google" url={config.playStoreUrl} />
            </div>
            {!config.hasDownloadLink && (
              <p className="release-note" role="status">
                Store releases are being prepared. Download links will appear here
                when they are public.
              </p>
            )}
            <ul className="hero-points" aria-label="Product highlights">
              <li>NEPSE-focused</li>
              <li>No brokerage connection</li>
              <li>Portfolio data stays local</li>
            </ul>
          </div>

          <div className="phone-stage" aria-label="Lagani mobile app previews">
            <div className="phone phone-primary">
              <span className="phone-speaker" aria-hidden="true" />
              <Image
                src="/app_home.png"
                alt="Lagani home screen showing a portfolio chart and top gainers"
                width={1080}
                height={2400}
                sizes="(max-width: 640px) 62vw, 300px"
                priority
              />
            </div>
            <div className="phone phone-secondary">
              <span className="phone-speaker" aria-hidden="true" />
              <Image
                src="/app_virtual_trade.png"
                alt="Lagani paper trading screen showing a virtual balance and portfolio"
                width={1080}
                height={2400}
                sizes="(max-width: 640px) 42vw, 230px"
              />
            </div>
            <div className="market-badge" aria-hidden="true">
              <span>Designed around</span>
              <strong>NEPSE</strong>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Lagani capabilities">
          <div className="container trust-grid">
            <p>Portfolio ledger</p>
            <p>Historical charts</p>
            <p>Paper trading</p>
            <p>Market news</p>
          </div>
        </section>

        <section className="section container" id="features" aria-labelledby="features-title">
          <div className="section-heading">
            <p className="eyebrow">One calm place to learn and track</p>
            <h2 id="features-title">Useful context without the noise.</h2>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.number}>
                <span>{feature.number}</span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section data-section" id="data" aria-labelledby="data-title">
          <div className="container data-grid">
            <div className="data-intro">
              <p className="eyebrow">Know what you are looking at</p>
              <h2 id="data-title">Market data needs honest labels.</h2>
              <p>
                Nepal market sources can be delayed, unavailable, or revised.
                Lagani&apos;s architecture keeps source timestamps and cache status
                visible so stale information is not mistaken for a live quote.
              </p>
              <Link className="text-link" href="/terms">
                Read the market-data terms <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="principle-list">
              {dataPrinciples.map((principle) => (
                <article key={principle.label}>
                  <h3>{principle.label}</h3>
                  <p>{principle.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section container">
          <div className="final-cta">
            <div>
              <p className="eyebrow">A clearer way to follow NEPSE</p>
              <h2>Build your investing routine before your next trade.</h2>
            </div>
            <div className="final-actions">
              <StoreCta store="apple" url={config.appStoreUrl} />
              <StoreCta store="google" url={config.playStoreUrl} />
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Link className="brand footer-brand" href="/" aria-label="Lagani home">
              <Image src="/lagani_logo.png" alt="" width={36} height={36} />
              <span>Lagani</span>
            </Link>
            <p>NEPSE tracking and educational tools for Nepal&apos;s investors.</p>
          </div>
          <div className="footer-links" aria-label="Legal and support links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            {config.supportEmail && (
              <a href={`mailto:${config.supportEmail}`}>Support</a>
            )}
          </div>
          <p className="copyright">
            © {new Date().getFullYear()} Lagani. Not investment advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
