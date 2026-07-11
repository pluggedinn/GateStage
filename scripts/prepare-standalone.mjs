/**
 * After `next build`, prepare `.next/standalone` for the desktop / production
 * launcher: copy static assets + public, and bundle our custom Socket.io server.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const publicSrc = path.join(root, "public");

if (!existsSync(standaloneDir)) {
  console.error(
    "[prepare-standalone] Missing .next/standalone — run `next build` first.",
  );
  process.exit(1);
}

const standaloneNext = path.join(standaloneDir, ".next");
mkdirSync(standaloneNext, { recursive: true });

const staticDest = path.join(standaloneNext, "static");
if (existsSync(staticDest)) {
  rmSync(staticDest, { recursive: true, force: true });
}
cpSync(staticSrc, staticDest, { recursive: true });
console.log("[prepare-standalone] copied .next/static");

if (existsSync(publicSrc)) {
  const publicDest = path.join(standaloneDir, "public");
  if (existsSync(publicDest)) {
    rmSync(publicDest, { recursive: true, force: true });
  }
  cpSync(publicSrc, publicDest, { recursive: true });
  console.log("[prepare-standalone] copied public/");
}

await esbuild.build({
  entryPoints: [path.join(root, "server.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(standaloneDir, "gatestage-server.cjs"),
  // Next stays external so standalone's traced next package is used at runtime.
  external: ["next", "next/*", "sharp", "@img/*"],
  sourcemap: false,
  logLevel: "info",
});

// Standalone NFT traces a slim `next` that is enough for `server.js`, but our
 // custom `next({...})` server needs the full package (compiled webpack, etc.).
 // When developing from the repo, Node walks up to the workspace node_modules and
 // hides this; packaged Electron apps cannot.
for (const pkg of ["next", "react", "react-dom", "styled-jsx"]) {
  const src = path.join(root, "node_modules", pkg);
  const dest = path.join(standaloneDir, "node_modules", pkg);
  if (!existsSync(src)) continue;
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  cpSync(src, dest, { recursive: true });
  console.log(`[prepare-standalone] copied full node_modules/${pkg}`);
}

// Drop files that Next may NFT-trace but that are not needed at runtime.
const pruneNames = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "LICENSE",
  "biome.json",
  "components.json",
  "electron-builder.yml",
  "playwright.config.ts",
  "postcss.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "server.ts",
  "tsconfig.json",
  "desktop",
  "docs",
  "e2e",
  "mocks",
  "scripts",
  ".cursor",
  ".git",
  ".github",
];
for (const name of pruneNames) {
  const target = path.join(standaloneDir, name);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
}

console.log("[prepare-standalone] bundled gatestage-server.cjs");
