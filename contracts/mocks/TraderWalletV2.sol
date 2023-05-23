// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {TraderWallet} from "../TraderWallet.sol";

/// import its own interface as well

contract TraderWalletV2 is TraderWallet {
    // added variable
    uint256 public addedVariable;

    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderAddress,
        address _ownerAddress
    ) external override initializer {
        __TraderWallet_init(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _traderAddress,
            _ownerAddress
        );
    }

    // added method
    function addedMethod(uint256 _newValue) external {
        addedVariable = _newValue;
    }
}
