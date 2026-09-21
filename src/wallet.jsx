import React from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { NightlyWalletAdapter } from '@solana/wallet-adapter-nightly';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { RPC_URL, MEMO_PROGRAM, parseMemo } from './chain.js';

export const connection = new Connection(RPC_URL, 'confirmed');

/** Nightly is first-class here; Phantom/Solflare are added for breadth. */
function useAdapters() {
  return React.useMemo(() => [
    new NightlyWalletAdapter(),
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);
}

export function WalletProviders({ children }) {
  const adapters = useAdapters();
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={adapters} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function ConnectButton() {
  return <WalletMultiButton />;
}

/* ------------------------------------------------------------------ *
 * real transaction: publish an audit verdict on chain as a memo
 * ------------------------------------------------------------------ */

export function usePublish() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const [state, setState] = React.useState(null); // {status, sig, message, memo}

  const publish = React.useCallback(async (memo) => {
    if (!publicKey) throw new Error('Connect a wallet first.');
    setState({ status: 'signing', memo, message: 'Waiting for wallet signature…' });
    try {
      const ix = new TransactionInstruction({
        keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
        programId: new PublicKey(MEMO_PROGRAM),
        data: new TextEncoder().encode(memo),
      });
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;

      setState({ status: 'sending', memo, message: 'Broadcasting to Cookie Chain…' });
      const sig = await sendTransaction(tx, connection, { skipPreflight: false });
      setState({ status: 'confirming', sig, memo, message: 'Submitted — waiting for confirmation…' });

      const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      if (conf.value?.err) throw new Error(`Transaction failed on chain: ${JSON.stringify(conf.value.err)}`);

      setState({ status: 'ok', sig, memo, message: 'Confirmed on Cookie Chain.' });
      return sig;
    } catch (e) {
      const msg = e?.message || String(e);
      setState({ status: 'err', memo, message: msg });
      throw e;
    }
  }, [publicKey, sendTransaction]);

  return { publish, state, reset: () => setState(null), connected, publicKey };
}

export async function getBalance(pubkey) {
  try { return await connection.getBalance(new PublicKey(pubkey)); } catch { return null; }
}

/** Live native balance of the connected wallet (lamports), refreshed on demand. */
export function useWalletBalance() {
  const { publicKey } = useWallet();
  const [bal, setBal] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    if (!publicKey) { setBal(null); return () => {}; }
    const tick = () => getBalance(publicKey).then((b) => { if (alive) setBal(b); });
    tick();
    const id = setInterval(tick, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [publicKey]);
  return bal;
}

/* ------------------------------------------------------------------ *
 * on-chain attestation ledger for the connected wallet
 * ------------------------------------------------------------------ */

export async function fetchAttestations(pubkey, limit = 60) {
  const sigs = await connection.getSignaturesForAddress(new PublicKey(pubkey), { limit });
  const rows = [];
  // fetch in small parallel batches to stay responsive
  for (let i = 0; i < sigs.length; i += 8) {
    const batch = sigs.slice(i, i + 8);
    const txs = await Promise.all(batch.map((s) =>
      connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null)));
    txs.forEach((tx, j) => {
      const s = batch[j];
      if (!tx) return;
      const ixs = tx.transaction?.message?.instructions || [];
      for (const ix of ixs) {
        const parsed = typeof ix.parsed === 'string' ? ix.parsed : null;
        const att = parsed ? parseMemo(parsed) : null;
        if (att) {
          rows.push({ ...att, signature: s.signature, blockTime: s.blockTime, slot: s.slot });
        }
      }
    });
  }
  return rows;
}
