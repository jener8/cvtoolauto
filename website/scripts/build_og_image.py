#!/usr/bin/env python3
"""Build og-image.png (1200x630) with text in the center safe zone for WhatsApp/FB previews."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "og-image.png"

W, H = 1200, 630
BG = (247, 245, 240)  # --paper
INK = (17, 18, 16)  # --ink
MUTED = (122, 120, 110)  # --muted
YELLOW = (240, 212, 74)  # --yellow

F_TITLE = "/System/Library/Fonts/Supplemental/Georgia.ttf"
F_SUB = "/System/Library/Fonts/Supplemental/Arial.ttf"


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(F_TITLE, 78)
    sub_font = ImageFont.truetype(F_SUB, 26)

    title = "CV by Design"
    sub = "Personalised AI tools for your career"

    tb = draw.textbbox((0, 0), title, font=title_font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]

    sb = draw.textbbox((0, 0), sub, font=sub_font)
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]

    gap_after_title = 18
    line_h = 3
    gap_after_line = 22

    block_h = th + gap_after_title + line_h + gap_after_line + sh
    y0 = (H - block_h) // 2

    x_title = (W - tw) // 2 - tb[0]
    y_title = y0 - tb[1]
    draw.text((x_title, y_title), title, font=title_font, fill=INK)

    line_y = y0 + th + gap_after_title
    line_w = min(560, max(tw, sw) + 80)
    x1 = (W - line_w) // 2
    draw.rectangle([x1, line_y, x1 + line_w, line_y + line_h], fill=YELLOW)

    sub_y = line_y + line_h + gap_after_line - sb[1]
    x_sub = (W - sw) // 2 - sb[0]
    draw.text((x_sub, sub_y), sub, font=sub_font, fill=MUTED)

    # Subtle right-side accent (stays clear of center text — WhatsApp crops edges most)
    accent = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ad = ImageDraw.Draw(accent)
    ax0, ay0 = W - 200, 80
    ad.rounded_rectangle(
        [ax0, ay0, W - 48, H - 48],
        radius=12,
        outline=(226, 221, 214),
        width=1,
    )
    for i in range(5):
        yy = ay0 + 42 + i * 22
        ad.line([(ax0 + 28, yy), (W - 80, yy)], fill=(226, 221, 214), width=1)
    ax_circle = ax0 + 38
    ay_circle = ay0 + 28
    ad.ellipse(
        [ax_circle - 18, ay_circle - 18, ax_circle + 18, ay_circle + 18],
        outline=(226, 221, 214),
        width=1,
    )
    img.paste(accent, (0, 0), accent)

    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
