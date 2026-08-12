import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const buildFiles = {
  home: ".next/server/app/index.html",
  privacy: ".next/server/app/privacy.html",
  terms: ".next/server/app/terms.html",
  robots: ".next/server/app/robots.txt.body",
  sitemap: ".next/server/app/sitemap.xml.body",
};

const entries = await Promise.all(
  Object.entries(buildFiles).map(async ([name, path]) => [name, await readFile(path, "utf8")]),
);
const output = Object.fromEntries(entries);

assert.match(output.home, /Your NEPSE portfolio/);
assert.match(output.home, /latest available market data/i);
assert.match(output.privacy, /Privacy Policy/);
assert.match(output.privacy, /Data stored on your device/);
assert.match(output.terms, /Terms of Use/);
assert.match(output.terms, /Market data is not real time/);
assert.match(output.robots, /Sitemap:/);
assert.match(output.sitemap, /<urlset/);
assert.doesNotMatch(output.home, /href=["']#["']/);
assert.doesNotMatch(output.home, /real-time data/i);

const configuredStores = [
  process.env.NEXT_PUBLIC_APP_STORE_URL,
  process.env.NEXT_PUBLIC_PLAY_STORE_URL,
].filter(Boolean);

if (configuredStores.length === 0) {
  assert.match(output.home, /Coming soon to/);
  assert.match(output.home, /aria-disabled="true"/);
} else {
  for (const storeUrl of configuredStores) {
    assert.match(output.home, new RegExp(storeUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
}

console.log("Static build smoke checks passed.");
