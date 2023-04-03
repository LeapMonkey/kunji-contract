// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import { IAdapterOperations } from "../interfaces/IAdapterOperations.sol";
    
contract AdapterOperations {
    bool public returnValue;
    address public returnAddress;

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }
    
    function setReturnAddress(address _value) external {
        returnAddress = _value;
    }

    function isTraderAllowed(address _trader) external view returns (bool) {
        _trader;                        // just to avoid warnings
        return returnValue;
    }


    function isOperationAllowed(IAdapterOperations.AdapterOperation[] memory adapterOperations) external returns(bool) {
        adapterOperations;              // just to avoid warnings
        returnValue = returnValue;      // just to avoid warnings
        return returnValue;
    }
    
    function executeOperation(IAdapterOperations.AdapterOperation[] memory) external returns(bool) {

    }
}
