// Verification harness — runs the real risk engine against live Cookie Chain data.
import { scanToken, getTokenCensus, getNetworkStats, getPoolRegistry } from '../src/chain.js';

const MINTS = process.argv.slice(2).length ? process.argv.slice(2) : [
  'EkPafx58mgwkEnGwo62jXhXDAdJ37Z8G8MFBRPsr9uhz', // bCOOK (LST)
  'BDEFBNgzV5MzCnF4ccWNYbjy5g8wh5Y76T4xkWn1momo', // COTE
  '5N3Mtr1AhZUDx9nvkMv4kTV7kJHFgNyeLazKxWwcmomo', // BURNT
];

const t0 = Date.now();
const net = await getNetworkStats();
console.log(`NETWORK: slot=${net.slot} epoch=${net.epoch} (${net.epochProgress.toFixed(1)}%) txs=${net.transactionCount} tps=${net.tps?.toFixed(1)} circ=${net.circulating?.toFixed(0)} COOK  [${Date.now() - t0}ms]\n`);

const p0 = Date.now();
const reg = await getPoolRegistry({ force: true });
console.log(`POOLS: ${reg.count} live pools on ${[...new Set(reg.pools.map((p) => p.dex))].join(' + ')}  [${Date.now() - p0}ms]`);
const top = [...reg.pools].filter((p) => p.cookReserve !== null).sort((a, b) => b.cookReserve - a.cookReserve).slice(0, 5);
for (const p of top) console.log(`   ${p.dex} ${p.pool.slice(0, 8)}… ${p.tokenMint.slice(0, 8)}… COOK=${p.cookReserve.toFixed(2)} tokens=${p.tokenReserve.toFixed(2)} price=${p.priceInCook?.toExponential(3)}`);
console.log('');

for (const m of MINTS) {
  const t = Date.now();
  try {
    const r = await scanToken(m, { registry: reg });
    console.log(`=== ${m} — score ${r.score}/100 ${r.verdict}  (${Date.now() - t}ms)`);
    console.log(`    supply=${r.info.uiSupply} dec=${r.info.decimals} holders=${r.holderCount} top1=${r.top1Pct.toFixed(2)}% top10=${r.top10Pct.toFixed(2)}% liq=${r.liquidityCook === null ? 'none' : r.liquidityCook.toFixed(2)} COOK`);
    console.log(`    pools: ${r.pools.map((p) => `${p.dex}:${p.pool.slice(0, 6)}`).join(', ') || 'NONE'}`);
    console.log(`    distribution top5: ${r.distribution.slice(0, 5).map((d) => `${d.pct.toFixed(1)}%${d.isVault ? '[VAULT]' : ''}`).join(' ')}`);
    for (const c of r.checks) console.log(`      [${c.status.toUpperCase().padEnd(4)}] -${String(c.weight).padStart(2)} ${c.label}: ${c.detail}`);
    console.log('');
  } catch (e) {
    console.log(`=== ${m} FAILED: ${e.message}\n`);
  }
}

const c0 = Date.now();
const census = await getTokenCensus();
console.log(`CENSUS (${Date.now() - c0}ms): ${census.total} mints, live=${census.live} dead=${census.dead} revokedMintAuth=${census.revokedMintAuth} freezeOpen=${census.freezeOpen} fullyRenounced=${census.fullyRenounced}`);
console.log('supply buckets:', census.supplyBuckets.map((b) => `${b.label}=${b.count}`).join(' '));
