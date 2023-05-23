// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {UsersVault} from "../UsersVault.sol";

contract UsersVaultV2 is UsersVault {
    // added variable
    uint256 public addedVariable;

    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        address _ownerAddress,
        string memory _sharesName,
        string memory _sharesSymbol
    ) external override initializer {
        __UsersVault_init(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _traderWalletAddress,
            _ownerAddress,
            _sharesName,
            _sharesSymbol
        );
    }

    function addedMethod(uint256 _newValue) external {
        addedVariable = _newValue;
    }
}
