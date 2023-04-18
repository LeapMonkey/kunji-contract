// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import "./adapters/gmx/GMXAdapter.sol";

import "hardhat/console.sol";

/// import its own interface as well

contract UsersVault is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using MathUpgradeable for uint256;
    using SafeCastUpgradeable for uint256;

    struct UserDeposit {
        uint256 round;
        uint256 pendingAssets;
        uint256 unclaimedShares;
    }
    struct UserWithdrawal {
        uint256 round;
        uint256 pendingShares;
        uint256 unclaimedAssets;
    }

    address public underlyingTokenAddress;
    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;
    address public traderWalletAddress;
    address public dynamicValueAddress;
    mapping(uint256 => address) public adaptersPerProtocol;
    address[] public traderSelectedAdaptersArray;

    uint256 public currentRound;
    uint256 public initialVaultBalance;
    uint256 public afterRoundVaultBalance;

    // Total amount of total deposit assets in mapped round
    uint256 public pendingDepositAssets;

    // Total amount of total withdrawal shares in mapped round
    uint256 public pendingWithdrawShares;
    uint256 public processedWithdrawAssets;
    uint256 public ratioShares;

    // user specific deposits accounting
    mapping(address => UserDeposit) public userDeposits;

    // user specific withdrawals accounting
    mapping(address => UserWithdrawal) public userWithdrawals;

    mapping(uint256 => uint256) public assetsPerShareXRound;

    error ZeroAddress(string target);
    error ZeroAmount();
    error FunctionCallNotAllowed();
    error UserNotAllowed();
    error SafeTransferFailed();

    // error InvalidTime(uint256 timestamp);
    error InvalidRound();

    // error ExistingWithdraw();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error UnderlyingAssetNotAllowed();
    // error BatchNotClosed();
    // error WithdrawNotInitiated();
    error InvalidRollover();
    error NewTraderNotAllowed();
    error InvalidProtocol();
    error InvalidAdapter();
    error AdapterOperationFailed(string target);
    error UsersVaultOperationFailed();
    error ApproveFailed(address caller, address token, uint256 amount);

    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);
    event TraderAddressSet(address indexed traderAddress);
    event DynamicValueAddressSet(address indexed dynamicValueAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);

    event AdapterToUseAdded(
        uint256 protocolId,
        address indexed adapter,
        address indexed trader
    );
    event AdapterToUseRemoved(address indexed adapter, address indexed trader);

    event UserDeposited(address indexed caller, uint256 assetsAmount);
    event WithdrawRequest(address indexed caller, uint256 sharesAmount);

    event SharesClaimed(
        uint256 round,
        uint256 shares,
        address caller,
        address receiver
    );
    event AssetsClaimed(
        uint256 round,
        uint256 assets,
        address owner,
        address receiver
    );
    event BatchRollover(
        uint256 round,
        uint256 newDeposit,
        uint256 newWithdrawal
    );

    event OperationExecuted(
        uint256 protocolId,
        uint256 timestamp,
        string target,
        uint256 initialBalance,
        uint256 walletRatio
    );


    // if (_tokenAddress != asset()) revert UnderlyingAssetNotAllowed();

    // this is the shares token
    // constructor() ERC20("name", "symbol) ERC4626(...) {}
    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        address _dynamicValueAddress,
        string memory _sharesName,
        string memory _sharesSymbol
    ) external initializer {
        // CHECK CALLER IS THE FACTORY
        // CHECK TRADER IS ALLOWED

        if (_underlyingTokenAddress == address(0))
            revert ZeroAddress({target: "_underlyingTokenAddress"});
        if (_adaptersRegistryAddress == address(0))
            revert ZeroAddress({target: "_adaptersRegistryAddress"});
        if (_contractsFactoryAddress == address(0))
            revert ZeroAddress({target: "_contractsFactoryAddress"});
        if (_traderWalletAddress == address(0))
            revert ZeroAddress({target: "_traderAddress"});

        if (_dynamicValueAddress == address(0))
            revert ZeroAddress({target: "_dynamicValueAddress"});

        __Ownable_init();
        __Pausable_init();
        __ERC20_init(_sharesName, _sharesSymbol);

        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderWalletAddress = _traderWalletAddress;
        dynamicValueAddress = _dynamicValueAddress;
        currentRound = 0;
        // currentRound = 1;
    }

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    ) external {
        _checkOwner();
        _checkAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress");
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function setDynamicValueAddress(address _dynamicValueAddress) external {
        _checkOwner();
        _checkAddress(_dynamicValueAddress, "_dynamicValueAddress");
        emit DynamicValueAddressSet(_dynamicValueAddress);
        dynamicValueAddress = _dynamicValueAddress;
    }

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    ) external {
        _checkOwner();
        _checkAddress(_contractsFactoryAddress, "_contractsFactoryAddress");
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
        contractsFactoryAddress = _contractsFactoryAddress;
    }

    function setTraderWalletAddress(address _traderWalletAddress) external {
        _checkOwner();
        _checkAddress(_traderWalletAddress, "_traderWalletAddress");
        if (
            !IContractsFactory(contractsFactoryAddress).isTraderAllowed(
                _traderWalletAddress
            )
        ) revert NewTraderNotAllowed();

        emit TraderAddressSet(_traderWalletAddress);
        traderWalletAddress = _traderWalletAddress;
    }

    function setUnderlyingTokenAddress(
        address _underlyingTokenAddress
    ) external {
        _checkOwner();
        _checkAddress(_underlyingTokenAddress, "_underlyingTokenAddress");
        emit UnderlyingTokenAddressSet(_underlyingTokenAddress);
        underlyingTokenAddress = _underlyingTokenAddress;
    }

    function userDeposit(uint256 _assetsAmount) external {
        _onlyValidInvestors(_msgSender());

        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(underlyingTokenAddress),
            _msgSender(),
            address(this),
            _assetsAmount
        );

        emit UserDeposited(_msgSender(), _assetsAmount);

        // good only for first time (round zero)
        uint256 assetPerShare = 1e18;
        // uint256 assetPerShare = 500000000000000000;

        // converts previous pending assets to shares using assetsPerShare value from rollover
        // set pending asset to zero
        if (
            userDeposits[_msgSender()].round < currentRound &&
            userDeposits[_msgSender()].pendingAssets > 0
        ) {
            assetPerShare = assetsPerShareXRound[
                userDeposits[_msgSender()].round
            ];

            userDeposits[_msgSender()].unclaimedShares =
                userDeposits[_msgSender()].unclaimedShares +
                userDeposits[_msgSender()].pendingAssets.mulDiv(
                    1e18,
                    assetPerShare
                );

            userDeposits[_msgSender()].pendingAssets = 0;
        }

        userDeposits[_msgSender()].round = currentRound;

        userDeposits[_msgSender()].pendingAssets =
            userDeposits[_msgSender()].pendingAssets +
            _assetsAmount;

        pendingDepositAssets += _assetsAmount;
    }

    function withdrawRequest(uint256 _sharesAmount) external {
        _onlyValidInvestors(_msgSender());
        _checkRound();

        // CHECK QTY ??
        emit WithdrawRequest(_msgSender(), _sharesAmount);
        _burn(_msgSender(), _sharesAmount);

        // Convert previous round pending shares into unclaimed assets
        if (
            userWithdrawals[_msgSender()].round < currentRound &&
            userWithdrawals[_msgSender()].pendingShares > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userWithdrawals[_msgSender()].round
            ];
            userWithdrawals[_msgSender()].unclaimedAssets =
                userWithdrawals[_msgSender()].unclaimedAssets +
                userWithdrawals[_msgSender()].pendingShares.mulDiv(
                    assetsPerShare,
                    1e18
                );
            userWithdrawals[_msgSender()].pendingShares = 0;
        }

        // Update round and glp balance for current round
        userWithdrawals[_msgSender()].round = currentRound;
        userWithdrawals[_msgSender()].pendingShares =
            userWithdrawals[_msgSender()].pendingShares +
            _sharesAmount;

        pendingWithdrawShares = pendingWithdrawShares + _sharesAmount;
    }

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external returns (bool) {
        _checkOwner();
        // check if protocolId is valid
        address adapterAddress = adaptersPerProtocol[_protocolId];
        if (adapterAddress == address(0)) revert InvalidAdapter();

        uint256 amount;
        if (!_revoke) amount = type(uint256).max;
        else amount = 0;

        if (!IERC20Upgradeable(_tokenAddress).approve(adapterAddress, amount)) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: _tokenAddress,
                amount: amount
            });
        }

        return true;
    }

    function executeOnProtocol(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _traderOperation,
        uint256 _walletRatio
    ) external returns (bool) {
        /*
            onlyTrader
            onlyValidProtocolId(_protocolId)
        */

        // check if protocolId is valid
        address adapterAddress = adaptersPerProtocol[_protocolId];
        if (adapterAddress == address(0)) revert InvalidAdapter();

        bool success = false;
        if (_protocolId == 1) {
            success = _executeOnGmx(_walletRatio, _traderOperation);
        } else {
            success = _executeOnAdapter(
                adapterAddress,
                _walletRatio,
                _traderOperation
            );
        }

        // check operation success
        if (!success) revert AdapterOperationFailed({target: "vault"});

        // contract should receive tokens HERE

        emit OperationExecuted(
            _protocolId,
            block.timestamp,
            "trader wallet",
            initialVaultBalance,
            _walletRatio
        );
        return true;
    }

    function _executeOnGmx(
        uint256 _ratio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal pure returns (bool) {
        return GMXAdapter.executeOperation(_ratio, _traderOperation);
    }

    // @todo add implementation
    function _executeOnAdapter(
        address _adapterAddress,
        uint256 _ratio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal returns (bool) {
        return
            IAdapter(_adapterAddress).executeOperation(
                _ratio,
                _traderOperation
            );
    }

    //
    //
    function getUnderlyingLiquidity() public view returns (uint256) {
        return
            IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this)) -
            pendingDepositAssets -
            processedWithdrawAssets;
    }

    //
    //
    function rolloverFromTrader() external returns (bool) {
        // CALLER IS ONLY VAULT
        if (pendingDepositAssets == 0 && pendingWithdrawShares == 0)
            revert InvalidRollover();

        uint256 assetsPerShare;
        uint256 sharesToMint;

        if (currentRound != 0) {
            assetsPerShare = getUnderlyingLiquidity().mulDiv(1e18, totalSupply());
            sharesToMint = pendingDepositAssets.mulDiv(assetsPerShare, 1e18);
        } else {
            // store the first ratio between shares and deposit
            assetsPerShare = 1e18;
            sharesToMint = IERC20Upgradeable(underlyingTokenAddress).balanceOf(
                address(this)
            );
        }

        // mint the shares for the contract so users can claim their shares
        _mint(address(this), sharesToMint);
        assetsPerShareXRound[currentRound] = assetsPerShare;

        // Accept all pending deposits
        pendingDepositAssets = 0;

        // Process all withdrawals
        processedWithdrawAssets = assetsPerShare.mulDiv(
            pendingWithdrawShares,
            1e18
        );

        // Revert if the assets required for withdrawals < asset balance present in the vault
        if (processedWithdrawAssets > 0) {
            require(
                IERC20Upgradeable(underlyingTokenAddress).balanceOf(
                    address(this)
                ) < processedWithdrawAssets,
                "Not enough assets for withdrawal"
            );
        }

        // Make pending withdrawals 0
        pendingWithdrawShares = 0;

        emit BatchRollover(
            currentRound,
            pendingDepositAssets,
            pendingWithdrawShares
        );

        currentRound++;

        return true;
    }
    
    function previewShares(address _receiver) external view returns (uint256) {
        _checkRound();

        if (
            userDeposits[_receiver].round < currentRound &&
            userDeposits[_receiver].pendingAssets > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userDeposits[_receiver].round
            ];

            return
                userDeposits[_receiver].unclaimedShares +
                userDeposits[_receiver].pendingAssets.mulDiv(
                    1e18,
                    assetsPerShare > 0 ? assetsPerShare : 1e18
                );
        }

        return userDeposits[_receiver].unclaimedShares;
    }

    function claimShares(uint256 _sharesAmount, address _receiver) public {
        _checkRound();
        // CHECK CALLER

        // Convert previous round glp balance into unredeemed shares
        if (
            userDeposits[_receiver].round < currentRound &&
            userDeposits[_receiver].pendingAssets > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userDeposits[_receiver].round
            ];

            userDeposits[_receiver].unclaimedShares =
                userDeposits[_receiver].unclaimedShares +
                userDeposits[_receiver].pendingAssets.mulDiv(
                    1e18,
                    assetsPerShare
                );

            userDeposits[_receiver].pendingAssets = 0;
        }

        if (userDeposits[_receiver].unclaimedShares < _sharesAmount)
            revert InsufficientShares(userDeposits[_receiver].unclaimedShares);

        userDeposits[_receiver].unclaimedShares =
            userDeposits[_receiver].unclaimedShares -
            _sharesAmount;

        emit SharesClaimed(
            currentRound,
            _sharesAmount,
            _msgSender(),
            _receiver
        );

        transfer(_receiver, _sharesAmount);
    }

    function claimAssets(uint256 _assetsAmount, address _receiver) public {

        // check caller

        if (
            userWithdrawals[_msgSender()].round < currentRound &&
            userWithdrawals[_msgSender()].pendingShares > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userWithdrawals[_msgSender()].round
            ];
            userWithdrawals[_msgSender()].unclaimedAssets += userWithdrawals[
                _msgSender()
            ].pendingShares.mulDiv(assetsPerShare, 1e18);
            userWithdrawals[_msgSender()].pendingShares = 0;
        }

        if (userWithdrawals[_msgSender()].unclaimedAssets < _assetsAmount)
            revert InsufficientAssets(
                userWithdrawals[_msgSender()].unclaimedAssets
            );

        userWithdrawals[_msgSender()].unclaimedAssets =
            userWithdrawals[_msgSender()].unclaimedAssets -
            _assetsAmount;

        emit AssetsClaimed(
            currentRound,
            _assetsAmount,
            _msgSender(),
            _receiver
        );

        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(underlyingTokenAddress),
            _receiver,
            _assetsAmount
        );
    }

    function claimAllShares(
        address _receiver
    ) external returns (uint256 _sharesAmount) {
        _sharesAmount = balanceOf(_msgSender());
        claimShares(_sharesAmount, _receiver);
    }

    function claimAllAssets(
        address _receiver
    ) external returns (uint256 _assetsAmount) {
        _assetsAmount = balanceOf(_msgSender());
        claimAssets(_assetsAmount, _receiver);
    }

    function getSharesContractBalance() external view returns (uint256) {
        return this.balanceOf(address(this));
    }

    function _checkAddress(
        address _variable,
        string memory _message
    ) internal pure {
        if (_variable == address(0)) revert ZeroAddress({target: _message});
    }

    function _onlyValidInvestors(address _account) internal view {
        if (
            !IContractsFactory(contractsFactoryAddress).isInvestorAllowed(
                _account
            )
        ) revert UserNotAllowed();
    }

    function _checkRound() internal view {
        if (currentRound == 0) revert InvalidRound();
    }
}
