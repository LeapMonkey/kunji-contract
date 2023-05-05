// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

import "hardhat/console.sol";

contract UsersVaultMock {
    bool public generalReturnValue;
    bool public executedOperation;
    uint256 public returnAmount;
    uint256 public round;
    uint256 public liquidity;
    uint256 public variableToPreventWarning;

    // not used yet
    function setReturnValue(bool _value) external {
        generalReturnValue = _value;
    }

    function setExecuteOnProtocol(bool _value) external {
        executedOperation = _value;
    }

    function setReturnAmount(uint256 _value) external {
        returnAmount = _value;
    }

    function setRound(uint256 _value) external {
        round = _value;
    }

    function setLiquidity(uint256 _value) external {
        liquidity = _value;
    }

    function rolloverFromTrader() external returns(bool) {
        variableToPreventWarning = 0;     
        return generalReturnValue;
    }

    function executeOnProtocol(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _vaultOperation,
        uint256 _walletRatio
    ) external returns (bool) {
        _protocolId; // just to avoid warnings
        _vaultOperation; // just to avoid warnings
        _walletRatio = 1; // just to avoid warnings
        executedOperation = executedOperation; // just to avoid warnings
        return (executedOperation);
    }

    function getUnderlyingLiquidity() external view returns (uint256) {
        return liquidity;
    }

    function currentRound() external view returns (uint256) {
        return round;
    }
}
