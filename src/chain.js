/**
 * CookieGuard core — every number in the UI comes from the live Cookie Chain RPC.
 * No mocks, no hardcoded token stats.
 *
 * RPC: https://rpc.cookiescan.io  (solana-core 4.1.2, CORS-open)
 *
 * Liquidity is resolved from the two real on-chain DEX programs by reading their
 * pool state accounts directly (mints + vault addresses are stored in the pool
 * account), then reading each vault's token balance for true reserves:
 *
 *   CookieDEX  DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY   pool = 1112 bytes
 *     mintA @168  mintB @200  vaultA @232  vaultB @264
 *   Cookieswap BAMM  WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5   pool = 1544 bytes
 *     mintA @73   mintB @105  vaultA @137  vaultB @169
 */

export const RPC_URL = 'https://rpc.cookiescan.io';
export const EXPLORER = 'https://cookiescan.io';
export const CHAIN_NAME = 'Cookie Chain';
export const NATIVE_SYMBOL = 'COOK';

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const MEMO_PROGRAM_V1 = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';

/** The COOK quote leg is wrapped-SOL under the hood (classic SVM fork convention). */
export const WSOL = 'So11111111111111111111111111111111111111112';

export const DEX_PROGRAM = 'DAMMjDCEFTDkt7ywazZS8GoaLtjb3HaJo3pLbf64xrPY';
export const BAMM_PROGRAM = 'WTzkPUoprVx7PDc1tfKA5sS7k1ynCgU89WtwZhksHX5';

export const DEXES = {
  [DEX_PROGRAM]: { name: 'CookieDEX', size: 1112, off: { mintA: 168, mintB: 200, vaultA: 232, vaultB: 264 } },
  [BAMM_PROGRAM]: { name: 'Cookieswap BAMM', size: 1544, off: { mintA: 73, mintB: 105, vaultA: 137, vaultB: 169 } },
};

export const MEMO_TAG = 'CGUARD1';

/* ------------------------------------------------------------------ *
 * low-level rpc
 * ------------------------------------------------------------------ */

let _id = 1;
export async function rpc(method, params = [], { timeout = 45000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: _id++, method, params }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || `RPC ${method} error`);
    return j.result;
  } finally {
    clearTimeout(t);
  }
}

export function b64ToBytes(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function b58encode(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1';
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]];
  return out;
}

const u64le = (b, o) => {
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]);
  return v;
};
const u32le = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);

export const isValidPubkey = (s) => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || '').trim());

/* ------------------------------------------------------------------ *
 * on-chain reads
 * ------------------------------------------------------------------ */

/** SPL mint account (82 bytes). */
export function parseMintBytes(b) {
  const hasMintAuth = u32le(b, 0) === 1;
  const hasFreezeAuth = u32le(b, 46) === 1;
  return {
    hasMintAuth,
    mintAuthority: hasMintAuth ? b58encode(b.slice(4, 36)) : null,
    supply: u64le(b, 36),
    decimals: b[44],
    isInitialized: b[45] === 1,
    hasFreezeAuth,
    freezeAuthority: hasFreezeAuth ? b58encode(b.slice(50, 82)) : null,
  };
}

export async function getMint(mint) {
  const acct = await rpc('getAccountInfo', [mint, { encoding: 'base64' }]);
  if (!acct || !acct.value) throw new Error('No account found at that address on Cookie Chain.');
  const raw = b64ToBytes(acct.value.data[0]);
  if (raw.length !== 82) throw new Error(`Address is not an SPL mint (account size ${raw.length}).`);
  const m = parseMintBytes(raw);
  return {
    mint, program: acct.value.owner, is2022: acct.value.owner === TOKEN_2022_PROGRAM,
    lamports: acct.value.lamports, ...m,
    uiSupply: Number(m.supply) / 10 ** m.decimals,
  };
}

/** Full holder set — pulls only bytes 32..72 of each token account (owner + amount). */
export async function getAllHolders(mint, { minRaw = 1n } = {}) {
  const data = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM,
    {
      encoding: 'base64',
      dataSlice: { offset: 32, length: 40 },
      filters: [{ dataSize: 165 }, { memcmp: { offset: 0, bytes: mint } }],
    },
  ], { timeout: 60000 });

  const holders = [];
  for (const { pubkey, account } of data || []) {
    const b = b64ToBytes(account.data[0]);
    if (b.length < 40) continue;
    const amount = u64le(b, 32);
    if (amount < minRaw) continue;
    holders.push({ address: pubkey, owner: b58encode(b.slice(0, 32)), amount });
  }
  holders.sort((x, y) => (y.amount > x.amount ? 1 : y.amount < x.amount ? -1 : 0));
  return holders;
}

export async function getMultiple(keys, opts = { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }) {
  if (!keys.length) return [];
  const out = [];
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = await rpc('getMultipleAccounts', [keys.slice(i, i + 100), opts]);
    out.push(...(chunk.value || []));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * DEX pool registry — real liquidity
 * ------------------------------------------------------------------ */

let _poolCache = null;
export const POOL_TTL_MS = 120000;

/**
 * Enumerate every pool on both live DEX programs and read true reserves from the
 * vault token accounts. Returns pools indexed by mint.
 */
export async function getPoolRegistry({ force = false, ttl = POOL_TTL_MS } = {}) {
  if (!force && _poolCache && Date.now() - _poolCache.at < ttl) return _poolCache;

  const programs = Object.entries(DEXES);
  const raw = await Promise.all(programs.map(([pid, cfg]) => rpc('getProgramAccounts', [
    pid, { encoding: 'base64', filters: [{ dataSize: cfg.size }] },
  ], { timeout: 60000 }).catch(() => [])));

  const pools = [];
  programs.forEach(([pid, cfg], i) => {
    for (const { pubkey, account } of raw[i] || []) {
      const b = b64ToBytes(account.data[0]);
      if (b.length !== cfg.size) continue;
      const at = (o) => b58encode(b.slice(o, o + 32));
      pools.push({
        dex: cfg.name, program: pid, pool: pubkey,
        mintA: at(cfg.off.mintA), vaultA: at(cfg.off.vaultA),
        mintB: at(cfg.off.mintB), vaultB: at(cfg.off.vaultB),
      });
    }
  });

  // real reserves from the vault token accounts
  const vaultKeys = [];
  for (const p of pools) vaultKeys.push(p.vaultA, p.vaultB);
  const vals = await getMultiple(vaultKeys, { encoding: 'jsonParsed' }).catch(() => []);
  const reserve = new Map();
  vals.forEach((v, i) => {
    const info = v?.data?.parsed?.info;
    if (info?.mint) reserve.set(vaultKeys[i], { mint: info.mint, amount: Number(info.tokenAmount?.uiAmountString || 0) });
  });

  const byMint = new Map();
  const enriched = [];
  for (const p of pools) {
    const ra = reserve.get(p.vaultA);
    const rb = reserve.get(p.vaultB);
    const rec = {
      ...p,
      reserveA: ra?.amount ?? null,
      reserveB: rb?.amount ?? null,
      quoteMint: p.mintA === WSOL ? p.mintA : p.mintB === WSOL ? p.mintB : null,
    };
    if (rec.quoteMint === p.mintA) { rec.cookReserve = rec.reserveA; rec.tokenReserve = rec.reserveB; rec.tokenMint = p.mintB; }
    else if (rec.quoteMint === p.mintB) { rec.cookReserve = rec.reserveB; rec.tokenReserve = rec.reserveA; rec.tokenMint = p.mintA; }
    else { rec.cookReserve = null; rec.tokenReserve = null; rec.tokenMint = null; }
    rec.priceInCook = rec.cookReserve && rec.tokenReserve ? rec.cookReserve / rec.tokenReserve : null;

    enriched.push(rec);
    for (const m of [p.mintA, p.mintB]) {
      if (!byMint.has(m)) byMint.set(m, []);
      byMint.get(m).push(rec);
    }
  }

  _poolCache = { at: Date.now(), pools: enriched, byMint, count: enriched.length };
  return _poolCache;
}

export function poolsForMint(registry, mint) {
  const all = registry?.byMint?.get(mint) || [];
  // pool vaults are the accounts that must be excluded from insider concentration
  const vaults = new Set();
  for (const p of all) vaults.add(p.vaultA), vaults.add(p.vaultB);
  const quoted = all.filter((p) => p.quoteMint);
  const best = [...all].sort((a, b) => (b.cookReserve || 0) - (a.cookReserve || 0))[0] || null;
  return { all, quoted, vaults, best, liquidityCook: best?.cookReserve ?? null };
}

/** Recent on-chain activity for an account. */
export async function getActivity(mint, limit = 100) {
  const sigs = (await rpc('getSignaturesForAddress', [mint, { limit }])) || [];
  const now = Math.floor(Date.now() / 1000);
  const ok = sigs.filter((s) => !s.err);
  return {
    sampled: sigs.length,
    lastTxAt: ok[0]?.blockTime || null,
    lastTxAgeSec: ok[0]?.blockTime ? now - ok[0].blockTime : null,
    tx24h: ok.filter((s) => s.blockTime && now - s.blockTime < 86400).length,
    tx7d: ok.filter((s) => s.blockTime && now - s.blockTime < 604800).length,
    failed: sigs.filter((s) => s.err).length,
    signatures: sigs.slice(0, 6),
  };
}

export async function getNetworkStats() {
  const [epoch, supply, perf, rent] = await Promise.all([
    rpc('getEpochInfo'),
    rpc('getSupply').catch(() => null),
    rpc('getRecentPerformanceSamples', [4]).catch(() => null),
    rpc('getMinimumBalanceForRentExemption', [165]).catch(() => null),
  ]);
  let tps = null;
  if (perf?.length) {
    const tx = perf.reduce((a, s) => a + s.numTransactions, 0);
    const secs = perf.reduce((a, s) => a + s.samplePeriodSecs, 0);
    tps = secs ? tx / secs : null;
  }
  return {
    slot: epoch.absoluteSlot, blockHeight: epoch.blockHeight, epoch: epoch.epoch,
    slotIndex: epoch.slotIndex, slotsInEpoch: epoch.slotsInEpoch,
    transactionCount: epoch.transactionCount,
    epochProgress: epoch.slotsInEpoch ? (epoch.slotIndex / epoch.slotsInEpoch) * 100 : 0,
    circulating: supply ? Number(supply.value.circulating) / 1e9 : null,
    total: supply ? Number(supply.value.total) / 1e9 : null,
    tps, rent165: rent, fetchedAt: Date.now(),
  };
}

/** Chain-wide census of every SPL mint, from getProgramAccounts(dataSize:82). */
export async function getTokenCensus() {
  const data = await rpc('getProgramAccounts', [
    TOKEN_PROGRAM, { encoding: 'base64', filters: [{ dataSize: 82 }] },
  ], { timeout: 90000 });

  const tokens = [];
  for (const { pubkey, account } of data || []) {
    try {
      const m = parseMintBytes(b64ToBytes(account.data[0]));
      tokens.push({ mint: pubkey, ...m, uiSupply: Number(m.supply) / 10 ** m.decimals });
    } catch { /* unparseable, skip */ }
  }
  const live = tokens.filter((t) => t.supply > 0n);
  return {
    tokens, total: tokens.length, live: live.length, dead: tokens.length - live.length,
    revokedMintAuth: tokens.filter((t) => !t.hasMintAuth).length,
    freezeOpen: tokens.filter((t) => t.hasFreezeAuth).length,
    fullyRenounced: tokens.filter((t) => !t.hasMintAuth && !t.hasFreezeAuth).length,
    decimalsHistogram: histo(tokens.map((t) => t.decimals), 0, 9),
    supplyBuckets: supplyBuckets(live),
    topBySupply: [...live].sort((a, b) => Number(b.uiSupply) - Number(a.uiSupply)).slice(0, 30),
    fetchedAt: Date.now(),
  };
}

function histo(values, lo, hi) {
  const out = [];
  for (let i = lo; i <= hi; i++) out.push({ key: i, count: values.filter((v) => v === i).length });
  return out;
}

function supplyBuckets(live) {
  const edges = [
    [0, 1, '<1'], [1, 1e3, '1–1K'], [1e3, 1e6, '1K–1M'],
    [1e6, 1e9, '1M–1B'], [1e9, 1e12, '1B–1T'], [1e12, Infinity, '1T+'],
  ];
  return edges.map(([lo, hi, label]) => ({
    label, count: live.filter((t) => Number(t.uiSupply) >= lo && Number(t.uiSupply) < hi).length,
  }));
}

/* ------------------------------------------------------------------ *
 * risk engine
 * ------------------------------------------------------------------ */

const PENALTY = {
  mintAuthority: 30, freezeAuthority: 22, top1: 26, top10: 14,
  holders: 15, noPool: 22, dead: 45, stale: 8, uninitialized: 40, thinLiq: 10,
};

export function buildReport({ mint, info, holders, poolInfo, activity, supplyRaw }) {
  const checks = [];
  const totalRaw = supplyRaw > 0n ? supplyRaw : 1n;

  if (supplyRaw === 0n) {
    checks.push({ id: 'dead', label: 'Token supply', status: 'fail', weight: PENALTY.dead, detail: 'Total supply is 0 — this mint has no tokens in existence.' });
  }
  if (!info.isInitialized) {
    checks.push({ id: 'uninitialized', label: 'Mint initialized', status: 'fail', weight: PENALTY.uninitialized, detail: 'Mint account is not initialized.' });
  }

  checks.push(info.hasMintAuth
    ? { id: 'mintAuthority', label: 'Mint authority revoked', status: 'fail', weight: PENALTY.mintAuthority, detail: `Authority ${short(info.mintAuthority)} can mint unlimited supply at any time.` }
    : { id: 'mintAuthority', label: 'Mint authority revoked', status: 'pass', weight: 0, detail: 'Mint authority is renounced — supply is fixed forever.' });

  checks.push(info.hasFreezeAuth
    ? { id: 'freezeAuthority', label: 'Freeze authority revoked', status: 'fail', weight: PENALTY.freezeAuthority, detail: `Authority ${short(info.freezeAuthority)} can freeze token accounts — a honeypot risk.` }
    : { id: 'freezeAuthority', label: 'Freeze authority revoked', status: 'pass', weight: 0, detail: 'Freeze authority is renounced — nobody can freeze your balance.' });

  const vaultSet = poolInfo.vaults;
  const insider = holders.filter((h) => !vaultSet.has(h.address) && !vaultSet.has(h.owner));
  const top1 = insider[0] || { amount: 0n };
  const top1Pct = pct(top1.amount, totalRaw);
  const top10Pct = pct(insider.slice(0, 10).reduce((a, h) => a + h.amount, 0n), totalRaw);

  checks.push(top1Pct > 50
    ? { id: 'top1', label: 'Holder concentration', status: 'fail', weight: PENALTY.top1, detail: `Top insider wallet holds ${top1Pct.toFixed(2)}% of supply — one dump would crater it.` }
    : top1Pct > 25
      ? { id: 'top1', label: 'Holder concentration', status: 'warn', weight: Math.round(PENALTY.top1 / 2), detail: `Top insider wallet holds ${top1Pct.toFixed(2)}% of supply — elevated.` }
      : { id: 'top1', label: 'Holder concentration', status: 'pass', weight: 0, detail: `Top insider holds ${top1Pct.toFixed(2)}%; top 10 hold ${top10Pct.toFixed(2)}% (pool vaults excluded).` });

  if (top10Pct > 80 && top1Pct <= 50) {
    checks.push({ id: 'top10', label: 'Top-10 distribution', status: 'warn', weight: PENALTY.top10, detail: `Top 10 insider wallets hold ${top10Pct.toFixed(2)}% of supply outside liquidity.` });
  }

  const n = holders.length;
  checks.push(n < 10
    ? { id: 'holders', label: 'Holder base', status: 'fail', weight: PENALTY.holders, detail: `Only ${n} funded token account(s) — no distribution, exits will be illiquid.` }
    : n < 30
      ? { id: 'holders', label: 'Holder base', status: 'warn', weight: Math.round(PENALTY.holders / 2), detail: `${n} funded token accounts — thin.` }
      : { id: 'holders', label: 'Holder base', status: 'pass', weight: 0, detail: `${n} funded token accounts on chain.` });

  const liq = poolInfo.liquidityCook;
  if (poolInfo.best && liq !== null) {
    const thin = liq < 500;
    checks.push({
      id: 'noPool',
      label: 'Liquidity pool detected',
      status: thin ? 'warn' : 'pass',
      weight: thin ? PENALTY.thinLiq : 0,
      detail: `${poolInfo.best.dex} pool ${short(poolInfo.best.pool)} holds ${fmtNum(liq)} COOK + ${fmtNum(poolInfo.best.tokenReserve)} tokens. Implied price ${poolInfo.best.priceInCook ? poolInfo.best.priceInCook.toExponential(3) : '—'} COOK/token.${thin ? ' Depth is very thin.' : ''}`,
    });
  } else if (poolInfo.all.length) {
    checks.push({ id: 'noPool', label: 'Liquidity pool detected', status: 'warn', weight: Math.round(PENALTY.noPool / 2), detail: `${poolInfo.all.length} pool(s) reference this mint, but none is quoted against COOK — no direct COOK route.` });
  } else {
    checks.push({ id: 'noPool', label: 'Liquidity pool detected', status: 'fail', weight: PENALTY.noPool, detail: 'No pool on CookieDEX or Cookieswap BAMM references this mint — holders may not be able to sell.' });
  }

  if (activity.lastTxAgeSec === null) {
    checks.push({ id: 'stale', label: 'Recent activity', status: 'warn', weight: PENALTY.stale, detail: 'No successful transactions found for this mint.' });
  } else if (activity.lastTxAgeSec > 604800) {
    checks.push({ id: 'stale', label: 'Recent activity', status: 'warn', weight: PENALTY.stale, detail: `Last successful transaction was ${fmtAge(activity.lastTxAgeSec)} ago — the mint has gone quiet.` });
  } else {
    checks.push({ id: 'stale', label: 'Recent activity', status: 'pass', weight: 0, detail: `${activity.tx24h} successful tx in the last 24h, last one ${fmtAge(activity.lastTxAgeSec)} ago.` });
  }

  const penalty = checks.reduce((a, c) => a + (c.weight || 0), 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    mint, score, penalty, checks,
    verdict: score >= 85 ? 'SAFE' : score >= 60 ? 'CAUTION' : 'DANGER',
    holderCount: n, top1Pct, top10Pct,
    distribution: holders.slice(0, 12).map((h) => ({
      owner: h.owner, address: h.address, amount: h.amount, pct: pct(h.amount, totalRaw),
      isVault: vaultSet.has(h.address) || vaultSet.has(h.owner),
      amm: poolInfo.all.find((p) => p.vaultA === h.address || p.vaultB === h.address)?.dex || null,
    })),
    pools: poolInfo.all,
    bestPool: poolInfo.best,
    liquidityCook: liq,
    priceInCook: poolInfo.best?.priceInCook ?? null,
    activity, info, scannedAt: Date.now(),
  };
}

const pct = (a, total) => Number((a * 10000n) / total) / 100;

export async function scanToken(mintRaw, { registry } = {}) {
  const mint = (mintRaw || '').trim();
  if (!isValidPubkey(mint)) throw new Error('That is not a valid Cookie Chain (base58) token address.');

  const [info, reg] = await Promise.all([getMint(mint), registry ? Promise.resolve(registry) : getPoolRegistry()]);
  const poolInfo = poolsForMint(reg, mint);

  const [holders, activity] = await Promise.all([
    getAllHolders(mint).catch(() => []),
    getActivity(mint).catch(() => ({ sampled: 0, lastTxAt: null, lastTxAgeSec: null, tx24h: 0, tx7d: 0, failed: 0, signatures: [] })),
  ]);

  return buildReport({ mint, info, holders, poolInfo, activity, supplyRaw: info.supply });
}

/* ------------------------------------------------------------------ *
 * formatting
 * ------------------------------------------------------------------ */

export function short(k, n = 4) {
  if (!k) return '—';
  return `${k.slice(0, n)}…${k.slice(-4)}`;
}

export function fmtAge(sec) {
  if (sec === null || sec === undefined) return 'never';
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}

export function fmtNum(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  const n = Number(x);
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  if (n !== 0 && Math.abs(n) < 0.001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/** Memo payload written on chain when an audit is published. */
export function memoFor(report) {
  const failed = report.checks.filter((c) => c.status === 'fail').map((c) => c.id).join('+') || 'none';
  return `${MEMO_TAG}|${report.mint}|s${report.score}|${report.verdict}|h${report.holderCount}|f${failed}`;
}

export function parseMemo(memo) {
  if (typeof memo !== 'string' || !memo.startsWith(MEMO_TAG + '|')) return null;
  const p = memo.split('|');
  return {
    tag: p[0], mint: p[1], score: Number((p[2] || '').replace('s', '')),
    verdict: p[3], holders: Number((p[4] || '').replace('h', '')),
    failed: (p[5] || '').replace('f', ''),
  };
}
