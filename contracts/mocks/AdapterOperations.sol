// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IAdapterOperations} from "../interfaces/IAdapterOperations.sol";

contract AdapterOperations {
    bool public generalReturnValue;
    address public returnAddress;
    bool public operationAllowed;
    bool public executedOperation;

    function setReturnValue(bool _value) external {
        generalReturnValue = _value;
    }

    function setOperationAllowedReturn(bool _value) external {
        operationAllowed = _value;
    }

    function setExecuteOperationReturn(bool _value) external {
        executedOperation = _value;
    }

    function setReturnAddress(address _value) external {
        returnAddress = _value;
    }

    function isOperationAllowed(
        IAdapterOperations.AdapterOperation[] memory adapterOperations
    ) external returns (bool) {
        adapterOperations;                              // just to avoid warnings
        operationAllowed = operationAllowed;            // just to avoid warnings
        return operationAllowed;
    }

    function executeOperation(
        IAdapterOperations.AdapterOperation[] memory adapterOperations
    ) external returns (bool) {
        adapterOperations;                              // just to avoid warnings
        executedOperation = executedOperation;          // just to avoid warnings
        return executedOperation;
    }
}
