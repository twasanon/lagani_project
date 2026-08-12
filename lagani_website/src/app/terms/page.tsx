import type { Metadata } from "next";

import { LegalHeader } from "@/components/legal-header";
import { getPublicSiteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using Lagani's NEPSE tracking and educational tools.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  const { supportEmail } = getPublicSiteConfig();

  return (
    <div className="legal-page">
      <LegalHeader />
      <main className="legal-main">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Use</h1>
        <p className="legal-updated">Effective August 12, 2026</p>

        <section>
          <h2>Purpose of Lagani</h2>
          <p>
            Lagani provides educational tools for recording portfolios, simulating
            trades, viewing public market information, maintaining watchlists, and
            reading market news. It is not a licensed broker, exchange, custodian,
            financial adviser, or order-routing service. Nothing in Lagani is a
            recommendation to buy, sell, or hold a security.
          </p>
        </section>

        <section>
          <h2>Market data is not real time</h2>
          <p>
            Prices, charts, market status, movers, company records, and news may be
            cached, delayed, incomplete, unavailable, adjusted, or incorrect. A
            displayed timestamp describes the latest record Lagani has received;
            it does not guarantee exchange-level freshness. Verify material facts
            with NEPSE, your broker, and other authoritative sources before acting.
          </p>
        </section>

        <section>
          <h2>Paper trading and portfolio calculations</h2>
          <p>
            Virtual trades do not execute on any exchange and cannot reproduce
            liquidity, queue priority, fees, taxes, slippage, corporate actions,
            settlement, auction rules, or every NEPSE restriction. Portfolio
            figures are estimates based on your entries and available prices.
            You remain responsible for checking transaction records and results.
          </p>
        </section>

        <section>
          <h2>Alerts</h2>
          <p>
            Price alerts are convenience notifications, not guaranteed monitoring.
            They can be late or absent because of stale data, connectivity,
            background limits, permission settings, device state, or service
            interruption. Do not rely on Lagani alerts to protect a position or
            meet a trading deadline.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>interfere with, overload, probe, or bypass security on the service;</li>
            <li>use API administration routes without explicit authorization;</li>
            <li>misrepresent Lagani data as an official real-time NEPSE feed; or</li>
            <li>use the service in violation of applicable law or third-party rights.</li>
          </ul>
        </section>

        <section>
          <h2>Availability and liability</h2>
          <p>
            The service is provided on an “as available” basis and may change or
            stop without notice. To the extent allowed by applicable law, Lagani&apos;s
            maintainers disclaim warranties and are not liable for trading losses,
            missed opportunities, data errors, device data loss, or indirect
            damages arising from use of the service.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            These terms should receive qualified Nepal-specific legal review before
            a public commercial launch.
            {supportEmail ? (
              <> Questions can be sent to <a className="text-link" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>
            ) : (
              <> A public support address will be added before store submission.</>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
