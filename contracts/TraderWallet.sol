// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapterOperations} from "./interfaces/IAdapterOperations.sol";
import {IUserVault} from "./interfaces/IUserVault.sol";

// import "hardhat/console.sol";

contract TraderWallet is OwnableUpgradeable {
    address public vaultAddress;
    address public underlyingTokenAddress;
    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;
    address public traderAddress;
    address public dynamicValueAddress;

    uint256 public cumulativePendingDeposits;
    uint256 public cumulativePendingWithdrawals;
    uint256 public initialBalance;
    uint256 public afterRoundBalance;
    uint256 public traderFee;

    uint256[] public traderSelectedProtocols;

    error ZeroAddrees(string _target);
    error ZeroAmount();
    error UnderlyingAssetNotAllowed();
    error CallerNotAllowed();
    error NewTraderNotAllowed();
    error InvalidProtocolID();
    error InvalidOperation(string _target);
    error AdapterOperationFailed(string _target);
    error TokenTransferFailed();
    error RolloverFailed();

    event VaultAddressSet(address indexed vaultAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);
    event TraderAddressSet(address indexed traderAddress);
    event DynamicValueAddressSet(address indexed dynamicValueAddress);
    event ProtocolToUseAdded(
        uint256 indexed protocolId,
        address indexed trader
    );
    event ProtocolToUseRemoved(
        uint256 indexed protocolId,
        address indexed trader
    );

    event DepositRequest(
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
        uint256 _protocolId,
        uint256 _timestamp,
        string _contract,
        bool _replicate,
        uint256 _initialBalance
    );

    event RolloverExecuted(uint256 _timestamp);

    modifier onlyUnderlying(address _tokenAddress) {
        if (_tokenAddress != underlyingTokenAddress)
            revert UnderlyingAssetNotAllowed();
        _;
    }

    modifier onlyTrader() {
        if (_msgSender() != traderAddress) revert CallerNotAllowed();
        _;
    }

    modifier onlyValidAddress(address _variable, string memory _message) {
        if (_variable == address(0)) revert ZeroAddrees({_target: _message});
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
        // require(_vaultAddress != address(0), "INVALID address _vaultAddress");
        if (_vaultAddress == address(0))
            revert ZeroAddrees({_target: "_vaultAddress"});
        if (_underlyingTokenAddress == address(0))
            revert ZeroAddrees({_target: "_underlyingTokenAddress"});
        if (_adaptersRegistryAddress == address(0))
            revert ZeroAddrees({_target: "_adaptersRegistryAddress"});
        if (_contractsFactoryAddress == address(0))
            revert ZeroAddrees({_target: "_contractsFactoryAddress"});
        if (_traderAddress == address(0))
            revert ZeroAddrees({_target: "_traderAddress"});
        if (_dynamicValueAddress == address(0))
            revert ZeroAddrees({_target: "_dynamicValueAddress"});

        __Ownable_init();

        vaultAddress = _vaultAddress;
        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderAddress = _traderAddress;
        dynamicValueAddress = _dynamicValueAddress;

        traderFee = 0; // @TODO ASK IF THIS IS A THING OTHER THAN THE 30% FOR KUNJI
        cumulativePendingDeposits = 0;
        cumulativePendingWithdrawals = 0;
        initialBalance = 0;
        afterRoundBalance = 0;
    }

    function setVaultAddress(
        address _vaultAddress
    ) external onlyOwner onlyValidAddress(_vaultAddress, "_vaultAddress") {
        emit VaultAddressSet(_vaultAddress);
        vaultAddress = _vaultAddress;
    }

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    )
        external
        onlyOwner
        onlyValidAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress")
    {
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function setDynamicValueAddress(
        address _dynamicValueAddress
    )
        external
        onlyOwner
        onlyValidAddress(_dynamicValueAddress, "_dynamicValueAddress")
    {
        emit DynamicValueAddressSet(_dynamicValueAddress);
        dynamicValueAddress = _dynamicValueAddress;
    }

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    )
        external
        onlyOwner
        onlyValidAddress(_contractsFactoryAddress, "_contractsFactoryAddress")
    {
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
        contractsFactoryAddress = _contractsFactoryAddress;
    }

    function setUnderlyingTokenAddress(
        address _underlyingTokenAddress
    )
        external
        onlyTrader
        onlyValidAddress(_underlyingTokenAddress, "_underlyingTokenAddress")
    {
        emit UnderlyingTokenAddressSet(_underlyingTokenAddress);
        underlyingTokenAddress = _underlyingTokenAddress;
    }

    function setTraderAddress(
        address _traderAddress
    ) external onlyOwner onlyValidAddress(_traderAddress, "_traderAddress") {
        if (
            !IContractsFactory(contractsFactoryAddress).isTraderAllowed(
                _traderAddress
            )
        ) revert NewTraderNotAllowed();

        emit TraderAddressSet(_traderAddress);
        traderAddress = _traderAddress;
    }

    function addProtocolToUse(uint256 _protocolId) external onlyTrader {
        (bool isValidProtocol, ) = _isProtocolValid(_protocolId);

        if (!isValidProtocol) revert InvalidProtocolID();

        emit ProtocolToUseAdded(_protocolId, _msgSender());

        traderSelectedProtocols.push(_protocolId);
    }

    function removeProtocolToUse(uint256 _protocolId) external onlyTrader {
        bool found = false;
        for (uint256 i = 0; i < traderSelectedProtocols.length; i++) {
            if (traderSelectedProtocols[i] == _protocolId) {
                emit ProtocolToUseRemoved(_protocolId, _msgSender());

                traderSelectedProtocols[i] = traderSelectedProtocols[
                    traderSelectedProtocols.length - 1
                ];
                traderSelectedProtocols.pop();
                found = true;
            }
        }
        if (!found) revert InvalidProtocolID();
    }

    //
    receive() external payable {}

    //
    function depositRequest(
        address _token,
        uint256 _amount
    ) external onlyTrader onlyUnderlying(_token) {
        if (_amount == 0) revert ZeroAmount();

        if (
            !(
                IERC20Upgradeable(_token).transferFrom(
                    _msgSender(),
                    address(this),
                    _amount
                )
            )
        ) revert TokenTransferFailed();

        emit DepositRequest(_msgSender(), _token, _amount);

        cumulativePendingDeposits = cumulativePendingDeposits + _amount;
    }

    function withdrawRequest(
        address _token,
        uint256 _amount
    ) external onlyTrader onlyUnderlying(_token) {
        if (_amount == 0) revert ZeroAmount();

        // require(
        //     IERC20Upgradeable(_token).balanceOf(address(this)) >= _amount,
        //     "Insufficient balance to withdraw"
        // );

        // require(
        //     IERC20Upgradeable(_token).transfer(_msgSender(), _amount),
        //     "Token transfer failed"
        // );

        emit WithdrawalRequest(_msgSender(), _token, _amount);

        cumulativePendingWithdrawals = cumulativePendingWithdrawals + _amount;
    }

    /// @dev watch out if many operations are issued, maybe will fail
    /// @dev consider one operation per time ? so replication can happen easily ?
    function executeOnAdapter(
        uint256 _protocolId,
        IAdapterOperations.AdapterOperation[] memory _traderOperations,
        bool _replicate
    ) external onlyTrader {
        // check if protocol id is valid
        (bool isValidProtocol, address adapterAddress) = _isProtocolValid(
            _protocolId
        );
        if (!isValidProtocol) revert InvalidProtocolID();

        // check if operations on adapters are valid
        if (
            !IAdapterOperations(adapterAddress).isOperationAllowed(
                _traderOperations
            )
        ) revert InvalidOperation({_target: "_traderOperationsArray"});

        // execute operation
        bool success = IAdapterOperations(adapterAddress).executeOperation(
            _traderOperations
        );
        // check operation success
        if (!success) revert AdapterOperationFailed({_target: "trader"});
        
        // contract should receive funds in DIFFERENT TOKENS
        // contract should receive funds in DIFFERENT TOKENS
        // contract should receive funds in DIFFERENT TOKENS
        // contract should receive funds in DIFFERENT TOKENS

        // THIS SHOULD BE THE AMOUNT USED FOR THE OPERATIONS
        // NOT THE CONTRACT BALANCE
        initialBalance = IERC20Upgradeable(underlyingTokenAddress).balanceOf(
            address(this)
        );

        emit OperationExecuted(
            _protocolId,
            block.timestamp,
            "trader wallet",
            _replicate,
            initialBalance
        );

        // if tx needs to be replicated on vault
        if (_replicate) {
            // scale parameters
            IAdapterOperations.AdapterOperation[]
                memory scaledOperation = _scaleTraderOperation(
                    _traderOperations
                );

            // call user vault
            success = IUserVault(vaultAddress).executeOnAdapter(
                scaledOperation
            );

            if (!success) revert AdapterOperationFailed({_target: "user"});

            emit OperationExecuted(
                _protocolId,
                block.timestamp,
                "user vault",
                _replicate,
                initialBalance
            );
        }
    }

    /*

        FUNCTION TO TRANSFER FUNDS TO TRADER WHEN ROLLOVER
        BEING CALLED BY VAULT

    */

    function totalAssets() public view returns (uint256) {
        // Balance of UNDERLYING ASSET + Value of positions on adapters
        // this will call to the DynamicValuationContract
    }

    function getTraderSelectedProtocolsLength()
        external
        view
        returns (uint256)
    {
        return traderSelectedProtocols.length;
    }

    function getCumulativePendingWithdrawals() external view returns (uint256) {
        return cumulativePendingWithdrawals;
    }

    function getCumulativePendingDeposits() external view returns (uint256) {
        return cumulativePendingDeposits;
    }

    // not sure if the execution is here. Don't think so
    function rollover() external onlyTrader {
        bool success = IUserVault(vaultAddress).rolloverFromTrader();
        if (!success) revert RolloverFailed();

        afterRoundBalance = IERC20Upgradeable(underlyingTokenAddress).balanceOf(
                address(this)
            );

        emit RolloverExecuted(block.timestamp);
    }

    function _isProtocolValid(
        uint256 _protocolId
    ) internal view returns (bool, address) {
        address adapterAddress = IAdaptersRegistry(adaptersRegistryAddress)
            .getAdapterAddressFromId(_protocolId);

        if (adapterAddress == address(0)) return (false, address(0));

        return (
            IAdaptersRegistry(adaptersRegistryAddress).isAdapterAllowed(
                adapterAddress
            ),
            adapterAddress
        );
    }

    function _scaleTraderOperation(
        IAdapterOperations.AdapterOperation[] memory _traderOperations
    ) internal pure returns (IAdapterOperations.AdapterOperation[] memory) {
        IAdapterOperations.AdapterOperation[]
            memory scaledOperation = new IAdapterOperations.AdapterOperation[](
                _traderOperations.length
            );

        for (uint256 i; i < _traderOperations.length; i++) {
            scaledOperation[i].operationId = _traderOperations[i].operationId;

            // scale each operation here
            scaledOperation[i].data = _traderOperations[i].data;
        }
        return scaledOperation;
    }
}
