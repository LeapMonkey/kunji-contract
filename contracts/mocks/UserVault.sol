// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IAdapter} from "../interfaces/IAdapter.sol";

contract UserVault {
    bool public generalReturnValue;
    address public returnAddress;
    bool public operationAllowed;
    bool public executedOperation;
    uint256 public returnAmount;

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

    function setReturnAmount(uint256 _value) external {
        returnAmount = _value;
    }

    function executeOnAdapter(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _vaultOperation,
        IAdapter.Parameters[] memory _parameters        
    ) external returns (bool, uint256) {
        _protocolId;                                    // just to avoid warnings
        _vaultOperation;                                // just to avoid warnings
        _parameters;                                    // just to avoid warnings
        executedOperation = executedOperation;          // just to avoid warnings
        return (executedOperation, returnAmount);
    }
}
