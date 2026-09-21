#!/usr/bin/env python3
"""make_logo.py — CookieGuard logo: shield + cookie.

Deliberately drawn with direct ImageDraw primitives on ONE canvas at 4x and downsampled.
No alpha masks, no Image.composite, no pastes — those produced stray notches because a
mask plus a gradient never agree on colour at the seam. Direct drawing cannot do that.

Output: assets/cookieguard-logo.png (512, transparent outside the rounded square)
        assets/cookieguard-banner.png (1600x500)
"""
import math
import os
from PIL import Image, ImageDraw

OUT = "/root/.hermes/profiles/coin/workspace/cookieguard/assets"
SS = 4  # supersample factor


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def shield_points(cx, top, w, h, steps=64):
    """Shield outline: arched top, straight flanks, curved taper to a bottom point."""
    left, right = cx - w / 2, cx + w / 2
    bottom = top + h
    shoulder = top + h * 0.48
    pts = []
    for i in range(steps + 1):                       # top arch, left -> right
        t = i / steps
        pts.append((left + w * t, top - math.sin(t * math.pi) * h * 0.04))
    for i in range(steps + 1):                       # right flank
        pts.append((right, top + (shoulder - top) * (i / steps)))
    for i in range(steps + 1):                       # right curve into the point
        t = i / steps
        pts.append((right + (cx - right) * t, shoulder + (bottom - shoulder) * (t ** 1.8)))
    for i in range(steps + 1):                       # left curve back out
        t = i / steps
        pts.append((cx + (left - cx) * t, bottom - (bottom - shoulder) * (t ** 1.8)))
    for i in range(steps + 1):                       # left flank back up
        pts.append((left, shoulder - (shoulder - top) * (i / steps)))
    return pts


def build_logo(size=512):
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(S * 0.195)

    # 1) rounded square, vertical gradient painted row by row inside the rounded rect
    grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        c = lerp((33, 29, 25), (13, 12, 11), y / S) + (255,)
        gd.line([(0, y), (S, y)], fill=c)
    sq = Image.new("L", (S, S), 0)
    ImageDraw.Draw(sq).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)
    img.paste(grad, (0, 0), sq)
    d.rounded_rectangle([int(S * 0.006), int(S * 0.006), S - 1 - int(S * 0.006), S - 1 - int(S * 0.006)],
                        radius=r, outline=(58, 52, 44, 255), width=max(2, int(S * 0.006)))

    # 2) shield — filled polygon, gradient by bands
    sh_pts = shield_points(S / 2, S * 0.155, S * 0.60, S * 0.685)
    xs = [p[0] for p in sh_pts]
    ys = [p[1] for p in sh_pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    shield_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shield_layer)
    for y in range(int(y0), int(y1) + 1):
        t = max(0.0, min(1.0, (y - y0) / max(1, (y1 - y0))))
        sd.line([(0, y), (S, y)], fill=lerp((255, 210, 122), (201, 117, 12), t ** 0.9) + (255,))
    smask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(smask).polygon(sh_pts, fill=255)
    img.paste(shield_layer, (0, 0), smask)

    # 3) cookie — dark disc, direct ellipse (clipped to the shield by intersection test)
    #    kept small and high enough that clear amber always separates it from the background,
    #    otherwise the dark dough visually merges with the dark canvas at the shield's taper.
    ccx, ccy, cr = S * 0.5, S * 0.462, S * 0.152
    cookie = Image.new("L", (S, S), 0)
    ImageDraw.Draw(cookie).ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=255)
    # intersect: cookie is only visible where the shield is
    inter = Image.new("L", (S, S), 0)
    inter.paste(cookie, (0, 0), smask)
    dough = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dough)
    for y in range(int(ccy - cr), int(ccy + cr) + 1):
        t = max(0.0, min(1.0, (y - (ccy - cr)) / (2 * cr)))
        dd.line([(0, y), (S, y)], fill=lerp((62, 45, 27), (36, 25, 14), t) + (255,))
    img.paste(dough, (0, 0), inter)

    # 4) chips — direct ellipses, clipped to the cookie disc
    for dx, dy, rr in ((-0.42, -0.24, 0.150), (0.10, 0.14, 0.165), (-0.34, 0.44, 0.135),
                       (0.44, -0.36, 0.115), (-0.04, -0.56, 0.120), (0.36, 0.54, 0.125),
                       (0.60, 0.04, 0.105), (-0.10, -0.06, 0.115), (-0.64, 0.16, 0.100)):
        x, y, r2 = ccx + dx * cr, ccy + dy * cr, rr * cr
        chip = Image.new("L", (S, S), 0)
        ImageDraw.Draw(chip).ellipse([x - r2, y - r2, x + r2, y + r2], fill=255)
        chip = Image.composite(chip, Image.new("L", (S, S), 0), inter) if False else chip
        # keep chips inside the cookie: mask with the cookie∩shield area
        chip = Image.composite(chip, Image.new("L", (S, S), 0), inter)
        img.paste(Image.new("RGBA", (S, S), (255, 216, 143, 255)), (0, 0), chip)

    # 5) rim light on the disc
    d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], outline=(255, 216, 143, 70),
              width=max(2, int(S * 0.005)))

    return img.resize((size, size), Image.LANCZOS)


def build_banner(w=1600, h=500):
    img = Image.new("RGB", (w, h), (11, 10, 9))
    d = ImageDraw.Draw(img)
    for x in range(w):
        t = x / w
        d.line([(x, 0), (x, h)], fill=lerp((30, 25, 20), (11, 10, 9), t ** 0.7))
    logo = build_logo(300)
    img.paste(logo, (110, (h - 300) // 2), logo)

    from PIL import ImageFont
    def font(sz, bold=False):
        for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
                  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
            try:
                return ImageFont.truetype(p, sz)
            except Exception:
                continue
        return ImageFont.load_default()

    d.text((490, 168), "CookieGuard", font=font(64, True), fill=(244, 241, 236))
    d.text((492, 250), "On-chain token safety scanner for Cookie Chain", font=font(26), fill=(162, 156, 147))
    d.text((492, 292), "Rug-risk audits · real DEX vault reserves · chain-wide census", font=font(21), fill=(120, 114, 106))
    d.text((492, 326), "on-chain attestations", font=font(21), fill=(120, 114, 106))
    d.text((492, 378), "cookieguard.surge.sh", font=font(24), fill=(245, 165, 36))
    return img


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_logo(512).save(f"{OUT}/cookieguard-logo.png")
    build_banner().save(f"{OUT}/cookieguard-banner.png", quality=94)
    print("wrote", f"{OUT}/cookieguard-logo.png", f"{OUT}/cookieguard-banner.png")
