// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {GMXAdapter} from "./adapters/gmx/GMXAdapter.sol";
import {BaseVault} from "./BaseVault.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {IUsersVault} from "./interfaces/IUsersVault.sol";

// import "hardhat/console.sol";

// import its own interface as well

contract TraderWallet is BaseVault {
    address public vaultAddress;
    address public traderAddress;
    address public dynamicValueAddress;
    int256 public traderProfit;
    uint256 public cumulativePendingDeposits;
    uint256 public cumulativePendingWithdrawals;
    uint256 public initialTraderBalance;
    uint256 public afterRoundTraderBalance;
    uint256 public ratioProportions;
    address[] public traderSelectedAdaptersArray;
    mapping(uint256 => address) public adaptersPerProtocol;

    modifier onlyTrader() {
        if (_msgSender() != traderAddress) revert CallerNotAllowed();
        _;
    }

    function initialize(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderAddress,
        address _dynamicValueAddress,
        address _ownerAddress
    ) external virtual initializer {
        // CHECK CALLER IS THE FACTORY

        __TraderWallet_init(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _traderAddress,
            _dynamicValueAddress,
            _ownerAddress
        );
    }

    function __TraderWallet_init(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderAddress,
        address _dynamicValueAddress,
        address _ownerAddress
    ) internal onlyInitializing {
        __BaseVault_init(
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _ownerAddress
        );

        __TraderWallet_init_unchained(_traderAddress, _dynamicValueAddress);
    }

    function __TraderWallet_init_unchained(
        address _traderAddress,
        address _dynamicValueAddress
    ) internal onlyInitializing {
        _checkZeroAddress(_traderAddress, "_traderAddress");
        _checkZeroAddress(_dynamicValueAddress, "_dynamicValueAddress");
        // CHECK TRADER IS ALLOWED

        traderAddress = _traderAddress;
        dynamicValueAddress = _dynamicValueAddress;
    }

    function setVaultAddress(
        address _vaultAddress
    ) external onlyOwner notZeroAddress(_vaultAddress, "_vaultAddress") {
        if (
            !IContractsFactory(contractsFactoryAddress).isVaultAllowed(
                _vaultAddress
            )
        ) revert InvalidVault();
        emit VaultAddressSet(_vaultAddress);
        vaultAddress = _vaultAddress;
    }

    function setDynamicValueAddress(
        address _dynamicValueAddress
    )
        external
        onlyOwner
        notZeroAddress(_dynamicValueAddress, "_dynamicValueAddress")
    {
        emit DynamicValueAddressSet(_dynamicValueAddress);
        dynamicValueAddress = _dynamicValueAddress;
    }

    function setUnderlyingTokenAddress(
        address _underlyingTokenAddress
    )
        external
        onlyTrader
        notZeroAddress(_underlyingTokenAddress, "_underlyingTokenAddress")
    {
        emit UnderlyingTokenAddressSet(_underlyingTokenAddress);
        underlyingTokenAddress = _underlyingTokenAddress;
    }

    function setTraderAddress(
        address _traderAddress
    ) external onlyOwner notZeroAddress(_traderAddress, "_traderAddress") {
        if (
            !IContractsFactory(contractsFactoryAddress).isTraderAllowed(
                _traderAddress
            )
        ) revert TraderNotAllowed();

        emit TraderAddressSet(_traderAddress);
        traderAddress = _traderAddress;
    }

    function addAdapterToUse(uint256 _protocolId) external onlyTrader {
        address adapterAddress = _getAdapterAddress(_protocolId);
        (bool isAdapterOnArray, ) = _isAdapterOnArray(adapterAddress);
        if (isAdapterOnArray) revert AdapterPresent();

        emit AdapterToUseAdded(_protocolId, adapterAddress, _msgSender());

        // store the adapter on the array
        traderSelectedAdaptersArray.push(adapterAddress);
        adaptersPerProtocol[_protocolId] = adapterAddress;

        /*
            MAKES APPROVAL OF UNDERLYING HERE ???
        */
    }

    function removeAdapterToUse(uint256 _protocolId) external onlyTrader {
        address adapterAddress = _getAdapterAddress(_protocolId);
        (bool isAdapterOnArray, uint256 index) = _isAdapterOnArray(
            adapterAddress
        );
        if (!isAdapterOnArray) revert AdapterNotPresent();

        emit AdapterToUseRemoved(adapterAddress, _msgSender());

        // put the last in the found index
        traderSelectedAdaptersArray[index] = traderSelectedAdaptersArray[
            traderSelectedAdaptersArray.length - 1
        ];
        // remove the last one because it was alredy put in found index
        traderSelectedAdaptersArray.pop();

        // remove mapping
        delete adaptersPerProtocol[_protocolId];

        // REMOVE ALLOWANCE OF UNDERLYING ????
    }

    function getAdapterAddressPerProtocol(
        uint256 _protocolId
    ) external view returns (address) {
        return _getAdapterAddress(_protocolId);
    }

    //
    function traderDeposit(uint256 _amount) external onlyTrader {
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

        emit TraderDeposit(_msgSender(), underlyingTokenAddress, _amount);

        cumulativePendingDeposits = cumulativePendingDeposits + _amount;
    }

    function withdrawRequest(uint256 _amount) external onlyTrader {
        _checkZeroRound();
        if (_amount == 0) revert ZeroAmount();

        emit WithdrawRequest(_msgSender(), underlyingTokenAddress, _amount);

        cumulativePendingWithdrawals = cumulativePendingWithdrawals + _amount;
    }

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external onlyTrader returns (bool) {
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

    // not sure if the execution is here. Don't think so
    function rollover() external onlyTrader {
        if (cumulativePendingDeposits == 0 && cumulativePendingWithdrawals == 0)
            revert InvalidRollover();

        if (currentRound != 0) {
            (afterRoundTraderBalance, afterRoundVaultBalance) = getBalances();
        } else {
            afterRoundTraderBalance = IERC20Upgradeable(underlyingTokenAddress)
                .balanceOf(address(this));
            afterRoundVaultBalance = IERC20Upgradeable(underlyingTokenAddress)
                .balanceOf(vaultAddress);
        }

        bool success = IUsersVault(vaultAddress).rolloverFromTrader();
        if (!success) revert RolloverFailed();

        if (cumulativePendingWithdrawals > 0) {
            // send to trader account
            success = IERC20Upgradeable(underlyingTokenAddress).transfer(
                traderAddress,
                cumulativePendingWithdrawals
            );
            if (!success) revert SendToTraderFailed();

            cumulativePendingWithdrawals = 0;
        }

        // put to zero this value so the round can start
        cumulativePendingDeposits = 0;

        // get profits
        if (currentRound != 0) {
            traderProfit =
                int256(afterRoundTraderBalance) -
                int256(initialTraderBalance);
            vaultProfit =
                int256(afterRoundVaultBalance) -
                int256(initialVaultBalance);
        }
        if (traderProfit > 0) {
            // DO SOMETHING HERE WITH PROFIT ?
        }

        // get values for next round proportions
        (initialTraderBalance, initialVaultBalance) = getBalances();
        currentRound = IUsersVault(vaultAddress).currentRound();
        emit TraderWalletRolloverExecuted(
            block.timestamp,
            currentRound,
            traderProfit,
            vaultProfit
        );
        traderProfit = 0;
        vaultProfit = 0;
        ratioProportions = calculateRatio();
    }

    // @todo rename '_traderOperation' to '_tradeOperation'
    function executeOnProtocol(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _traderOperation,
        bool _replicate
    ) external onlyTrader nonReentrant returns (bool) {
        _checkZeroRound();

        address adapterAddress;

        uint256 walletRatio = 1e18;
        // execute operation with ratio equals to 1 because it is for trader, not scaling
        // returns success or not

        bool success = false;
        if (_protocolId == 1) {
            success = _executeOnGmx(walletRatio, _traderOperation);
        } else {
            adapterAddress = adaptersPerProtocol[_protocolId];
            if (adapterAddress == address(0)) revert InvalidAdapter();

            success = _executeOnAdapter(
                adapterAddress,
                walletRatio,
                _traderOperation
            );
        }

        // check operation success
        if (!success) revert AdapterOperationFailed({target: "trader"});

        // contract should receive tokens HERE

        emit OperationExecuted(
            _protocolId,
            block.timestamp,
            "trader wallet",
            _replicate,
            initialTraderBalance,
            walletRatio
        );

        // if tx needs to be replicated on vault
        if (_replicate) {
            walletRatio = ratioProportions;

            success = IUsersVault(vaultAddress).executeOnProtocol(
                _protocolId,
                _traderOperation,
                walletRatio
            );

            // FLOW IS NOW ON VAULT
            // check operation success
            if (!success) revert UsersVaultOperationFailed();

            emit OperationExecuted(
                _protocolId,
                block.timestamp,
                "users vault",
                _replicate,
                initialVaultBalance,
                walletRatio
            );
        }
        return true;
    }

    function getTraderSelectedAdaptersLength() external view returns (uint256) {
        return traderSelectedAdaptersArray.length;
    }

    function getCumulativePendingWithdrawals() external view returns (uint256) {
        return cumulativePendingWithdrawals;
    }

    function getCumulativePendingDeposits() external view returns (uint256) {
        return cumulativePendingDeposits;
    }

    function getBalances() public view returns (uint256, uint256) {
        uint256 pendingsFunds = cumulativePendingDeposits +
            cumulativePendingWithdrawals;
        uint256 underlyingBalance = IERC20Upgradeable(underlyingTokenAddress)
            .balanceOf(address(this));
        uint256 vaultUnderlying = IUsersVault(vaultAddress)
            .getUnderlyingLiquidity();

        if (pendingsFunds > underlyingBalance) return (0, vaultUnderlying);

        return (
            underlyingBalance - pendingsFunds,
            IUsersVault(vaultAddress).getUnderlyingLiquidity()
        );
    }

    function calculateRatio() public view returns (uint256) {
        return
            initialTraderBalance > 0
                ? (1e18 * initialVaultBalance) / initialTraderBalance
                : 1;
    }

    function getRatio() public view returns (uint256) {
        return ratioProportions;
    }

    function _getAdapterAddress(
        uint256 _protocolId
    ) internal view returns (address) {
        (bool adapterExist, address adapterAddress) = IAdaptersRegistry(
            adaptersRegistryAddress
        ).getAdapterAddress(_protocolId);
        if (!adapterExist) revert InvalidProtocol();

        return adapterAddress;
    }

    function _isAdapterOnArray(
        address _adapterAddress
    ) internal view returns (bool, uint256) {
        bool found = false;
        uint256 i = 0;
        if (traderSelectedAdaptersArray.length > 0) {
            for (i = 0; i < traderSelectedAdaptersArray.length; i++) {
                if (traderSelectedAdaptersArray[i] == _adapterAddress) {
                    found = true;
                    break;
                }
            }
        }
        return (found, i);
    }
}
