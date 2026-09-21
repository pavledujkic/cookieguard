# 🍪 CookieGuard

**On-chain token safety scanner for Cookie Chain.**

| | |
| --- | --- |
| **Live app** | https://cookieguard.surge.sh/ |
| **Source (browsable)** | https://cookieguard.surge.sh/source/ |
| **Source (git)** | `git clone https://cookieguard.surge.sh/cookieguard.git` |
| **Chain** | Cookie Chain mainnet — RPC `https://rpc.cookiescan.io` |
| **Category** | Tooling / Security |

CookieGuard scores any Cookie Chain token for rug risk using nothing but the chain itself — no
indexer, no API keys, no backend. It reads every holder account, both live DEX programs and the
actual pool vault balances, then publishes the verdict back to the chain as a signed attestation.

Built for the [Create an App on Cookie Chain](https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app/) bounty.

---

## What it does

### 1. Rug-risk audit for any token
Paste a mint address. CookieGuard runs six independent on-chain checks and produces a 0–100 score
plus a `SAFE` / `CAUTION` / `DANGER` verdict:

| Check | What is read from chain |
| --- | --- |
| Mint authority revoked | `getAccountInfo` → parsed SPL mint, `mintAuthority` |
| Freeze authority revoked | same account, `freezeAuthority` (honeypot vector) |
| Holder concentration | every token account of the mint, insider supply with **pool vaults excluded** |
| Holder base | count of funded token accounts (`getProgramAccounts` + `memcmp`) |
| Liquidity pool detected | pool state accounts of both live DEX programs, + real reserves from the vaults |
| Recent activity | `getSignaturesForAddress` → tx in last 24h / last 7d |

Findings render as a gauge, per-check pass/warn/fail rows, and a holder-distribution chart where AMM
pool vaults are colour-coded separately from insider wallets.

### 2. Real liquidity analytics
CookieGuard enumerates **every pool on Cookie Chain's two live DEX programs** by reading their
pool-state accounts, then resolves each pool's vault token accounts to get true reserves:

* `CookieDEX` — `DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY` (1112-byte pool accounts,
  mints at 168/200, vaults at 232/264)
* `Cookieswap BAMM` — `WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5` (1544-byte pool accounts,
  mints at 73/105, vaults at 137/169)

That yields live COOK reserves, token reserves and an implied price per pool — **77 pools indexed,
~19.4M COOK of tracked depth** at the time of writing.

### 3. Chain-wide token census
One `getProgramAccounts(dataSize: 82)` call returns **every SPL mint on the network** (~6,500).
CookieGuard parses each mint account locally and reports authority safety across the whole chain,
supply buckets, decimals in use, and network health (slot, epoch, throughput, rent).

### 4. On-chain audit attestations (the transaction)
Every audit can be published to Cookie Chain as a **Memo-program transaction** signed by the user's
wallet:

```
CGUARD1|<mint>|s<score>|<verdict>|h<holderCount>|f<failedChecks>
```

The app tracks the transaction through *awaiting signature → broadcasting → confirming → confirmed*,
surfaces failures verbatim, links the signature on CookieScan, and then **reads its own attestations
back off the chain** to build the audit ledger. The app's activity log *is* chain state, not a local
database.

---

## Wallet support

Cookie Chain is an SVM chain, so Solana wallets work as-is. CookieGuard ships
`@solana/wallet-adapter-nightly` (**Nightly**, the first COOK-supported wallet) plus Phantom and
Solflare adapters, and auto-detects any other Wallet-Standard wallet. Connection is non-custodial:
the app never sees a private key and every transaction is signed inside the wallet.

## Stack

* React 18 + esbuild — one static bundle, no runtime dependencies, no server
* `@solana/web3.js` — RPC + transaction construction
* RPC `https://rpc.cookiescan.io` is called **directly from the browser** (the endpoint is CORS-open)
* Custom SVG charts and a hand-written base58 / SPL-account parser — no chart or token libraries

```
src/chain.js    RPC layer, SPL parsing, DEX pool registry, risk engine
src/wallet.jsx  wallet providers, memo transaction, attestation reader
src/panels.jsx  Audit / Liquidity / Census / Ledger views
src/ui.jsx      gauge, donut, bar + column charts, stat cards
src/App.jsx     shell, live network polling
scripts/        verification harness, build + source publishing, asset generation
```

## Run locally

```bash
npm install
npm run build                 # -> dist/ (static)
npx serve dist                # or: python3 -m http.server -d dist
```

Verify the engine against the live chain without a browser:

```bash
npm run verify                              # network + pools + three sample audits
node scripts/verify.mjs <mint> <mint> ...   # audit specific tokens
```

## Deploy

```bash
git commit -am "..."                   # FIRST: the bare repo is cloned from HEAD
npm run build
python3 scripts/build_source_site.py   # bundles the bare repo + code viewer into dist/
python3 scripts/surge_deploy.py cookieguard.surge.sh
```

Commit before `build_source_site.py`, or the published repo lags the working tree by a commit.

`build_source_site.py` clones the working tree into `dist/cookieguard.git` and runs
`git update-server-info`, which is what makes the repo clonable over the git dumb-HTTP protocol from
a purely static host.

## Screenshots

`assets/screenshots/` — audit report, liquidity registry, chain census, attestation ledger.

---

## Notes

* Cookie Chain is **mainnet only** — there is no faucet and no devnet. Publishing an attestation
  costs the normal Cookie Chain fee (~0.000005 COOK) plus rent for the memo, so the connected wallet
  needs a small COOK balance. The UI warns when the wallet is underfunded for the fee.
* Token-2022 mints are detected and labelled, but holder enumeration targets legacy SPL token
  accounts, which is the format essentially every Cookie Chain token uses.
* Nothing here is financial advice — the score is a mechanical reading of on-chain facts.
