# Desktop packaging & releases

GateStage ships as a desktop app (Electron) that wraps the existing Node server.
Browsers on race WiFi still use `http://<rd-laptop-ip>:8080`.

## Local build

```sh
npm install
npm run build:next          # Next standalone + bundled gatestage-server.cjs
npm run desktop             # Launch Electron against .next/standalone
# or package installers for this OS:
npm run build:desktop
```

Artifacts land in `dist/desktop/`.

## Config location

| Mode | Config path |
|------|-------------|
| `npm run dev` / `npm start` | `./data/config.json` (or `GATESTAGE_CONFIG_PATH`) |
| Desktop app | OS user data dir (`…/GateStage/config.json`), set via `GATESTAGE_CONFIG_PATH` by Electron |

## Releases (GitHub Actions)

| Trigger | Workflow | Result |
|---------|----------|--------|
| Push to `main` | `release-nightly.yml` | Updates prerelease tag **`nightly`** |
| Push tag `v*` (manual) | `release-stable.yml` | Publishes stable Release (GitHub “Latest”) |

```sh
# After main looks good:
git tag v0.2.0
git push origin v0.2.0
```

Artifacts (unsigned in v1):

- macOS: `.dmg` (arm64 + x64)
- Windows: NSIS `.exe`
- Linux: `.AppImage` + `.deb`

Code signing / notarization can be wired later via GitHub Secrets without changing this layout.
