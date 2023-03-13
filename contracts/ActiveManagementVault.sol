// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {IPlatformAdapter} from "./interfaces/IPlatformAdapter.sol";
import {IActiveManagementVault} from "./interfaces/IActiveManagementVault.sol";

import {BatchedVault} from "./BatchedVault.sol";

contract ActiveManagementVault is BatchedVault, IActiveManagementVault {
    mapping(uint8 => IPlatformAdapter) public platformAdapters;
    uint256 platformAdapterCount;

    function createTrade(
        IPlatformAdapter.TradeOperation[] memory tradeOperations
    ) external returns (bytes[] memory tradeResults) {
        tradeResults = new bytes[](tradeOperations.length);
        for (uint8 i = 0; i < tradeOperations.length; i++) {
            IPlatformAdapter.TradeOperation
                memory tradeOperation = tradeOperations[i];
            tradeResults[i] = platformAdapters[tradeOperation.platformId]
                .createTrade(tradeOperation);
        }
    }

    function totalAssets() public view override returns (uint256 assets) {
        // Balance of USDC + Value of positions on adapters
        assets = super.totalAssets();

        for (uint8 i = 0; i < platformAdapterCount; i++) {
            assets += platformAdapters[i].totalAssets();
        }
    }
}
