// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IBatchedVault} from "./IBatchedVault.sol";
import {IPlatformAdapter} from "./IPlatformAdapter.sol";

interface IActiveManagementVault {
    function createTrade(
        IPlatformAdapter.TradeOperation[] memory tradeOperations
    ) external returns (bytes[] memory tradeResults);
}
