// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

interface IBaseVault {
    function underlyingTokenAddress() external view returns (address);

    function adaptersRegistryAddress() external view returns (address);

    function contractsFactoryAddress() external view returns (address);

    function currentRound() external view returns (uint256);

    function vaultProfit() external view returns (int256);

    function initialVaultBalance() external view returns (uint256);

    function afterRoundVaultBalance() external view returns (uint256);

    function setAdaptersRegistryAddress(
        address adaptersRegistryAddress
    ) external;

    function setContractsFactoryAddress(
        address contractsFactoryAddress
    ) external;
}
