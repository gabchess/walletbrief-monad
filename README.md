# WalletBrief

WalletBrief turns a Monad wallet's raw on-chain activity into a short, persistent brief: current MON and WMON value, change since the last check, recent activity, and a narrow signal for WMON approvals that may still be open.

When it finds a tracked stale approval, WalletBrief prepares one human-approved batch revoke. The browser never supplies calldata or chooses a contract target. The server rereads the wallet, rebuilds the revoke set, and submits only exact `approve(spender, 0)` calls through a locked-down EIP-7702 executor.

## Status

The application, contract, stateful container, and safety tests pass. The executor is deployed and source-verified on Monad mainnet. A real WMON approval was detected, revoked through the EIP-7702 executor, and reduced to a verified no-op on the public app.

| Proof | Link |
| --- | --- |
| Hosted app | [WalletBrief on Railway](https://walletbrief-production.up.railway.app) |
| Public repository | [github.com/gabchess/walletbrief-monad](https://github.com/gabchess/walletbrief-monad) |
| Verified `BatchExecutor` | [MonadVision](https://monadvision.com/address/0x2Aebb502460c8C6aECA8879d2165AaDFD6639658) · [exact-match source record](https://sourcify-api-monad.blockvision.org/v2/contract/143/0x2Aebb502460c8C6aECA8879d2165AaDFD6639658?fields=all) |
| Harmless WMON approval seed | [MonadVision transaction](https://monadvision.com/tx/0x880e68918c5852e4e62da078063469a2d3aa44c1dcc220ffc5ed7dd65eb3a10f) |
| Successful revoke transaction | [MonadVision transaction](https://monadvision.com/tx/0x5e07b37bbbd638460db7a488b0a964062021a7e967b5d398b21a434a1ee804c4) |

## Three-minute judge path

1. Open the hosted app and check the timestamp, wallet link, block link, balances, and change since the previous run.
2. Confirm the current action is **Nothing to revoke** and read the explicit WMON scan-window limitation.
3. Open the approval seed and successful revoke transactions above. The revoke emits `Approval(owner, spender, 0)`.
4. Read the measured deployment, allowance, delegation, no-op, and restart evidence in [docs/mainnet-proof.md](docs/mainnet-proof.md).
5. Refresh the app. Persistent cursors keep the result fast, and no second transaction is proposed.

## How it works

```text
Monad RPC
  -> bounded incremental scans per wallet
  -> MON + WMON balances and USD prices
  -> persisted snapshot diff and rule-based signals
  -> server-recomputed stale WMON revoke set
  -> one human approval
  -> EIP-7702 wallet self-call
  -> BatchExecutor validates approve(spender, 0) only
  -> receipt and explorer evidence
```

WalletBrief keeps separate cursors for balance activity and approval signals. A wallet without a cursor starts from `SCAN_START_BLOCK` when configured, or from a bounded 25,000-block lookback. Successful checks persist a new valued snapshot, so the next run reports the change since that check rather than pretending to calculate lifetime profit and loss.

Price reads use CoinGecko first and DefiLlama as a fallback. One wallet failure is isolated from the rest of a multi-wallet run.

## Revoke safety model

The revoke path has two independent boundaries:

- The client sends only a configured wallet address. The server rereads live state and rebuilds the action, digest, implementation address, and calldata.
- `BatchExecutor` accepts calls only from the delegated wallet itself. Every target must contain code, every payload must be exactly ERC-20 `approve(address,uint256)`, and the amount must be zero. Used digests cannot be replayed.

Hosted execution is disabled. The proof transaction was signed locally from macOS Keychain, so Railway never received a wallet private key. The executor has no payable entry point and no fund-custody logic.

## Run locally

Requirements: Node.js 20+, Foundry, and Socket CLI for dependency installation.

```bash
socket npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`. Keep `EXECUTE_ENABLED=false` for a read-only local brief.

The production container uses Next.js standalone output and one Node process:

```bash
docker build -t walletbrief .
docker run --rm -p 3000:3000 \
  -e BRIEF_WALLETS=0x35160A4238CB5F3166046399c397B6E0c12FD872 \
  walletbrief
```

`GET /api/health` returns `{"ok":true,"chainId":143}` without making an RPC call or exposing configuration.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONAD_RPC_URL` | `https://rpc.monad.xyz` | Read-only Monad mainnet RPC |
| `BRIEF_WALLETS` | Dedicated demo wallet | Comma-separated wallets to brief |
| `SCAN_START_BLOCK` | Unset | Explicit first block for a wallet with no cursor |
| `SCAN_LOOKBACK_BLOCKS` | `25000` | Bounded first-run lookback when no start block is set |
| `CURSOR_STORE_PATH` | `.state/cursors.json` | Balance-activity scan cursors |
| `ANOMALY_CURSOR_STORE_PATH` | `.state/anomaly-cursors.json` | Approval-signal scan cursors |
| `SNAPSHOT_STORE_PATH` | `.state/snapshots.json` | Last successful valued state |
| `APPROVAL_STATE_STORE_PATH` | `.state/approvals.json` | Tracked approval state |
| `BATCH_EXECUTOR_ADDRESS` | Zero address | Verified executor implementation |
| `EXECUTE_ENABLED` | `false` | Explicit hosted execution gate |
| `EXECUTE_RPC_URL` | `MONAD_RPC_URL` | HTTPS RPC used for an approved revoke |
| `DEMO_EXECUTION_WALLET` | Dedicated demo wallet | Exact wallet allowed to execute |
| `DEMO_WALLET_PRIVATE_KEY` | Unset | Runtime secret for the dedicated demo wallet |

For a hosted service, mount persistent storage at `/data`, point every state path there, and run exactly one replica. WalletBrief serializes state changes within one process; it does not claim distributed locking across replicas.

## Verify

```bash
npm test
npm run typecheck
npm run web:build

cd contracts
forge fmt --check
forge test
forge build
```

The default JavaScript suite keeps the Anvil integration test skipped. Run it explicitly with `npm run test:integration` when Foundry and a Monad RPC are available.

The contract suite covers self-only access, exact revoke validation, replay protection, partial action failure, reentrancy resistance, and zero custody. The application suite covers bounded scans, persisted state, per-wallet failure isolation, server-side action recomputation, disabled-by-default execution, explorer links, and the health endpoint.

## Honest limitations

- Approval detection is intentionally narrow: it tracks WMON inside the configured scan window. It is not a full wallet security scanner.
- "Stale" means a live nonzero tracked approval with no observed drawdown in WalletBrief's available history. It is a rule-based signal, not proof of malicious intent.
- USD values depend on external price APIs and are informational.
- Snapshot change is the delta since WalletBrief's previous successful check, not tax accounting or lifetime P&L.
- Stateful file storage requires one process and persistent disk.
- The demo executor is revoke-only. It cannot transfer tokens, set a positive allowance, or run arbitrary calldata.

Built for the [Spark Hackathon](https://buildanything.so/hackathons/spark) on Monad.
