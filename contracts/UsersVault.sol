// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {BaseVault} from "./BaseVault.sol";

import {IUsersVault} from "./interfaces/IUsersVault.sol";
import {ITraderWallet} from "./interfaces/ITraderWallet.sol";
import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";

// import "hardhat/console.sol";

// import its own interface as well

contract UsersVault is ERC20Upgradeable, BaseVault, IUsersVault {
    using SafeERC20 for IERC20;

    address public override traderWalletAddress;

    // Total amount of total deposit assets in mapped round
    uint256 public override pendingDepositAssets;

    // Total amount of total withdrawal shares in mapped round
    uint256 public override pendingWithdrawShares;

    uint256 public override processedWithdrawAssets;

    // user specific deposits accounting
    mapping(address => UserDeposit) public override userDeposits;

    // user specific withdrawals accounting
    mapping(address => UserWithdrawal) public override userWithdrawals;

    // ratio per round
    mapping(uint256 => uint256) public assetsPerShareXRound;

    modifier onlyTraderWallet() {
        if (_msgSender() != traderWalletAddress) revert UserNotAllowed();
        _;
    }

    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        address _ownerAddress,
        string memory _sharesName,
        string memory _sharesSymbol
    ) external virtual initializer {
        // CHECK CALLER IS THE FACTORY
        // CHECK TRADER IS ALLOWED

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

    function __UsersVault_init(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        address _ownerAddress,
        string memory _sharesName,
        string memory _sharesSymbol
    ) internal onlyInitializing {
        __BaseVault_init(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _ownerAddress
        );
        __ERC20_init(_sharesName, _sharesSymbol);

        __UsersVault_init_unchained(_traderWalletAddress);
    }

    function __UsersVault_init_unchained(
        address _traderWalletAddress
    ) internal onlyInitializing {
        _checkZeroAddress(_traderWalletAddress, "_traderWalletAddress");

        traderWalletAddress = _traderWalletAddress;
    }

    function setTraderWalletAddress(
        address _traderWalletAddress
    ) external override {
        _checkOwner();
        _checkZeroAddress(_traderWalletAddress, "_traderWalletAddress");
        if (
            !IContractsFactory(contractsFactoryAddress).isTraderWalletAllowed(
                _traderWalletAddress
            )
        ) revert InvalidTraderWallet();
        emit TraderWalletAddressSet(_traderWalletAddress);
        traderWalletAddress = _traderWalletAddress;
    }

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external override returns (bool) {
        _checkOwner();

        address adapterAddress = ITraderWallet(traderWalletAddress)
            .getAdapterAddressPerProtocol(_protocolId);
        if (adapterAddress == address(0)) revert InvalidAdapter();

        uint256 amount;
        if (!_revoke) amount = type(uint256).max;
        else amount = 0;

        if (!IERC20(_tokenAddress).approve(adapterAddress, amount)) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: _tokenAddress,
                amount: amount
            });
        }

        return true;
    }

    function userDeposit(uint256 _amount) external override {
        _onlyValidInvestors(_msgSender());

        if (_amount == 0) revert ZeroAmount();

        IERC20(underlyingTokenAddress).safeTransferFrom(
            _msgSender(),
            address(this),
            _amount
        );

        emit UserDeposited(_msgSender(), underlyingTokenAddress, _amount);

        // good only for first time (round zero)
        uint256 assetPerShare = 1e18;

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
                (userDeposits[_msgSender()].pendingAssets * 1e18) /
                assetPerShare;

            userDeposits[_msgSender()].pendingAssets = 0;
        }

        userDeposits[_msgSender()].round = currentRound;

        userDeposits[_msgSender()].pendingAssets =
            userDeposits[_msgSender()].pendingAssets +
            _amount;

        pendingDepositAssets = pendingDepositAssets + _amount;
    }

    function withdrawRequest(uint256 _sharesAmount) external override {
        _onlyValidInvestors(_msgSender());
        _checkZeroRound();
        if (_sharesAmount == 0) revert ZeroAmount();

        emit WithdrawRequest(
            _msgSender(),
            underlyingTokenAddress,
            _sharesAmount
        );

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
                (userWithdrawals[_msgSender()].pendingShares * assetsPerShare) /
                1e18;

            userWithdrawals[_msgSender()].pendingShares = 0;
        }

        // Update round and glp balance for current round
        userWithdrawals[_msgSender()].round = currentRound;
        userWithdrawals[_msgSender()].pendingShares =
            userWithdrawals[_msgSender()].pendingShares +
            _sharesAmount;

        pendingWithdrawShares = pendingWithdrawShares + _sharesAmount;

        super._transfer(_msgSender(), address(this), _sharesAmount);
    }

    function rolloverFromTrader()
        external
        override
        onlyTraderWallet
        returns (bool)
    {
        if (pendingDepositAssets == 0 && pendingWithdrawShares == 0)
            revert InvalidRollover();

        uint256 assetsPerShare;
        uint256 sharesToMint;

        if (currentRound != 0) {
            afterRoundVaultBalance = getUnderlyingLiquidity();
            assetsPerShare = totalSupply() != 0
                ? (afterRoundVaultBalance * 1e18) / totalSupply()
                : 0;

            sharesToMint = (pendingDepositAssets * assetsPerShare) / 1e18;
        } else {
            // first round dont consider pendings
            afterRoundVaultBalance = IERC20(underlyingTokenAddress).balanceOf(
                address(this)
            );
            // first ratio between shares and deposit = 1
            assetsPerShare = 1e18;
            // since ratio is 1 shares to mint is equal to actual balance
            sharesToMint = afterRoundVaultBalance;
        }

        // mint the shares for the contract so users can claim their shares
        if (sharesToMint > 0) super._mint(address(this), sharesToMint);
        assetsPerShareXRound[currentRound] = assetsPerShare;

        // Accept all pending deposits
        pendingDepositAssets = 0;

        if (pendingWithdrawShares > 0) {
            // burn shares for whitdrawal
            super._burn(address(this), pendingWithdrawShares);

            // Process all withdrawals
            processedWithdrawAssets =
                (assetsPerShare * pendingWithdrawShares) /
                1e18;
        }

        // Revert if the assets required for withdrawals < asset balance present in the vault
        if (processedWithdrawAssets > 0) {
            uint256 underlyingContractBalance = IERC20(underlyingTokenAddress)
                .balanceOf(address(this));
            if (underlyingContractBalance < processedWithdrawAssets)
                revert NotEnoughAssetsForWithdraw(
                    underlyingContractBalance,
                    processedWithdrawAssets
                );
        }

        // get profits
        int256 overallProfit = 0;
        if (currentRound != 0) {
            overallProfit =
                int256(afterRoundVaultBalance) -
                int256(initialVaultBalance);
        }
        if (overallProfit > 0) {
            // DO SOMETHING HERE WITH PROFIT ?
            int256 kunjiFee = int256(
                IContractsFactory(contractsFactoryAddress).getFeeRate()
            );
            vaultProfit = overallProfit - ((overallProfit * kunjiFee) / 100);
        }

        // Make pending withdrawals 0
        pendingWithdrawShares = 0;
        vaultProfit = 0;

        initialVaultBalance = getUnderlyingLiquidity();
        processedWithdrawAssets = 0;

        emit UserVaultRolloverExecuted(
            currentRound,
            pendingDepositAssets,
            pendingWithdrawShares
        );

        currentRound++;

        return true;
    }

    function executeOnProtocol(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _traderOperation,
        uint256 _walletRatio
    ) external override onlyTraderWallet returns (bool) {
        _checkZeroRound();
        address adapterAddress;

        bool success = false;
        if (_protocolId == 1) {
            success = _executeOnGmx(_walletRatio, _traderOperation);
        } else {
            adapterAddress = ITraderWallet(traderWalletAddress)
                .getAdapterAddressPerProtocol(_protocolId);
            if (adapterAddress == address(0)) revert InvalidAdapter();

            success = _executeOnAdapter(
                adapterAddress,
                _walletRatio,
                _traderOperation
            );
        }

        // check operation success
        if (!success) revert AdapterOperationFailed({target: "vault"});

        // contract should receive tokens HERE

        return true;
    }

    function getSharesContractBalance()
        external
        view
        override
        returns (uint256)
    {
        return this.balanceOf(address(this));
    }

    function previewShares(
        address _receiver
    ) external view override returns (uint256) {
        _checkZeroRound();

        if (
            userDeposits[_receiver].round < currentRound &&
            userDeposits[_receiver].pendingAssets > 0
        ) {
            uint256 unclaimedShares = _pendAssetsToUnclaimedShares(_receiver);
            return unclaimedShares;
        }

        return userDeposits[_receiver].unclaimedShares;
    }

    function previewAssets(address _receiver) external view returns (uint256) {
        _checkZeroRound();

        if (
            userWithdrawals[_receiver].round < currentRound &&
            userWithdrawals[_receiver].pendingShares > 0
        ) {
            uint256 unclaimedAssets = _pendSharesToUnclaimedAssets(_receiver);
            return unclaimedAssets;
        }

        return userWithdrawals[_receiver].unclaimedAssets;
    }

    function claimShares(
        uint256 _sharesAmount,
        address _receiver
    ) external override {
        _checkZeroRound();
        _onlyValidInvestors(_msgSender());

        if (_sharesAmount == 0) revert ZeroAmount();

        // Convert previous round glp balance into unredeemed shares
        if (
            userDeposits[_msgSender()].round < currentRound &&
            userDeposits[_msgSender()].pendingAssets > 0
        ) {
            uint256 unclaimedShares = _pendAssetsToUnclaimedShares(
                _msgSender()
            );
            userDeposits[_msgSender()].unclaimedShares = unclaimedShares;
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

        super._transfer(address(this), _receiver, _sharesAmount);
    }

    function claimAssets(
        uint256 _assetsAmount,
        address _receiver
    ) external override {
        _checkZeroRound();
        _onlyValidInvestors(_msgSender());

        if (_assetsAmount == 0) revert ZeroAmount();

        if (
            userWithdrawals[_msgSender()].round < currentRound &&
            userWithdrawals[_msgSender()].pendingShares > 0
        ) {
            uint256 unclaimedAssets = _pendSharesToUnclaimedAssets(
                _msgSender()
            );
            userWithdrawals[_msgSender()].unclaimedAssets = unclaimedAssets;
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

        IERC20(underlyingTokenAddress).safeTransfer(_receiver, _assetsAmount);
    }

    //
    function getUnderlyingLiquidity() public view override returns (uint256) {
        return
            IERC20(underlyingTokenAddress).balanceOf(address(this)) -
            pendingDepositAssets -
            processedWithdrawAssets;
    }

    function _pendAssetsToUnclaimedShares(
        address _receiver
    ) internal view returns (uint256) {
        uint256 assetsPerShare = assetsPerShareXRound[
            userDeposits[_receiver].round
        ];

        if (assetsPerShare == 0) assetsPerShare = 1e18;

        return
            userDeposits[_receiver].unclaimedShares +
            (userDeposits[_receiver].pendingAssets * 1e18) /
            assetsPerShare;
    }

    function _pendSharesToUnclaimedAssets(
        address _receiver
    ) internal view returns (uint256) {
        uint256 assetsPerShare = assetsPerShareXRound[
            userWithdrawals[_receiver].round
        ];

        return
            userWithdrawals[_receiver].unclaimedAssets +
            (userWithdrawals[_receiver].pendingShares * assetsPerShare) /
            1e18;
    }

    //

    function _onlyValidInvestors(address _account) internal view {
        if (
            !IContractsFactory(contractsFactoryAddress).isInvestorAllowed(
                _account
            )
        ) revert UserNotAllowed();
    }
}
