// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
// import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {TraderWallet} from "./TraderWallet.sol";
import {UsersVault} from "./UsersVault.sol";

// import "hardhat/console.sol";

contract ContractsFactory is OwnableUpgradeable {
    uint256 public feeRate;
    address public adaptersRegistryAddress;
    address public lastTraderWalletContractAddress;

    mapping(address => bool) public investorsAllowList;
    mapping(address => bool) public tradersAllowList;
    mapping(address => address) public vaultsXTraderWallet;
    mapping(address => address) public traderWalletsXVault;

    error ZeroAddress(string _target);
    error FeeRateError();
    error ZeroAmount();
    error InvestorNotExists();
    error TraderNotExists();

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

    modifier notZeroAddress(address _receivedAddress, string memory _message) {
        if (_receivedAddress == address(0))
            revert ZeroAddress({_target: _message});
        _;
    }

    function initialize(
        address _adaptersRegistryAddress,
        uint256 _feeRate
    ) external initializer {
        if (_adaptersRegistryAddress == address(0))
            revert ZeroAddress({_target: "_adaptersRegistryAddress"});
        if (_feeRate > 100) revert FeeRateError();
        __Ownable_init();

        feeRate = _feeRate;
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function addInvestor(
        address _investorAddress
    ) external onlyOwner notZeroAddress(_investorAddress, "_investorAddress") {
        investorsAllowList[_investorAddress] = true;
        emit InvestorAdded(_investorAddress);
    }

    function removeInvestor(
        address _investorAddress
    ) external onlyOwner notZeroAddress(_investorAddress, "_investorAddress") {
        if (!investorsAllowList[_investorAddress]) {
            revert InvestorNotExists();
        }
        emit InvestorRemoved(_investorAddress);
        delete investorsAllowList[_investorAddress];
    }

    function addTrader(
        address _traderAddress
    ) external onlyOwner notZeroAddress(_traderAddress, "_traderAddress") {
        tradersAllowList[_traderAddress] = true;
        emit TraderAdded(_traderAddress);
    }

    function removeTrader(
        address _traderAddress
    ) external onlyOwner notZeroAddress(_traderAddress, "_traderAddress") {
        if (!tradersAllowList[_traderAddress]) {
            revert TraderNotExists();
        }
        emit TraderRemoved(_traderAddress);
        delete tradersAllowList[_traderAddress];
    }

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    )
        external
        onlyOwner
        notZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress")
    {
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
        address _dynamicValueAddress
    ) external onlyOwner {
        // Deploy contract B
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.number));
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,address,address,address)",
            _underlyingTokenAddress,
            adaptersRegistryAddress,
            address(this),
            _traderAddress,
            _dynamicValueAddress
        );
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(new TraderWallet{salt: salt}()), // Address of the contract to be proxied
            address(this), // Address of the contract that will own the proxy
            data
        );

        // mapping(address => address) public vaultsXTraderWallet;
        // mapping(address => address) public traderWalletsXVault;

        emit TraderWalletDeployed(
            address(proxy),
            _traderAddress,
            _underlyingTokenAddress
        );

        lastTraderWalletContractAddress = address(proxy);
    }

    function deployUsersVault() external onlyOwner {}

    function _authorizeUpgrade(address newImplementation) internal virtual {
        newImplementation;
    }

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

    function getComissionPercentage() external view returns (uint256) {
        return feeRate;
    }
}
