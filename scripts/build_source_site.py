#!/usr/bin/env python3
"""build_source_site.py — publish the CookieGuard source as
  * a real, clonable bare git repo at  /cookieguard.git   (git dumb-HTTP protocol)
  * a browsable code reader at        /source/

Runs against the working tree, writes everything into dist/.
"""
import html
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
SRC_REPO = os.path.join(DIST, "cookieguard.git")
VIEW = os.path.join(DIST, "source")

TRACKED = [
    "README.md", "SUBMISSION.md", "package.json", "build.mjs", ".gitignore",
    "public/index.html",
    "src/chain.js", "src/wallet.jsx", "src/panels.jsx", "src/ui.jsx",
    "src/App.jsx", "src/main.jsx", "src/styles.css",
    "scripts/verify.mjs", "scripts/verify_tx.mjs", "scripts/surge_deploy.py",
    "scripts/build_source_site.py",
    "scripts/make_logo.py",
    "scripts/gitea_signup.py", "scripts/probe_hcaptcha.py",
    "catalog/apps-entry.json", "catalog/x-thread.md",
]
LANG = {".js": "js", ".jsx": "jsx", ".mjs": "js", ".json": "json",
        ".html": "html", ".css": "css", ".md": "md", ".py": "py"}


def make_bare_repo():
    if os.path.exists(SRC_REPO):
        shutil.rmtree(SRC_REPO)
    os.makedirs(DIST, exist_ok=True)
    # a clean clone of the committed history, as a bare repo
    tmp = "/tmp/cg_clone"
    if os.path.exists(tmp):
        shutil.rmtree(tmp)
    subprocess.run(["git", "clone", "--quiet", ROOT, tmp], check=True)
    subprocess.run(["git", "clone", "--quiet", "--bare", tmp, SRC_REPO], check=True)
    # dumb HTTP needs these two generated indexes
    subprocess.run(["git", "update-server-info"], cwd=SRC_REPO, check=True)
    subprocess.run(["git", "config", "http.receivepack", "false"], cwd=SRC_REPO, check=True)
    # a description + a dumb-protocol marker so clients fall back correctly
    open(os.path.join(SRC_REPO, "git-daemon-export-ok"), "w").close()
    head = open(os.path.join(SRC_REPO, "HEAD")).read().strip()
    print(f"bare repo ready: {SRC_REPO} (HEAD {head})")
    subprocess.run(["git", "log", "--oneline", "-3"], cwd=tmp)


def make_viewer():
    if os.path.exists(VIEW):
        shutil.rmtree(VIEW)
    os.makedirs(VIEW, exist_ok=True)
    files = []
    for rel in TRACKED:
        p = os.path.join(ROOT, rel)
        if os.path.exists(p):
            files.append((rel, open(p, encoding="utf-8", errors="replace").read()))

    total = sum(len(c) for _, c in files)
    nav = "\n".join(
        f'<a class="f" href="#{html.escape(r)}">{html.escape(r)}<span>{len(c.splitlines())}L</span></a>'
        for r, c in files)
    body = "\n".join(
        f'<section id="{html.escape(r)}"><h2>{html.escape(r)}'
        f'<span class="ln">{len(c.splitlines())} lines · {len(c)} bytes</span></h2>'
        f'<pre><code>{html.escape(c)}</code></pre></section>'
        for r, c in files)

    doc = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CookieGuard — source</title>
<style>
 body{{margin:0;background:#0b0a09;color:#f4f1ec;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}}
 header{{padding:22px 26px;border-bottom:1px solid #2a2724;display:flex;gap:16px;align-items:baseline;flex-wrap:wrap}}
 h1{{margin:0;font-size:19px}} .m{{color:#a29c93;font-size:13px}}
 a{{color:#f5a524;text-decoration:none}} a:hover{{text-decoration:underline}}
 .wrap{{display:grid;grid-template-columns:270px 1fr;gap:0;align-items:start}}
 @media(max-width:900px){{.wrap{{grid-template-columns:1fr}} nav{{position:static!important;max-height:none!important}}}}
 nav{{position:sticky;top:0;border-right:1px solid #2a2724;padding:14px 0;max-height:100vh;overflow:auto}}
 a.f{{display:flex;justify-content:space-between;gap:8px;padding:7px 20px;font-family:ui-monospace,Menlo,Consolas,monospace;
   font-size:12.5px;color:#a29c93;border-left:2px solid transparent}}
 a.f:hover{{color:#f4f1ec;background:#171614;border-left-color:#f5a524;text-decoration:none}}
 a.f span{{color:#6f6a63}}
 main{{padding:8px 26px 90px;min-width:0}}
 section{{margin-bottom:34px;scroll-margin-top:14px}}
 h2{{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:#a29c93;display:flex;justify-content:space-between;
   gap:14px;flex-wrap:wrap;border-bottom:1px solid #2a2724;padding-bottom:8px;margin:26px 0 12px}}
 h2 .ln{{color:#6f6a63;text-transform:none;letter-spacing:0;font-weight:400}}
 pre{{margin:0;background:#121110;border:1px solid #2a2724;border-radius:10px;padding:14px 16px;overflow:auto;max-height:560px}}
 code{{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:#e9e4dc;white-space:pre}}
 .note{{background:rgba(245,165,36,.12);border:1px solid rgba(245,165,36,.34);color:#f7d488;
   border-radius:10px;padding:12px 14px;margin:18px 26px;font-size:13px}}
</style></head><body>
<header>
 <h1>🍪 CookieGuard — source</h1>
 <span class="m">{len(files)} files · {total:,} bytes · MIT-spirited, read it, fork it</span>
 <span class="m"><a href="../">← live app</a></span>
</header>
<div class="note">
 This is the full source of the deployed app. It is also a real git repository —
 <code>git clone https://cookieguard.surge.sh/cookieguard.git</code> — served over
 the git dumb-HTTP protocol from this same static host.
</div>
<div class="wrap"><nav>{nav}</nav><main>{body}</main></div>
</body></html>"""
    open(os.path.join(VIEW, "index.html"), "w", encoding="utf-8").write(doc)
    print(f"viewer: {VIEW}/index.html ({len(files)} files)")


if __name__ == "__main__":
    make_bare_repo()
    make_viewer()
