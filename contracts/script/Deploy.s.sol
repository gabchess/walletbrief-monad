// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {BatchExecutor} from "../src/BatchExecutor.sol";

/// @notice Prepared deploy script for the BatchExecutor singleton implementation.
/// @dev A real broadcast requires a final bytecode review, a no-broadcast cost
/// simulation, and explicit approval for the exact chain, deployer, gas limit,
/// fee cap, bytecode hash, and predicted address.
contract Deploy is Script {
    function run() external returns (address deployed) {
        vm.startBroadcast();
        BatchExecutor executor = new BatchExecutor();
        vm.stopBroadcast();

        deployed = address(executor);
        console.log("BatchExecutor deployed:", deployed);
    }
}
