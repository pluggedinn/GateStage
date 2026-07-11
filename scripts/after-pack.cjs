/**
 * electron-builder FileSets omit nested node_modules. GateStage's Next standalone
 * server needs those modules — copy them into resources after pack.
 */
const { cpSync, existsSync, rmSync } = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const src = path.join(context.packager.projectDir, ".next", "standalone");
  const dest = path.join(context.appOutDir, "resources", "standalone");
  const nmSrc = path.join(src, "node_modules");
  const nmDest = path.join(dest, "node_modules");

  if (!existsSync(nmSrc)) {
    throw new Error(
      `[after-pack] Missing ${nmSrc} — run \`npm run build:next\` first.`,
    );
  }

  if (!existsSync(dest)) {
    throw new Error(
      `[after-pack] Missing ${dest} — extraResources standalone copy failed.`,
    );
  }

  if (existsSync(nmDest)) {
    rmSync(nmDest, { recursive: true, force: true });
  }
  cpSync(nmSrc, nmDest, { recursive: true });
  console.log("[after-pack] copied standalone/node_modules into app resources");
};
