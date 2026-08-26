"""Render extension icons from the supplied Wabbajack-inspired mark."""

from pathlib import Path

from PIL import Image

OUTPUT_SIZES = (16, 32, 48, 128)
ASSET_DIR = Path(__file__).resolve().parents[1] / "extension" / "src" / "assets"
SOURCE_PATH = ASSET_DIR / "brand-mark.png"


def main():
    with Image.open(SOURCE_PATH) as image:
        source = image.convert("RGBA")
        for size in OUTPUT_SIZES:
            icon = source.resize((size, size), Image.Resampling.LANCZOS)
            icon.save(ASSET_DIR / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
