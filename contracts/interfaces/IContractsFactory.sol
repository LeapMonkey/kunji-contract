// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

interface IContractsFactory {
    function isTraderAllowed(address) external view returns (bool);

    function isInvestorAllowed(address) external view returns (bool);

    function isVaultAllowed(address) external view returns (bool);

    function isTraderWalletAllowed(address) external view returns (bool);

    function getFeeRate() external view returns (uint256);
}
