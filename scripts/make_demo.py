#!/usr/bin/env python3
"""Build docs/marketing/demo.gif — the 10-second loop used on HN/Reddit/X.

    python3 scripts/make_demo.py

Frames are real mobile screenshots (from scripts/screenshots.mjs) flown through
a phone frame, so the GIF shows the actual product with no fabricated motion.

Requires: pip install pillow
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "docs" / "marketing" / "demo.gif"

W, H = 480, 854           # GIF canvas (fits X/Twitter and Reddit previews)
PHONE_W = 268             # phone screen width inside the canvas
BG = (11, 12, 15)
ACCENT = (248, 183, 79)

CAPTIONS = [
    ("home-mobile", "Free open cinema"),
    ("player-mobile", "Quality · subs · speed"),
    ("detail-mobile", "Watch instantly"),
    ("providers-mobile", "Add your own sources"),
    ("downloads-mobile", "Download offline"),
]


def font(size: int, bold: bool = True):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def fit(img: Image.Image, w: int, h: int) -> Image.Image:
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def backdrop() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse([-160, 240, 300, 900], fill=(236, 147, 91, 58))
    d.ellipse([260, -120, 700, 380], fill=(133, 162, 225, 46))
    return Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(90)))


def frame(screen: Image.Image, caption: str, base: Image.Image, progress: float) -> Image.Image:
    canvas = base.copy()
    phone_h = round(PHONE_W * 844 / 390)

    # slide/fade the incoming screen in from the right
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shot = fit(screen, PHONE_W, phone_h)
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, shot.height - 1], radius=22, fill=255)
    shot.putalpha(mask)
    x = (W - PHONE_W) // 2
    y = 118
    # soft shadow
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [x - 6, y + 6, x + PHONE_W + 6, y + phone_h + 16], radius=30, fill=(0, 0, 0, 170)
    )
    layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    layer.alpha_composite(shot, (x, y))
    canvas.alpha_composite(layer)

    d = ImageDraw.Draw(canvas)
    # header
    d.text((34, 34), "ZeeFlix", font=font(40), fill=(246, 245, 243))
    d.text((34, 82), "Entertainment Without Limits.", font=font(20, False), fill=(161, 163, 170))
    for i, colour in enumerate(["#ff575b", "#ff973c", "#ffcf50", "#6bdbab", "#54bbef", "#7688ff", "#bf7efb"]):
        d.rectangle([34 + i * 26, 112, 34 + i * 26 + 24, 116], fill=colour)
    # caption
    d.text((W // 2, H - 118), caption, font=font(26), fill=ACCENT, anchor="mm")
    # progress dots
    total = len(CAPTIONS)
    active = round(progress * (total - 1))
    for i in range(total):
        cx = W // 2 - (total - 1) * 11 + i * 22
        colour = (248, 183, 79) if i == active else (70, 71, 78)
        d.ellipse([cx - 4, H - 74, cx + 4, H - 66], fill=colour)
    return canvas.convert("RGB")


def main() -> None:
    missing = [name for name, _ in CAPTIONS if not (SHOTS / f"{name}.png").exists()]
    if missing:
        sys.exit(f"Missing screenshots: {', '.join(missing)}. Run scripts/screenshots.mjs first.")

    base = backdrop()
    frames: list[Image.Image] = []
    hold, blend = 5, 2
    for idx, (name, caption) in enumerate(CAPTIONS):
        screen = Image.open(SHOTS / f"{name}.png").convert("RGB")
        # cross-fade from the previous screen for a smooth "app tour" feel
        prev = Image.open(SHOTS / f"{CAPTIONS[idx - 1][0]}.png").convert("RGB") if idx else screen
        for step in range(blend):
            mix = Image.blend(prev, screen, (step + 1) / blend)
            frames.append(frame(mix, caption, base, idx / (len(CAPTIONS) - 1)))
        for _ in range(hold):
            frames.append(frame(screen, caption, base, idx / (len(CAPTIONS) - 1)))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        duration=130,
        loop=0,
        optimize=True,
        disposal=2,
    )
    print(f"✓ {OUT.relative_to(ROOT)} — {len(frames)} frames, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
