// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract ContractsFactoryMock is OwnableUpgradeable {
    bool public returnValue;    

    function initialize() external initializer {}

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }

    function isTraderAllowed(address _trader) external view returns (bool) {
        _trader; // just to avoid warnings
        return returnValue;
    }

    function isInvestorAllowed(address _investor) external view returns (bool) {
        _investor; // just to avoid warnings
        return returnValue;
    }
}
