// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {IERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

/// import its own interface as well

contract UsersVault is
    ERC4626Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using MathUpgradeable for uint256;
    using MathUpgradeable for uint128;
    using SafeCastUpgradeable for uint256;

    error ZeroAmount();

    error InvalidTime(uint256 timestamp);
    error InvalidRound(uint256 inputRound, uint256 currentRound);

    error ExistingWithdraw();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);

    error BatchNotClosed();
    error WithdrawNotInitiated();
    error InvalidRolloverBatch();

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

    struct UserDeposit {
        uint256 round;
        uint128 pendingAssets;
        uint128 unclaimedShares;
    }
    struct UserWithdrawal {
        uint256 round;
        uint128 pendingShares;
        uint128 unclaimedAssets;
    }

    uint256 public currentRound = 1;
    // Total amount of total deposit assets in mapped round
    uint128 public pendingDepositAssets;
    // Total amount of total withdrawal shares in mapped round
    uint128 public pendingWithdrawShares;
    uint128 public processedWithdrawAssets;
    // user specific deposits accounting
    mapping(address => UserDeposit) public userDeposits;
    // user specific withdrawals accounting
    mapping(address => UserWithdrawal) public userWithdrawals;

    mapping(uint256 => uint256) internal batchAssetsPerShareX128;

    uint256 internal constant Q128 = 1 << 128;

    function initialize() external initializer {
        __Ownable_init();
        __Pausable_init();
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        // If _asset is ERC777, `transferFrom` can trigger a reenterancy BEFORE the transfer happens through the
        // `tokensToSend` hook. On the other hand, the `tokenReceived` hook, that is triggered after the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer before we mint so that any reentrancy would happen before the
        // assets are transferred and before the shares are minted, which is a valid state.
        // slither-disable-next-line reentrancy-no-eth
        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(asset()),
            caller,
            address(this),
            assets
        );
        // _mint(receiver, shares);

        // Create a deposit receipt, user can mint once batch is executed
        _createDepositReceipt(assets, receiver);

        emit Deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal virtual override {
        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        // If _asset is ERC777, `transfer` can trigger a reentrancy AFTER the transfer happens through the
        // `tokensReceived` hook. On the other hand, the `tokensToSend` hook, that is triggered before the transfer,
        // calls the vault, which is assumed not malicious.
        //
        // Conclusion: we need to do the transfer after the burn so that any reentrancy would happen after the
        // shares are burned and after the assets are transferred, which is a valid state.
        _burn(owner, shares);
        // SafeERC20Upgradeable.safeTransfer(_asset, receiver, assets);
        _createWithdrawalReceipt(shares, owner);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    function _createDepositReceipt(uint256 assets, address receiver) internal {
        UserDeposit storage userDeposit = userDeposits[receiver];
        uint128 userDepositAssets = userDeposit.pendingAssets;

        //Convert previous round glp balance into unredeemed shares
        uint256 userDepositRound = userDeposit.round;
        if (userDepositRound < currentRound && userDepositAssets > 0) {
            uint256 assetPerShareX128 = batchAssetsPerShareX128[
                userDepositRound
            ];
            userDeposit.unclaimedShares += userDeposit
                .pendingAssets
                .mulDiv(Q128, assetPerShareX128)
                .toUint128();
            userDepositAssets = 0;
        }

        //Update round and glp balance for current round
        userDeposit.round = currentRound;
        userDeposit.pendingAssets = userDepositAssets + assets.toUint128();
        pendingDepositAssets += assets.toUint128();
    }

    function _createWithdrawalReceipt(uint256 shares, address owner) internal {
        UserWithdrawal storage userWithdrawal = userWithdrawals[owner];
        uint128 userWithdrawShares = userWithdrawal.pendingShares;

        //Convert previous round glp balance into unredeemed shares
        uint256 userWithdrawalRound = userWithdrawal.round;
        if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
            uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                userWithdrawalRound
            ];
            userWithdrawal.unclaimedAssets += userWithdrawShares
                .mulDiv(assetsPerShareX128, Q128)
                .toUint128();
            userWithdrawShares = 0;
        }

        //Update round and glp balance for current round
        userWithdrawal.round = currentRound;
        userWithdrawal.pendingShares = userWithdrawShares + shares.toUint128();
        pendingWithdrawShares += shares.toUint128();
    }
/*
    function totalAssets()
        public
        view
        virtual
        override(ERC4626Upgradeable, IERC4626Upgradeable)
        returns (uint256)
    {
        // Balance of USDC + Value of positions on adapters
        return
            IERC20Upgradeable(asset()).balanceOf(address(this)) -
            pendingDepositAssets -
            processedWithdrawAssets;
    }
*/
    function rolloverBatch() external virtual {
        if (pendingDepositAssets == 0 && pendingWithdrawShares == 0)
            revert InvalidRolloverBatch();

        uint256 assetsPerShareX128 = totalAssets().mulDiv(Q128, totalSupply());
        batchAssetsPerShareX128[currentRound] = assetsPerShareX128;

        // Accept all pending deposits
        pendingDepositAssets = 0;

        // Process all withdrawals
        processedWithdrawAssets = assetsPerShareX128
            .mulDiv(pendingWithdrawShares, Q128)
            .toUint128();

        // Revert if the assets required for withdrawals < asset balance present in the vault
        require(
            IERC20Upgradeable(asset()).balanceOf(address(this)) <
                processedWithdrawAssets,
            "Not enough assets for withdrawal"
        );

        // Make pending withdrawals 0
        pendingWithdrawShares = 0;

        emit BatchRollover(
            currentRound,
            pendingDepositAssets,
            pendingWithdrawShares
        );

        ++currentRound;
    }

    function claimShares(uint256 shares, address receiver) public {
        UserDeposit storage userDeposit = userDeposits[msg.sender];
        uint128 userUnclaimedShares = userDeposit.unclaimedShares;
        uint128 userDepositAssets = userDeposit.pendingAssets;
        {
            //Convert previous round glp balance into unredeemed shares
            uint256 userDepositRound = userDeposit.round;
            if (userDepositRound < currentRound && userDepositAssets > 0) {
                uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                    userDepositRound
                ];
                userUnclaimedShares += userDepositAssets
                    .mulDiv(Q128, assetsPerShareX128)
                    .toUint128();
                userDeposit.pendingAssets = 0;
            }
        }
        if (userUnclaimedShares < shares.toUint128())
            revert InsufficientShares(userUnclaimedShares);
        userDeposit.unclaimedShares = userUnclaimedShares - shares.toUint128();
        transfer(receiver, shares);

        emit SharesClaimed(currentRound, shares, msg.sender, receiver);
    }

    function claimAssets(uint256 assets, address receiver) public {
        UserWithdrawal storage userWithdrawal = userWithdrawals[msg.sender];
        uint128 userUnclaimedAssets = userWithdrawal.unclaimedAssets;
        uint128 userWithdrawShares = userWithdrawal.pendingShares;
        {
            uint256 userWithdrawalRound = userWithdrawal.round;
            if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
                uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                    userWithdrawalRound
                ];
                userUnclaimedAssets += userWithdrawShares
                    .mulDiv(assetsPerShareX128, Q128)
                    .toUint128();
                userWithdrawal.pendingShares = 0;
            }
        }

        if (userUnclaimedAssets < assets)
            revert InsufficientAssets(userUnclaimedAssets);

        userWithdrawal.unclaimedAssets =
            userUnclaimedAssets -
            assets.toUint128();

        emit AssetsClaimed(currentRound, assets, msg.sender, receiver);

        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(asset()),
            receiver,
            assets
        );
    }

    function claimAllShares(
        address receiver
    ) external returns (uint256 shares) {
        shares = balanceOf(msg.sender);
        claimShares(shares, receiver);
    }

    function claimAllAssets(
        address receiver
    ) external returns (uint256 assets) {
        assets = balanceOf(msg.sender);
        claimAssets(assets, receiver);
    }
}
