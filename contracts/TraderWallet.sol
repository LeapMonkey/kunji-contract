// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
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
    uint256 public initialTraderBalance;
    uint256 public initialVaultBalance;
    uint256 public afterRoundTraderBalance;
    uint256 public afterRoundVaultBalance;
    uint256 public ratioPropotions;
    uint256 public ratioShares;
    uint256[] public traderSelectedProtocols;

    uint256[50] __gap;

    error ZeroAddrees(string _target);
    error ZeroAmount();
    error UnderlyingAssetNotAllowed();
    error CallerNotAllowed();
    error NewTraderNotAllowed();
    error InvalidProtocolID();
    error InvalidOperation(string _target);
    error AdapterOperationFailed(string _target);
    error ApproveFailed(address caller, address token, uint256 amount);
    error TokenTransferFailed();
    error RolloverFailed();
    error SendToTraderFailed();
    error AmountToScaleNotFound();
    error NothingToScale();


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

    event RolloverExecuted(uint256 _timestamp, uint256 _round);

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

        cumulativePendingDeposits = 0;
        cumulativePendingWithdrawals = 0;
        initialTraderBalance = 0;
        initialVaultBalance = 0;
        afterRoundTraderBalance = 0;
        afterRoundVaultBalance = 0;
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

    function getApproval(
        uint256 _protocolId,
        address _token,
        uint256 _amount
    ) external returns (bool) {
        // check if protocol id is valid
        (bool isValidProtocol, address adapterAddress) = _isProtocolValid(
            _protocolId
        );
        if (!isValidProtocol) revert InvalidProtocolID();

        if (
            !IERC20Upgradeable(underlyingTokenAddress).approve(
                adapterAddress,
                _amount
            )
        ) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: _token,
                amount: _amount
            });
        }
        return true;
    }

    // FIRST TRADE FLAG
    // FIRST TRADE FLAG
    // FIRST TRADE FLAG
    // FIRST TRADE FLAG
    // FIRST TRADE FLAG
    // FIRST TRADE FLAG

    function executeOnAdapter(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _traderOperation,
        IAdapter.Parameters[] memory _parameters,
        bool _replicate
    ) external onlyTrader {
        // check if protocol id is valid
        (bool isValidProtocol, address adapterAddress) = _isProtocolValid(
            _protocolId
        );
        if (!isValidProtocol) revert InvalidProtocolID();

        // check if operations on adapters are valid
        if (!IAdapter(adapterAddress).isOperationAllowed(_traderOperation))
            revert InvalidOperation({_target: "_traderOperationStruct"});

        // DELEGATE CALL        
        /*
            // IAdapter adapter = IAdapter(adapterAddress);
            // (bool success, bytes memory returnedData) = address(adapter)
            //     .delegatecall(
            //         abi.encodeWithSignature(
            //             "executeOperations((uint8,bytes),Parameters[])",
            //             _traderOperation,
            //             _parameters
            //         )
            //     );
            // IAdapter.Parameters[] memory toScaleParameters;
            // (success, toScaleParameters) = abi.decode(
            //     returnedData,
            //     (bool, IAdapter.Parameters[])
            // );
        */

        // execute operation
        // returns success and the params to be scaled
        (
            bool success,
            IAdapter.Parameters[] memory toScaleParameters
        ) = IAdapter(adapterAddress).executeOperations(
                _traderOperation,
                _parameters
            );

        // check operation success
        if (!success) revert AdapterOperationFailed({_target: "trader"});

        // contract should receive funds HERE
        // contract should receive funds HERE
        // contract should receive funds HERE

        if (_replicate && toScaleParameters.length == 0) {
            // revert if operation does not return an array to scale values
            revert NothingToScale();
        }

        emit OperationExecuted(
            _protocolId,
            block.timestamp,
            "trader wallet",
            _replicate,
            initialTraderBalance
        );

        // if tx needs to be replicated on vault
        if (_replicate) {
            // scale parameters
            IAdapter.Parameters[]
                memory scaledParameters = _scaleTraderOperation(
                    toScaleParameters,
                    _parameters
                );

            // call user vault
            (success, initialVaultBalance) = IUserVault(vaultAddress)
                .executeOnAdapter(
                    _protocolId,
                    _traderOperation,
                    scaledParameters
                );

            if (!success) revert AdapterOperationFailed({_target: "user"});

            emit OperationExecuted(
                _protocolId,
                block.timestamp,
                "user vault",
                _replicate,
                initialVaultBalance
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
        bool firstRollover = true;

        if (!firstRollover) {
            afterRoundTraderBalance = IERC20Upgradeable(underlyingTokenAddress)
                .balanceOf(address(this));
            afterRoundVaultBalance = IUserVault(vaultAddress)
                .getVaultInitialBalance();
        } else {
            // store the first ratio between shares and deposit
            ratioShares = 1;
        }

        bool success = IUserVault(vaultAddress).rolloverFromTrader();
        if (!success) revert RolloverFailed();

        // send to trader account

        (bool sent, ) = traderAddress.call{value: cumulativePendingWithdrawals}(
            ""
        );
        if (!sent) revert SendToTraderFailed();

        emit RolloverExecuted(
            block.timestamp,
            IUserVault(vaultAddress).getRound()
        );

        // get values for next round proportions
        initialTraderBalance = IERC20Upgradeable(underlyingTokenAddress)
            .balanceOf(address(this));
        initialVaultBalance = IUserVault(vaultAddress).getVaultInitialBalance();
        ratioPropotions = initialVaultBalance / initialTraderBalance;
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
        IAdapter.Parameters[] memory _toScaleParameters,
        IAdapter.Parameters[] memory _traderParameters
    ) internal returns (IAdapter.Parameters[] memory) {
        // new array with the scaled parameter
        IAdapter.Parameters[]
            memory scaledParameters = new IAdapter.Parameters[](
                _traderParameters.length
            );

        // copy the array completely
        for (uint256 i; i < _traderParameters.length; i++) {
            scaledParameters[i]._order = _traderParameters[i]._order;
            scaledParameters[i]._type = _traderParameters[i]._type;
            scaledParameters[i]._value = _traderParameters[i]._value;
        }

        // copy the array completely
        for (uint256 i; i < _toScaleParameters.length; i++) {
            scaledParameters[_toScaleParameters[i]._order]
                ._value = _getScaledValue(_toScaleParameters[i]._value);
        }

        // return the array with the
        return scaledParameters;
    }

    function _getScaledValue(
        string memory _toScaleValue
    ) internal returns (string memory) {
        uint256 value = getNumberFromString(_toScaleValue);
        ratioPropotions = initialVaultBalance / initialTraderBalance;
        uint256 scaledValue = value * ratioPropotions;
        return uintToString(scaledValue);
    }

    function getNumberFromString(
        string memory str
    ) public pure returns (uint256) {
        bytes memory strBytes = bytes(str);
        uint256 num = 0;
        for (uint i = 0; i < strBytes.length; i++) {
            uint256 digit = uint256(uint8(strBytes[i])) - 48;
            require(digit <= 9, "Invalid digit");
            num = num * 10 + digit;
        }
        return uint256(num);
    }

    function uintToString(uint256 num) public pure returns (string memory) {
        bytes memory numBytes = abi.encodePacked(num);
        return string(numBytes);
    }
}
