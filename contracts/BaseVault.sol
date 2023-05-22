// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {GMXAdapter} from "./adapters/gmx/GMXAdapter.sol";

import {Events} from "./interfaces/Events.sol";
import {Errors} from "./interfaces/Errors.sol";

import {IAdapter} from "./interfaces/IAdapter.sol";
import {IBaseVault} from "./interfaces/IBaseVault.sol";

abstract contract BaseVault is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IBaseVault,
    Errors,
    Events
{
    address public underlyingTokenAddress;
    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;

    uint256 public currentRound;
    int256 public vaultProfit;

    uint256 public initialVaultBalance;
    uint256 public afterRoundVaultBalance;

    modifier notZeroAddress(address _variable, string memory _message) {
        _checkZeroAddress(_variable, _message);
        _;
    }

    function __BaseVault_init(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _ownerAddress
    ) internal onlyInitializing {
        __Ownable_init();
        __ReentrancyGuard_init();

        __BaseVault_init_unchained(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _ownerAddress
        );
    }

    function __BaseVault_init_unchained(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _ownerAddress
    ) internal onlyInitializing {
        _checkZeroAddress(_underlyingTokenAddress, "_underlyingTokenAddress");
        _checkZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress");
        _checkZeroAddress(_contractsFactoryAddress, "_contractsFactoryAddress");
        _checkZeroAddress(_ownerAddress, "_ownerAddress");

        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;

        transferOwnership(_ownerAddress);

        GMXAdapter.__initApproveGmxPlugin();
    }

    receive() external payable {}

    /* OWNER FUNCTIONS */

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    )
        external
        onlyOwner
        notZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress")
    {
        adaptersRegistryAddress = _adaptersRegistryAddress;
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
    }

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    )
        external
        onlyOwner
        notZeroAddress(_contractsFactoryAddress, "_contractsFactoryAddress")
    {
        contractsFactoryAddress = _contractsFactoryAddress;
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
    }

    /* INTERNAL FUNCTIONS */

    function _executeOnAdapter(
        address _adapterAddress,
        uint256 _walletRatio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal returns (bool) {
        return
            IAdapter(_adapterAddress).executeOperation(
                _walletRatio,
                _traderOperation
            );
    }

    function _executeOnGmx(
        uint256 _walletRatio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal returns (bool) {
        return GMXAdapter.executeOperation(_walletRatio, _traderOperation);
    }

    function _checkZeroRound() internal view {
        if (currentRound == 0) revert InvalidRound();
    }

    function _checkZeroAddress(
        address _variable,
        string memory _message
    ) internal pure {
        if (_variable == address(0)) revert ZeroAddress({target: _message});
    }
}
