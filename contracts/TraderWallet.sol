// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {IUsersVault} from "./interfaces/IUsersVault.sol";
import "./adapters/gmx/GMXAdapter.sol";

/// import its own interface as well

// import "hardhat/console.sol";

contract TraderWallet is OwnableUpgradeable {
    address public vaultAddress;
    address public underlyingTokenAddress;
    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;
    address public traderAddress;
    address public dynamicValueAddress;

    int256 public traderProfit;
    int256 public vaultProfit;
    uint256 public cumulativePendingDeposits;
    uint256 public cumulativePendingWithdrawals;
    uint256 public initialTraderBalance;
    uint256 public initialVaultBalance;
    uint256 public afterRoundTraderBalance;
    uint256 public afterRoundVaultBalance;
    uint256 public ratioProportions;
    uint256 public currentRound;
    mapping(uint256 => address) public adaptersPerProtocol;
    address[] public traderSelectedAdaptersArray;

    // mapping(address => bool) public traderSelectedAdaptersMapping;
    // uint256[] public traderSelectedProtocols;

    uint256[50] __gap;

    error ZeroAddress(string target);
    error ZeroAmount();
    error UnderlyingAssetNotAllowed();
    error CallerNotAllowed();
    error NewTraderNotAllowed();
    error InvalidProtocol();
    error InvalidAdapter();
    // error InvalidOperation(string target);
    error AdapterOperationFailed(string target);
    error UsersVaultOperationFailed();
    error ApproveFailed(address caller, address token, uint256 amount);
    error TokenTransferFailed();
    error InvalidRollover();
    error RolloverFailed();
    error SendToTraderFailed();
    error AmountToScaleNotFound();

    event VaultAddressSet(address indexed vaultAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
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

    event TraderDeposit(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    event WithdrawalRequest(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    event OperationExecuted(
        uint256 protocolId,
        uint256 timestamp,
        string target,
        bool replicate,
        uint256 initialBalance,
        uint256 walletRatio
    );

    event RolloverExecuted(uint256 timestamp, uint256 round);

    modifier onlyUnderlying(address _tokenAddress) {
        if (_tokenAddress != underlyingTokenAddress)
            revert UnderlyingAssetNotAllowed();
        _;
    }

    modifier onlyTrader() {
        if (_msgSender() != traderAddress) revert CallerNotAllowed();
        _;
    }

    modifier notZeroAddress(address _variable, string memory _message) {
        if (_variable == address(0)) revert ZeroAddress({target: _message});
        _;
    }

    modifier onlyValidProtocolId(uint256 _protocolId) {
        if (adaptersPerProtocol[_protocolId] == address(0))
            revert InvalidProtocol();
        _;
    }

    function initialize(
        address _vaultAddress,
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderAddress,
        address _dynamicValueAddress
    ) external initializer {
        // CHECK CALLER IS THE FACTORY

        if (_vaultAddress == address(0))
            revert ZeroAddress({target: "_vaultAddress"});
        if (_underlyingTokenAddress == address(0))
            revert ZeroAddress({target: "_underlyingTokenAddress"});
        if (_adaptersRegistryAddress == address(0))
            revert ZeroAddress({target: "_adaptersRegistryAddress"});
        if (_contractsFactoryAddress == address(0))
            revert ZeroAddress({target: "_contractsFactoryAddress"});
        if (_traderAddress == address(0))
            revert ZeroAddress({target: "_traderAddress"});
        // CHECK TRADER IS ALLOWED

        if (_dynamicValueAddress == address(0))
            revert ZeroAddress({target: "_dynamicValueAddress"});

        __Ownable_init();

        vaultAddress = _vaultAddress;
        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderAddress = _traderAddress;
        dynamicValueAddress = _dynamicValueAddress;

        cumulativePendingDeposits = 0;
        cumulativePendingWithdrawals = 0;
        initialTraderBalance = 0;
        initialVaultBalance = 0;
        afterRoundTraderBalance = 0;
        afterRoundVaultBalance = 0;
        currentRound = 0;
    }

    function setVaultAddress(
        address _vaultAddress
    ) external onlyOwner notZeroAddress(_vaultAddress, "_vaultAddress") {
        emit VaultAddressSet(_vaultAddress);
        vaultAddress = _vaultAddress;
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

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    )
        external
        onlyOwner
        notZeroAddress(_contractsFactoryAddress, "_contractsFactoryAddress")
    {
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
        contractsFactoryAddress = _contractsFactoryAddress;
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
        ) revert NewTraderNotAllowed();

        emit TraderAddressSet(_traderAddress);
        traderAddress = _traderAddress;
    }

    function addAdapterToUse(
        uint256 _protocolId,
        address _adapterAddress
    )
        external
        onlyTrader
        notZeroAddress(_adapterAddress, "_adapterAddress")
        onlyValidProtocolId(_protocolId)
    {
        emit AdapterToUseAdded(_protocolId, _adapterAddress, _msgSender());
        adaptersPerProtocol[_protocolId] = _adapterAddress;
        // store the adapter on the array
        traderSelectedAdaptersArray.push(_adapterAddress);

        /* 
        MAKES APPROVAL OF UNDERLYING HERE ???
        MAKES APPROVAL OF UNDERLYING HERE ???

        if (
            !IERC20Upgradeable(underlyingTokenAddress).approve(
                _adapterAddress,
                type(uint256).max
            )
        ) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: underlyingTokenAddress,
                amount: type(uint256).max
            });
        }
        */
    }

    function removeAdapterToUse(
        uint256 _protocolId,
        address _adapterAddress
    )
        external
        onlyTrader
        notZeroAddress(_adapterAddress, "_adapterAddress")
        onlyValidProtocolId(_protocolId)
    {
        emit AdapterToUseRemoved(_adapterAddress, _msgSender());
        delete adaptersPerProtocol[_protocolId];

        // REMOVE ALLOWANCE OF UNDERLYING ????
        /*
        if (
            !IERC20Upgradeable(underlyingTokenAddress).approve(
                _adapterAddress,
                0
            )
        ) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: underlyingTokenAddress,
                amount: 0
            });
        }
        */
    }

    //
    receive() external payable {}

    //
    function traderDeposit(
        address _underlying,
        uint256 _amount
    ) external onlyTrader onlyUnderlying(_underlying) {
        if (_amount == 0) revert ZeroAmount();

        if (
            !(
                IERC20Upgradeable(_underlying).transferFrom(
                    _msgSender(),
                    address(this),
                    _amount
                )
            )
        ) revert TokenTransferFailed();

        emit TraderDeposit(_msgSender(), _underlying, _amount);

        cumulativePendingDeposits = cumulativePendingDeposits + _amount;
    }

    function withdrawRequest(
        address _underlying,
        uint256 _amount
    ) external onlyTrader onlyUnderlying(_underlying) {
        if (_amount == 0) revert ZeroAmount();

        // require(
        //     IERC20Upgradeable(_underlying).balanceOf(address(this)) >= _amount,
        //     "Insufficient balance to withdraw"
        // );

        // require(
        //     IERC20Upgradeable(_underlying).transfer(_msgSender(), _amount),
        //     "Token transfer failed"
        // );

        emit WithdrawalRequest(_msgSender(), _underlying, _amount);

        cumulativePendingWithdrawals = cumulativePendingWithdrawals + _amount;
    }

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external onlyTrader returns (bool) {
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
        bool _replicate
    ) external onlyTrader onlyValidProtocolId(_protocolId) returns (bool) {
        // check if protocolId is valid
        address adapterAddress = adaptersPerProtocol[_protocolId];
        if (adapterAddress == address(0)) revert InvalidAdapter();

        uint256 walletRatio = 1e18;
        // execute operation with ratio equals to 1 because it is for trader, not scaling
        // returns success or not

        bool success = false;
        if (_protocolId == 1) {
            success = _executeOnGmx(walletRatio, _traderOperation);
        } else {
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

    function _executeOnGmx(
        uint256 _walletRatio,
        IAdapter.AdapterOperation memory _traderOperation
    ) internal pure returns (bool) {
        return GMXAdapter.executeOperation(_walletRatio, _traderOperation);
    }

    // @todo add implementation
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

    function totalAssets() public view returns (uint256) {
        // Balance of UNDERLYING ASSET + Value of positions on adapters
        // this will call to the DynamicValuationContract
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

    // not sure if the execution is here. Don't think so
    function rollover() external onlyTrader {
        if (cumulativePendingDeposits == 0 && cumulativePendingWithdrawals == 0)
            revert InvalidRollover();

        if (currentRound != 0) {
            (afterRoundTraderBalance, afterRoundVaultBalance) = getBalances();
        } else{
            afterRoundTraderBalance = IERC20Upgradeable(underlyingTokenAddress).balanceOf(traderAddress);
            afterRoundVaultBalance = IERC20Upgradeable(underlyingTokenAddress).balanceOf(vaultAddress);
        }

        bool success = IUsersVault(vaultAddress).rolloverFromTrader();
        if (!success) revert RolloverFailed();
        emit RolloverExecuted(
            block.timestamp,
            IUsersVault(vaultAddress).getRound()
        );


        if (cumulativePendingWithdrawals > 0) {
            // send to trader account
            success = IERC20Upgradeable(underlyingTokenAddress).transferFrom(
                address(this),
                traderAddress,
                cumulativePendingWithdrawals
            );
            if (!success) revert SendToTraderFailed();
        }

        // get profits ?
        traderProfit = int256(afterRoundTraderBalance) - int256(initialTraderBalance);
        vaultProfit = int256(afterRoundVaultBalance) - int256(initialVaultBalance);
        /*

        DO SOMETHING HERE WITH PROFIT ?

        */

        
        // get values for next round proportions
        (initialTraderBalance, initialVaultBalance) = getBalances();

        cumulativePendingDeposits = 0;
        cumulativePendingWithdrawals = 0;
        traderProfit = 0;
        vaultProfit = 0;
        ratioProportions = calculateRatio();
    }

    function getBalances() public view returns (uint256, uint256) {
        return (
            IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this)) -
                cumulativePendingDeposits -
                cumulativePendingWithdrawals,
            IUsersVault(vaultAddress).getUnderlyingLiquidity()
        );
    }

    function calculateRatio() public view returns (uint256) {
        return (1e18 * initialVaultBalance) / initialTraderBalance;
    }

    function getRatio() public view returns (uint256) {
        return ratioProportions;
    }
}
