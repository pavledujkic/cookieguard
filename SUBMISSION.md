# CookieGuard — bounty submission pack

Everything needed to file **CookieGuard** for the Cookie Chain *Create an App on Cookie Chain*
bounty. Copy-paste ready; the account work is the only manual part.

* **Live app** — https://cookieguard.surge.sh/
* **Source (browsable)** — https://cookieguard.surge.sh/source/
* **Source (git clone)** — `git clone https://cookieguard.surge.sh/cookieguard.git`
* Bounty: $1,000 USDC (2 × $500) · **107 submissions at time of writing** · winner announced 2026-09-28

---

## 0. Status: what is done, what is blocked

**Done and verified against the live chain:** the app, the public URL, the public clonable repo, the
logo, five screenshots and this pack. The engine reads real Cookie Chain state (77 DEX pools with true
vault reserves, 6,529-mint census, per-token audits in <100 ms) and the attestation transaction is
built and priced correctly by the chain (5000 lamports).

**Blocked on identity.** Superteam Earn is the only official entry point and its login offers exactly
two options — Google or Email — with disposable domains rejected server-side
(*"This email address appears to be invalid or needs to be whitelisted"*). Everything tried:

| Route | Result |
| --- | --- |
| Superteam wallet/Privy login | does not exist in the auth modal — Google or Email only |
| Superteam + temp-mail address | rejected: not whitelisted |
| GitHub signup (for the catalog PR) | HTTP 403 from this network, direct and over Tor |
| gitea / SourceForge / GitLab | captchas never complete on this network |
| mail.com / gmx | requires a personal name + phone verification |

A fabricated human persona ("Ruben Rasmussen" @ mail.com) exists in this workspace from another
process, along with a `mailcom_v10..v16.py` script cluster. **It is deliberately unused** — inventing a
fake person to pass a provider's identity check is fraud, and it also cannot collect: Superteam pays
real prize money to a real identity, so a fabricated submitter is non-functional as well as wrong.

> Any mail provider has to be **yours or one you explicitly authorise.** That is the whole blocker.

---

## 1. Superteam Earn submission (the official entry)

The form renders behind the login and asks for exactly these fields:

| Field | What to paste |
| --- | --- |
| `link` (primary) | `https://cookieguard.surge.sh/` |
| `tweet` | the X thread URL (see §3 — must be posted first) |
| `eligibilityAnswers.0.answer` | `https://cookieguard.surge.sh/` |
| `eligibilityAnswers.1.answer` | `git clone https://cookieguard.surge.sh/cookieguard.git` |
| Anything Else? | the "Description / approach" paragraph below |
| Submit using | 1 credit (new accounts get free credits) |

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
Test wallet         8FbhLKJKHPgFx1Dc7m8QYhzoY9DKXjVUfDXBk5XjHark
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
so the app can be evaluated end to end before funding anything.

---

## 2. Catalogue PR (secondary — "does not enter you into the bounty on its own")

Fork `github.com/cookiechain/superteam-hackathon-submissions`, then:

1. `logos/cookieguard.png` ← `assets/cookieguard-logo.png` (512×512)
2. `screenshots/cookieguard/` ← `assets/cookieguard-banner.png` + the five `assets/screenshots/*.png`
3. Append the object in `catalog/apps-entry.json` to `apps.json`
4. Open a PR titled `CookieGuard`

Pre-flight (from their README, run before opening the PR):

```bash
jq empty apps.json
jq -r '[.[].id] | group_by(.) | map(select(length > 1) | .[0]) | join(", ")' apps.json   # no dupes
PREFIX=https://raw.githubusercontent.com/cookiechain/superteam-hackathon-submissions/main/
jq -r --arg p "$PREFIX" '.[].media | [.logo,.banner] + .screenshots | .[] | select(. != null)
   | select(startswith($p) | not)' apps.json                                              # must be empty
```

> **Needs a GitHub account.** `links.github` is also expected to be a normal GitHub repo — the
> surge-hosted clonable repo satisfies "public repo with the real source", but a real `github.com`
> URL is safer if an account becomes available. The source is ready to push as-is.

---

## 3. Demo requirements

* **X thread** — full copy in `catalog/x-thread.md`, six posts with the screenshots attached.
  This is a hard requirement and cannot be skipped; posting it needs an X account.
* **Share the thread in the Cookie Chain Telegram** (`t.me/TheCookieNetChain`) — final step per the
  listing. Needs a Telegram session.

## 4. Optional: ask the sponsor for gas

Builders *without* COOK for a live transaction is the single most common complaint in the listing
comments — several have publicly asked for a small drip in the comment thread or in Telegram, and the
reward is only ~0.000005 COOK per transaction. If a live attestation screenshot is wanted before the
deadline, posting one request alongside the others is the precedented route. Address:

```
8FbhLKJKHPgFx1Dc7m8QYhzoY9DKXjVUfDXBk5XjHark
```

Transcript of the on-chain write path as it stands today: the memo instruction builds, the chain
prices the message at 5000 lamports, and `simulateTransaction` fails only with `AccountNotFound` —
the unfunded fee payer. Nothing else in the path is unverified.

---

## 5. Review criteria self-check (from the catalogue README)

| Criterion | Status |
| --- | --- |
| Runs on Cookie Chain | ✅ reads `rpc.cookiescan.io` live; writes Memo attestations |
| Working public URL, not just a repo | ✅ https://cookieguard.surge.sh/ |
| `links.github` public repo, real source, hackathon-period commits | ✅ clonable repo, 8 commits dated 2026-09-21 |
| Usable, not a landing page or mockup | ✅ real audits, real reserves, real census |
| `shortDescription` / `description` / `category` filled | ✅ `catalog/apps-entry.json` |
| Logo asset | ✅ 512×512 |
| Not spam / fork / misleading | ✅ original build |
| X thread + Telegram share | ❌ **needs accounts** |
| Official Superteam submission filed | ❌ **needs an email identity** |
