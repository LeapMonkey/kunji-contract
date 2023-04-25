// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/IPlatformAdapter.sol";
import "../../interfaces/IAdapter.sol";

library GMXAdapter {
    function executeOperation(
        uint256 _ratio,
        IAdapter.AdapterOperation memory _traderOperation
    ) external pure returns (bool) {
        _ratio;
        _traderOperation;
        return true;
    }
}
