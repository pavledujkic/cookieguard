import React from 'react';
import { getPoolRegistry, getNetworkStats, getTokenCensus, fmtNum, NATIVE_SYMBOL, RPC_URL, CHAIN_NAME } from './chain.js';
import { AuditPanel, PoolsPanel, CensusPanel, LedgerPanel } from './panels.jsx';
import { ConnectButton, WalletProviders, useWalletBalance } from './wallet.jsx';
import { useWallet } from '@solana/wallet-adapter-react';

function TopBar({ network, walletOpen }) {
  const balance = useWalletBalance();
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">🍪</div>
        <div>
          <h1>CookieGuard</h1>
          <p>On-chain token safety for {CHAIN_NAME}</p>
        </div>
      </div>
      <div className="netstats">
        <div className="netstat">
          <b><span className="live-dot" />{network ? fmtNum(network.slot, 0) : '—'}</b>
          <span>Slot</span>
        </div>
        <div className="netstat">
          <b>{network ? network.epoch : '—'}</b>
          <span>Epoch</span>
        </div>
        <div className="netstat">
          <b>{network ? `${network.epochProgress.toFixed(1)}%` : '—'}</b>
          <span>Epoch done</span>
        </div>
        <div className="netstat">
          <b>{network?.tps ? network.tps.toFixed(1) : '—'}</b>
          <span>Tps</span>
        </div>
        {balance !== null && (
          <div className="netstat">
            <b>{fmtNum(balance / 1e9, 4)}</b>
            <span>{NATIVE_SYMBOL}</span>
          </div>
        )}
      </div>
      {walletOpen && <ConnectButton />}
    </div>
  );
}

function Shell() {
  const [tab, setTab] = React.useState('audit');
  const [registry, setRegistry] = React.useState(null);
  const [network, setNetwork] = React.useState(null);
  const [census, setCensus] = React.useState(null);
  const [censusLoading, setCensusLoading] = React.useState(false);
  const [bootErr, setBootErr] = React.useState(null);
  const [auditReq, setAuditReq] = React.useState(null);

  const loadRegistry = React.useCallback(async (force = false) => {
    const r = await getPoolRegistry({ force });
    setRegistry(r);
    return r;
  }, []);

  const loadCensus = React.useCallback(async () => {
    setCensusLoading(true);
    try { setCensus(await getTokenCensus()); }
    catch (e) { setBootErr(e.message); }
    finally { setCensusLoading(false); }
  }, []);

  React.useEffect(() => {
    let alive = true;
    loadRegistry().catch((e) => alive && setBootErr(e.message));
    const net = () => getNetworkStats().then((n) => alive && setNetwork(n)).catch(() => {});
    net();
    const id = setInterval(net, 12000);
    // pool reserves drift: refresh cache every 2 minutes
    const pid = setInterval(() => loadRegistry(true).catch(() => {}), 120000);
    const cid = setTimeout(() => { loadCensus().catch(() => {}); }, 400);
    return () => { alive = false; clearInterval(id); clearInterval(pid); clearTimeout(cid); };
  }, [loadRegistry, loadCensus]);

  const onAudit = React.useCallback((mint) => {
    setAuditReq({ mint, n: Date.now() });
    setTab('audit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const tabs = [
    ['audit', 'Audit'],
    ['pools', 'Liquidity', registry?.count],
    ['census', 'Chain census', census?.total],
    ['ledger', 'On-chain ledger'],
  ];

  return (
    <div className="shell">
      <TopBar network={network} walletOpen />
      {bootErr && <div className="errbox mb">RPC error: {bootErr} — the Cookie Chain RPC ({RPC_URL}) may be briefly unreachable. Retrying automatically.</div>}

      <div className="tabs">
        {tabs.map(([k, label, n]) => (
          <button key={k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {label}{n ? <span className="n">{fmtNum(n, 0)}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'audit' && <AuditPanel registry={registry} refreshRegistry={() => loadRegistry(true)} auditReq={auditReq} />}
      {tab === 'pools' && <PoolsPanel registry={registry} onAudit={onAudit} />}
      {tab === 'census' && <CensusPanel census={census} network={network} loading={censusLoading} onReload={loadCensus} onAudit={onAudit} />}
      {tab === 'ledger' && <LedgerPanelProxy onAudit={onAudit} />}

      <div className="footer">
        <span>
          CookieGuard · reads {RPC_URL} directly from your browser · pools from CookieDEX + Cookieswap BAMM state ·
          verdicts published as Memo transactions
        </span>
        <span>{CHAIN_NAME} · {NATIVE_SYMBOL}</span>
      </div>
    </div>
  );
}

function LedgerPanelProxy({ onAudit }) {
  const { publicKey, connected } = useWallet();
  return <LedgerPanel publicKey={publicKey} connected={connected} onAudit={onAudit} />;
}

export default function App() {
  return (
    <WalletProviders>
      <Shell />
    </WalletProviders>
  );
}
