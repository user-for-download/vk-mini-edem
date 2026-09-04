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
  "generated",
  "node_modules",
]);
// Existing whitespace is baselined by exact location so new violations still fail.
// Remove entries when those lines are naturally touched by future product work.
const legacyTrailingWhitespace = new Set([
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

/**
 * JSONC по соглашению: tsconfig-файлы (TypeScript сам парсит их с комментариями)
 * и opencode.json. Такие файлы проверяем после вычистки комментариев
 * и trailing-запятых; остальные .json — строгим JSON.parse.
 */
function isJsoncFile(relativePath) {
  const base = path.basename(relativePath);
  return base.startsWith("tsconfig") || base === "opencode.json";
}

/** Убирает // и /* *\/ комментарии, не трогая содержимое строк. */
function stripJsoncComments(content) {
  let out = "";
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
    } else if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
    } else {
      out += ch;
    }
  }

  return out;
}

/** Удаляет запятые перед `}`/`]` вне строк (trailing commas из JSONC). */
function stripTrailingCommas(content) {
  let out = "";
  let inString = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += content[i + 1] ?? "";
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < content.length && /\s/.test(content[j])) j += 1;
      if (content[j] === "}" || content[j] === "]") continue;
    }

    out += ch;
  }

  return out;
}

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
    const parseText = isJsoncFile(relativePath)
      ? stripTrailingCommas(stripJsoncComments(content))
      : content;
    try {
      JSON.parse(parseText);
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
