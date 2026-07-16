// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {BatchExecutor} from "../src/BatchExecutor.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MaliciousReentrant} from "./mocks/MaliciousReentrant.sol";
import {MockFailingApprove} from "./mocks/MockFailingApprove.sol";

/// @notice End-to-end contract proof: deploy BatchExecutor,
/// delegate one wallet to it via EIP-7702, revoke a stale ERC20 approval in one call,
/// prove BatchExecuted + ActionResult(success=true) fire, a replayed digest reverts,
/// and the contract never custodies funds. Forked locally against Monad mainnet --
/// Safety boundary: no mainnet writes, local fork only (mainnet write constraint).
contract BatchExecutorTest is Test {
    BatchExecutor implementation;
    MockERC20 token;

    uint256 constant WALLET_PK = 0xA11CE;
    address WALLET;
    address constant SPENDER = address(0xBEEF);
    address constant RELAYER = address(0xC0FFEE);

    function setUp() public {
        // Fork Monad mainnet locally -- functionally equivalent to
        // `anvil --fork-url rpc1.monad.xyz`, embedded so a bare `forge test` proves
        // the fork verifier without an extra CLI flag.
        vm.createSelectFork(vm.envOr("MONAD_RPC_URL", string("https://rpc1.monad.xyz")));

        WALLET = vm.addr(WALLET_PK);
        implementation = new BatchExecutor();
        token = new MockERC20("Test Token", "TT");

        token.mint(WALLET, 1_000e18);

        // WALLET pre-approves SPENDER for max -- simulates a stale approval
        // (product spec Definitions: "approval exists and has never been drawn down").
        vm.prank(WALLET);
        token.approve(SPENDER, type(uint256).max);
        assertEq(
            token.allowance(WALLET, SPENDER),
            type(uint256).max,
            "precondition: stale approval exists"
        );

        // Delegate WALLET's code to BatchExecutor via EIP-7702. Monad mainnet supports
        // type-0x04 SetCode txs natively (docs.monad.xyz/developer-essentials/eip-7702);
        // this cheatcode simulates the same designation locally so `address(this)`
        // inside executeBatch resolves to WALLET, and outbound calls carry WALLET as
        // msg.sender -- required for `token.approve(spender, 0)` to revoke WALLET's
        // own allowance rather than the executor's.
        vm.signAndAttachDelegation(address(implementation), WALLET_PK);
    }

    function _revokeAction() internal view returns (BatchExecutor.Action[] memory actions) {
        actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({
            target: address(token),
            data: abi.encodeWithSelector(token.approve.selector, SPENDER, uint256(0))
        });
    }

    function test_executeBatch_revokesApproval_andEmitsEvents() public {
        BatchExecutor.Action[] memory actions = _revokeAction();
        bytes32 digest = keccak256("revoke-1");

        vm.expectEmit(true, false, false, true, WALLET);
        emit BatchExecutor.ActionResult(digest, 0, address(token), true, abi.encode(true));
        vm.expectEmit(true, false, false, true, WALLET);
        emit BatchExecutor.BatchExecuted(digest, block.timestamp, 1);

        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(digest, actions);

        assertEq(ok.length, 1);
        assertTrue(ok[0], "revoke call should succeed");
        assertEq(token.allowance(WALLET, SPENDER), 0, "allowance should be revoked to zero");
    }

    function test_executeBatch_replayOfSameDigestReverts() public {
        BatchExecutor.Action[] memory actions = _revokeAction();
        bytes32 digest = keccak256("revoke-1");

        vm.prank(WALLET);
        BatchExecutor(WALLET).executeBatch(digest, actions);

        vm.prank(WALLET);
        vm.expectRevert(abi.encodeWithSelector(BatchExecutor.DigestAlreadyUsed.selector, digest));
        BatchExecutor(WALLET).executeBatch(digest, actions);
    }

    function test_onlySelfCanExecute_relayerAttemptReverts() public {
        BatchExecutor.Action[] memory actions = _revokeAction();
        bytes32 digest = keccak256("revoke-relayer-attempt");

        vm.prank(RELAYER);
        vm.expectRevert(bytes("BatchExecutor: only self"));
        BatchExecutor(WALLET).executeBatch(digest, actions);
    }

    function test_zeroFundCustody_afterExecuteBatch() public {
        BatchExecutor.Action[] memory actions = _revokeAction();
        vm.prank(WALLET);
        BatchExecutor(WALLET).executeBatch(keccak256("revoke-custody-check"), actions);

        // The deployed implementation contract itself never custodies funds -- no
        // receive()/payable fallback, no token-holding logic (acceptance criteria: zero fund custody).
        assertEq(address(implementation).balance, 0, "implementation must hold zero native balance");
        assertEq(
            token.balanceOf(address(implementation)),
            0,
            "implementation must hold zero token balance"
        );

        // The delegated wallet's own balance is untouched -- a revoke changes an
        // allowance, never the wallet's own funds.
        assertEq(
            token.balanceOf(WALLET),
            1_000e18,
            "wallet balance must be unaffected by a revoke action"
        );
    }

    function test_emptyBatchReverts() public {
        BatchExecutor.Action[] memory empty = new BatchExecutor.Action[](0);
        vm.prank(WALLET);
        vm.expectRevert(BatchExecutor.EmptyBatch.selector);
        BatchExecutor(WALLET).executeBatch(keccak256("empty"), empty);
    }

    function test_multiActionBatch_revokesTwoApprovalsInOneCall() public {
        address spender2 = address(0xDEAD2);
        MockERC20 token2 = new MockERC20("Test Token 2", "TT2");
        token2.mint(WALLET, 500e18);
        vm.prank(WALLET);
        token2.approve(spender2, type(uint256).max);

        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](2);
        actions[0] = BatchExecutor.Action({
            target: address(token),
            data: abi.encodeWithSelector(token.approve.selector, SPENDER, uint256(0))
        });
        actions[1] = BatchExecutor.Action({
            target: address(token2),
            data: abi.encodeWithSelector(token2.approve.selector, spender2, uint256(0))
        });

        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(keccak256("revoke-batch-2"), actions);

        assertEq(ok.length, 2);
        assertTrue(ok[0] && ok[1], "both revokes should succeed in one batch");
        assertEq(token.allowance(WALLET, SPENDER), 0);
        assertEq(token2.allowance(WALLET, spender2), 0);
    }

    // ---- implementation security hardening: additional edge-case coverage ----

    /// @notice Reentrancy posture: a batch action that tries to call back into
    /// the wallet's own executeBatch must fail (msg.sender inside that inner
    /// call is the attacker contract, not WALLET), while the rest of the same
    /// batch still executes normally.
    function test_reentrancy_selfOnlyCheckBlocksReentrantCallback() public {
        MaliciousReentrant attacker = new MaliciousReentrant(WALLET);

        BatchExecutor.Action[] memory revokeActions = _revokeAction();
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](2);
        actions[0] = BatchExecutor.Action({
            target: address(attacker),
            data: abi.encodeWithSelector(attacker.approve.selector, SPENDER, uint256(0))
        });
        actions[1] = revokeActions[0];

        bytes32 digest = keccak256("revoke-with-reentry-attempt");
        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(
            ok[0], "reentrant call must fail: msg.sender inside is the attacker, not WALLET"
        );
        assertTrue(ok[1], "the legitimate action in the same batch must still succeed");
        assertEq(
            token.allowance(WALLET, SPENDER), 0, "the legitimate revoke still executed correctly"
        );
        assertEq(
            address(implementation).balance,
            0,
            "zero-custody invariant holds after a reentrancy attempt"
        );
    }

    /// @notice Per-action failure handling: one action that reverts (a call to
    /// a nonexistent function selector) must not abort the rest of the batch,
    /// and the digest is still marked used exactly once for the whole batch
    /// (no retry under the same digest after a partial failure).
    function test_partialFailureWithinBatch_oneRevertingActionDoesNotBlockOthers() public {
        address failingSpender = address(0xFA11);
        MockFailingApprove failingToken = new MockFailingApprove(failingSpender);
        BatchExecutor.Action[] memory revokeActions = _revokeAction();
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](2);
        actions[0] = BatchExecutor.Action({
            target: address(failingToken),
            data: abi.encodeWithSelector(failingToken.approve.selector, failingSpender, uint256(0))
        });
        actions[1] = revokeActions[0];

        bytes32 digest = keccak256("partial-failure-batch");
        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(
            ok[0], "a valid approve(spender, 0) call may fail without reverting the whole batch"
        );
        assertTrue(ok[1], "the following legitimate action in the same batch must still execute");
        assertEq(token.allowance(WALLET, SPENDER), 0);

        vm.prank(WALLET);
        vm.expectRevert(abi.encodeWithSelector(BatchExecutor.DigestAlreadyUsed.selector, digest));
        BatchExecutor(WALLET).executeBatch(digest, actions);
    }

    /// @notice Digest/content independence: usedDigests tracks the
    /// caller-supplied digest value alone, never a hash of `actions`. Two
    /// different digests wrapping an identical action both execute
    /// independently -- proving the digest never inspects action content when
    /// deciding uniqueness (see BatchExecutor.sol's usedDigests doc comment
    /// for why this is safe: only the wallet itself can ever submit a
    /// (digest, actions) pair).
    function test_digestDoesNotBindActionContent_sameActionUnderDifferentDigestsBothExecute()
        public
    {
        address spender2 = address(0xDEAD3);
        vm.prank(WALLET);
        token.approve(spender2, type(uint256).max);

        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({
            target: address(token),
            data: abi.encodeWithSelector(token.approve.selector, spender2, uint256(0))
        });

        vm.prank(WALLET);
        BatchExecutor(WALLET).executeBatch(keccak256("digest-a"), actions);
        assertEq(token.allowance(WALLET, spender2), 0);

        // Re-approve so there is something real to revoke again under a
        // second, unrelated digest wrapping the exact same action content.
        vm.prank(WALLET);
        token.approve(spender2, type(uint256).max);

        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(keccak256("digest-b"), actions);
        assertTrue(ok[0]);
        assertEq(token.allowance(WALLET, spender2), 0);
    }

    /// @notice Out-of-gas atomicity: a batch too large to complete under a
    /// deliberately underfunded gas stipend must revert the ENTIRE call, not
    /// leave usedDigests marked with only some actions applied. Proves
    /// usedDigests[digest] = true is committed as part of the SAME atomic
    /// state change as the actions themselves.
    function test_outOfGas_wholeBatchRevertsAtomically_digestNotConsumed() public {
        uint256 batchSize = 30;
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            address spender = address(uint160(0x9000 + i));
            vm.prank(WALLET);
            token.approve(spender, type(uint256).max);
            actions[i] = BatchExecutor.Action({
                target: address(token),
                data: abi.encodeWithSelector(token.approve.selector, spender, uint256(0))
            });
        }

        bytes32 digest = keccak256("out-of-gas-attempt");

        // Deliberately starve the call of gas -- nowhere near enough for 30
        // approve() calls plus their SSTOREs.
        vm.prank(WALLET);
        (bool success,) = WALLET.call{gas: 50_000}(
            abi.encodeWithSelector(BatchExecutor.executeBatch.selector, digest, actions)
        );
        assertFalse(
            success, "an underfunded batch call must fail outright, not silently under-execute"
        );

        // The whole transaction reverted -- usedDigests was never persisted,
        // so a retry with sufficient gas can still use the same digest.
        assertFalse(BatchExecutor(WALLET).usedDigests(digest));

        vm.prank(WALLET);
        bool[] memory ok = BatchExecutor(WALLET).executeBatch(digest, actions);
        for (uint256 i = 0; i < batchSize; i++) {
            assertTrue(ok[i], "every action must succeed on the properly-funded retry");
        }
    }

    function test_rejectsTargetWithNoCodeBeforeConsumingDigest() public {
        address noCodeTarget = address(0x9999999999999999999999999999999999999);
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({
            target: noCodeTarget,
            data: abi.encodeWithSignature("approve(address,uint256)", SPENDER, uint256(0))
        });

        bytes32 digest = keccak256("malformed-target");
        vm.prank(WALLET);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("TargetHasNoCode(uint256,address)")), uint256(0), noCodeTarget
            )
        );
        BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(BatchExecutor(WALLET).usedDigests(digest));
    }

    function test_rejectsEmptyCalldataBeforeConsumingDigest() public {
        _expectMalformedCalldata(hex"", keccak256("empty-calldata"));
    }

    function test_rejectsShortCalldataBeforeConsumingDigest() public {
        _expectMalformedCalldata(abi.encodePacked(bytes4(0x095ea7b3)), keccak256("short-calldata"));
    }

    function test_rejectsLongCalldataBeforeConsumingDigest() public {
        bytes memory valid =
            abi.encodeWithSignature("approve(address,uint256)", SPENDER, uint256(0));
        _expectMalformedCalldata(bytes.concat(valid, hex"00"), keccak256("long-calldata"));
    }

    function test_rejectsUnsupportedSelectorBeforeConsumingDigest() public {
        bytes4 transferSelector = bytes4(keccak256("transfer(address,uint256)"));
        bytes memory data = abi.encodeWithSelector(transferSelector, SPENDER, uint256(0));
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({target: address(token), data: data});

        bytes32 digest = keccak256("unsupported-selector");
        vm.prank(WALLET);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("UnsupportedSelector(uint256,bytes4)")),
                uint256(0),
                transferSelector
            )
        );
        BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(BatchExecutor(WALLET).usedDigests(digest));
    }

    function test_rejectsNonZeroApprovalBeforeConsumingDigest() public {
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({
            target: address(token),
            data: abi.encodeWithSelector(token.approve.selector, SPENDER, uint256(1))
        });

        bytes32 digest = keccak256("nonzero-approval");
        vm.prank(WALLET);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("NonZeroApproval(uint256,uint256)")), uint256(0), uint256(1)
            )
        );
        BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(BatchExecutor(WALLET).usedDigests(digest));
    }

    function _expectMalformedCalldata(bytes memory data, bytes32 digest) internal {
        BatchExecutor.Action[] memory actions = new BatchExecutor.Action[](1);
        actions[0] = BatchExecutor.Action({target: address(token), data: data});

        vm.prank(WALLET);
        vm.expectRevert(
            abi.encodeWithSelector(bytes4(keccak256("MalformedCalldata(uint256)")), uint256(0))
        );
        BatchExecutor(WALLET).executeBatch(digest, actions);

        assertFalse(BatchExecutor(WALLET).usedDigests(digest));
    }
}
