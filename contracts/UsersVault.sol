// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import "./adapters/gmx/GMXAdapter.sol";

import "hardhat/console.sol";

/// import its own interface as well

contract UsersVault is ERC4626Upgradeable, OwnableUpgradeable {
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

    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;
    address public traderWalletAddress;
    address public dynamicValueAddress;
    mapping(uint256 => address) public adaptersPerProtocol;
    address[] public traderSelectedAdaptersArray;

    uint256 public currentRound;

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

    error InvalidTime(uint256 timestamp);
    error InvalidRound();

    error ExistingWithdraw();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error UnderlyingAssetNotAllowed();
    error BatchNotClosed();
    error WithdrawNotInitiated();
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

    event AdapterToUseAdded(
        uint256 protocolId,
        address indexed adapter,
        address indexed trader
    );
    event AdapterToUseRemoved(address indexed adapter, address indexed trader);

    event SharesClaimed(
        uint256 round,
        uint256 shares,
        address owner,
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
        // __Pausable_init();
        __ERC4626_init(IERC20Upgradeable(_underlyingTokenAddress));
        __ERC20_init(_sharesName, _sharesSymbol);

        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderWalletAddress = _traderWalletAddress;
        dynamicValueAddress = _dynamicValueAddress;
        currentRound = 0;
    }

    function deposit(
        uint256 _assetsAmount,
        address _receiver
    ) public virtual override returns (uint256) {
        _assetsAmount; // avoid warnings
        _receiver; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function mint(
        uint256 _sharesAmount,
        address _receiver
    ) public virtual override returns (uint256) {
        _sharesAmount; // avoid warnings
        _receiver; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function withdraw(
        uint256 _assetsAmount,
        address _receiver,
        address _owner
    ) public virtual override returns (uint256) {
        _assetsAmount; // avoid warnings
        _receiver; // avoid warnings
        _owner; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function redeem(
        uint256 _sharesAmount,
        address _receiver,
        address _owner
    ) public virtual override returns (uint256) {
        _sharesAmount; // avoid warnings
        _receiver; // avoid warnings
        _owner; // avoid warnings
        revert FunctionCallNotAllowed();
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

    function userDeposit(uint256 _assetsAmount) external {
        _onlyValidInvestors(_msgSender());

        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(asset()),
            _msgSender(),
            address(this),
            _assetsAmount
        );

        emit Deposit(_msgSender(), _msgSender(), _assetsAmount, 0);

        // good only for first time (round zero)
        uint256 assetPerShare = 1e18;
        // uint256 assetPerShare = 500000000000000000;

        if (currentRound != 0) {
            if (
                userDeposits[_msgSender()].round < currentRound &&
                userDeposits[_msgSender()].pendingAssets > 0
            ) {
                assetPerShare = assetsPerShareXRound[
                    userDeposits[_msgSender()].round
                ];
            }
        }

        userDeposits[_msgSender()].pendingAssets =
            userDeposits[_msgSender()].pendingAssets +
            _assetsAmount;

        userDeposits[_msgSender()].unclaimedShares =
            userDeposits[_msgSender()].unclaimedShares +
            _assetsAmount.mulDiv(1e18, assetPerShare);

        userDeposits[_msgSender()].round = currentRound;

        pendingDepositAssets += _assetsAmount;
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function withdrawalRequest(
        // address _caller,
        // address _receiver,
        // address _owner,
        uint256 _assetsAmount,
        uint256 _sharesAmount
    ) external {
        _onlyValidInvestors(_msgSender());
        _checkRound();
        _burn(_msgSender(), _sharesAmount);

        emit Withdraw(
            _msgSender(),
            _msgSender(),
            _msgSender(),
            _assetsAmount,
            _sharesAmount
        );

        uint256 userWithdrawShares = userWithdrawals[_msgSender()]
            .pendingShares;

        //Convert previous round glp balance into unredeemed shares
        uint256 userWithdrawalRound = userWithdrawals[_msgSender()].round;
        if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
            uint256 assetsPerShare = assetsPerShareXRound[userWithdrawalRound];
            userWithdrawals[_msgSender()].unclaimedAssets += userWithdrawShares
                .mulDiv(assetsPerShare, 1e18);
            userWithdrawShares = 0;
        }

        //Update round and glp balance for current round
        userWithdrawals[_msgSender()].round = currentRound;
        userWithdrawals[_msgSender()].pendingShares =
            userWithdrawShares +
            _sharesAmount;
        pendingWithdrawShares += _sharesAmount;
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

    //
    //
    function underlyingLiquidity() public view returns (uint256) {
        return
            IERC20Upgradeable(asset()).balanceOf(address(this)) -
            pendingDepositAssets -
            processedWithdrawAssets;
    }

    //
    //
    function rolloverFromTrader() external {
        if (pendingDepositAssets == 0 && pendingWithdrawShares == 0)
            revert InvalidRollover();

        uint256 assetsPerShare;
        uint256 sharesToMint;

        if (currentRound != 0) {
            /////////////////////////////////////////////////////////////////////
            assetsPerShare = underlyingLiquidity().mulDiv(1e18, totalSupply());
            sharesToMint = pendingDepositAssets.mulDiv(assetsPerShare, 1e18);
            /////////////////////////////////////////////////////////////////////
        } else {
            // store the first ratio between shares and deposit
            assetsPerShare = 1e18;
            sharesToMint = IERC20Upgradeable(asset()).balanceOf(address(this));
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
                IERC20Upgradeable(asset()).balanceOf(address(this)) <
                    processedWithdrawAssets,
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
    }

    function claimShares(uint256 _sharesAmount, address _receiver) public {
        _checkRound();

        //Convert previous round glp balance into unredeemed shares
        if (
            userDeposits[_msgSender()].round < currentRound &&
            userDeposits[_msgSender()].pendingAssets > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userDeposits[_msgSender()].round
            ];

            userDeposits[_msgSender()].unclaimedShares =
                userDeposits[_msgSender()].unclaimedShares +
                userDeposits[_msgSender()].pendingAssets.mulDiv(
                    1e18,
                    assetsPerShare
                );
            
            userDeposits[_msgSender()].pendingAssets = 0;
        }

        if (userDeposits[_msgSender()].unclaimedShares < _sharesAmount)
            revert InsufficientShares(
                userDeposits[_msgSender()].unclaimedShares
            );

        userDeposits[_msgSender()].unclaimedShares =
            userDeposits[_msgSender()].unclaimedShares -
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
        uint256 userUnclaimedAssets = userWithdrawals[_msgSender()]
            .unclaimedAssets;
        uint256 userWithdrawShares = userWithdrawals[_msgSender()]
            .pendingShares;
        {
            uint256 userWithdrawalRound = userWithdrawals[_msgSender()].round;
            if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
                uint256 assetsPerShare = assetsPerShareXRound[
                    userWithdrawalRound
                ];
                userUnclaimedAssets += userWithdrawShares.mulDiv(
                    assetsPerShare,
                    1e18
                );
                userWithdrawals[_msgSender()].pendingShares = 0;
            }
        }

        if (userUnclaimedAssets < _assetsAmount)
            revert InsufficientAssets(userUnclaimedAssets);

        userWithdrawals[_msgSender()].unclaimedAssets =
            userUnclaimedAssets -
            _assetsAmount;

        emit AssetsClaimed(
            currentRound,
            _assetsAmount,
            _msgSender(),
            _receiver
        );

        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(asset()),
            _receiver,
            _assetsAmount
        );
    }

    // function claimAllShares(
    //     address _receiver
    // ) external returns (uint256 _sharesAmount) {
    //     _sharesAmount = balanceOf(_msgSender());
    //     claimShares(_sharesAmount, _receiver);
    // }

    // function claimAllAssets(
    //     address _receiver
    // ) external returns (uint256 _assetsAmount) {
    //     _assetsAmount = balanceOf(_msgSender());
    //     claimAssets(_assetsAmount, _receiver);
    // }

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
