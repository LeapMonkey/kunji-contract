// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract ContractsFactory {
    bool public returnValue;

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }

    function isTraderAllowed(address _trader) external view returns (bool) {
        _trader;                    // just to avoid warnings
        return returnValue;
    }
}
