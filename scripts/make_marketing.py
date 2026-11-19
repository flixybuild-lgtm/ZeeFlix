#!/usr/bin/env python3
"""Render Framewave marketing assets from the real app screenshots.

    python3 scripts/make_marketing.py

Inputs   docs/screenshots/*.png    (produced by scripts/screenshots.mjs)
Outputs  docs/marketing/           social card, banners, store panels, README hero

Everything is drawn locally with Pillow using the project's own OFL fonts
(public/fonts/anton.woff2 + manrope.woff2, transcoded with fontTools), so the
marketing matches the product exactly and needs no stock art or network access.

Requires: pip install pillow fonttools brotli
"""
from __future__ import annotations

from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "docs" / "marketing"
FONTS = ROOT / "public" / "fonts"
CACHE = Path("/tmp/zeeflix-fonts")

BG = (11, 12, 15)
TEXT = (246, 245, 243)
SOFT = (214, 211, 206)
MUTED = (161, 163, 170)
ACCENT = (139, 243, 201)
SPECTRUM = ["#ff575b", "#ff973c", "#ffcf50", "#6dbfa4", "#54bbef", "#7688ff", "#bf7efb"]

# Exact geometry of public/logo.svg, scaled from its 56 × 56 viewBox.
PRISM = [
    ("#8bf3c9", [(9, 35), (18, 14), (28, 14), (19, 35)]),
    ("#8bf3c9", [(22, 42), (35, 12), (43, 12), (30, 42)]),
    ("#a4c9ff", [(34, 39), (42, 21), (49, 29)]),
]


# --------------------------------------------------------------------------- #
# fonts
# --------------------------------------------------------------------------- #
def _convert(name: str) -> Path:
    """WOFF2 → TTF so Pillow can load the project's own typefaces."""
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / f"{name}.ttf"
    if target.exists():
        return target
    try:
        from fontTools.ttLib import TTFont
    except ImportError:  # pragma: no cover
        sys.exit("Install fontTools: python3 -m pip install fonttools brotli")
    ft = TTFont(str(FONTS / f"{name}.woff2"))
    ft.flavor = None
    ft.save(str(target))
    return target


def display(size: int) -> ImageFont.FreeTypeFont:
    """Anton — the poster/hero display face used by the UI."""
    return ImageFont.truetype(str(_convert("anton")), size)


def sans(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    """Manrope variable font — pick an instance via set_variation_by_axes."""
    f = ImageFont.truetype(str(_convert("manrope")), size)
    axes = {"Thin": 100, "Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700, "ExtraBold": 800}
    try:
        f.set_variation_by_axes([axes.get(weight, 400)])
    except Exception:  # static fallback
        pass
    return f


def bold(size: int) -> ImageFont.FreeTypeFont:
    return sans(size, "Bold")


def semibold(size: int) -> ImageFont.FreeTypeFont:
    return sans(size, "SemiBold")


# --------------------------------------------------------------------------- #
# canvas helpers
# --------------------------------------------------------------------------- #
def load(name: str) -> Image.Image:
    path = SHOTS / f"{name}.png"
    if not path.exists():
        raise SystemExit(f"Missing screenshot {path}. Run scripts/screenshots.mjs first.")
    return Image.open(path).convert("RGB")


def rgba(img: Image.Image) -> Image.Image:
    return img.convert("RGBA")


def fit_cover(img: Image.Image, size) -> Image.Image:
    w, h = size
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def rounded(img: Image.Image, radius: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def place(canvas: Image.Image, layer: Image.Image, xy) -> None:
    """alpha_composite that clips instead of raising when a layer is off-canvas."""
    x, y = xy
    cw, ch = canvas.size
    lw, lh = layer.size
    if x >= cw or y >= ch or x + lw <= 0 or y + lh <= 0:
        return
    left, top = max(0, x), max(0, y)
    right, bottom = min(cw, x + lw), min(ch, y + lh)
    place.__dict__.setdefault("_", None)
    canvas.alpha_composite(layer.crop((left - x, top - y, right - x, bottom - y)), (left, top))


def panel(w: int, h: int, glows=((236, 147, 91, 46), (133, 162, 225, 42))) -> Image.Image:
    """Dark card with two soft brand glows — the app's liquid-glass backdrop."""
    base = Image.new("RGBA", (w, h), BG + (255,))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-w * 0.22, h * 0.34, w * 0.46, h * 1.5], fill=glows[0])
    gd.ellipse([w * 0.5, -h * 0.36, w * 1.18, h * 0.5], fill=glows[1])
    return Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(max(w, h) // 12)))


def prism(draw: ImageDraw.ImageDraw, xy, scale: float = 1.0):
    """Draw the seven-colour Framewave signal mark mark; width ≈ 56 × factor(scale)."""
    x, y = xy
    for colour, pts in PRISM:
        draw.polygon([(x + px * factor, y + py * factor) for px, py in pts] if (factor := scale) else [], fill=colour)


def spectrum_bar(draw: ImageDraw.ImageDraw, xy, w: int, h: int = 4):
    x, y = xy
    seg = w / len(SPECTRUM)
    for i, colour in enumerate(SPECTRUM):
        draw.rectangle([x + i * seg, y, x + (i + 1) * seg - (0 if i == len(SPECTRUM) - 1 else 1), y + h], fill=colour)


def text(draw: ImageDraw.ImageDraw, xy, value, font, fill=TEXT, align: str = "left"):
    draw.multiline_text(xy, value, font=font, fill=fill, spacing=int(font.size * 0.22), align=align)


def chip(canvas: Image.Image, xy, label, font, *, fill=(255, 255, 255, 18), outline=(255, 255, 255, 52), colour=TEXT):
    """Pill label. Drawn on its own layer because ImageDraw writes pixels directly
    instead of alpha-blending, which would flatten translucent fills to white."""
    x, y = xy
    probe = ImageDraw.Draw(canvas)
    tw = probe.textlength(label, font=font)
    w, h = int(tw + 32), font.size + 20
    layer = Image.new("RGBA", (w + 4, h + 4), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([2, 2, w + 1, h + 1], radius=h // 2, fill=fill, outline=outline, width=1)
    place(canvas, layer, (x - 2, y - 2))
    probe.text((x + 16, y + 10), label, font=font, fill=colour)
    return w


def phone(img: Image.Image, width: int, radius: int = 32) -> Image.Image:
    """Frame a 390×844 capture in a soft-edged device with a drop shadow."""
    shot = rounded(fit_cover(img, (width, round(width * 844 / 390))), radius)
    pad = max(7, width // 40)
    w, h = shot.width + pad * 2, shot.height + pad * 2
    canvas = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [24, 26, w + 16, h + 18], radius=radius + pad, fill=(0, 0, 0, 185)
    )
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)), (0, 0))
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius + pad, fill=(33, 34, 39, 255))
    ImageDraw.Draw(frame).rounded_rectangle(
        [1, 1, w - 2, h - 2], radius=radius + pad, outline=(255, 255, 255, 34), width=2
    )
    place(frame, shot, (pad, pad))
    canvas.alpha_composite(frame, (20, 20))
    return canvas


def save(img: Image.Image, name: str):
    img.convert("RGB").save(OUT / name, optimize=True)
    kb = (OUT / name).stat().st_size // 1024
    print(f"✓ docs/marketing/{name}  ({kb} KB)")


# --------------------------------------------------------------------------- #
# 1. Social / Open Graph card — 1280 × 640
# --------------------------------------------------------------------------- #
def social_card():
    W, H = 1280, 640
    card = rgba(fit_cover(load("home-desktop"), (W, H))).filter(ImageFilter.GaussianBlur(4.5))
    scrim = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scrim)
    for x in range(W):
        # Near-opaque on the left so the wordmark always reads, translucent on the right.
        sd.line([(x, 0), (x, H)], fill=(8, 9, 11, int(252 - 118 * (x / W) ** 0.55)))
    card = Image.alpha_composite(card, scrim)

    shell = panel(W, H, glows=((236, 147, 91, 34), (133, 162, 225, 30)))
    card = Image.alpha_composite(shell, card)
    d = ImageDraw.Draw(card)

    # phone stack on the right
    big = phone(load("home-mobile"), 258)
    place(card, big, (W - big.width - 26, (H - big.height) // 2 - 2))
    small = phone(load("player-mobile"), 168)
    place(card, small, (W - big.width - small.width + 46, (H - small.height) // 2 + 96))
    d = ImageDraw.Draw(card)

    prism(d, (78, 74), 0.86)
    d.text((78 + 94, 74 + 6), "Framewave", font=bold(46), fill=TEXT)
    d.text((78, 186), "CINEMA ON YOUR", font=display(74), fill=TEXT)
    d.text((78, 258), "WAVELENGTH.", font=display(74), fill=ACCENT)
    spectrum_bar(d, (80, 348), 300, 5)
    d.text((80, 380), "Open cinema for Android and the web.", font=sans(25), fill=SOFT)
    d.text((80, 416), "Free APK · no account · no ads · no tracking.", font=sans(25), fill=SOFT)

    band = Image.new("RGBA", (W, 54), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle([0, 0, W, 54], fill=(255, 255, 255, 12))
    bd.line([(0, 0), (W, 0)], fill=(255, 255, 255, 26), width=1)
    card.alpha_composite(band, (0, H - 54))
    d = ImageDraw.Draw(card)
    d.text((78, H - 40), "github.com/flixybuild-lgtm/ZeeFlix", font=semibold(19), fill=(235, 232, 228))
    credit = "Built by Zeeshan Haider"
    d.text((W - 78 - d.textlength(credit, font=sans(18)), H - 40), credit, font=sans(18), fill=MUTED)
    save(card, "social-card.png")


# --------------------------------------------------------------------------- #
# 2. Feature banner — 1600 × 900
# --------------------------------------------------------------------------- #
def feature_banner():
    W, H = 1600, 900
    card = panel(W, H, glows=((236, 147, 91, 62), (133, 162, 225, 54)))
    d = ImageDraw.Draw(card)
    prism(d, (96, 82), 0.8)
    d.text((96 + 88, 82 + 4), "Framewave", font=bold(42), fill=TEXT)
    text(d, (96, 176), "A STUDENT-BUILT\nSTREAMING APP.", display(78), TEXT)
    spectrum_bar(d, (98, 392), 340, 6)
    rows = [
        ("Rust + WebAssembly", "Instant web app, ~201 KiB core"),
        ("Kotlin + Media3", "Native Android with PiP and downloads"),
        ("12 open films", "Blender movie collection, CC licensed"),
        ("Zero tracking", "No accounts, no ads, no analytics"),
    ]
    y = 424
    for title, sub in rows:
        d.rounded_rectangle([96, y + 8, 112, y + 24], radius=4, fill=ACCENT)
        d.text((130, y), title, font=bold(29), fill=TEXT)
        d.text((130, y + 38), sub, font=sans(22), fill=MUTED)
        y += 100
    big = phone(load("home-mobile"), 306)
    place(card, big, (1010, 62))
    mid = phone(load("detail-mobile"), 200)
    place(card, mid, (1330, 388))
    small = phone(load("player-mobile"), 208)
    place(card, small, (800, 330))
    save(card, "feature-banner.png")


# --------------------------------------------------------------------------- #
# 3. Store-style panels + contact sheet
# --------------------------------------------------------------------------- #
def store_panels():
    captions = [
        ("home-mobile", "Cinema that feels expensive."),
        ("player-mobile", "Quality, subtitles and speed."),
        ("providers-mobile", "Bring your own sources."),
        ("detail-mobile", "Twelve open films."),
    ]
    panels = []
    for name, caption in captions:
        W, H = 1080, 1920
        card = panel(W, H, glows=((236, 147, 91, 58), (133, 162, 225, 50)))
        d = ImageDraw.Draw(card)
        prism(d, (84, 78), 0.72)
        d.text((84 + 80, 78), "Framewave", font=bold(38), fill=TEXT)
        text(d, (84, 196), caption, display(84), TEXT)
        spectrum_bar(d, (86, 330), 240, 6)
        framed = phone(load(name), 820)
        place(card, framed, ((W - framed.width) // 2, H - framed.height - 30))
        panels.append(card.convert("RGB"))

    gap, pad = 40, 40
    sheet = Image.new("RGB", (len(panels) * 1080 + gap * (len(panels) - 1) + pad * 2, 1920 + pad * 2), BG)
    for i, item in enumerate(panels):
        sheet.paste(item, (pad + i * (1080 + gap), pad))
    sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS).save(OUT / "screenshot-sheet.png", optimize=True)
    print("✓ docs/marketing/screenshot-sheet.png")
    for (name, _), item in zip(captions, panels):
        item.resize((540, 960), Image.LANCZOS).save(OUT / f"store-{name}.png", optimize=True)
    print("✓ docs/marketing/store-*.png")


# --------------------------------------------------------------------------- #
# 4. README hero strip
# --------------------------------------------------------------------------- #
def readme_hero():
    W, H = 1280, 400
    card = panel(W, H, glows=((236, 147, 91, 78), (133, 162, 225, 66)))
    d = ImageDraw.Draw(card)
    prism(d, (62, 64), 0.82)
    d.text((62 + 92, 62), "Framewave", font=bold(50), fill=TEXT)
    d.text((64, 172), "Cinema on your wavelength.", font=display(52), fill=ACCENT)
    spectrum_bar(d, (66, 246), 260, 5)
    x = 66
    for label in ("Android APK", "Web app", "Rust + WASM", "Kotlin + Media3"):
        x += chip(card, (x, 286), label, semibold(19)) + 10
    one = phone(load("player-mobile"), 150)
    place(card, one, (W - 400, 22))
    two = phone(load("home-mobile"), 150)
    place(card, two, (W - 214, 4))
    save(card, "readme-hero.png")


# --------------------------------------------------------------------------- #
# 5. Web-ready thumbnails used by public/install.html
# --------------------------------------------------------------------------- #
WEB_THUMBS = {
    "app-home": "home-desktop",
    "app-player": "player-desktop",
    "app-providers": "providers-desktop",
    "app-search": "search-desktop",
    "app-mobile-home": "home-mobile",
    "app-mobile-player": "player-mobile",
    "app-mobile-providers": "providers-mobile",
    "app-mobile-detail": "detail-mobile",
}


def web_thumbs():
    dest = ROOT / "public" / "screenshots"
    dest.mkdir(parents=True, exist_ok=True)
    wrote = 0
    for out_name, src in WEB_THUMBS.items():
        path = SHOTS / f"{src}.png"
        if not path.exists():
            continue
        img = Image.open(path).convert("RGB")
        target_width = 640 if "mobile" in out_name else 1000
        scale = target_width / img.width
        if scale < 1:
            img = img.resize((target_width, round(img.height * scale)), Image.LANCZOS)
        img.save(dest / f"{out_name}.webp", "WEBP", quality=82, method=6)
        wrote += 1
    print(f"✓ public/screenshots/*.webp ({wrote} files)")


if __name__ == "__main__":
    if not SHOTS.exists():
        sys.exit("Run scripts/screenshots.mjs first.")
    OUT.mkdir(parents=True, exist_ok=True)
    social_card()
    feature_banner()
    store_panels()
    readme_hero()
    web_thumbs()
    print(f"\nMarketing assets → {OUT.relative_to(ROOT)}/")
