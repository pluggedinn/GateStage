#!/usr/bin/env python3
"""Generate Electron desktop icons from docs/gatestage-logo.png."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "gatestage-logo.png"
OUT = ROOT / "desktop" / "build"

MAC_ICONSET = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024),
]

LINUX_SIZES = [16, 32, 48, 64, 128, 256, 512]
WIN_SIZES = [16, 24, 32, 48, 64, 128, 256]


def square_master(src: Path) -> Image.Image:
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.point(lambda a: 255 if a > 16 else 0).getbbox()
    if not bbox:
        raise SystemExit(f"No opaque pixels in {src}")

    pad = max(im.width, im.height) // 40
    left = max(bbox[0] - pad, 0)
    top = max(bbox[1] - pad, 0)
    right = min(bbox[2] + pad, im.width)
    bottom = min(bbox[3] + pad, im.height)
    cropped = im.crop((left, top, right, bottom))

    side = max(cropped.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(
        cropped,
        ((side - cropped.width) // 2, (side - cropped.height) // 2),
        cropped,
    )
    return square


def write_png(master: Image.Image, path: Path, size: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    master.resize((size, size), Image.Resampling.LANCZOS).save(path, "PNG")


def write_icns(master: Image.Image, path: Path) -> None:
    iconset = OUT / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)

    for name, size in MAC_ICONSET:
        write_png(master, iconset / name, size)

    if path.exists():
        path.unlink()
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(path)],
        check=True,
    )
    shutil.rmtree(iconset)


def write_ico(master: Image.Image, path: Path) -> None:
    largest = max(WIN_SIZES)
    frame = master.resize((largest, largest), Image.Resampling.LANCZOS)
    frame.save(
        path,
        format="ICO",
        sizes=[(size, size) for size in WIN_SIZES],
    )


def main() -> int:
    if not SRC.exists():
        print(f"Missing source logo: {SRC}", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    master = square_master(SRC)

    write_png(master, OUT / "icon.png", 1024)
    write_icns(master, OUT / "icon.icns")
    write_ico(master, OUT / "icon.ico")

    icons_dir = OUT / "icons"
    if icons_dir.exists():
        shutil.rmtree(icons_dir)
    for size in LINUX_SIZES:
        write_png(master, icons_dir / f"{size}x{size}.png", size)

    print(f"Wrote desktop icons to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
