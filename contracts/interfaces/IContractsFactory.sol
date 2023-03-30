// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IContractsFactory {
    function isTraderAllowed(address) external view returns (bool);

    function isInvestorAllowed(address) external view returns (bool);

    function getComissionPercentage() external view returns (uint256);

    function getTraderFromWallet(address) external view returns (address);

    function getVaultFromTrader(address) external view returns (address);
}
