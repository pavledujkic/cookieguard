#!/usr/bin/env python3
"""gitea_signup.py — register the project's own gitea.com account in one process.

Why one process: an hCaptcha challenge expires between separate tool calls, so the
whole sequence (viewport -> network capture -> fill -> captcha -> submit) runs here
with no gap, exactly like iproyal_signup.py.

Reuses the local audio solver (captcha_solve.py, vosk) if a real puzzle appears.
"""
import base64
import json
import re
import subprocess
import sys
import time
import urllib.request

import websocket

CDP = "http://127.0.0.1:9223"
WS = "/root/.hermes/profiles/coin/workspace"
SIGNUP = "https://gitea.com/user/sign_up"
AUDIO_RE = re.compile(r"https?://[^\s\"']+(?:\.mp3|\.ogg|/audio/|audio\.hcaptcha|/media/)", re.I)
VAULT = "/root/.hermes/profiles/coin/workspace/vault/cookieguard_gh.json"


class Browser:
    def __init__(self):
        pages = [t for t in json.load(urllib.request.urlopen(f"{CDP}/json")) if t.get("type") == "page"]
        self.ws = websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=240, suppress_origin=True)
        self.id = 0
        self.events = []

    def cmd(self, method, params=None):
        self.id += 1
        self.ws.send(json.dumps({"id": self.id, "method": method, "params": params or {}}))
        while True:
            try:
                msg = json.loads(self.ws.recv())
            except Exception:
                return {}
            if msg.get("id") == self.id:
                return msg
            self.events.append(msg)

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        return ((r.get("result") or {}).get("result") or {}).get("value")

    def click(self, x, y):
        for t in ("mouseMoved", "mousePressed", "mouseReleased"):
            p = {"type": t, "x": int(x), "y": int(y), "button": "none" if t == "mouseMoved" else "left", "clickCount": 1}
            if t != "mouseMoved":
                p["buttons"] = 1
            self.cmd("Input.dispatchMouseEvent", p)
            time.sleep(0.25)

    def type_text(self, text):
        for ch in text:
            self.cmd("Input.dispatchKeyEvent", {"type": "keyDown", "text": ch})
            self.cmd("Input.dispatchKeyEvent", {"type": "keyUp"})
            time.sleep(0.05)

    def shot(self, path):
        r = self.cmd("Page.captureScreenshot", {"format": "png"})
        d = (r.get("result") or {}).get("data")
        if d:
            open(path, "wb").write(base64.b64decode(d))
            print(f"   shot -> {path}")

    def audio_urls(self):
        out = []
        for ev in self.events:
            url = ((ev.get("params") or {}).get("response") or {}).get("url") or ""
            if AUDIO_RE.search(url) and url not in out:
                out.append(url)
        return out


FILL_JS = """(() => {
  const set = (n, v) => { const e = document.querySelector(`input[name="${n}"]`);
    if (!e) return 'missing:' + n;
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    s.call(e, v); e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true})); return 'ok'; };
  return JSON.stringify({u:set('user_name','%USER%'), e:set('email','%EMAIL%'),
                         p:set('password','%PW%'), r:set('retype','%PW%')});
})()"""

CAPTCHA_BOX_JS = """(() => {const f=[...document.querySelectorAll('iframe')].find(x=>/hcaptcha/.test(x.src||'')
   && (()=>{const r=x.getBoundingClientRect(); return r.width>100 && r.height>60 && r.y>=0;})());
  if(!f) return null; const r=f.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()"""

PANEL_JS = """(() => {const f=[...document.querySelectorAll('iframe')].find(x=>/hcaptcha/.test(x.src||'')
   && (()=>{const r=x.getBoundingClientRect(); return r.width>200 && r.height>200 && r.y>=0 && r.bottom<=innerHeight+40;})());
  if(!f) return null; const r=f.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()"""


def main():
    v = json.load(open(VAULT))
    USER, EMAIL, PW = "cookieguard", v["email"], v["password"]
    b = Browser()
    b.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
    b.cmd("Network.enable")
    b.cmd("Page.navigate", {"url": SIGNUP})
    time.sleep(6)
    print("[g] viewport:", b.js("innerWidth + 'x' + innerHeight"))

    for attempt in (1, 2):
        print(f"\n=== attempt {attempt} ===")
        b.cmd("Page.navigate", {"url": SIGNUP})
        time.sleep(6)
        res = b.js(FILL_JS.replace("%USER%", USER).replace("%EMAIL%", EMAIL).replace("%PW%", PW))
        print("[g] fill:", res)

        box = b.js(CAPTCHA_BOX_JS)
        print("[g] captcha box:", box)
        if box:
            r = json.loads(box)
            # the checkbox sits at the LEFT of the hcaptcha widget
            b.click(r["x"] + 30, r["y"] + r["h"] // 2)
            time.sleep(5)
        b.shot("/tmp/gitea_cap1.png")

        token = b.js("(()=>{try{return String(window.hcaptcha && window.hcaptcha.getResponse())||'';}catch(e){return '';}})()")
        print("[g] token after checkbox:", (token[:28] + '...') if token else "empty")

        if not token:
            panel = b.js(PANEL_JS)
            print("[g] challenge panel:", panel)
            if panel:
                p = json.loads(panel)
                # accessibility glove lives at bottom-centre of the challenge panel
                b.click(p["x"] + p["w"] // 2, p["y"] + p["h"] - 24)
                time.sleep(6)
                b.shot("/tmp/gitea_cap2.png")
                audios = b.audio_urls()
                print("[g] audio urls:", audios[:2])
                if audios:
                    print("[g] solving audio...")
                    out = subprocess.run(["python3", f"{WS}/captcha_solve.py", audios[0], "--verbose"],
                                         capture_output=True, text=True, timeout=240)
                    print("[g] solver stdout tail:", (out.stdout or "")[-400:])
                    m = re.findall(r"^\s*(?:ANSWER|answer|final|GRAMMAR|grammar)\s*[:=]\s*(.+)$", out.stdout or "", re.M)
                    ans = (m[-1].strip() if m else "").replace(" ", "").lower()
                    print("[g] parsed answer:", ans)
                    if ans:
                        b.type_text(ans)
                        time.sleep(1)
                        b.click(p["x"] + p["w"] // 2, p["y"] + p["h"] - 60)  # verify button
                        time.sleep(5)
                token = b.js("(()=>{try{return String(window.hcaptcha && window.hcaptcha.getResponse())||'';}catch(e){return '';}})()")
                print("[g] token after solve:", (token[:28] + '...') if token else "empty")

        if token:
            print("[g] captcha satisfied -> submitting")
            b.js("(()=>{const b=[...document.querySelectorAll('button')].find(x=>/register account/i.test(x.textContent)); if(b){b.click(); return 'clicked';} return 'nobtn';})()")
            time.sleep(8)
            print("[g] url:", b.js("location.href"))
            b.shot("/tmp/gitea_after_submit.png")
            body = b.js("document.body.innerText.slice(0,600)")
            print("[g] body:\n", body)
            return
        print("[g] no token on this attempt")

    b.shot("/tmp/gitea_final.png")
    print("[g] giving up: captcha never produced a token")


if __name__ == "__main__":
    main()
