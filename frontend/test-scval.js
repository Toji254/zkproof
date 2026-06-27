import { nativeToScVal, xdr } from '@stellar/stellar-sdk';

try {
  console.log("Testing nativeToScVal with address:");
  const addr = nativeToScVal("GBW6HMK3Y4X45XZ5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5", { type: "address" });
  console.log("Address OK");

  console.log("Testing nativeToScVal with bytes:");
  const bytes = nativeToScVal(new Uint8Array(32), { type: "bytes" });
  console.log("Bytes OK");

  console.log("Testing nativeToScVal with symbol:");
  const sym = nativeToScVal("income", { type: "symbol" });
  console.log("Symbol OK");

  console.log("Testing nativeToScVal with i128 (BigInt):");
  const i128Val = nativeToScVal(3000n, { type: "i128" });
  console.log("i128 BigInt OK:", i128Val);

} catch (err) {
  console.error("Error caught:", err);
}
