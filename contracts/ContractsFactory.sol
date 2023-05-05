// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {TraderWalletDeployer} from "./factoryLibraries/TraderWalletDeployer.sol";
import {ITraderWallet} from "./interfaces/ITraderWallet.sol";
import {IUsersVault} from "./interfaces/IUsersVault.sol";

// import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import "hardhat/console.sol";

contract ContractsFactory is OwnableUpgradeable {
    uint256 public feeRate;
    address public adaptersRegistryAddress;
    
    mapping(address => bool) public investorsAllowList;
    mapping(address => bool) public tradersAllowList;

    mapping(address => bool) public deployedWallets;
    mapping(address => bool) public deployedVaults;
    mapping(address => address) public vaultsXTraderWallet;
    mapping(address => address) public traderWalletsXVault;

    error ZeroAddress(string _target);
    error InvalidCaller();
    error FeeRateError();
    error ZeroAmount();
    error InvestorNotExists();
    error TraderNotExists();
    error FailedWalletDeployment();
    error InvalidVault();
    error InvalidWallet();

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

    function initialize(uint256 _feeRate) external initializer {
        if (_feeRate > 100) revert FeeRateError();
        __Ownable_init();

        feeRate = _feeRate;
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

    function changeOwnershipToWallet(
        address _traderWalletAddress,
        address _newOwner
    ) public onlyOwner {
        // if (_msgSender() != owner() && _msgSender() != address(this))
        //     revert InvalidCaller();

        // if (!deployedWallets[_traderWalletAddress]) revert InvalidWallet();

        console.log("factory caller: ", _msgSender());
        ITraderWallet(_traderWalletAddress).transferWalletOwnership(_newOwner);
        console.log("200");
    }

    function changeOwnershipToVault(
        address _targetContract,
        address _newOwner
    ) public {
        if (_msgSender() != owner() && _msgSender() != address(this))
            revert InvalidCaller();

        if (traderWalletsXVault[address(_targetContract)] == address(0))
            revert InvalidVault();

        IUsersVault(_targetContract).transferOwnership(_newOwner);
    }

    function deployTraderWallet(
        address _underlyingTokenAddress,
        address _traderAddress,
        address _dynamicValueAddress
    ) external onlyOwner {
        (
            address proxyAddress,
            address traderWalletAddress
        ) = TraderWalletDeployer.deployTraderWallet(
                _underlyingTokenAddress,
                _traderAddress,
                _dynamicValueAddress,
                adaptersRegistryAddress,
                address(this)
            );

        if (proxyAddress == address(0) || traderWalletAddress == address(0))
            revert FailedWalletDeployment();

        deployedWallets[proxyAddress] = true;

        console.log("proxyAddress:        ", proxyAddress);
        console.log("traderWalletAddress: ", traderWalletAddress);
        console.log("this:                ", address(this));
        console.log("library:             ", address(TraderWalletDeployer));
        console.log("sender:              ", _msgSender());


        // changeOwnershipToWallet(traderWalletAddress, _msgSender());
        // ITraderWallet(traderWalletAddress).transferWalletOwnership(_msgSender());

        // mapping(address => address) public vaultsXTraderWallet;
        // mapping(address => address) public traderWalletsXVault;

        // lastTraderWalletContractAddress = address(traderWalletAddress);
    }

    // function deployUsersVault(
    //     address _underlyingTokenAddress,
    //     address _traderWalletAddress,
    //     address _dynamicValueAddress,
    //     string memory _sharesName,
    //     string memory _sharesSymbol,
    //     bool _useLastTraderWalletContracAddress
    // ) external onlyOwner {
    //     bytes32 salt = keccak256(abi.encodePacked(_msgSender(), block.number));
    //     bytes memory data = abi.encodeWithSignature(
    //         "initialize(address,address,address,address,address)",
    //         _underlyingTokenAddress,
    //         adaptersRegistryAddress,
    //         address(this),
    //         _traderAddress,
    //         _dynamicValueAddress
    //     );
    //     TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
    //         address(new TraderWallet{salt: salt}()), // Address of the contract to be proxied
    //         address(this), // Address of the contract that will own the proxy
    //         data
    //     );

    //     // mapping(address => address) public vaultsXTraderWallet;
    //     // mapping(address => address) public traderWalletsXVault;

    //     emit TraderWalletDeployed(
    //         address(proxy),
    //         _traderAddress,
    //         _underlyingTokenAddress
    //     );

    //     lastTraderWalletContractAddress = address(proxy);
    // }

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
