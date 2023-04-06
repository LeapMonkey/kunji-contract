// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IAdapter} from "../interfaces/IAdapter.sol";

contract AdapterOperations {
    bool public generalReturnValue;
    address public returnAddress;
    bool public operationAllowed;
    bool public executedOperation;
    IAdapter.Parameters[] parametersToReturn;

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

    function setReturnParameters(
        IAdapter.Parameters[] memory _parameters,
        bool _empty
    ) external {
        delete parametersToReturn;
        if (!_empty) {
            // new array with the scaled parameter
            for (uint256 i = 0; i < _parameters.length; i++) {
                parametersToReturn.push(_parameters[i]);
            }
        }
    }

    function isOperationAllowed(
        IAdapter.AdapterOperation memory adapterOperations
    ) external returns (bool) {
        adapterOperations; // just to avoid warnings
        operationAllowed = operationAllowed; // just to avoid warnings
        return operationAllowed;
    }

    function executeOperations(
        IAdapter.AdapterOperation memory adapterOperations,
        IAdapter.Parameters[] memory parameters
    ) external returns (bool, IAdapter.Parameters[] memory) {
        adapterOperations; // just to avoid warnings
        parameters; // just to avoid warnings
        executedOperation = executedOperation; // just to avoid warnings
        return (executedOperation, parametersToReturn);
    }
}
