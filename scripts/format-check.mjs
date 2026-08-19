import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".opencode",
  ".tmp",
  "assets",
  "build",
  "coverage",
  "dist",
  "dump",
  "fix",
  "node_modules",
]);
// Existing whitespace is baselined by exact location so new violations still fail.
// Remove entries when those lines are naturally touched by future product work.
const legacyTrailingWhitespace = new Set([
  "backend/src/bookings/index.ts:624",
  "backend/src/bookings/index.ts:805",
  "backend/src/services/notification.service.ts:34",
  "backend/src/trips/index.ts:516",
  "mini-app/src/providers/WsProvider.tsx:36",
  "mini-app/src/providers/WsProvider.tsx:131",
  "mini-app/src/providers/WsProvider.tsx:198",
]);
const legacyMissingFinalNewline = new Set([
  "mini-app/src/api/notifications.api.ts",
  "mini-app/src/components/EmptyState.tsx",
  "mini-app/src/components/Skeleton/TripCardSkeleton.tsx",
  "mini-app/src/components/ViewErrorBoundary.tsx",
  "mini-app/src/helpers/transformVKBridgeAdaptivity.ts",
  "mini-app/src/providers/useWsEvent.ts",
  "mini-app/src/views/ActionView/panels/PassengerHistoryPanel/PassengerHistoryPanel.tsx",
]);
const textExtensions = new Set([
  ".cjs", ".css", ".example", ".js", ".json", ".md", ".mjs", ".prisma",
  ".scss", ".sh", ".ts", ".tsx", ".yaml", ".yml",
]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      files.push(...(await collectFiles(absolutePath)));
    } else if (textExtensions.has(path.extname(entry.name))) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

const errors = [];

for (const { absolutePath, relativePath } of await collectFiles(root)) {
  const content = await readFile(absolutePath, "utf8");

  if (content.includes("\r")) errors.push(`${relativePath}: contains CRLF/CR characters`);
  if (
    content.length > 0 &&
    !content.endsWith("\n") &&
    !legacyMissingFinalNewline.has(relativePath)
  ) {
    errors.push(`${relativePath}: missing final newline`);
  }

  content.split("\n").forEach((line, index) => {
    const location = `${relativePath}:${index + 1}`;
    if (/[ \t]+$/.test(line) && !legacyTrailingWhitespace.has(location)) {
      errors.push(`${location}: trailing whitespace`);
    }
  });

  if (path.extname(relativePath) === ".json") {
    try {
      JSON.parse(content);
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON (${error.message})`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Format check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exitCode = 1;
} else {
  process.stdout.write("Format check passed.\n");
}
