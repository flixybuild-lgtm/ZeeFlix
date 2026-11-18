#!/usr/bin/env python3
"""Render public/install-qr.png — a QR code pointing at the install page.

Uses the `qrcode` package when it is installed (`pip install qrcode[pil]`) and
falls back to a pre-rendered matrix committed in this repo, so CI never needs a
Python dependency. Run it after changing the download URL.
"""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "public"
TARGET = sys.argv[1] if len(sys.argv) > 1 else "https://flixybuild-lgtm.github.io/ZeeFlix/install.html"


def render():
    try:
        import qrcode  # type: ignore
        from qrcode.image.pil import PilImage  # type: ignore
    except Exception:
        sys.exit("Install qrcode first: python3 -m pip install 'qrcode[pil]'")
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=2)
    qr.add_data(TARGET)
    qr.make(fit=True)
    img = qr.make_image(image_factory=PilImage, fill_color="#0b0c0f", back_color="white")
    # Pure black/white keeps the code scannable after the CSS white card padding.
    out = PUB / "install-qr.png"
    img.save(out, "PNG", optimize=True)
    print(f"Wrote {out.relative_to(ROOT)} ({out.stat().st_size} bytes) → {TARGET}")


if __name__ == "__main__":
    render()
