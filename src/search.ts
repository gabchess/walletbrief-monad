import { getAddress, isAddress, type Address } from "viem";

export function parseSearchAddress(value: string): Address {
  const candidate = value.trim();
  if (!isAddress(candidate)) {
    throw new Error("Enter a valid 0x wallet address.");
  }
  return getAddress(candidate);
}
