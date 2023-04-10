// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import {IAdaptersRegistry} from "./interfaces/IAdaptersRegistry.sol";
import {IAdapter} from "./interfaces/IAdapter.sol";
import {IUsersVault} from "./interfaces/IUsersVault.sol";

/// import its own interface as well

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
    address[] public traderSelectedAdaptersArray;
    mapping(address => bool) public traderSelectedAdaptersMapping;

    uint256[50] __gap;

    error ZeroAddress(string target);
    error ZeroAmount();
    error UnderlyingAssetNotAllowed();
    error CallerNotAllowed();
    error NewTraderNotAllowed();
    error InvalidAdapter();
    error InvalidOperation(string target);
    error AdapterOperationFailed(string target);
    error ApproveFailed(address caller, address token, uint256 amount);
    error TokenTransferFailed();
    error RolloverFailed();
    error SendToTraderFailed();
    error AmountToScaleNotFound();

    event VaultAddressSet(address indexed vaultAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);
    event TraderAddressSet(address indexed traderAddress);
    event DynamicValueAddressSet(address indexed dynamicValueAddress);
    event AdapterToUseAdded(address indexed adapter, address indexed trader);
    event AdapterToUseRemoved(
        address indexed adapter,
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
        address adapterAddress,
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

    function addAdapterToUse(address _adapterAddress) external onlyTrader {
        if (
            !IAdaptersRegistry(adaptersRegistryAddress).isValidAdapter(
                _adapterAddress
            )
        ) revert InvalidAdapter();
        emit AdapterToUseAdded(_adapterAddress, _msgSender());

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

        // store the adapter on the array
        traderSelectedAdaptersArray.push(_adapterAddress);
        // store the adapter in the mapping
        traderSelectedAdaptersMapping[_adapterAddress] = true;
    }

    function removeAdapterToUse(address _adapterAddress) external onlyTrader {
        bool found = false;

        for (uint256 i = 0; i < traderSelectedAdaptersArray.length; i++) {
            if (traderSelectedAdaptersArray[i] == _adapterAddress) {
                emit AdapterToUseRemoved(_adapterAddress, _msgSender());

                // put the last in the found index
                traderSelectedAdaptersArray[i] = traderSelectedAdaptersArray[
                    traderSelectedAdaptersArray.length - 1
                ];
                // remove the last one because it was alredy put in found index
                traderSelectedAdaptersArray.pop();
                // flag
                found = true;
                // remove from the mapping
                delete traderSelectedAdaptersMapping[_adapterAddress];
                // // disable on mapping
                // traderSelectedAdaptersMapping[_adapterAddress] = false;
            }
        }
        if (!found) revert InvalidAdapter();

        // REMOVE ALLOWANCE OF UNDERLYING ????
        // REMOVE ALLOWANCE OF UNDERLYING ????
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

    function setAdapterAllowanceOnToken(
        address _adapterAddress,
        address _tokenAddress,
        bool _revoke
    ) external onlyTrader returns (bool) {
        if (
            !IAdaptersRegistry(adaptersRegistryAddress).isValidAdapter(
                _adapterAddress
            )
        ) revert InvalidAdapter();

        uint256 amount;
        if (!_revoke) amount = type(uint256).max;
        else amount = 0;

        if (
            !IERC20Upgradeable(_tokenAddress).approve(_adapterAddress, amount)
        ) {
            revert ApproveFailed({
                caller: _msgSender(),
                token: _tokenAddress,
                amount: amount
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
        address _adapterAddress,
        IAdapter.AdapterOperation memory _traderOperation,
        bool _replicate
    ) external onlyTrader returns(bool) {
        // check if adapter is selected by trader
        if (!traderSelectedAdaptersMapping[_adapterAddress])
            revert InvalidAdapter();

    
        uint256 walletRatio = 1e18;
        // execute operation with ratio equals to 1 because it is for trader, not scaling
        // returns success or not
        bool success = IAdapter(_adapterAddress).executeOperations(
            walletRatio,
            _traderOperation
        );

        // check operation success
        if (!success) revert AdapterOperationFailed({target: "trader"});

        // contract should receive tokens HERE

        emit OperationExecuted(
            _adapterAddress,
            block.timestamp,
            "trader wallet",
            _replicate,
            initialTraderBalance,
            walletRatio
        );

        // if tx needs to be replicated on vault
        if (_replicate) {
            
            ////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////
            walletRatio = 1e18;
            ////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////
            ////////////////////////////////////////////////////////////
            success = IUsersVault(vaultAddress).executeOnAdapter(_adapterAddress, _traderOperation, walletRatio);
                

            /* 
            FLOW IS NOW ON VAULT, MAYBE IT NEEDS TO CHECK THERE FOR ALL THIS BELOW

            // check operation success
            if (!success) revert AdapterOperationFailed({target: "vault"});

            // contract should receive tokens HERE

            emit OperationExecuted(
                _adapterAddress,
                block.timestamp,
                "users vault",
                _replicate,
                initialVaultBalance,
                walletRatio
            );
            */
        }
        return true;
    }


    function totalAssets() public view returns (uint256) {
        // Balance of UNDERLYING ASSET + Value of positions on adapters
        // this will call to the DynamicValuationContract
    }

    function getTraderSelectedAdaptersLength()
        external
        view
        returns (uint256)
    {
        return traderSelectedAdaptersArray.length;
    }

    function getCumulativePendingWithdrawals() external view returns (uint256) {
        return cumulativePendingWithdrawals;
    }

    function getCumulativePendingDeposits() external view returns (uint256) {
        return cumulativePendingDeposits;
    }

    /*

        FUNCTION TO TRANSFER FUNDS TO TRADER WHEN ROLLOVER
        BEING CALLED BY VAULT

    */

    // not sure if the execution is here. Don't think so
    function rollover() external onlyTrader {
        bool firstRollover = true;

        if (!firstRollover) {
            afterRoundTraderBalance = IERC20Upgradeable(underlyingTokenAddress)
                .balanceOf(address(this));
            afterRoundVaultBalance = IUsersVault(vaultAddress)
                .getVaultInitialBalance();
        } else {
            // store the first ratio between shares and deposit
            ratioShares = 1;
        }

        bool success = IUsersVault(vaultAddress).rolloverFromTrader();
        if (!success) revert RolloverFailed();

        // send to trader account

        (bool sent, ) = traderAddress.call{value: cumulativePendingWithdrawals}(
            ""
        );
        if (!sent) revert SendToTraderFailed();

        emit RolloverExecuted(
            block.timestamp,
            IUsersVault(vaultAddress).getRound()
        );

        // get values for next round proportions
        initialTraderBalance = IERC20Upgradeable(underlyingTokenAddress)
            .balanceOf(address(this));
        initialVaultBalance = IUsersVault(vaultAddress).getVaultInitialBalance();
        ratioPropotions = getRatio();
    }

    function getRatio() public view returns(uint256) {
        return initialVaultBalance / initialTraderBalance;
    }    
}
