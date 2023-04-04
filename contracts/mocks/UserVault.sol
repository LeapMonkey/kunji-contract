// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IAdapterOperations} from "../interfaces/IAdapterOperations.sol";

contract UserVault {
    bool public generalReturnValue;
    address public returnAddress;
    bool public operationAllowed;
    bool public executedOperation;

    // not used yet
    function setReturnValue(bool _value) external {
        generalReturnValue = _value;
    }

    // not used yet
    function setReturnAddress(address _value) external {
        returnAddress = _value;
    }
    
    function setExecuteOnAdapter(bool _value) external {
        executedOperation = _value;
    }

    function executeOnAdapter(
        IAdapterOperations.AdapterOperation[] memory adapterOperations
    ) external returns (bool) {
        adapterOperations;                              // just to avoid warnings
        executedOperation = executedOperation;          // just to avoid warnings
        return executedOperation;
    }
}
