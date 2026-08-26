"""Render the original Unofficial Wabbajack-Nexus Index mark."""

from pathlib import Path

from PIL import Image, ImageDraw

SOURCE_SIZE = 128
RENDER_SIZE = 1024
SCALE = RENDER_SIZE / SOURCE_SIZE
OUTPUT_SIZES = (16, 32, 48, 128)
ASSET_DIR = Path(__file__).resolve().parents[1] / "extension" / "src" / "assets"


def scaled_points(points):
    return [(round(x * SCALE), round(y * SCALE)) for x, y in points]


def render_source():
    image = Image.new("RGBA", (RENDER_SIZE, RENDER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    outer = [(40, 4), (88, 4), (124, 40), (124, 88), (88, 124), (40, 124), (4, 88), (4, 40)]
    ring = [(42, 13), (86, 13), (115, 42), (115, 86), (86, 115), (42, 115), (13, 86), (13, 42)]
    wand = [(31, 91), (39, 99), (86, 52), (78, 44)]
    star = [(91, 23), (97, 36), (110, 42), (97, 48), (91, 61), (85, 48), (72, 42), (85, 36)]

    draw.polygon(scaled_points(outer), fill="#17131f")
    draw.line(
        scaled_points(ring + [ring[0]]),
        fill="#8b5cf6",
        width=round(9 * SCALE),
        joint="curve",
    )
    draw.polygon(scaled_points(wand), fill="#f8fafc")
    draw.ellipse(
        (round(27 * SCALE), round(87 * SCALE), round(43 * SCALE), round(103 * SCALE)),
        fill="#c4b5fd",
    )
    draw.polygon(scaled_points(star), fill="#d98f40")
    for start, end in [((76, 88), (102, 88)), ((76, 101), (94, 101))]:
        draw.line(
            scaled_points([start, end]),
            fill="#d98f40",
            width=round(6 * SCALE),
        )

    return image


def main():
    source = render_source()
    for size in OUTPUT_SIZES:
        icon = source.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(ASSET_DIR / f"icon-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
