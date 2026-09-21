# CookieGuard — X (Twitter) demo thread

The bounty asks for a thread that explains the app, shows how to use it, and guides users to the
Cookie Chain Bridge. Post the text below, attaching the screenshots from `assets/screenshots/`.

---

**1/6**

Most "rug checker" tools read a database someone else maintains.

CookieGuard reads Cookie Chain itself.

Paste a mint → it audits the real chain state and scores it 0–100.

🔗 cookieguard.surge.sh

`[attach 01-audit-top.png]`

---

**2/6**

What it checks, all from RPC:

• Mint authority — can they print more?
• Freeze authority — can they freeze you? (honeypot)
• Every funded holder account
• Liquidity — from the actual pool vaults
• Activity — is it alive?

`[attach 02-audit-report.png]`

---

**3/6**

The interesting part: liquidity.

CookieGuard enumerates every pool on CookieDEX and Cookieswap BAMM by reading their pool-state
accounts, then reads each pool's *vault token balances* for real reserves.

77 pools. ~19.4M COOK of tracked depth. No off-chain number.

And pool vaults are excluded from holder-concentration scoring — so a healthy pool never gets
mistaken for a whale dump.

`[attach 03-liquidity.png]`

---

**4/6**

Then it zooms out.

One `getProgramAccounts(dataSize: 82)` call returns *every SPL mint on Cookie Chain* — about 6,500.

Only ~4.5% have revoked their mint authority. Only 296 have renounced both mint and freeze.

That is the real state of the chain.

`[attach 04-chain-census.png]`

---

**5/6**

And it writes back.

Every audit can be published to Cookie Chain as a signed Memo transaction — a permanent, timestamped
attestation of the verdict.

Connect Nightly, hit publish, watch it go signing → broadcasting → confirmed.

The ledger below is read back off the chain. The app's history *is* chain state.

`[attach 05-onchain-ledger.png]`

---

**6/6**

Cookie Chain is mainnet-only, so you need a little COOK for gas — about 0.000005 COOK per tx, which
goes a very long way.

Bridge in from Solana here:
🔗 https://hyperlane.cookiescan.io

Then audit something:
🔗 https://cookieguard.surge.sh

Source is public — clone it, fork it, break it:
`git clone https://cookieguard.surge.sh/cookieguard.git`

🍪
