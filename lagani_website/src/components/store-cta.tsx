type Store = "apple" | "google";

type StoreCtaProps = {
  store: Store;
  url?: string;
  className?: string;
};

const storeCopy: Record<Store, { eyebrow: string; title: string }> = {
  apple: { eyebrow: "Download on the", title: "App Store" },
  google: { eyebrow: "Get it on", title: "Google Play" },
};

function StoreIcon({ store }: { store: Store }) {
  if (store === "apple") {
    return (
      <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 12.54c-.03-3.06 2.5-4.55 2.61-4.62a5.58 5.58 0 0 0-4.39-2.38c-1.85-.2-3.64 1.1-4.58 1.1-.96 0-2.41-1.08-3.97-1.04a5.82 5.82 0 0 0-4.9 2.98c-2.13 3.69-.54 9.12 1.5 12.1 1.02 1.46 2.2 3.08 3.76 3.02 1.52-.06 2.09-.97 3.92-.97 1.81 0 2.35.97 3.94.93 1.63-.02 2.66-1.47 3.64-2.94a12.1 12.1 0 0 0 1.66-3.38 5.28 5.28 0 0 1-3.19-4.8ZM14.06 3.58A5.34 5.34 0 0 0 15.28 0a5.45 5.45 0 0 0-3.52 1.7 5.1 5.1 0 0 0-1.26 3.43 4.5 4.5 0 0 0 3.56-1.55Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.6 2.2c-.38.4-.6 1.02-.6 1.8v16c0 .78.22 1.4.6 1.8l.1.08L13.92 12 3.7 2.12l-.1.08Zm13.73 6.51-2.72-1.58-8.65-5 8.7 8.4 2.67-1.82ZM5.96 21.87l8.65-5 2.73-1.58-2.69-1.83-8.69 8.41Zm13.09-7.58 2.34-1.35c.8-.46.8-1.22 0-1.69l-2.36-1.36-2.88 2.11 2.9 2.29Z" />
    </svg>
  );
}

export function StoreCta({ store, url, className = "" }: StoreCtaProps) {
  const copy = storeCopy[store];
  const classes = `store-cta ${className}`.trim();
  const contents = (
    <>
      <StoreIcon store={store} />
      <span className="store-cta-copy">
        <small>{url ? copy.eyebrow : "Coming soon to"}</small>
        <strong>{copy.title}</strong>
      </span>
    </>
  );

  if (!url) {
    return (
      <span className={`${classes} store-cta-disabled`} aria-disabled="true">
        {contents}
      </span>
    );
  }

  return (
    <a className={classes} href={url} target="_blank" rel="noopener noreferrer">
      {contents}
    </a>
  );
}
