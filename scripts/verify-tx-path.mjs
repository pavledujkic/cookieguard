// Structural + behavioural validation of CookieGuard's on-chain write path,
// executed against the live Cookie Chain RPC.
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import { MEMO_PROGRAM, parseMemo, memoFor } from "../src/chain.js";

const RPC = "https://rpc.cookiescan.io";
const conn = new Connection(RPC, "confirmed");

console.log("=== A. Transaction construction (exact CookieGuard pattern) ===");
const payer = Keypair.generate(); // unfunded: used only to validate the message
const report = {
  mint: "5N3Mtr1AhZUDx9nvkMv4kTV7kJHFgNyeLazKxWwcmomo",
  score: 79,
  verdict: "CAUTION",
  holderCount: 21,
  checks: [{ status: "fail" }, { status: "pass" }],
};
const memo = memoFor(report);
console.log("memo payload:", memo);

const ix = new TransactionInstruction({
  keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
  programId: new PublicKey(MEMO_PROGRAM),
  data: new TextEncoder().encode(memo),
});
const tx = new Transaction().add(ix);
tx.feePayer = payer.publicKey;
const bh = await conn.getLatestBlockhash("confirmed");
tx.recentBlockhash = bh.blockhash;
console.log("blockhash:", bh.blockhash, "lastValidBlockHeight:", bh.lastValidBlockHeight);

// serialize exactly as the wallet would sign
const msg = tx.compileMessage();
const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
console.log("serialized bytes:", serialized.length, "(legacy tx, unsigned)");
console.log("instruction count:", msg.instructions.length, "| program:", msg.instructions[0].programIdIndex, "| accountKeys:", msg.accountKeys.length);
console.log("accountKeys:", msg.accountKeys.map((k) => k.toBase58()).join(", "));

console.log("\n=== B. RPC accepts the message (getFeeForMessage) ===");
const fee = await conn.getFeeForMessage(msg, "confirmed");
console.log("fee response:", JSON.stringify(fee));
if (fee.value !== null && fee.value !== undefined) {
  console.log("VERDICT: chain PARSED the message and priced it ->", fee.value, "lamports. Message is well-formed.");
} else {
  console.log("VERDICT: chain returned null fee -> message rejected.");
}

console.log("\n=== C. simulateTransaction (expect only a funding error) ===");
const sim = await conn.simulateTransaction(tx);
console.log("err:", JSON.stringify(sim.value.err));
console.log("logs:", JSON.stringify(sim.value.logs));
const onlyFundingIssue =
  sim.value.err &&
  JSON.stringify(sim.value.err).includes("AccountNotFound") ||
  (sim.value.logs || []).some((l) => /insufficient|AccountNotFound|not found/i.test(l));
console.log("VERDICT:", onlyFundingIssue ? "ONLY a funding/account look-up issue -> memo instruction itself is valid." : "unexpected error shape -> inspect.");

console.log("\n=== D. parseMemo() against REAL memos on Cookie Chain ===");
const sigs = await conn.getSignaturesForAddress(new PublicKey(MEMO_PROGRAM), { limit: 1000 }, "confirmed");
const withMemo = sigs.filter((s) => typeof s.memo === "string");
console.log(`fetched ${sigs.length} memo-program signatures, ${withMemo.length} carry an inline memo`);
const real = withMemo.slice(0, 5).map((s) => s.memo);
for (const m of real) console.log("  real memo:", JSON.stringify(m.slice(0, 90)), "-> parseMemo:", parseMemo(m) === null ? "null (correctly ignored)" : "PARSED");

// inject a genuine CGUARD1 row to prove the decoder handles the app's own format
console.log("\n  decoder check on the app's own format:");
const decoded = parseMemo(memo);
console.log("  ", JSON.stringify(decoded));

console.log("\n=== E. Does Cookie Chain confirm memos? (historical proof) ===");
const sample = withMemo.find((s) => !s.err);
const txHist = await conn.getParsedTransaction(sample.signature, { maxSupportedTransactionVersion: 0 });
console.log("sample memo tx:", sample.signature);
console.log("  confirmed at slot:", txHist?.slot, "| blockTime:", new Date((txHist?.blockTime || 0) * 1000).toISOString());
console.log("  memo instruction seen:", JSON.stringify(txHist?.transaction?.message?.instructions?.map((i) => i.parsed).filter(Boolean)?.[0] || null).slice(0, 160));
console.log("\nALL CHECKS COMPLETE.");
