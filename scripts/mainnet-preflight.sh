#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

RPC_URL="${MONAD_RPC_URL:-https://rpc.monad.xyz}"
RPC_URL_2="${MONAD_RPC_URL_2:-https://rpc3.monad.xyz}"
DEPLOYER="0x35160A4238CB5F3166046399c397B6E0c12FD872"
WMON="0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"
EXPECTED_CHAIN_ID="143"
GAS_ESTIMATE_MULTIPLIER="110"
RESERVE_WEI="10000000000000000000"

: "${KEYCHAIN_SERVICE:?Set KEYCHAIN_SERVICE to the local macOS Keychain service name.}"
: "${KEYCHAIN_ACCOUNT:?Set KEYCHAIN_ACCOUNT to the local macOS Keychain account name.}"

for tool in cast forge jq node security; do
  command -v "$tool" >/dev/null || {
    printf 'Missing required tool: %s\n' "$tool" >&2
    exit 1
  }
done

format_mon() {
  node -e '
    const value = BigInt(process.argv[1]);
    const unit = 10n ** 18n;
    const whole = value / unit;
    const fraction = (value % unit).toString().padStart(18, "0").replace(/0+$/, "");
    console.log(fraction ? `${whole}.${fraction}` : `${whole}`);
  ' "$1"
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

chain_id_1="$(cast chain-id --rpc-url "$RPC_URL")"
chain_id_2="$(cast chain-id --rpc-url "$RPC_URL_2")"
if [[ "$chain_id_1" != "$EXPECTED_CHAIN_ID" || "$chain_id_2" != "$EXPECTED_CHAIN_ID" ]]; then
  printf 'Chain ID mismatch: %s / %s\n' "$chain_id_1" "$chain_id_2" >&2
  exit 1
fi

key="$(security find-generic-password -s "$KEYCHAIN_SERVICE" -a "$KEYCHAIN_ACCOUNT" -w)"
trap 'unset key || true' EXIT
derived_address="$(cast wallet address --private-key "$key")"
unset key
if [[ "$(lowercase "$derived_address")" != "$(lowercase "$DEPLOYER")" ]]; then
  printf 'Keychain address mismatch: expected %s, got %s\n' "$DEPLOYER" "$derived_address" >&2
  exit 1
fi

balance_1="$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL")"
balance_2="$(cast balance "$DEPLOYER" --rpc-url "$RPC_URL_2")"
nonce_1="$(cast nonce "$DEPLOYER" --rpc-url "$RPC_URL")"
nonce_2="$(cast nonce "$DEPLOYER" --rpc-url "$RPC_URL_2")"
wallet_code_1="$(cast code "$DEPLOYER" --rpc-url "$RPC_URL")"
wallet_code_2="$(cast code "$DEPLOYER" --rpc-url "$RPC_URL_2")"

if [[ "$balance_1" != "$balance_2" || "$nonce_1" != "$nonce_2" ]]; then
  printf 'Independent RPCs disagree on deployer balance or nonce.\n' >&2
  exit 1
fi
if [[ "$wallet_code_1" != "0x" || "$wallet_code_2" != "0x" ]]; then
  printf 'Deployer already has EIP-7702 code; stop and review before deploying.\n' >&2
  exit 1
fi

wmon_code_1="$(cast code "$WMON" --rpc-url "$RPC_URL")"
wmon_code_2="$(cast code "$WMON" --rpc-url "$RPC_URL_2")"
if [[ "$wmon_code_1" == "0x" || "$wmon_code_1" != "$wmon_code_2" ]]; then
  printf 'Independent RPCs disagree on canonical WMON code.\n' >&2
  exit 1
fi
wmon_code_hash="$(printf '%s' "$wmon_code_1" | cast keccak)"

base_fee="$(cast to-dec "$(cast block latest --field baseFeePerGas --rpc-url "$RPC_URL")")"
priority_fee="$(cast to-dec "$(cast rpc --rpc-url "$RPC_URL" eth_maxPriorityFeePerGas | jq -r '.')")"
max_fee_per_gas="$(node -e 'console.log((2n * BigInt(process.argv[1]) + BigInt(process.argv[2])).toString())' "$base_fee" "$priority_fee")"

forge clean --root "$CONTRACTS_DIR"
forge build --root "$CONTRACTS_DIR" --sizes >/dev/null

artifact="$CONTRACTS_DIR/out/BatchExecutor.sol/BatchExecutor.json"
creation_hash="$(jq -r '.bytecode.object' "$artifact" | cast keccak)"
runtime_hash="$(jq -r '.deployedBytecode.object' "$artifact" | cast keccak)"
initcode_bytes="$(jq -r '.bytecode.object | (length - 2) / 2' "$artifact")"
runtime_bytes="$(jq -r '.deployedBytecode.object | (length - 2) / 2' "$artifact")"

predicted_address="$(cast compute-address "$DEPLOYER" --nonce "$nonce_1" | awk '{print $3}')"
if [[ "$(cast code "$predicted_address" --rpc-url "$RPC_URL")" != "0x" || \
      "$(cast code "$predicted_address" --rpc-url "$RPC_URL_2")" != "0x" ]]; then
  printf 'Predicted deployment address is already in use: %s\n' "$predicted_address" >&2
  exit 1
fi

simulation_output="$(mktemp -t walletbrief-preflight.XXXXXX)"
trap 'unset key || true; rm -f "$simulation_output"' EXIT
(
  cd "$CONTRACTS_DIR"
  forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --sender "$DEPLOYER" \
    --gas-estimate-multiplier "$GAS_ESTIMATE_MULTIPLIER" \
    --with-gas-price "$max_fee_per_gas" \
    --priority-gas-price "$priority_fee" \
    -vv >"$simulation_output"
)

dry_run="$CONTRACTS_DIR/broadcast/Deploy.s.sol/$EXPECTED_CHAIN_ID/dry-run/run-latest.json"
simulated_address="$(jq -r '.transactions[0].contractAddress' "$dry_run")"
gas_limit="$(cast to-dec "$(jq -r '.transactions[0].transaction.gas' "$dry_run")")"
if [[ "$(lowercase "$simulated_address")" != "$(lowercase "$predicted_address")" ]]; then
  printf 'Simulation address mismatch: predicted %s, simulated %s\n' "$predicted_address" "$simulated_address" >&2
  exit 1
fi

read -r maximum_fee_wei ending_balance_wei < <(
  node -e '
    const gas = BigInt(process.argv[1]);
    const price = BigInt(process.argv[2]);
    const balance = BigInt(process.argv[3]);
    const maximum = gas * price;
    console.log(`${maximum} ${balance - maximum}`);
  ' "$gas_limit" "$max_fee_per_gas" "$balance_1"
)

node -e '
  if (BigInt(process.argv[1]) < BigInt(process.argv[2])) process.exit(1);
' "$ending_balance_wei" "$RESERVE_WEI" || {
  printf 'Worst-case ending balance would fall below the 10 MON reserve.\n' >&2
  exit 1
}

printf '%s\n' \
  "WalletBrief Monad mainnet preflight (NO BROADCAST)" \
  "chain_id=$EXPECTED_CHAIN_ID" \
  "deployer=$DEPLOYER" \
  "nonce=$nonce_1" \
  "predicted_address=$predicted_address" \
  "creation_bytecode_hash=$creation_hash" \
  "runtime_bytecode_hash=$runtime_hash" \
  "initcode_bytes=$initcode_bytes" \
  "runtime_bytes=$runtime_bytes" \
  "wmon_code_hash=$wmon_code_hash" \
  "gas_estimate_multiplier_percent=$GAS_ESTIMATE_MULTIPLIER" \
  "gas_limit=$gas_limit" \
  "base_fee_wei=$base_fee" \
  "max_priority_fee_per_gas_wei=$priority_fee" \
  "max_fee_per_gas_wei=$max_fee_per_gas" \
  "maximum_fee_mon=$(format_mon "$maximum_fee_wei")" \
  "balance_mon=$(format_mon "$balance_1")" \
  "worst_case_ending_balance_mon=$(format_mon "$ending_balance_wei")" \
  "wallet_code=0x" \
  "predicted_address_code=0x" \
  "broadcast=false"
