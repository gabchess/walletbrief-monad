# WalletBrief mainnet proof

## Current gate

Status: **complete — executor deployed and verified, WMON approval revoked, hosted no-op and persistence proven**.

The private key remained in macOS Keychain and was neither printed, written to disk, nor transmitted to Railway. The public service is intentionally read-only; the exact server-recomputed revoke was signed locally.

Official Monad behavior used for this proof:

- Mainnet uses chain ID `143`, and canonical WMON is `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A`: [Monad network information](https://docs.monad.xyz/developer-essentials/network-information).
- Monad charges `gas_limit * price_per_gas`: [Monad gas pricing](https://docs.monad.xyz/developer-essentials/gas-pricing).
- An EIP-7702 delegated EOA cannot reduce its balance below the `10 MON` reserve: [EIP-7702 on Monad](https://docs.monad.xyz/developer-essentials/eip-7702) and [reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance).

## Locked deployment preflight

The final no-broadcast preflight on July 16, 2026 matched every approved field before signing.

| Field | Verified value |
| --- | --- |
| Chain ID | `143` on `rpc.monad.xyz` and `rpc3.monad.xyz` |
| Sender | `0x35160A4238CB5F3166046399c397B6E0c12FD872` |
| Pending nonce | `0` |
| Predicted contract | `0x2Aebb502460c8C6aECA8879d2165AaDFD6639658` |
| Initcode | `1,964 bytes` · `0xf070fb52d6ec1919bad1a28c09e54c1ca5386cbf56b9394905c5e43be83cb37d` |
| Runtime | `1,936 bytes` · `0xa7e015cacda53443c9a05a0ee13e856f805e0166218f16cb7a9ac1bb4aba57e9` |
| Gas limit | `519,017` |
| Max fee / priority fee | `202 gwei` / `2 gwei` |
| Starting balance | `25 MON` |
| Worst-case ending balance | `24.895158566 MON` |

The signed transaction was decoded locally before publication. Its sender, nonce, chain, CREATE input hash, gas limit, fee caps, and empty access list matched the approved operation exactly.

## Deployment proof

| Field | Measured result |
| --- | --- |
| Transaction | [`0x8c3421a8…8092c37a`](https://monadvision.com/tx/0x8c3421a83bc482bbcd20dd232a4d3eecd69f9d07136f86ed26a3c89a8092c37a) |
| Contract | [`0x2Aebb502460c8C6aECA8879d2165AaDFD6639658`](https://monadvision.com/address/0x2Aebb502460c8C6aECA8879d2165AaDFD6639658) |
| Block | [`88,132,222`](https://monadvision.com/block/88132222) at `2026-07-16T12:40:24Z` |
| Receipt | Success on both independent RPCs; contract address matched the prediction |
| Runtime hash | `0xa7e015cacda53443c9a05a0ee13e856f805e0166218f16cb7a9ac1bb4aba57e9` on both finalized views |
| Gas limit / effective price | `519,017` / `102 gwei` |
| Charged fee | `0.052939734 MON` |
| Ending balance | `24.947060266 MON` |
| Finalized heads observed | `88,132,520` and `88,132,537` |

## Source verification

MonadVision's documented Foundry Sourcify endpoint verified `src/BatchExecutor.sol:BatchExecutor`.

| Field | Result |
| --- | --- |
| Verification job | [`24410132-1181-4db1-976d-b4061c704c7b`](https://sourcify-api-monad.blockvision.org/v2/verify/24410132-1181-4db1-976d-b4061c704c7b) |
| Public source record | [MonadVision Sourcify API](https://sourcify-api-monad.blockvision.org/v2/contract/143/0x2Aebb502460c8C6aECA8879d2165AaDFD6639658?fields=all) |
| Match | `exact_match` for creation and runtime bytecode |
| Compiler | `solc 0.8.28+commit.7893614a` |
| Contract identifier | `src/BatchExecutor.sol:BatchExecutor` |
| Verified at | `2026-07-16T12:43:17Z` |

The public record includes the Solidity source, ABI, compiler settings, creation bytecode, and runtime bytecode. The [MonadVision contract page](https://monadvision.com/address/0x2Aebb502460c8C6aECA8879d2165AaDFD6639658) exposes the verified deployment.

## Harmless WMON seed

The seed holds `0.01 WMON` and approves the same amount to the inert spender `0x000000000000000000000000000000000000dEaD`. Both RPCs returned `0x` for the spender's code.

| Field | Wrap | Approval |
| --- | --- | --- |
| Transaction | [`0xdeae30c2…ba41dfe4`](https://monadvision.com/tx/0xdeae30c2a985af2183cbb1ac6f0568cda982a93b53036720f9f75fb7ba41dfe4) | [`0x880e6891…5eb3a10f`](https://monadvision.com/tx/0x880e68918c5852e4e62da078063469a2d3aa44c1dcc220ffc5ed7dd65eb3a10f) |
| Block | [`88,133,161`](https://monadvision.com/block/88133161) at `2026-07-16T12:46:42Z` | [`88,133,622`](https://monadvision.com/block/88133622) at `2026-07-16T12:49:46Z` |
| Fresh gas estimate | `51,321` | `52,671` |
| Gas limit | `53,888` | `55,305` |
| Buffer | 5%, rounded up | 5%, rounded up |
| Max fee / priority fee | `202 gwei` / `2 gwei` | `202 gwei` / `2 gwei` |
| Effective price | `102 gwei` | `102 gwei` |
| Charged fee | `0.005496576 MON` | `0.00564111 MON` |

Finalized reads from both RPCs agreed on:

- WMON balance: `0.01 WMON`.
- Allowance to `0x000000000000000000000000000000000000dEaD`: `0.01 WMON`.
- Approval event owner, spender, and amount: exact match.
- Wallet nonce: `3`.
- Wallet code: `0x`; EIP-7702 remains untouched.
- MON balance: `24.92592258 MON`, leaving `14.92592258 MON` above the delegated-account reserve.
- `SCAN_START_BLOCK=88133621`, the block immediately before the Approval event.

## Hosted service and revoke proof

| Proof | Result |
| --- | --- |
| Hosted app | [walletbrief-production.up.railway.app](https://walletbrief-production.up.railway.app) |
| Railway deployment | `2fd24561-0465-4b77-acc1-48ed1a9ab26d` · one replica · `/data` volume · healthcheck passed |
| Deployment image | `sha256:bd0c7429e1837c4ddc08828ce64032431852009ebfcd66e950ad46c305da1661` |
| Initial seeded load | HTTP `200` in `115.808333s`; real approval and revoke proposal visible |
| Persisted second load | HTTP `200` in `2.465534s` |
| Pre-revoke restart | Health returned chain `143`; proposal survived in `1.794207s` |
| EIP-7702 revoke | [`0x5e07b37b…1ee804c4`](https://monadvision.com/tx/0x5e07b37bbbd638460db7a488b0a964062021a7e967b5d398b21a434a1ee804c4) · block [`88,150,275`](https://monadvision.com/block/88150275) · `2026-07-16T15:49:24Z` |
| Receipt | Success on `rpc.monad.xyz` and `rpc3.monad.xyz`; `109,594` gas at `102 gwei`; fee `0.011178588 MON` |
| Revoke event | WMON `Approval` for the exact owner and inert spender with amount `0` |
| Allowance after revoke | `0` on both RPCs |
| Delegation after revoke | `0xef01002aebb502460c8c6aeca8879d2165aadfd6639658` on both RPCs |
| Wallet after revoke | Nonce `5`; balance `24.914743992 MON` |
| Explicit second attempt | `noop: No current revoke is available.`; nonce remained `5` |
| Post-revoke restart | Health returned chain `143`; **Nothing to revoke** survived in `3.258043s` |

The hosted service keeps `EXECUTE_ENABLED=false`. This preserves the public evidence and stateful judge path without entrusting a third-party host with a hot-wallet key that could sign transactions outside WalletBrief.
