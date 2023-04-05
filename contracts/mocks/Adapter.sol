// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IAdapter} from "../interfaces/IAdapter.sol";

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
        IAdapter.AdapterOperation memory adapterOperations
    ) external returns (bool) {
        adapterOperations;                              // just to avoid warnings
        operationAllowed = operationAllowed;            // just to avoid warnings
        return operationAllowed;
    }

    function executeOperations(
        IAdapter.AdapterOperation memory adapterOperations,
        IAdapter.Parameters[] memory parameters
    ) external returns (bool) {
        adapterOperations;                              // just to avoid warnings
        parameters;                                     // just to avoid warnings
        executedOperation = executedOperation;          // just to avoid warnings
        return executedOperation;
    }
}
