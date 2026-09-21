// Verify the app's attestation transaction against the LIVE Cookie Chain:
// build the exact instruction the UI builds, then simulate it on real chain state.
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import fs from 'node:fs';

const RPC = 'https://rpc.cookiescan.io';
const MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const conn = new Connection(RPC, 'confirmed');

const w = JSON.parse(fs.readFileSync('/root/.hermes/profiles/coin/workspace/vault/cookiechain_wallet.json', 'utf8'));
const payer = new PublicKey(w.address);
console.log('fee payer:', payer.toBase58());

// exactly what memoFor(report) yields in src/chain.js
const mint = 'BDEFBNgzV5MzCnF4ccWNYbjy5g8wh5Y76T4xkWn1momo';
const memo = `CGUARD1|${mint}|s66|CAUTION|h24|ftop1`;
console.log('memo payload:', memo);

const ix = new TransactionInstruction({
  keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
  programId: new PublicKey(MEMO),
  data: new TextEncoder().encode(memo),
});
const tx = new Transaction().add(ix);
tx.feePayer = payer;
const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
tx.recentBlockhash = blockhash;

console.log('\n--- simulate on live chain (sigVerify off, real blockhash) ---');
const sim = await conn.simulateTransaction(tx, undefined, false);
console.log('err:', JSON.stringify(sim.value.err));
console.log('unitsConsumed:', sim.value.unitsConsumed);
console.log('logs:');
for (const l of sim.value.logs || []) console.log('   ', l);

console.log('\n--- what the fee would be ---');
console.log('blockhash:', blockhash, 'lastValidBlockHeight:', lastValidBlockHeight);
const fee = await conn.getFeeForMessage(tx.compileMessage(), 'confirmed');
console.log('fee (lamports):', fee.value, '=', fee.value === null ? 'n/a' : `${fee.value / 1e9} COOK`);
const bal = await conn.getBalance(payer);
console.log('wallet balance now (lamports):', bal);

// Also prove the attestation reader decodes real memos that already exist on chain.
console.log('\n--- attestation reader sanity: scan recent memo txs on chain ---');
const recent = await conn.getSignaturesForAddress(new PublicKey(MEMO), { limit: 8 });
let decoded = 0, checked = 0;
for (const s of recent) {
  const t = await conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null);
  if (!t) continue;
  checked++;
  for (const i of t.transaction.message.instructions) {
    if (typeof i.parsed === 'string' && i.parsed.startsWith('CGUARD1|')) decoded++;
  }
}
console.log(`scanned ${checked} recent Memo-program txs, found ${decoded} CookieGuard attestations (expected 0 before first publish)`);
