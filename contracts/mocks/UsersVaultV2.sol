// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {IAdaptersRegistry} from "../interfaces/IAdaptersRegistry.sol";
import {IContractsFactory} from "../interfaces/IContractsFactory.sol";
import "../adapters/gmx/GMXAdapter.sol";

import "hardhat/console.sol";

/// import its own interface as well

contract UsersVaultV2 is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
using MathUpgradeable for uint256;

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
    address public dynamicValueAddress;
    uint256 public currentRound;
    uint256 public initialVaultBalance;
    uint256 public afterRoundVaultBalance;
    // Total amount of total deposit assets in mapped round
    uint256 public pendingDepositAssets;

    // Total amount of total withdrawal shares in mapped round
    uint256 public pendingWithdrawShares;

    uint256 public processedWithdrawAssets;
    uint256 public ratioShares;
    int256 public vaultProfit;

    address[] public traderSelectedAdaptersArray;
    mapping(uint256 => address) public adaptersPerProtocol;

    // user specific deposits accounting
    mapping(address => UserDeposit) public userDeposits;

    // user specific withdrawals accounting
    mapping(address => UserWithdrawal) public userWithdrawals;

    // ratio per round
    mapping(uint256 => uint256) public assetsPerShareXRound;

    // added variable
    uint256 public addedVariable;

    error ZeroAddress(string target);
    error ZeroAmount();
    error UserNotAllowed();
    error InvalidTraderWallet();
    error TokenTransferFailed();
    error InvalidRound();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error InvalidRollover();
    error InvalidProtocol();
    error AdapterPresent();
    error AdapterNotPresent();
    error InvalidAdapter();
    error AdapterOperationFailed(string target);
    error UsersVaultOperationFailed();
    error ApproveFailed(address caller, address token, uint256 amount);
    // error ExistingWithdraw();
    // error BatchNotClosed();

    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);
    event TraderAddressSet(address indexed traderAddress);
    event DynamicValueAddressSet(address indexed dynamicValueAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
    event AdapterToUseAdded(
        uint256 protocolId,
        address indexed adapter,
        address indexed trader
    );
    event AdapterToUseRemoved(address indexed adapter, address indexed caller);
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
    event OperationExecuted(
        uint256 protocolId,
        uint256 timestamp,
        string target,
        uint256 initialBalance,
        uint256 walletRatio
    );

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
            revert ZeroAddress({target: "_traderWalletAddress"});

        if (_dynamicValueAddress == address(0))
            revert ZeroAddress({target: "_dynamicValueAddress"});

        __Ownable_init();
        __Pausable_init();
        __ERC20_init(_sharesName, _sharesSymbol);

        underlyingTokenAddress = _underlyingTokenAddress;
        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderWalletAddress = _traderWalletAddress;
        dynamicValueAddress = _dynamicValueAddress;
        currentRound = 0;
        vaultProfit = 0;
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

    function setDynamicValueAddress(address _dynamicValueAddress) external {
        _checkOwner();
        _checkZeroAddress(_dynamicValueAddress, "_dynamicValueAddress");
        emit DynamicValueAddressSet(_dynamicValueAddress);
        dynamicValueAddress = _dynamicValueAddress;
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
            !IContractsFactory(contractsFactoryAddress).isVaultWalletAllowed(
                _traderWalletAddress
            )
        ) revert InvalidTraderWallet();
        emit TraderWalletAddressSet(_traderWalletAddress);
        traderWalletAddress = _traderWalletAddress;
    }

    function setUnderlyingTokenAddress(
        address _underlyingTokenAddress
    ) external {
        _checkOwner();
        _checkZeroAddress(_underlyingTokenAddress, "_underlyingTokenAddress");
        emit UnderlyingTokenAddressSet(_underlyingTokenAddress);
        underlyingTokenAddress = _underlyingTokenAddress;
    }

    function addAdapterToUse(uint256 _protocolId) external {
        _checkOwner();
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

    function removeAdapterToUse(uint256 _protocolId) external {
        _checkOwner();

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

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external returns (bool) {
        _checkOwner();

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
                userDeposits[_msgSender()].pendingAssets.mulDiv(
                    1e18,
                    assetPerShare
                );

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
        _burn(_msgSender(), _sharesAmount);

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
                userWithdrawals[_msgSender()].pendingShares.mulDiv(
                    assetsPerShare,
                    1e18
                );
            userWithdrawals[_msgSender()].pendingShares = 0;
        }

        // Update round and glp balance for current round
        userWithdrawals[_msgSender()].round = currentRound;
        userWithdrawals[_msgSender()].pendingShares =
            userWithdrawals[_msgSender()].pendingShares +
            _sharesAmount;

        pendingWithdrawShares = pendingWithdrawShares + _sharesAmount;
    }

    //
    //
    function rolloverFromTrader() external returns (bool) {
        _onlyTraderWallet(_msgSender());

        if (pendingDepositAssets == 0 && pendingWithdrawShares == 0)
            revert InvalidRollover();

        uint256 assetsPerShare;
        uint256 sharesToMint;

        if (currentRound != 0) {
            afterRoundVaultBalance = getUnderlyingLiquidity();

            assetsPerShare = afterRoundVaultBalance.mulDiv(1e18, totalSupply());
            sharesToMint = pendingDepositAssets.mulDiv(assetsPerShare, 1e18);
            console.log(
                "CNT - getUnderlyingLiquidity : ",
                afterRoundVaultBalance
            );
            console.log("CNT - sharesToMint           : ", sharesToMint);
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
        _mint(address(this), sharesToMint);
        assetsPerShareXRound[currentRound] = assetsPerShare;

        // Accept all pending deposits
        pendingDepositAssets = 0;

        // Process all withdrawals
        processedWithdrawAssets = assetsPerShare.mulDiv(
            pendingWithdrawShares,
            1e18
        );

        console.log("CNT - round                  : ", currentRound);
        console.log("CNT - assetsPerShare         : ", assetsPerShare);
        console.log("CNT - processedWithdrawAssets: ", processedWithdrawAssets);

        // Revert if the assets required for withdrawals < asset balance present in the vault
        if (processedWithdrawAssets > 0) {
            require(
                IERC20Upgradeable(underlyingTokenAddress).balanceOf(
                    address(this)
                ) > processedWithdrawAssets,
                "Not enough assets for withdrawal"
            );
        }

        // get profits
        if (currentRound != 0) {
            vaultProfit = int256(afterRoundVaultBalance) -
            int256(initialVaultBalance);
        }
        if (vaultProfit > 0) {
            // DO SOMETHING HERE WITH PROFIT ?
        }

        // Make pending withdrawals 0
        pendingWithdrawShares = 0;
        vaultProfit = 0;

        initialVaultBalance = getUnderlyingLiquidity();

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
        _onlyTraderWallet(_msgSender());
        address adapterAddress;

        bool success = false;
        if (_protocolId == 1) {
            success = _executeOnGmx(_walletRatio, _traderOperation);
        } else {
            adapterAddress = adaptersPerProtocol[_protocolId];
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

        emit OperationExecuted(
            _protocolId,
            block.timestamp,
            "trader wallet",
            initialVaultBalance,
            _walletRatio
        );
        return true;
    }

    // THIS FUNCTION SEEMS INCORRECT
    // USES BALANCE OF SENDER SHARES TO CALCULATE AMOUNT TO CLAIM
    // SO USER ALREADY HAS THAT
    // THEN CALL CLAIMSHARES WITH THE RECEIVER WHICH CAN BE ANYONE
    // IF USER EXECUTES WILL TRY TO GET FOR HIMSELF
    // WHAT HE ALREADY HAS
    /*
    function claimAllShares(
        address _receiver
    ) external returns (uint256 _sharesAmount) {
        _sharesAmount = balanceOf(_msgSender());
        claimShares(_sharesAmount, _receiver);
    }
    */

    function claimAllAssets(
        address _receiver
    ) external returns (uint256 _assetsAmount) {
        _onlyValidInvestors(_msgSender());
        _assetsAmount = balanceOf(_msgSender());
        claimAssets(_assetsAmount, _receiver);
    }

    function previewShares(address _receiver) external view returns (uint256) {
        _checkZeroRound();

        if (
            userDeposits[_receiver].round < currentRound &&
            userDeposits[_receiver].pendingAssets > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userDeposits[_receiver].round
            ];

            return
                userDeposits[_receiver].unclaimedShares +
                userDeposits[_receiver].pendingAssets.mulDiv(
                    1e18,
                    assetsPerShare > 0 ? assetsPerShare : 1e18
                );
        }

        return userDeposits[_receiver].unclaimedShares;
    }

    function getSharesContractBalance() external view returns (uint256) {
        return this.balanceOf(address(this));
    }

    function getTraderSelectedAdaptersLength() external view returns (uint256) {
        return traderSelectedAdaptersArray.length;
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

        _transfer(address(this), _receiver, _sharesAmount);
    }

    function claimAssets(uint256 _assetsAmount, address _receiver) public {
        _checkZeroRound();
        _onlyValidInvestors(_msgSender());

        if (_assetsAmount == 0) revert ZeroAmount();

        if (
            userWithdrawals[_msgSender()].round < currentRound &&
            userWithdrawals[_msgSender()].pendingShares > 0
        ) {
            uint256 assetsPerShare = assetsPerShareXRound[
                userWithdrawals[_msgSender()].round
            ];

            userWithdrawals[_msgSender()].unclaimedAssets =
                userWithdrawals[_msgSender()].unclaimedAssets +
                userWithdrawals[_msgSender()].pendingShares.mulDiv(
                    assetsPerShare,
                    1e18
                );
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
    //
    function getUnderlyingLiquidity() public view returns (uint256) {
        console.log("-------------------------------------------------------");
        console.log(
            "CNT - USDC Balance           : ",
            IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this))
        );
        console.log("CNT - pendingDepositAssets   : ", pendingDepositAssets);
        console.log("CNT - processedWithdrawAssets: ", processedWithdrawAssets);
        console.log("CNT - totalSupply()          : ", totalSupply());
        console.log("-------------------------------------------------------");
        return
            IERC20Upgradeable(underlyingTokenAddress).balanceOf(address(this)) -
            pendingDepositAssets -
            processedWithdrawAssets;
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
    ) internal pure returns (bool) {
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

    function _checkZeroAddress(
        address _variable,
        string memory _message
    ) internal pure {
        if (_variable == address(0)) revert ZeroAddress({target: _message});
    }

    function addedMethod(uint256 _newValue) external {
        addedVariable = _newValue;
    }
}
