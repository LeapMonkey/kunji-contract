// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {CustomReentrancyGuard} from "./CustomReentrancyGuard.sol";

import {ITraderWallet} from "./interfaces/ITraderWallet.sol";
import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {GMXAdapter} from "./adapters/gmx/GMXAdapter.sol";

// import "hardhat/console.sol";

// import its own interface as well

contract UsersVault is
    ERC20Upgradeable,
    OwnableUpgradeable,
    CustomReentrancyGuard
{
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
    uint256 public currentRound;
    uint256 public initialVaultBalance;
    uint256 public afterRoundVaultBalance;

    // Total amount of total deposit assets in mapped round
    uint256 public pendingDepositAssets;

    // Total amount of total withdrawal shares in mapped round
    uint256 public pendingWithdrawShares;

    uint256 public processedWithdrawAssets;
    int256 public vaultProfit;

    // user specific deposits accounting
    mapping(address => UserDeposit) public userDeposits;

    // user specific withdrawals accounting
    mapping(address => UserWithdrawal) public userWithdrawals;

    // ratio per round
    mapping(uint256 => uint256) public assetsPerShareXRound;

    error ZeroAddress(string target);
    error ZeroAmount();
    error UserNotAllowed();
    error InvalidTraderWallet();
    error TokenTransferFailed();
    error InvalidRound();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error InvalidRollover();
    error InvalidAdapter();
    error AdapterOperationFailed(string target);
    error ApproveFailed(address caller, address token, uint256 amount);
    error NotEnoughAssetsForWithdraw(
        uint256 underlyingContractBalance,
        uint256 processedWithdrawAssets
    );

    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);

    event TraderWalletAddressSet(address indexed traderWalletAddress);
    event UserDeposited(
        address indexed caller,
        address tokenAddress,
        uint256 assetsAmount
    );
    event WithdrawRequest(
        address indexed account,
        address indexed token,
        uint256 amount
    );
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
    event RolloverExecuted(
        uint256 round,
        uint256 newDeposit,
        uint256 newWithdrawal
    );

    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        address _ownerAddress,
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
            revert ZeroAddress({target: "_traderWalletAddress"});
        if (_ownerAddress == address(0))
            revert ZeroAddress({target: "_ownerAddress"});

        __Ownable_init();
        transferOwnership(_ownerAddress);

        __ERC20_init(_sharesName, _sharesSymbol);
        __ReentrancyGuard_init();
        GMXAdapter.__initApproveGmxPlugin();

        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderWalletAddress = _traderWalletAddress;
        currentRound = 0;
        vaultProfit = 0;
        processedWithdrawAssets = 0;
        pendingDepositAssets = 0;
        pendingWithdrawShares = 0;
    }

    receive() external payable {}

    fallback() external {}

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    ) external {
        _checkOwner();
        _checkZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress");
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    ) external {
        _checkOwner();
        _checkZeroAddress(_contractsFactoryAddress, "_contractsFactoryAddress");
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
        contractsFactoryAddress = _contractsFactoryAddress;
    }

    function setTraderWalletAddress(address _traderWalletAddress) external {
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
    ) external returns (bool) {
        _checkOwner();

        address adapterAddress = ITraderWallet(traderWalletAddress)
            .getAdapterAddressPerProtocol(_protocolId);
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

    function userDeposit(uint256 _amount) external {
        _onlyValidInvestors(_msgSender());

        if (_amount == 0) revert ZeroAmount();

        if (
            !(
                IERC20Upgradeable(underlyingTokenAddress).transferFrom(
                    _msgSender(),
                    address(this),
                    _amount
                )
            )
        ) revert TokenTransferFailed();

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

    function withdrawRequest(uint256 _sharesAmount) external {
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

    function rolloverFromTrader() external returns (bool) {
        _onlyTraderWallet(_msgSender());

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
            afterRoundVaultBalance = IERC20Upgradeable(underlyingTokenAddress)
                .balanceOf(address(this));
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
            uint256 underlyingContractBalance = IERC20Upgradeable(
                underlyingTokenAddress
            ).balanceOf(address(this));
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
            vaultProfit = overallProfit - ((overallProfit / 100) * kunjiFee);
        }

        // Make pending withdrawals 0
        pendingWithdrawShares = 0;
        vaultProfit = 0;

        initialVaultBalance = getUnderlyingLiquidity();
        processedWithdrawAssets = 0;

        emit RolloverExecuted(
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
    ) external returns (bool) {
        _checkZeroRound();
        _onlyTraderWallet(_msgSender());
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

    function getSharesContractBalance() external view returns (uint256) {
        return this.balanceOf(address(this));
    }

    function getRound() external view returns (uint256) {
        return currentRound;
    }

    function previewShares(address _receiver) external view returns (uint256) {
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

    function claimShares(uint256 _sharesAmount, address _receiver) public {
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

    function claimAssets(uint256 _assetsAmount, address _receiver) public {
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

        if (
            !(
                IERC20Upgradeable(underlyingTokenAddress).transfer(
                    _receiver,
                    _assetsAmount
                )
            )
        ) revert TokenTransferFailed();
    }

    //
    function getUnderlyingLiquidity() public view returns (uint256) {
        return
            IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this)) -
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

    function _executeOnGmx(
        uint256 _ratio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal returns (bool) {
        return GMXAdapter.executeOperation(_ratio, _traderOperation);
    }

    function _onlyValidInvestors(address _account) internal view {
        if (
            !IContractsFactory(contractsFactoryAddress).isInvestorAllowed(
                _account
            )
        ) revert UserNotAllowed();
    }

    function _onlyTraderWallet(address _account) internal view {
        if (_account != traderWalletAddress) revert UserNotAllowed();
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
