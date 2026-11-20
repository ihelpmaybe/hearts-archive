// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** Minimal tip-token for Foundry dry-run only. */
contract MockERC20 {
    string public name = "Mock Tip";
    string public symbol = "MTIP";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;

    constructor() {
        balanceOf[msg.sender] = 1_000_000 ether;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        uint256 bal = balanceOf[msg.sender];
        require(bal >= amount, "bal");
        unchecked {
            balanceOf[msg.sender] = bal - amount;
            balanceOf[to] += amount;
        }
        return true;
    }
}
