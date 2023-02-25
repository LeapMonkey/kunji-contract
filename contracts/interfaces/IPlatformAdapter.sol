// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IBatchedVault} from "./IBatchedVault.sol";

interface IPlatformAdapter {
    struct TradeOperation {
        uint8 platformId;
        uint8 actionId;
        bytes data;
    }

    error InvalidOperation(uint8 platformId, uint8 actionId);

    function createTrade(
        TradeOperation memory tradeOperation
    ) external returns (bytes memory);

    function totalAssets() external view returns (uint256);
}
