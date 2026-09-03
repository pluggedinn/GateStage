import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set(["node_modules", ".next", "dist", "data", ".git"]);

async function collect(dir, files) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collect(next, files);
      continue;
    }
    if (entry.name.endsWith(".test.ts")) files.push(next);
  }
}

const files = [];
await collect(root, files);
files.sort();

if (files.length === 0) {
  console.error("No *.test.ts files found");
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["--import", "tsx", "--test", ...process.argv.slice(2), ...files],
  { stdio: "inherit", cwd: root },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
