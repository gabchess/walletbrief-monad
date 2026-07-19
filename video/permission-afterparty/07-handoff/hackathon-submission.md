# Spark submission

## Cover image

`walletbrief-cover.webp`

## Title

WalletBrief

## Description

WalletBrief is a live search-and-revoke app for Monad. Paste any address to see current MON and WMON balances, transaction count, latest block, and ERC-20 approvals indexed through HyperSync. If the connected wallet owns an active approval, WalletBrief simulates `approve(spender, 0)` before asking for a signature.

I built it because token permissions can outlive the dapps that requested them. Finding and revoking them still means explorer tabs, contract addresses, and guesswork.

The public app is read-only by default and never holds a signing key. The repo also includes a verified mainnet BatchExecutor proof. I learned that approval discovery needs both indexed events and live allowance checks: RPC-by-RPC scanning is too slow, while event history alone can be stale.

## Project URL

https://walletbrief-production.up.railway.app/

## GitHub repo

https://github.com/gabchess/walletbrief-monad

## Category

mainnet

## Contract address

`0x2Aebb502460c8C6aECA8879d2165AaDFD6639658`

## Demo video

Use the public X post URL after publishing the video.

## Social media post URL

Use the public X post URL after publishing the video.

## What problem are you trying to solve?

Token approvals can stay open long after someone leaves a dapp. On Monad, checking them still means searching explorers, matching contract addresses, and confirming whether each allowance is active. A simple safety task becomes slow and easy to skip.

## How is your project the solution to your problem?

Paste any Monad address into WalletBrief. HyperSync finds its approval history, live onchain reads confirm what is still active, and the app puts the result in one screen. If the connected wallet owns an approval, WalletBrief simulates `approve(spender, 0)` before asking the wallet to sign. The hosted app never keeps a private key.

## X post

The dapp party ends. Some permissions don't.

Meet WalletBrief, built for the @monad_xyz Build Anything hackathon.

Attach `walletbrief-permission-afterparty-master.mp4`.

## Copy audit

Humanizer scores: A10 / B10 / C10 / D10 / E9 / Voice9 / Soul9.

Caveman pass: removed setup language, duplicate proof claims, stack details that belong in the README, and extra calls to action. Kept the live product path, safety boundary, mainnet proof, and one concrete lesson.
