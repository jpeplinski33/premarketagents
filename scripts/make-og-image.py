#!/usr/bin/env python3
"""Brand a listing photo as a Pre Market Agents Open Graph share image (1200x630)."""
import argparse, os
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

def make_og(src, out, address, price, agent, kicker="EXCLUSIVE INVITE"):
    W, H = 1200, 630
    im = Image.open(src).convert("RGB")
    scale = max(W / im.width, H / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left, top = (nw - W) // 2, (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    im = ImageEnhance.Brightness(im).enhance(0.82)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for y in range(H):
        t = y / (H - 1)
        a = min(230, int(40 * (1 - min(t * 1.4, 1))) + int(210 * max(0, (t - 0.35) / 0.65) ** 1.1))
        d.line([(0, y), (W, y)], fill=(12, 12, 13, a))
    pad = 36
    d.rounded_rectangle([pad, pad, pad + 280, pad + 78], radius=2, fill=(12, 12, 13, 210), outline=(196, 165, 116, 200), width=2)
    d.text((pad + 22, pad + 12), "PRE MARKET", font=font(FONT_SERIF, 36), fill=(245, 242, 235, 255))
    d.text((pad + 24, pad + 50), "A G E N T S", font=font(FONT_SANS_BOLD, 14), fill=(196, 165, 116, 255))
    fb = font(FONT_SANS_BOLD, 15)
    bb = d.textbbox((0, 0), kicker, font=fb)
    bw, bh = bb[2] - bb[0] + 36, bb[3] - bb[1] + 22
    bx, by = W - pad - bw, pad
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=2, fill=(196, 165, 116, 235))
    d.text((bx + 18, by + 10), kicker, font=fb, fill=(12, 12, 13, 255))
    bottom_y = H - 150
    d.text((pad, bottom_y), "Private pre-market showing", font=font(FONT_SANS_BOLD, 18), fill=(196, 165, 116, 255))
    d.text((pad, bottom_y + 32), address, font=font(FONT_SERIF, 42), fill=(245, 242, 235, 255))
    d.text((pad, bottom_y + 88), price, font=font(FONT_SANS_BOLD, 28), fill=(245, 242, 235, 240))
    if agent:
        d.text((pad, bottom_y + 124), agent, font=font(FONT_SANS, 18), fill=(200, 195, 185, 230))
    d.rectangle([0, H - 4, W, H], fill=(196, 165, 116, 255))
    out_im = Image.alpha_composite(im.convert("RGBA"), overlay).convert("RGB")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    out_im.save(out, "JPEG", quality=90, optimize=True)
    print(out, os.path.getsize(out))

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
