#!/usr/bin/env python3
"""Brand a listing photo as a Pre Market Agents Open Graph share image (1200x630).

Use a NEW unique filename every visual redesign/cache bust (e.g. *-exclusive-v5.jpg) so
messaging apps cannot serve a cached older preview URL.
"""
import argparse
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageEnhance

FONT_SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FONT_SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def make_og(src, out_path, address, price, agent, kicker="EXCLUSIVE INVITE"):
    W, H = 1200, 630
    im = Image.open(src).convert("RGB")
    scale = max(W / im.width, H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im = ImageEnhance.Brightness(im).enhance(0.72)
    im = ImageEnhance.Contrast(im).enhance(1.05)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    for y in range(H):
        t = y / (H - 1)
        a = min(
            235,
            int(70 * (1 - min(t * 1.2, 1)))
            + int(230 * max(0, (t - 0.28) / 0.72) ** 1.05),
        )
        d.line([(0, y), (W, y)], fill=(12, 12, 13, a))
    for x in range(80):
        a = int(90 * (1 - x / 80))
        d.line([(x, 0), (x, H)], fill=(12, 12, 13, a))
        d.line([(W - 1 - x, 0), (W - 1 - x, H)], fill=(12, 12, 13, a))

    pad = 40
    d.rounded_rectangle(
        [pad, pad, pad + 340, pad + 96],
        radius=3,
        fill=(12, 12, 13, 230),
        outline=(196, 165, 116, 255),
        width=3,
    )
    d.text((pad + 26, pad + 14), "PRE MARKET", font=font(FONT_SERIF, 42), fill=(245, 242, 235, 255))
    d.text((pad + 28, pad + 62), "A G E N T S", font=font(FONT_SANS_BOLD, 16), fill=(196, 165, 116, 255))

    fb = font(FONT_SANS_BOLD, 18)
    bb = d.textbbox((0, 0), kicker, font=fb)
    bw, bh = bb[2] - bb[0] + 44, bb[3] - bb[1] + 28
    bx, by = W - pad - bw, pad + 8
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=3, fill=(196, 165, 116, 255))
    d.text((bx + 22, by + 12), kicker, font=fb, fill=(12, 12, 13, 255))

    plate_top = H - 200
    d.rectangle([0, plate_top, W, H], fill=(12, 12, 13, 200))
    d.rectangle([0, plate_top, W, plate_top + 3], fill=(196, 165, 116, 255))

    d.text(
        (pad, plate_top + 22),
        "PRIVATE PRE-MARKET SHOWING",
        font=font(FONT_SANS_BOLD, 20),
        fill=(196, 165, 116, 255),
    )
    d.text((pad, plate_top + 54), address, font=font(FONT_SERIF, 46), fill=(245, 242, 235, 255))
    d.text((pad, plate_top + 118), price, font=font(FONT_SANS_BOLD, 32), fill=(245, 242, 235, 255))
    if agent:
        d.text((pad, plate_top + 160), agent, font=font(FONT_SANS, 20), fill=(200, 195, 185, 255))

    d.rectangle([0, H - 6, W, H], fill=(196, 165, 116, 255))

    result = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(out_path, "JPEG", quality=92, optimize=True)
    print(out_path, result.size, os.path.getsize(out_path))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--address", required=True)
    ap.add_argument("--price", required=True)
    ap.add_argument("--agent", default="")
    ap.add_argument("--kicker", default="EXCLUSIVE INVITE")
    a = ap.parse_args()
    make_og(a.src, a.out, a.address, a.price, a.agent, a.kicker)
