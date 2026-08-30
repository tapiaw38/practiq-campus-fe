import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const sourceRoot = new URL("../src/", import.meta.url);
const sourceExtensions = new Set([".css", ".ts", ".vue"]);
const dynamicTokens = new Set([]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(path.slice(path.lastIndexOf("."))) ? [path] : [];
  }));
  return files.flat();
}

const files = await sourceFiles(sourceRoot.pathname);
const declared = new Set();
const referenced = new Map();

for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) declared.add(match[1]);
  for (const match of source.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    const locations = referenced.get(match[1]) ?? [];
    locations.push(file.replace(sourceRoot.pathname, "src/"));
    referenced.set(match[1], locations);
  }
}

const missing = [...referenced]
  .filter(([token]) => !declared.has(token) && !dynamicTokens.has(token))
  .sort(([left], [right]) => left.localeCompare(right));

if (missing.length) {
  console.error("Undefined CSS custom properties:");
  for (const [token, filesUsingToken] of missing) {
    console.error(`  ${token}: ${[...new Set(filesUsingToken)].join(", ")}`);
  }
  process.exit(1);
}

console.log(`CSS token check passed (${referenced.size} references, ${declared.size} declarations).`);
