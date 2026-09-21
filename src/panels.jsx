import React from 'react';
import {
  scanToken, getPoolRegistry, getNetworkStats, getTokenCensus,
  fmtNum, fmtAge, short, memoFor, EXPLORER, NATIVE_SYMBOL, WSOL,
} from './chain.js';
import { usePublish, useWalletBalance, fetchAttestations } from './wallet.jsx';
import {
  Gauge, ShareBars, ColumnChart, Donut, Legend, Stat, CheckRow, Addr, Copy,
} from './ui.jsx';

/* ================================================================== *
 *  AUDIT
 * ================================================================== */

const PRESETS_FALLBACK = [
  ['bCOOK', 'EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz'],
  ['COOKHOUSE', 'C4yVWDrwXeEUapmw3BkvktHBxCSsM8MfJ3aPVuFonFi5'],
  ['COTE', 'BDEFBNgzV5MzCnF4ccWNYbjy5g8wh5Y76T4xkWn1momo'],
  ['BURNT', '5N3Mtr1AhZUDx9nvkMv4kTV7kJHFgNyeLazKxWwcmomo'],
  ['CHAT', '2wPK38gv8dWU89K5zDAAULAihnU1sRocbpzwPP6twY7Q'],
  ['OMNOM', '9V6z4wiifv2BrCxd7rwBWBAaWS2dxSepWZmWjRpfQ66p'],
];

export function AuditPanel({ registry, refreshRegistry, auditReq }) {
  const [mint, setMint] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState('');
  const [report, setReport] = React.useState(null);
  const [error, setError] = React.useState(null);
  const { publish, state: txState, publicKey, connected } = usePublish();
  const balance = useWalletBalance();

  const runRef = React.useRef(null);
  React.useEffect(() => {
    if (auditReq?.mint) runRef.current?.(auditReq.mint);
  }, [auditReq?.n]);

  const presets = React.useMemo(() => {
    if (!registry?.pools?.length) return PRESETS_FALLBACK;
    const seen = new Map();
    for (const p of registry.pools) {
      if (!p.quoteMint || p.tokenMint === WSOL) continue;
      const prev = seen.get(p.tokenMint);
      if (!prev || (p.cookReserve || 0) > (prev.liq || 0)) seen.set(p.tokenMint, { mint: p.tokenMint, liq: p.cookReserve || 0 });
    }
    const top = [...seen.entries()].sort((a, b) => b[1].liq - a[1].liq).slice(0, 7)
      .map(([m, v]) => [short(m, 4), m]);
    return top.length >= 4 ? top : PRESETS_FALLBACK;
  }, [registry]);

  async function run(target) {
    const m = (target ?? mint).trim();
    if (!m) return;
    setMint(m); setBusy(true); setError(null); setReport(null);
    try {
      setStep('Reading mint account…');
      let reg = registry;
      if (!reg) { setStep('Indexing DEX pools…'); reg = await refreshRegistry(); }
      setStep('Resolving DEX pools & reserves…');
      setStep('Enumerating holders + activity…');
      const r = await scanToken(m, { registry: reg });
      setReport(r);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false); setStep('');
    }
  }

  const memo = report ? memoFor(report) : null;
  const lowBalance = connected && balance !== null && balance < 5000;
  runRef.current = run;

  return (
    <>
      <div className="card">
        <h2>Token safety audit</h2>
        <p className="sub">
          Paste any Cookie Chain token address. CookieGuard reads the mint account, every holder
          account, both live DEX programs and the pool vault balances straight from the chain —
          then scores rug risk on {registry?.count ?? '…'} indexed pools and live supply data.
        </p>
        <div className="search">
          <input type="text" value={mint} placeholder="Token mint address (base58)…"
            onChange={(e) => setMint(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <button className="btn" disabled={busy || !mint.trim()} onClick={() => run()}>
            {busy ? <><span className="spinner" /> Auditing…</> : 'Run audit'}
          </button>
        </div>
        <div className="chips">
          <span className="dim tiny" style={{ alignSelf: 'center' }}>Top pools:</span>
          {presets.map(([label, m]) => (
            <button key={m} className="chip" onClick={() => run(m)} title={m}><b>{label}</b></button>
          ))}
        </div>
        {busy && <p className="tiny muted mt"><span className="spinner" style={{ marginRight: 8 }} />{step}</p>}
        {error && <div className="errbox mt">{error}</div>}
      </div>

      {report && (
        <>
          <ReportCard report={report} />
          <div className="card">
            <h3>Publish this verdict on chain</h3>
            <p className="sub" style={{ marginBottom: 12 }}>
              Writes the result as a Memo-program transaction signed by your wallet — a permanent,
              timestamped attestation on Cookie Chain that anyone can verify, and the source of the
              live audit ledger in this app.
            </p>
            <div className="warnbox mb">
              <b>Memo payload</b> — <span className="mono">{memo}</span> <Copy text={memo} />
            </div>
            {!connected && <div className="warnbox mb">Connect a wallet (Nightly supported) to publish on chain.</div>}
            {lowBalance && (
              <div className="warnbox mb">
                This wallet holds {fmtNum(balance / 1e9, 6)} {NATIVE_SYMBOL}. The memo transaction needs a small
                network fee (~0.000005 {NATIVE_SYMBOL}) plus rent. Fund it first.
              </div>
            )}
            <button className="btn" disabled={!connected || txState?.status === 'confirming' || txState?.status === 'sending' || txState?.status === 'signing'}
              onClick={() => publish(memo)}>
              {txState?.status === 'signing' || txState?.status === 'sending' || txState?.status === 'confirming'
                ? <><span className="spinner" /> Publishing…</> : 'Sign & publish on chain'}
            </button>
            <TxStatus state={txState} />
          </div>
        </>
      )}
    </>
  );
}

export function TxStatus({ state }) {
  if (!state) return null;
  const cls = state.status === 'ok' ? 'ok' : state.status === 'err' ? 'err' : 'pending';
  const title = state.status === 'ok' ? 'Transaction confirmed'
    : state.status === 'err' ? 'Transaction failed'
      : state.status === 'signing' ? 'Awaiting signature'
        : state.status === 'sending' ? 'Broadcasting' : 'Confirming';
  return (
    <div className={`txbox ${cls}`}>
      <div className="ttl">
        {state.status === 'ok' ? '✓' : state.status === 'err' ? '✕' : <span className="spinner" />}
        {title}
      </div>
      <div className="body">{state.message}</div>
      {state.sig && (
        <div className="body">
          <a href={`${EXPLORER}/tx/${state.sig}`} target="_blank" rel="noreferrer">View on CookieScan ↗</a>
          <br /><span className="mono">{state.sig}</span> <Copy text={state.sig} label="copy sig" />
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }) {
  const r = report;
  const accent = r.verdict === 'SAFE' ? 'var(--green)' : r.verdict === 'CAUTION' ? 'var(--amber)' : 'var(--red)';
  return (
    <>
      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(200px, 240px) 1fr', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'grid', placeItems: 'center' }}>
            <Gauge score={r.score} verdict={r.verdict} />
          </div>
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <span className="pill" style={{ background: `${accent}22`, color: accent }}>{r.verdict}</span>
              <span className="pill neutral">risk penalty −{r.penalty}</span>
              <span className="pill neutral">{r.info.is2022 ? 'Token-2022' : 'SPL Token'}</span>
            </div>
            <div className="mono" style={{ fontSize: 12.5, wordBreak: 'break-all', marginBottom: 14 }}>
              <Addr value={r.mint} chars={8} />
            </div>
            <div className="grid g3">
              <Stat label="Holders" value={fmtNum(r.holderCount)} hint="funded token accounts" />
              <Stat label="Top insider" value={`${r.top1Pct.toFixed(2)}%`} hint="pool vaults excluded"
                accent={r.top1Pct > 50 ? 'var(--red)' : r.top1Pct > 25 ? 'var(--amber)' : 'var(--green)'} />
              <Stat label={`Liquidity (${NATIVE_SYMBOL})`} value={r.liquidityCook === null ? 'none' : fmtNum(r.liquidityCook)}
                hint={r.bestPool ? r.bestPool.dex : 'no COOK-quoted pool'} />
              <Stat label="Total supply" value={fmtNum(r.info.uiSupply, 3)} hint={`${r.info.decimals} decimals`} />
              <Stat label="Implied price" value={r.priceInCook ? `${r.priceInCook.toExponential(3)}` : '—'} hint={`${NATIVE_SYMBOL} per token`} />
              <Stat label="24h activity" value={`${r.activity.tx24h} tx`} hint={`last ${fmtAge(r.activity.lastTxAgeSec)} ago`} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>On-chain findings · {r.checks.length} checks</h3>
        {r.checks.map((c, i) => <CheckRow key={c.id + i} c={c} />)}
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>Top holders &amp; pool vaults</h3>
          <ShareBars items={r.distribution.map((d) => ({
            ...d,
            label: d.isVault ? `${d.amm || 'POOL'} vault` : d.owner ? short(d.owner, 6) : '—',
          }))} />
          <p className="tiny dim mt">Blue bars are AMM pool vaults holding the liquidity — they are excluded from concentration risk.</p>
        </div>
        <div className="card">
          <h3>Mint authorities</h3>
          <div className="grid" style={{ gap: 10 }}>
            <div className="between">
              <span className="muted tiny">Mint authority</span>
              {r.info.hasMintAuth
                ? <span className="pill fail">active — can inflate</span>
                : <span className="pill pass">revoked</span>}
            </div>
            {r.info.hasMintAuth && <div className="mono tiny dim">{r.info.mintAuthority}</div>}
            <div className="between">
              <span className="muted tiny">Freeze authority</span>
              {r.info.hasFreezeAuth
                ? <span className="pill fail">active — honeypot risk</span>
                : <span className="pill pass">revoked</span>}
            </div>
            {r.info.hasFreezeAuth && <div className="mono tiny dim">{r.info.freezeAuthority}</div>}
            <div className="between"><span className="muted tiny">Owner program</span><span className="mono tiny">{short(r.info.program, 6)}</span></div>
            <div className="between"><span className="muted tiny">Account rent</span><span className="mono tiny">{fmtNum(r.info.lamports / 1e9, 6)} {NATIVE_SYMBOL}</span></div>
          </div>
        </div>
      </div>

      {r.pools.length > 0 && (
        <div className="card">
          <h3>Liquidity pools referencing this mint ({r.pools.length})</h3>
          <div className="scroll">
            <table>
              <thead><tr>
                <th>DEX</th><th className="mono">Pool</th><th className="mono">Counterpart</th>
                <th className="num">COOK reserve</th><th className="num">Token reserve</th><th className="num">Price</th>
              </tr></thead>
              <tbody>
                {r.pools.map((p) => {
                  const other = p.tokenMint === p.mintA ? p.mintB : p.mintA;
                  return (
                    <tr key={p.pool}>
                      <td>{p.dex}</td>
                      <td className="mono"><Addr value={p.pool} chars={6} /></td>
                      <td className="mono">{other === WSOL ? 'COOK (wrapped)' : <Addr value={other} chars={5} />}</td>
                      <td className="num">{p.cookReserve === null ? '—' : fmtNum(p.cookReserve)}</td>
                      <td className="num">{p.tokenReserve === null ? '—' : fmtNum(p.tokenReserve)}</td>
                      <td className="num">{p.priceInCook ? p.priceInCook.toExponential(3) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

/* ================================================================== *
 *  POOLS (live liquidity analytics)
 * ================================================================== */

export function PoolsPanel({ registry, onAudit }) {
  const [sort, setSort] = React.useState('cookReserve');
  const [q, setQ] = React.useState('');

  const rows = React.useMemo(() => {
    if (!registry?.pools) return [];
    let r = registry.pools.filter((p) => p.quoteMint);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((p) => p.pool.toLowerCase().includes(s) || (p.tokenMint || '').toLowerCase().includes(s));
    }
    return [...r].sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
  }, [registry, sort, q]);

  const totCook = rows.reduce((a, p) => a + (p.cookReserve || 0), 0);
  const dexCounts = rows.reduce((a, p) => { a[p.dex] = (a[p.dex] || 0) + 1; return a; }, {});

  return (
    <>
      <div className="card">
        <h2>Live liquidity</h2>
        <p className="sub">
          Every pool on Cookie Chain's two live DEX programs, discovered by reading their pool-state
          accounts and priced from the actual vault token balances. Refreshed {fmtAge((Date.now() - (registry?.at || Date.now())) / 1000)} ago.
        </p>
        <div className="grid g4">
          <Stat label="Pools indexed" value={registry?.count ?? '—'} hint="on-chain state accounts" />
          <Stat label="COOK-quoted" value={rows.length} hint={Object.entries(dexCounts).map(([k, v]) => `${k}: ${v}`).join(' · ')} />
          <Stat label={`Total ${NATIVE_SYMBOL} locked`} value={fmtNum(totCook)} hint="sum of pool reserves" />
          <Stat label="Deepest pool" value={rows[0] ? fmtNum(rows[0].cookReserve) : '—'} hint={rows[0] ? rows[0].dex : ''} />
        </div>
      </div>
      <div className="card">
        <div className="between mb">
          <h3 style={{ margin: 0 }}>Pool registry</h3>
          <div className="row">
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter pool / mint…" style={{ flex: '0 0 260px', padding: '8px 11px', fontSize: 12 }} />
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              style={{ background: 'var(--bg-2)', color: 'var(--text)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5 }}>
              <option value="cookReserve">Sort: COOK reserve</option>
              <option value="tokenReserve">Sort: token reserve</option>
              <option value="priceInCook">Sort: price</option>
            </select>
          </div>
        </div>
        <div className="scroll">
          <table>
            <thead><tr>
              <th>#</th><th>DEX</th><th className="mono">Pool</th><th className="mono">Token mint</th>
              <th className="num">COOK reserve</th><th className="num">Token reserve</th><th className="num">Price (COOK)</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.pool}>
                  <td className="dim">{i + 1}</td>
                  <td>{p.dex}</td>
                  <td className="mono"><Addr value={p.pool} chars={5} /></td>
                  <td className="mono"><Addr value={p.tokenMint} chars={5} /></td>
                  <td className="num">{fmtNum(p.cookReserve)}</td>
                  <td className="num">{fmtNum(p.tokenReserve)}</td>
                  <td className="num">{p.priceInCook ? p.priceInCook.toExponential(3) : '—'}</td>
                  <td><button className="btn ghost sm" onClick={() => onAudit(p.tokenMint)}>audit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ================================================================== *
 *  CENSUS (chain-wide analytics)
 * ================================================================== */

export function CensusPanel({ census, network, loading, onReload }) {
  if (loading && !census) return <div className="card"><span className="spinner" /> Reading every token mint on Cookie Chain…</div>;
  if (!census) return <div className="card"><button className="btn" onClick={onReload}>Load chain census</button></div>;

  const authSegments = [
    { label: 'Mint + freeze open', value: census.total - census.revokedMintAuth - (census.total - census.freezeOpen) + 0, color: 'var(--red)' },
  ];
  // explicit, mutually exclusive buckets
  const bothBad = census.tokens.filter((t) => t.hasMintAuth && t.hasFreezeAuth).length;
  const mintOnly = census.tokens.filter((t) => t.hasMintAuth && !t.hasFreezeAuth).length;
  const freezeOnly = census.tokens.filter((t) => !t.hasMintAuth && t.hasFreezeAuth).length;
  const clean = census.fullyRenounced;
  const pctOf = (v) => ((v / census.total) * 100).toFixed(1);

  return (
    <>
      <div className="card">
        <div className="between">
          <div>
            <h2>Cookie Chain token census</h2>
            <p className="sub" style={{ marginBottom: 0 }}>
              Every SPL mint on the network, enumerated in one <span className="mono">getProgramAccounts</span> call
              and parsed account-by-account. No indexer, no API key — straight off the RPC.
            </p>
          </div>
          <button className="btn ghost sm" onClick={onReload}>refresh</button>
        </div>
      </div>

      <div className="grid g4">
        <Stat label="Tokens discovered" value={fmtNum(census.total, 0)} hint="SPL mint accounts" />
        <Stat label="Live supply" value={fmtNum(census.live, 0)} hint={`${fmtNum(census.dead, 0)} with zero supply`} />
        <Stat label="Mint authority revoked" value={fmtNum(census.revokedMintAuth, 0)} hint={`${pctOf(census.revokedMintAuth)}% of all tokens`} accent="var(--green)" />
        <Stat label="Fully renounced" value={fmtNum(census.fullyRenounced, 0)} hint="mint + freeze both revoked" accent="var(--green)" />
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h3>Authority safety across the chain</h3>
          <div className="row" style={{ gap: 26, alignItems: 'center' }}>
            <Donut size={168} label={`${pctOf(census.fullyRenounced)}%`} sub="fully renounced"
              segments={[
                { label: 'Both open', value: bothBad, color: 'var(--red)' },
                { label: 'Mint open', value: mintOnly, color: 'var(--amber-2)' },
                { label: 'Freeze open', value: freezeOnly, color: 'var(--amber)' },
                { label: 'Renounced', value: clean, color: 'var(--green)' },
              ]} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <Legend items={[
                { label: 'Mint + freeze both live', value: fmtNum(bothBad, 0), pct: pctOf(bothBad), color: 'var(--red)' },
                { label: 'Mint authority live', value: fmtNum(mintOnly, 0), pct: pctOf(mintOnly), color: 'var(--amber-2)' },
                { label: 'Freeze authority live', value: fmtNum(freezeOnly, 0), pct: pctOf(freezeOnly), color: 'var(--amber)' },
                { label: 'Fully renounced', value: fmtNum(clean, 0), pct: pctOf(clean), color: 'var(--green)' },
              ]} />
            </div>
          </div>
          <p className="tiny dim mt">
            A live mint authority means the issuer can print unlimited new supply; a live freeze authority
            means they can freeze your token account. Only {pctOf(census.fullyRenounced)}% of Cookie Chain
            tokens have surrendered both.
          </p>
        </div>

        <div className="card">
          <h3>Supply distribution (live tokens)</h3>
          <ColumnChart data={census.supplyBuckets} height={165} />
          <h3 className="mt">Decimals in use</h3>
          <ColumnChart data={census.decimalsHistogram.filter((d) => d.count > 0)} height={120} color="var(--blue)" />
        </div>
      </div>

      {network && (
        <div className="card">
          <h3>Network health</h3>
          <div className="grid g4">
            <Stat label="Slot" value={fmtNum(network.slot, 0)} hint={`block height ${fmtNum(network.blockHeight, 0)}`} />
            <Stat label="Epoch" value={network.epoch} hint={`${network.epochProgress.toFixed(1)}% through`} />
            <Stat label="Transactions" value={fmtNum(network.transactionCount, 0)} hint="all time" />
            <Stat label="Throughput" value={network.tps ? `${network.tps.toFixed(1)}` : '—'} hint="tx/sec (recent samples)" />
            <Stat label="Circulating" value={fmtNum(network.circulating, 0)} hint={NATIVE_SYMBOL} />
            <Stat label="Total supply" value={fmtNum(network.total, 0)} hint={NATIVE_SYMBOL} />
            <Stat label="Rent (token acct)" value={`${fmtNum((network.rent165 || 0) / 1e9, 6)}`} hint={NATIVE_SYMBOL} />
            <Stat label="Epoch progress" value={`${network.epochProgress.toFixed(1)}%`} hint={`${network.slotIndex.toLocaleString()} / ${network.slotsInEpoch.toLocaleString()}`} />
          </div>
          <ColumnChart height={130} color="var(--green)"
            data={[{ key: 'done', label: 'elapsed', count: network.slotIndex }, { key: 'left', label: 'remaining', count: network.slotsInEpoch - network.slotIndex }]} />
        </div>
      )}

      <div className="card">
        <h3>Largest live tokens by supply</h3>
        <div className="scroll">
          <table>
            <thead><tr><th>#</th><th className="mono">Mint</th><th className="num">UI supply</th><th className="num">Decimals</th><th>Mint auth</th><th>Freeze auth</th><th></th></tr></thead>
            <tbody>
              {census.topBySupply.map((t, i) => (
                <tr key={t.mint}>
                  <td className="dim">{i + 1}</td>
                  <td className="mono"><Addr value={t.mint} chars={6} /></td>
                  <td className="num">{fmtNum(t.uiSupply, 3)}</td>
                  <td className="num">{t.decimals}</td>
                  <td>{t.hasMintAuth ? <span className="pill fail">live</span> : <span className="pill pass">revoked</span>}</td>
                  <td>{t.hasFreezeAuth ? <span className="pill warn">live</span> : <span className="pill pass">revoked</span>}</td>
                  <td><button className="btn ghost sm" onClick={() => onAudit(t.mint)}>audit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ================================================================== *
 *  LEDGER (on-chain attestations)
 * ================================================================== */

export function LedgerPanel({ publicKey, connected, onAudit }) {
  const [rows, setRows] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!publicKey) return;
    setLoading(true); setErr(null);
    try {
      setRows(await fetchAttestations(publicKey.toBase58()));
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setLoading(false); }
  }, [publicKey]);

  React.useEffect(() => { load(); }, [load]);

  if (!connected) {
    return (
      <div className="card">
        <h2>On-chain audit ledger</h2>
        <p className="sub">
          Connect a wallet to read back its published audit attestations from Cookie Chain. Every
          audit you publish is a real Memo transaction — this view decodes them straight from the
          chain, so the app's activity log <i>is</i> chain state, not a database.
        </p>
      </div>
    );
  }

  const unique = rows ? new Set(rows.map((r) => r.mint)).size : 0;
  const avg = rows?.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : null;
  const dangerous = rows ? rows.filter((r) => r.verdict === 'DANGER').length : 0;
  const byVerdict = rows ? rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {}) : {};

  return (
    <>
      <div className="card">
        <div className="between">
          <div>
            <h2>On-chain audit ledger</h2>
            <p className="sub" style={{ marginBottom: 0 }}>
              Attestations published by <span className="mono">{short(publicKey.toBase58(), 6)}</span>, decoded live
              from Memo-program transactions.
            </p>
          </div>
          <button className="btn ghost sm" onClick={load} disabled={loading}>{loading ? 'reading…' : 'refresh'}</button>
        </div>
      </div>

      {err && <div className="errbox">{err}</div>}

      <div className="grid g4">
        <Stat label="Attestations" value={rows ? rows.length : '—'} hint="memo txs from this wallet" />
        <Stat label="Tokens covered" value={rows ? unique : '—'} hint="unique mints audited" />
        <Stat label="Mean score" value={avg ?? '—'} hint="across published audits" accent={avg === null ? undefined : avg >= 85 ? 'var(--green)' : avg >= 60 ? 'var(--amber)' : 'var(--red)'} />
        <Stat label="Flagged DANGER" value={dangerous} hint="published high-risk verdicts" accent={dangerous ? 'var(--red)' : undefined} />
      </div>

      {rows && rows.length > 0 && (
        <div className="card mt">
          <h3>Verdict distribution</h3>
          <ColumnChart height={140} data={['SAFE', 'CAUTION', 'DANGER'].map((v) => ({ key: v, label: v, count: byVerdict[v] || 0 }))} />
        </div>
      )}

      <div className="card">
        <h3>Attestation history</h3>
        {loading && !rows && <p className="tiny muted"><span className="spinner" /> scanning signature history…</p>}
        {rows && rows.length === 0 && (
          <p className="sub" style={{ marginBottom: 0 }}>
            No audit attestations from this wallet yet. Run an audit and hit
            “Sign &amp; publish on chain” — it will show up here, read back from the chain.
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr>
                <th>When</th><th className="mono">Token</th><th className="num">Score</th><th>Verdict</th>
                <th className="num">Holders</th><th>Failed checks</th><th className="mono">Tx</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.signature}>
                    <td className="dim">{r.blockTime ? fmtAge(Math.floor(Date.now() / 1000) - r.blockTime) + ' ago' : '—'}</td>
                    <td className="mono"><Addr value={r.mint} chars={5} /></td>
                    <td className="num" style={{ fontWeight: 600 }}>{r.score}</td>
                    <td><span className={`pill ${r.verdict === 'SAFE' ? 'pass' : r.verdict === 'CAUTION' ? 'warn' : 'fail'}`}>{r.verdict}</span></td>
                    <td className="num">{r.holders}</td>
                    <td className="tiny dim">{r.failed === 'none' ? '—' : r.failed}</td>
                    <td className="mono"><a href={`${EXPLORER}/tx/${r.signature}`} target="_blank" rel="noreferrer">{short(r.signature, 4)}</a></td>
                    <td><button className="btn ghost sm" onClick={() => onAudit(r.mint)}>re-audit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
