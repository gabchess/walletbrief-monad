import { isAddress, type Address, type Hex } from "viem";

const EXPLORER = "https://monadvision.com";

export function addressExplorerUrl(address: Address | string): string {
  if (!isAddress(address)) throw new Error("Invalid Monad address.");
  return `${EXPLORER}/address/${address}`;
}

export function blockExplorerUrl(block: bigint | number): string {
  const value = typeof block === "bigint" ? block : BigInt(block);
  if (value < 0n) throw new Error("Invalid Monad block number.");
  return `${EXPLORER}/block/${value}`;
}

export function transactionExplorerUrl(hash: Hex | string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error("Invalid Monad transaction hash.");
  }
  return `${EXPLORER}/tx/${hash}`;
}
