// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


//// DESPUES DEL DEPLOY DE LA WALLET Y LA VAULT
//// HAY QUE SETEAR EN LA VAULT, LA WALLET
//// Y EN LA WALLET LA VAULT


contract ContractsFactoryMock is OwnableUpgradeable {
    bool public returnValue;

    function initialize() external initializer {}

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }

    function isTraderAllowed(address _trader) external view returns (bool) {
        _trader; // just to avoid warnings
        return returnValue;
    }

    function isInvestorAllowed(address _investor) external view returns (bool) {
        _investor; // just to avoid warnings
        return returnValue;
    }

    function isTraderWalletAllowed(
        address _contract
    ) external view returns (bool) {
        _contract; // just to avoid warnings
        return returnValue;
    }

    function isVaultWalletAllowed(
        address _vault
    ) external view returns (bool) {
        _vault; // just to avoid warnings
        return returnValue;
    }
}

