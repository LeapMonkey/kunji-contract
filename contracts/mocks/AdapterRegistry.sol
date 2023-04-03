// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract AdaptersRegistry {
    bool public returnValue;
    address public returnAddress;

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }
    
    function setReturnAddress(address _value) external {
        returnAddress = _value;
    }

    function isTraderAllowed(address _trader) external view returns (bool) {
        _trader;                    // just to avoid warnings
        return returnValue;
    }


    function getAdapterAddressFromId(uint256 _adapterId) external view returns (address) {
        _adapterId;                 // just to avoid warnings
        return returnAddress;
    }

    function isAdapterAllowed(address _adapterAddress) external view returns (bool) {
        _adapterAddress;            // just to avoid warnings
        return returnValue;
    }
}
