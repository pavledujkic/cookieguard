#!/usr/bin/env python3
"""make_logo_svg.py — CookieGuard logo as SVG, rasterised with headless Chrome.

SVG gives exact shapes (no alpha-compositing surprises), Chrome gives a faithful raster
with real anti-aliasing. Output: assets/cookieguard-logo.png (512) + banner.
"""
import os
import subprocess

OUT = "/root/.hermes/profiles/coin/workspace/cookieguard/assets"
CHROME = "/usr/bin/google-chrome"

# shield: rounded top shoulders, straight flanks, tapering to a point
SHIELD = ("M 256 78 C 316 116, 372 130, 428 132 L 428 306 "
          "C 428 392, 344 442, 256 466 C 168 442, 84 392, 84 306 L 84 132 "
          "C 140 130, 196 116, 256 78 Z")

CHIPS = [(-52, -30, 17), (14, 20, 19), (-38, 48, 15), (46, -40, 14),
         (-2, -58, 13), (40, 54, 15), (62, 8, 13), (-8, -2, 14), (-62, 14, 12)]


def logo_svg(size=512):
    chip_markup = "\n".join(
        f'<circle cx="{256+dx}" cy="{268+dy}" r="{r}" fill="url(#chip)"/>' for dx, dy, r in CHIPS)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 512 512">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#211d19"/><stop offset="1" stop-color="#0d0c0b"/>
  </linearGradient>
  <linearGradient id="shield" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#ffd27a"/><stop offset="0.5" stop-color="#f5a524"/>
    <stop offset="1" stop-color="#c9750c"/>
  </linearGradient>
  <radialGradient id="chip" cx="0.35" cy="0.3" r="0.75">
    <stop offset="0" stop-color="#ffe6b0"/><stop offset="1" stop-color="#f0b64f"/>
  </radialGradient>
  <linearGradient id="dough" x1="0.25" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#2b2117"/><stop offset="1" stop-color="#150f08"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="512" height="512" rx="100" fill="url(#bg)"/>
<rect x="3" y="3" width="506" height="506" rx="98" fill="none" stroke="#39332c" stroke-width="3"/>
<path d="{SHIELD}" fill="url(#shield)"/>
<circle cx="256" cy="268" r="96" fill="url(#dough)"/>
{chip_markup}
<circle cx="256" cy="268" r="96" fill="none" stroke="#f5a524" stroke-opacity="0.35" stroke-width="3"/>
</svg>'''


def banner_svg(w=1600, h=500):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs>
  <linearGradient id="bbg" x1="0" y1="0" x2="1" y2="0.6">
    <stop offset="0" stop-color="#1a1714"/><stop offset="0.55" stop-color="#0f0e0d"/><stop offset="1" stop-color="#0b0a09"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#f5a524" stop-opacity="0.20"/><stop offset="1" stop-color="#f5a524" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="{w}" height="{h}" fill="url(#bbg)"/>
<ellipse cx="330" cy="250" rx="430" ry="330" fill="url(#glow)"/>
<g transform="translate(120,90) scale(0.625)">{logo_svg_bytes()}</g>
<text x="500" y="205" font-family="Helvetica,Arial,sans-serif" font-size="62" font-weight="700" fill="#f4f1ec">CookieGuard</text>
<text x="500" y="252" font-family="Helvetica,Arial,sans-serif" font-size="25" fill="#a29c93">On-chain token safety scanner for Cookie Chain</text>
<text x="500" y="300" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="#6f6a63">Rug-risk audits · real DEX vault reserves · chain-wide census · on-chain attestations</text>
<text x="500" y="352" font-family="Menlo,Consolas,monospace" font-size="22" fill="#f5a524">cookieguard.surge.sh</text>
</svg>'''


def logo_svg_bytes():
    """inner markup of the logo (no xml header) for embedding in the banner"""
    return logo_svg().split(">", 1)[1].rsplit("</svg>", 1)[0]


def rasterise(svg_text, png_path, w, h):
    svg_path = "/tmp/_cg.svg"
    open(svg_path, "w").write(svg_text)
    subprocess.run([
        CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
        "--default-background-color=00000000",
        f"--screenshot={png_path}", f"--window-size={w},{h}",
        "--force-device-scale-factor=1", f"file://{svg_path}",
    ], capture_output=True, timeout=120)
    return os.path.exists(png_path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ok1 = rasterise(logo_svg(512), f"{OUT}/cookieguard-logo.png", 512, 512)
    ok2 = rasterise(banner_svg(), f"{OUT}/cookieguard-banner.png", 1600, 500)
    print("logo:", ok1, " banner:", ok2)
