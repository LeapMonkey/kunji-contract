// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract AdaptersRegistryMock {
    bool public returnValue;

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }
    
    function isValidAdapter(address _adapterAddress) external view returns (bool) {
        _adapterAddress;            // just to avoid warnings
        return returnValue;
    }
}
