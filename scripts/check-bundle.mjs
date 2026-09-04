import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const PER_FILE_GZIP_KIB = 130;
const INITIAL_GZIP_KIB = 330;

// Pure: gzip size of a buffer, no I/O.
const gzipKib = (bytes) => gzipSync(bytes).byteLength / 1024;

// Pure: collect budget violations for one dist dir from already-read files.
const collectOversized = (label, jsEntries, initialEntries) => {
  const oversized = jsEntries
    .filter(({ gzipKib: size }) => size > PER_FILE_GZIP_KIB)
    .map(({ file, gzipKib: size }) => `${label}/${file}: ${size.toFixed(1)} KiB gzip`);
  const initialKib = initialEntries.reduce((sum, { gzipKib: size }) => sum + size, 0);
  if (initialKib > INITIAL_GZIP_KIB) {
    oversized.push(`${label} initial assets: ${initialKib.toFixed(1)} KiB gzip`);
  }
  return { oversized, initialKib };
};

const readBytes = (filePath) => readFile(filePath).catch(() => null);

const checkDist = async (distDir) => {
  const label = path.basename(path.dirname(distDir)) + "/dist";
  const assets = path.join(distDir, "assets");
  const files = await readdir(assets).catch(() => null);
  if (!files) return { label, fatal: `${label}: missing — run "npm run build" first` };

  const jsFiles = files.filter((file) => file.endsWith(".js"));
  const jsEntries = (
    await Promise.all(
      jsFiles.map(async (file) => {
        const bytes = await readBytes(path.join(assets, file));
        return bytes ? { file, gzipKib: gzipKib(bytes) } : null;
      }),
    )
  ).filter(Boolean);

  const indexHtml = await readBytes(path.join(distDir, "index.html"));
  if (!indexHtml) return { label, fatal: `${label}: index.html missing — run "npm run build" first` };
  const initialAssets = [
    ...new Set(
      [...indexHtml.toString().matchAll(/(?:src|href)="(?:\.\/|\/)?assets\/([^"]+\.(?:js|css))"/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  const initialEntries = (
    await Promise.all(
      initialAssets.map(async (file) => {
        const bytes = await readBytes(path.join(assets, file));
        return bytes ? { file, gzipKib: gzipKib(bytes) } : null;
      }),
    )
  ).filter(Boolean);

  const { oversized, initialKib } = collectOversized(label, jsEntries, initialEntries);
  return { label, oversized, initialKib };
};

// Both frontends ship to production: mini-app (VK client) and webapp (admin).
// Root "npm run build" produces both dists, so both are budget-gated here.
const dists = [path.resolve("mini-app/dist"), path.resolve("webapp/dist")];
const results = await Promise.all(dists.map((dist) => checkDist(dist)));

const fatal = results.filter((result) => result.fatal).map((result) => result.fatal);
const oversized = results.flatMap((result) => result.oversized ?? []);

if (fatal.length || oversized.length) {
  console.error(
    `Bundle budget exceeded:\n${[...fatal, ...oversized].map((item) => `- ${item}`).join("\n")}`,
  );
  process.exitCode = 1;
} else {
  const summary = results.map((result) => `${result.label}: ${result.initialKib.toFixed(1)} KiB`).join(", ");
  process.stdout.write(`Bundle budget passed (initial gzip) — ${summary}.\n`);
}
