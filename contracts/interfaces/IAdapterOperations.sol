// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAdapterOperations {
    
    struct AdapterOperation {
        uint8 operationId;
        bytes data;
    }

    
    function executeOperation(AdapterOperation[] memory) external returns(bool);

    function isOperationAllowed(AdapterOperation[] memory) external returns(bool);

    /*
    error InvalidOperation(uint8 platformId, uint8 actionId);

    function createTrade(
        TradeOperation memory tradeOperation
    ) external returns (bytes memory);

    function totalAssets() external view returns (uint256);
    */
}
