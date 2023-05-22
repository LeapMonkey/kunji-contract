// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IAdapter} from "../interfaces/IAdapter.sol";

contract AdapterMock {
    bool public executedOperation;

    function setExecuteOperationReturn(bool _value) external {
        executedOperation = _value;
    }

    function executeOperation(
        uint256 _ratio,
        IAdapter.AdapterOperation memory adapterOperations
    ) external returns (bool) {
        adapterOperations; // just to avoid warnings
        _ratio; // just to avoid warnings
        executedOperation = executedOperation; // just to avoid warnings
        return (executedOperation);
    }
}
