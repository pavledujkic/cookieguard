#!/usr/bin/env python3
"""probe_hcaptcha.py — click the hCaptcha accessibility control and report exactly what opens.

Diagnostic only: dumps every network URL captured after the click, all iframes with geometry,
and a screenshot taken immediately after the click (before any menu can auto-close).
"""
import base64, json, re, sys, time, urllib.request
import websocket

CDP = "http://127.0.0.1:9223"
SIGNUP = "https://gitea.com/user/sign_up"


class B:
    def __init__(self):
        pages = [t for t in json.load(urllib.request.urlopen(f"{CDP}/json")) if t.get("type") == "page"]
        self.ws = websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=240, suppress_origin=True)
        self.id = 0; self.events = []

    def cmd(self, m, p=None):
        self.id += 1
        self.ws.send(json.dumps({"id": self.id, "method": m, "params": p or {}}))
        while True:
            try: msg = json.loads(self.ws.recv())
            except Exception: return {}
            if msg.get("id") == self.id: return msg
            self.events.append(msg)

    def js(self, e):
        r = self.cmd("Runtime.evaluate", {"expression": e, "returnByValue": True, "awaitPromise": True})
        return ((r.get("result") or {}).get("result") or {}).get("value")

    def click(self, x, y):
        for t in ("mouseMoved", "mousePressed", "mouseReleased"):
            p = {"type": t, "x": int(x), "y": int(y), "button": "none" if t == "mouseMoved" else "left", "clickCount": 1}
            if t != "mouseMoved": p["buttons"] = 1
            self.cmd("Input.dispatchMouseEvent", p); time.sleep(0.2)

    def shot(self, path):
        r = self.cmd("Page.captureScreenshot", {"format": "png"})
        d = (r.get("result") or {}).get("data")
        if d: open(path, "wb").write(base64.b64decode(d)); print("   shot ->", path)


def main():
    v = json.load(open("/root/.hermes/profiles/coin/workspace/vault/cookieguard_gh.json"))
    b = B()
    b.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 1100, "deviceScaleFactor": 1, "mobile": False})
    b.cmd("Network.enable")
    b.cmd("Page.navigate", {"url": SIGNUP}); time.sleep(6)
    b.js(f"""(()=>{{const s=(n,v)=>{{const e=document.querySelector('input[name="'+n+'"]');if(!e)return;
        const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(e,v);
        e.dispatchEvent(new Event('input',{{bubbles:true}}));}};
        s('user_name','cookieguard');s('email','{v['email']}');s('password','{v['password']}');s('retype','{v['password']}');return 1;}})()""")
    time.sleep(1)

    box = b.js("""(()=>{const f=[...document.querySelectorAll('iframe')].find(x=>/hcaptcha/.test(x.src||'')
       &&(()=>{const r=x.getBoundingClientRect();return r.width>100&&r.height>60&&r.y>=0;})());
      if(!f)return null;const r=f.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()""")
    print("box:", box)
    if box:
        r = json.loads(box)
        b.click(r["x"] + 30, r["y"] + r["h"] // 2)
        time.sleep(6)
    b.shot("/tmp/hp_1_challenge.png")

    panel = b.js("""(()=>{const f=[...document.querySelectorAll('iframe')].find(x=>/hcaptcha/.test(x.src||'')
       &&(()=>{const r=x.getBoundingClientRect();return r.width>200&&r.height>200&&r.y>=0;})());
      if(!f)return null;const r=f.getBoundingClientRect();
      return JSON.stringify({x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)});})()""")
    print("panel:", panel)
    if not panel:
        print("no panel found"); return
    p = json.loads(panel)

    # sweep candidate positions along the bottom icon row
    cands = [
        ("icon-50%", p["x"] + p["w"] // 2, p["y"] + p["h"] - 31),
        ("icon-50%-8", p["x"] + p["w"] // 2, p["y"] + p["h"] - 39),
        ("icon-52%", p["x"] + int(p["w"] * 0.52), p["y"] + p["h"] - 31),
    ]
    for name, x, y in cands:
        print(f"\n>>> click {name} at ({x},{y})")
        n0 = len(b.events)
        b.click(x, y)
        time.sleep(4)
        b.shot(f"/tmp/hp_after_{name.replace('%','p')}.png")
        # every URL seen since the click
        urls = []
        for ev in b.events[n0:]:
            u = ((ev.get("params") or {}).get("response") or {}).get("url") or ""
            if u and ("hcaptcha" in u or "audio" in u.lower() or ".mp3" in u or ".ogg" in u) and u not in urls:
                urls.append(u)
        print("   hcaptcha-ish requests:", urls[:6])
        # did an accessibility menu or audio element appear in any frame?
        print("   audio elements in page:", b.js("""document.querySelectorAll('audio').length"""))
        print("   iframes now:", b.js("""JSON.stringify([...document.querySelectorAll('iframe')].map(f=>{const r=f.getBoundingClientRect();return {src:(f.src||'').slice(0,60),w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y)};}))"""))


if __name__ == "__main__":
    main()
