import Image from "next/image";
import Link from "next/link";

export function LegalHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Back to Lagani home">
          <Image src="/lagani_logo.png" alt="" width={44} height={44} />
          <span>Lagani</span>
        </Link>
        <nav aria-label="Legal navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </div>
    </header>
  );
}
