// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {TraderWalletDeployer} from "./factoryLibraries/TraderWalletDeployer.sol";
import {UsersVaultDeployer} from "./factoryLibraries/UsersVaultDeployer.sol";

// import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
// import "hardhat/console.sol";

contract ContractsFactory is OwnableUpgradeable {
    uint256 public feeRate;
    address public adaptersRegistryAddress;

    mapping(address => bool) public investorsAllowList;
    mapping(address => bool) public tradersAllowList;

    // wallet ==> Underlying
    mapping(address => address) public underlyingPerDeployedWallet;
    // vault ==> wallet
    mapping(address => address) public walletPerDeployedVault;

    error ZeroAddress(string _target);
    error InvalidCaller();
    error FeeRateError();
    error ZeroAmount();
    error InvestorNotExists();
    error TraderNotExists();
    error FailedWalletDeployment();
    error FailedVaultDeployment();
    error InvalidWallet();
    error InvalidVault();
    error InvalidTrader();

    event FeeRateSet(uint256 _newFeeRate);
    event InvestorAdded(address indexed _investorAddress);
    event InvestorRemoved(address indexed _investorAddress);
    event TraderAdded(address indexed _traderAddress);
    event TraderRemoved(address indexed _traderAddress);
    event AdaptersRegistryAddressSet(address indexed _adaptersRegistryAddress);
    event TraderWalletDeployed(
        address indexed _traderWalletAddress,
        address indexed _traderAddress,
        address indexed _underlyingTokenAddress
    );
    event UsersVaultDeployed(
        address indexed _usersVaultAddress,
        address indexed _traderAddress,
        address indexed _underlyingTokenAddress
    );
    event OwnershipToWalletChanged(
        address indexed traderWalletAddress,
        address indexed newOwner
    );
    event OwnershipToVaultChanged(
        address indexed usersVaultAddress,
        address indexed newOwner
    );

    function initialize(uint256 _feeRate) external initializer {
        if (_feeRate > (1e18 * 100)) revert FeeRateError();
        __Ownable_init();

        feeRate = _feeRate;
    }

    function addInvestor(address _investorAddress) external onlyOwner {
        _checkZeroAddress(_investorAddress, "_investorAddress");
        investorsAllowList[_investorAddress] = true;
        emit InvestorAdded(_investorAddress);
    }

    function removeInvestor(address _investorAddress) external onlyOwner {
        _checkZeroAddress(_investorAddress, "_investorAddress");
        if (!investorsAllowList[_investorAddress]) {
            revert InvestorNotExists();
        }
        emit InvestorRemoved(_investorAddress);
        delete investorsAllowList[_investorAddress];
    }

    function addTrader(address _traderAddress) external onlyOwner {
        _checkZeroAddress(_traderAddress, "_traderAddress");
        tradersAllowList[_traderAddress] = true;
        emit TraderAdded(_traderAddress);
    }

    function removeTrader(address _traderAddress) external onlyOwner {
        _checkZeroAddress(_traderAddress, "_traderAddress");
        if (!tradersAllowList[_traderAddress]) {
            revert TraderNotExists();
        }
        emit TraderRemoved(_traderAddress);
        delete tradersAllowList[_traderAddress];
    }

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    ) external onlyOwner {
        _checkZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress");
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function setFeeRate(uint256 _newFeeRate) external onlyOwner {
        if (_newFeeRate > 100) revert FeeRateError();
        emit FeeRateSet(_newFeeRate);
        feeRate = _newFeeRate;
    }

    function deployTraderWallet(
        address _underlyingTokenAddress,
        address _traderAddress,
        address _owner
    ) external onlyOwner {
        _checkZeroAddress(_underlyingTokenAddress, "_underlyingTokenAddress");
        _checkZeroAddress(_traderAddress, "_traderAddress");
        _checkZeroAddress(_owner, "_owner");
        _checkZeroAddress(adaptersRegistryAddress, "adaptersRegistryAddress");
        if (tradersAllowList[_traderAddress]) revert InvalidTrader();

        address proxyAddress = TraderWalletDeployer.deployTraderWallet(
            _underlyingTokenAddress,
            _traderAddress,
            adaptersRegistryAddress,
            address(this),
            _owner
        );

        if (proxyAddress == address(0)) revert FailedWalletDeployment();

        underlyingPerDeployedWallet[proxyAddress] = _underlyingTokenAddress;
    }

    function deployUsersVault(
        address _traderWalletAddress,
        address _owner,
        string memory _sharesName,
        string memory _sharesSymbol
    ) external onlyOwner {
        _checkZeroAddress(_traderWalletAddress, "_traderWalletAddress");
        _checkZeroAddress(_owner, "_owner");

        // get underlying from wallet
        address underlyingTokenAddress = underlyingPerDeployedWallet[
            _traderWalletAddress
        ];

        if (underlyingTokenAddress == address(0)) revert InvalidWallet();

        address proxyAddress = UsersVaultDeployer.deployUsersVault(
            underlyingTokenAddress,
            adaptersRegistryAddress,
            address(this),
            _traderWalletAddress,
            _owner,
            _sharesName,
            _sharesSymbol
        );

        if (proxyAddress == address(0)) revert FailedVaultDeployment();

        walletPerDeployedVault[proxyAddress] = _traderWalletAddress;
    }

    // disable vault/wallet
    // change mapping of vault and trader wallet

    function isTraderAllowed(
        address _traderAddress
    ) external view returns (bool) {
        return tradersAllowList[_traderAddress];
    }

    function isInvestorAllowed(
        address _investorAddress
    ) external view returns (bool) {
        return investorsAllowList[_investorAddress];
    }

    function getFeeRate() external view returns (uint256) {
        return feeRate;
    }

    function isTraderWalletAllowed(
        address _traderWalletAddress
    ) external view returns (bool) {
        if (underlyingPerDeployedWallet[_traderWalletAddress] != address(0))
            return true;
        return false;
    }

    function isVaultAllowed(
        address _usersVaultAddress
    ) external view returns (bool) {
        if (walletPerDeployedVault[_usersVaultAddress] != address(0))
            return true;
        return false;
    }

    function _checkZeroAddress(
        address _variable,
        string memory _message
    ) internal pure {
        if (_variable == address(0)) revert ZeroAddress({_target: _message});
    }
}
