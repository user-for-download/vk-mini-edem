import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("mini-app/dist");
const assets = path.join(dist, "assets");
const files = await readdir(assets);
const jsFiles = files.filter((file) => file.endsWith(".js"));
const oversized = [];

for (const file of jsFiles) {
  const bytes = await readFile(path.join(assets, file));
  const gzipBytes = gzipSync(bytes).byteLength;
  if (gzipBytes > 130 * 1024) oversized.push(`${file}: ${(gzipBytes / 1024).toFixed(1)} KiB gzip`);
}

const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
const initialAssets = [...indexHtml.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.(?:js|css))"/g)]
  .map((match) => match[1]);
let initialGzipBytes = 0;
for (const file of new Set(initialAssets)) {
  initialGzipBytes += gzipSync(await readFile(path.join(assets, file))).byteLength;
}

if (initialGzipBytes > 330 * 1024) {
  oversized.push(`initial assets: ${(initialGzipBytes / 1024).toFixed(1)} KiB gzip`);
}

if (oversized.length) {
  console.error(`Bundle budget exceeded:\n${oversized.map((item) => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Bundle budget passed: ${(initialGzipBytes / 1024).toFixed(1)} KiB initial gzip.\n`);
}
