// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

contract UsersVaultMock {
    bool public generalReturnValue;
    address public returnAddress;
    bool public operationAllowed;
    bool public executedOperation;
    uint256 public returnAmount;
    address public underlyingTokenAddress;
    uint256 public round;

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

    function setRound(uint256 _value) external {
        round = _value;
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

    function getVaultInitialBalance() external view returns(uint256) {
        return IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this));
    }

    function getRound() external view returns(uint256) {
        return round;
    }
}
