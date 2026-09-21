# CookieGuard — bounty submission pack

Everything needed to submit **CookieGuard** to the Cookie Chain *Create an App on Cookie Chain*
bounty. Copy-paste ready.

* **Live app** — https://cookieguard.surge.sh/
* **Source (browsable)** — https://cookieguard.surge.sh/source/
* **Source (git clone)** — `git clone https://cookieguard.surge.sh/cookieguard.git`

---

## 1. Superteam Earn submission (the official entry)

**Live application URL**

```
https://cookieguard.surge.sh/
```

**GitHub repository / source**

```
https://cookieguard.surge.sh/source/
(clone: git clone https://cookieguard.surge.sh/cookieguard.git)
```

**Relevant addresses**

```
RPC used            https://rpc.cookiescan.io
Wallet program      MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr  (SPL Memo, attestations)
Pool program A      DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY  (CookieDEX)
Pool program B      WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5  (Cookieswap BAMM)
```

**Description / approach**

CookieGuard is a token-safety scanner for Cookie Chain. Paste any mint and it audits it against the
chain itself — SPL mint authority, freeze authority, every funded holder account, and true liquidity
from both live DEX programs (it reads the pool-state accounts and then the vault token balances to
get real reserves, rather than trusting an off-chain number). It scores 0–100 and returns
SAFE/CAUTION/DANGER with per-check reasoning, then lets the user publish that verdict to Cookie
Chain as a Memo transaction, and reads its own attestations back off the chain to build the audit
ledger. It also ships a chain-wide census: one `getProgramAccounts(dataSize: 82)` enumerates every
SPL mint on the network (~6,500) and breaks down authority safety across the whole chain.

**Notes for reviewers**

Cookie Chain is mainnet-only with no faucet, so publishing an attestation spends real COOK
(~0.000005 COOK fee + memo rent). The app surfaces a clear warning when the connected wallet is
underfunded and links the bridge, and the full audit/analytics flow works without a wallet at all —
so the app can be evaluated end to end before funding anything. Suggested test wallet:
`8FbhLKJKHPgFx1Dc7m8QYhzoY9DKXjVUfDXBk5XjHark` (created for this submission).
