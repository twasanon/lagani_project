import type { Metadata } from "next";

import { LegalHeader } from "@/components/legal-header";
import { getPublicSiteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Lagani handles website and mobile app data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  const { supportEmail } = getPublicSiteConfig();

  return (
    <div className="legal-page">
      <LegalHeader />
      <main className="legal-main">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Effective August 12, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Lagani is a NEPSE-focused portfolio tracking and educational app. This
            policy explains the data handled by the Lagani mobile app, website,
            and supporting market-data API. It should be reviewed again before a
            public store release if analytics, accounts, cloud sync, advertising,
            or new third-party services are added.
          </p>
        </section>

        <section>
          <h2>Data stored on your device</h2>
          <p>
            Portfolio transactions, paper trades, virtual balances, watchlists,
            alert targets, and app preferences are stored in the mobile app&apos;s
            local database. The current product does not require a Lagani account
            and does not upload that financial journal to the Lagani API.
          </p>
        </section>

        <section>
          <h2>Market-data requests</h2>
          <p>
            The app requests public company, price, chart, market-status, mover,
            and news information from the Lagani API. Those requests do not need
            your portfolio contents. The API or hosting provider may process
            ordinary technical request data such as an IP address, timestamp,
            route, user agent, and error diagnostics for operation and security.
          </p>
        </section>

        <section>
          <h2>Notifications and device permissions</h2>
          <p>
            If you enable alerts, the app may ask the operating system for
            notification permission and run periodic local checks. Alert targets
            remain on the device. Delivery is best effort and depends on the
            operating system, connectivity, background-execution limits, and the
            availability of market data.
          </p>
        </section>

        <section>
          <h2>Website and hosting</h2>
          <p>
            The public website does not contain an account form or advertising
            tracker in this release. Its hosting and content-delivery providers
            may still retain standard access and security logs under their own
            policies. Following an App Store, Google Play, news-source, or support
            link takes you to a separate service governed by that service&apos;s policy.
          </p>
        </section>

        <section>
          <h2>Retention, deletion, and security</h2>
          <p>
            You can remove locally stored app data using the app&apos;s reset controls
            or by uninstalling the app. Server access-log retention depends on the
            production hosting configuration. No system can guarantee absolute
            security; production operators should restrict API administration,
            use HTTPS, rotate secrets, patch dependencies, and limit log retention.
          </p>
        </section>

        <section>
          <h2>Contact and changes</h2>
          <p>
            This policy may change when the product or its service providers
            change. The effective date above identifies this version.
            {supportEmail ? (
              <> Privacy questions can be sent to <a className="text-link" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>
            ) : (
              <> A public privacy-contact address will be added before store submission.</>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
