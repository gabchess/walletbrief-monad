// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title BatchExecutor
/// @notice Minimal batched-action executor for WalletBrief's demo action: batch-revoke
/// stale ERC20 approvals in one human-approved call.
///
/// @dev Designed to be attached to a wallet EOA via EIP-7702 delegation (Monad mainnet
/// supports type-0x04 SetCode txs natively -- docs.monad.xyz/developer-essentials/eip-7702),
/// so that `address(this)` inside executeBatch resolves to the wallet's own address and
/// outbound calls carry the wallet as msg.sender. That is required for an action like
/// `IERC20.approve(spender, 0)` to actually revoke *that wallet's* allowance -- a shared
/// executor calling out on its own behalf could only revoke its own allowances, not the
/// wallet's.
///
/// Holds zero fund custody by construction: no `receive()`/payable fallback, no balance
/// bookkeeping, no logic that could accumulate a token balance under this contract's own
/// deployed address.
///
/// Access control: `executeBatch` requires `msg.sender == address(this)`. When the wallet
/// submits the transaction directly (`to: wallet, from: wallet`), this holds naturally and
/// blocks any other address -- delegated or not -- from driving the wallet's calls.
/// ponytail: this blocks EIP-7702 gas-sponsored/relayed execution (a relayer-submitted tx
/// would have msg.sender == relayer, not the wallet). If sponsored execution is needed
/// later, replace this check with a signature-based approval check (e.g. EIP-712) instead
/// of the self-call requirement. Gas sponsorship is outside this demo's scope.
contract BatchExecutor {
    bytes4 private constant APPROVE_SELECTOR = 0x095ea7b3;

    struct Action {
        address target;
        bytes data;
    }

    /// @dev approvalDigest => used. Enforces single-use / non-replayable approvals
    /// (product spec user story 9, acceptance criteria: "approvalDigest single-use").
    ///
    /// This digest is an opaque, caller-supplied
    /// bytes32 -- the contract never derives or checks it against `actions`, so
    /// uniqueness is tracked per-digest-value, not per-action-content. Two
    /// different digests wrapping identical actions both execute independently;
    /// a single digest can never be replayed regardless of what actions
    /// accompany the first use. Binding a digest to its intended action content
    /// is an OFF-CHAIN trust boundary (prepare.ts derives the digest
    /// deterministically from the exact revoke set it packages, and execute()
    /// submits both together in the one wallet-signed transaction) -- not
    /// something this mapping enforces. This is safe here specifically because
    /// `executeBatch` also requires `msg.sender == address(this)`: nobody but
    /// the wallet itself can ever submit a (digest, actions) pair, so there is
    /// no third party who could exploit the digest/content gap.
    mapping(bytes32 => bool) public usedDigests;

    event BatchExecuted(bytes32 indexed approvalDigest, uint256 timestamp, uint256 actionCount);
    event ActionResult(
        bytes32 indexed approvalDigest,
        uint256 index,
        address target,
        bool success,
        bytes returnData
    );

    error DigestAlreadyUsed(bytes32 approvalDigest);
    error EmptyBatch();
    error MalformedCalldata(uint256 index);
    error TargetHasNoCode(uint256 index, address target);
    error UnsupportedSelector(uint256 index, bytes4 selector);
    error NonZeroApproval(uint256 index, uint256 amount);

    /// @notice Executes a batch of low-level calls once per unique approvalDigest.
    /// @param approvalDigest Caller-supplied digest identifying the human-approved action.
    ///        Must be unique per approval; replaying an already-used digest reverts.
    /// @param actions The ordered list of {target, calldata} pairs to execute.
    /// @return successes Per-action success flags, in the same order as `actions`.
    function executeBatch(bytes32 approvalDigest, Action[] calldata actions)
        external
        returns (bool[] memory successes)
    {
        require(msg.sender == address(this), "BatchExecutor: only self");
        if (actions.length == 0) revert EmptyBatch();
        if (usedDigests[approvalDigest]) revert DigestAlreadyUsed(approvalDigest);

        for (uint256 i = 0; i < actions.length; i++) {
            _validate(actions[i], i);
        }

        // Effects before interactions (CEI): mark used before any external call.
        usedDigests[approvalDigest] = true;

        successes = new bool[](actions.length);
        for (uint256 i = 0; i < actions.length; i++) {
            (bool ok, bytes memory ret) = actions[i].target.call(actions[i].data);
            successes[i] = ok;
            emit ActionResult(approvalDigest, i, actions[i].target, ok, ret);
        }

        emit BatchExecuted(approvalDigest, block.timestamp, actions.length);
    }

    function _validate(Action calldata action, uint256 index) private view {
        if (action.target.code.length == 0) revert TargetHasNoCode(index, action.target);
        if (action.data.length != 68) revert MalformedCalldata(index);

        bytes4 selector = bytes4(action.data[:4]);
        if (selector != APPROVE_SELECTOR) revert UnsupportedSelector(index, selector);

        (, uint256 amount) = abi.decode(action.data[4:], (address, uint256));
        if (amount != 0) revert NonZeroApproval(index, amount);
    }
}
