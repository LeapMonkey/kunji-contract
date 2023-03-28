// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TraderWallet is OwnableUpgradeable {
    address public vaultAddress;
    address public underlyingTokenAddress;
    address public dynamicValuationAddress;

    // error InvalidRound(uint256 inputRound, uint256 currentRound);
    error AddressZero(string target);

    event VaultAddressSet(address indexed vaultAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
    event DynamicValuationAddressSet(address indexed dynamicValuationAddress);

    event Deposit(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    event Withdrawal(
        address indexed account,
        address indexed token,
        uint256 amount
    );

    modifier onlyAllowedAsset() {
        // get allowed asset and check
        _;
    }

    modifier onlyTrader() {
        // check trader // owner is the same ?
        _;
    }

    function initialize(
        address _vaultAddress,
        address _underlyingTokenAddress,
        address _dynamicValuationAddress
    ) external initializer {
        if (_vaultAddress == address(0))
            revert AddressZero({target: "_vaultAddress"});
        if (_underlyingTokenAddress == address(0))
            revert AddressZero({target: "_underlyingTokenAddress"});
        if (_dynamicValuationAddress == address(0))
            revert AddressZero({target: "_dynamicValuationAddress"});

        __Ownable_init();

        vaultAddress = _vaultAddress;
        underlyingTokenAddress = _underlyingTokenAddress;
        dynamicValuationAddress = _dynamicValuationAddress;
    }

    function setVaultAddress(address _vaultAddress) external onlyTrader {
        if (_vaultAddress == address(0))
            revert AddressZero({target: "_vaultAddress"});

        emit VaultAddressSet(_vaultAddress);

        vaultAddress = _vaultAddress;
    }

    function setUnderlyingTokenAddress(
        address _underlyingTokenAddress
    ) external onlyTrader {
        if (_underlyingTokenAddress == address(0))
            revert AddressZero({target: "_underlyingTokenAddress"});

        emit UnderlyingTokenAddressSet(_underlyingTokenAddress);

        underlyingTokenAddress = _underlyingTokenAddress;
    }

    function setDynamicValuationAddress(
        address _dynamicValuationAddress
    ) external onlyTrader {
        if (_dynamicValuationAddress == address(0))
            revert AddressZero({target: "_dynamicValuationAddress"});

        emit DynamicValuationAddressSet(_dynamicValuationAddress);

        dynamicValuationAddress = _dynamicValuationAddress;
    }

    //
    receive() external payable {}

    
    function deposit(
        address token,
        uint256 amount
    ) external onlyTrader onlyAllowedAsset {
        require(
            IERC20Upgradeable(token).transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        emit Deposit(msg.sender, token, amount);
    }

    function withdraw(
        address token,
        uint256 amount
    ) external onlyTrader onlyAllowedAsset {
        require(
            IERC20Upgradeable(token).balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );

        require(
            IERC20Upgradeable(token).transfer(msg.sender, amount),
            "Token transfer failed"
        );

        emit Withdrawal(msg.sender, token, amount);
    }

    function executeOperation(bool replicate) external onlyAllowedAsset onlyTrader {

        // other parameters missing


        if (replicate) {
            // scale parameters: how ?
            // call user vault
        }

    }
    
    function totalAssets()
        public
        view        
        returns (uint256)
    {
        // Balance of UNDERLYING ASSET + Value of positions on adapters
        // this will call to the DynamicValuationContract

    }


    function rolloverBatch() external virtual {
        // WILL THIS BE EXECUTED FROM HERE AND CALLING THE VAULT ?
    }


}
