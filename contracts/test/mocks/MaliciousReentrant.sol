// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BatchExecutor} from "../../src/BatchExecutor.sol";

/// @notice Test-only mock proving BatchExecutor's self-only access check
/// (`msg.sender == address(this)`) blocks reentrancy. A call from this
/// contract back into the delegated wallet's executeBatch always fails:
/// msg.sender inside that inner call is this contract's own address, never
/// the wallet's -- implementation security hardening (BatchExecutor.t.sol's
/// test_reentrancy_selfOnlyCheckBlocksReentrantCallback).
contract MaliciousReentrant {
    address public immutable wallet;

    constructor(address _wallet) {
        wallet = _wallet;
    }

    /// @dev Called AS an Action.target during a batch -- attempts to
    /// re-enter the wallet's executeBatch with an arbitrary digest and an
    /// empty action list. Must fail regardless: the self-only require
    /// reverts before the EmptyBatch check is ever reached.
    function approve(address, uint256) external {
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](0);
        BatchExecutor(wallet).executeBatch(keccak256("reentry-attempt"), actions);
    }
}
