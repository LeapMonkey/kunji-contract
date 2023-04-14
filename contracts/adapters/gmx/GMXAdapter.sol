// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
// import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
// import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
// import {FlagsInterface} from "@chainlink/contracts/src/v0.8/interfaces/FlagsInterface.sol";
// import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
// import {AddressToAddressMapLib} from "../../libraries/AddressToAddressMapLib.sol";
// import {IPlatformAdapter} from "../../interfaces/IPlatformAdapter.sol";
// import {PriceHelper} from "../../libraries/PriceHelper.sol";

import "../../interfaces/IPlatformAdapter.sol";
import "../../interfaces/IAdapter.sol";

// import "./interfaces/IGMXAdapter.sol";

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
