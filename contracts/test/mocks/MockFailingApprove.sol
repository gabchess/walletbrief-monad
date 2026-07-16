// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockFailingApprove {
    address public immutable failingSpender;

    constructor(address _failingSpender) {
        failingSpender = _failingSpender;
    }

    function approve(address spender, uint256 amount) external view returns (bool) {
        require(spender != failingSpender, "MockFailingApprove: rejected spender");
        require(amount == 0, "MockFailingApprove: nonzero amount");
        return true;
    }
}
