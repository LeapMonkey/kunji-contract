// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import {ERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {IERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";

import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {SafeCastUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeCastUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import {IContractsFactory} from "./interfaces/IContractsFactory.sol";
import "./adapters/gmx/GMXAdapter.sol";

/// import its own interface as well

contract UsersVault is
    ERC4626Upgradeable,
    OwnableUpgradeable    
{
    using MathUpgradeable for uint256;
    using MathUpgradeable for uint128;
    using SafeCastUpgradeable for uint256;

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

    address public adaptersRegistryAddress;
    address public contractsFactoryAddress;
    address public traderWalletAddress;
    address public dynamicValueAddress;
    mapping(uint256 => address) public adaptersPerProtocol;
    address[] public traderSelectedAdaptersArray;

    uint256 public currentRound;

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

    error ZeroAddress(string target);
    error ZeroAmount();
    error FunctionCallNotAllowed();
    error UserNotAllowed();
    error SafeTransferFailed();

    error InvalidTime(uint256 timestamp);
    error InvalidRound(uint256 inputRound, uint256 currentRound);

    error ExistingWithdraw();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error UnderlyingAssetNotAllowed();
    error BatchNotClosed();
    error WithdrawNotInitiated();
    error InvalidRolloverBatch();
    error NewTraderNotAllowed();
    error InvalidProtocol();
    error InvalidAdapter();
    error AdapterOperationFailed(string target);
    error UsersVaultOperationFailed();
    error ApproveFailed(address caller, address token, uint256 amount);

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

    modifier notZeroAddress(address _variable, string memory _message) {
        if (_variable == address(0)) revert ZeroAddress({target: _message});
        _;
    }

    modifier onlyUnderlying(address _tokenAddress) {
        if (_tokenAddress != asset()) revert UnderlyingAssetNotAllowed();
        _;
    }

    modifier onlyValidInvestors(address _account) {
        if (
            !IContractsFactory(contractsFactoryAddress).isInvestorAllowed(
                _account
            )
        ) revert UserNotAllowed();
        _;
    }

    // this is the shares token
    // constructor() ERC20("name", "symbol) ERC4626(...) {}
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
            revert ZeroAddress({target: "_traderAddress"});

        if (_dynamicValueAddress == address(0))
            revert ZeroAddress({target: "_dynamicValueAddress"});

        __Ownable_init();
        // __Pausable_init();
        __ERC4626_init(IERC20Upgradeable(_underlyingTokenAddress));
        __ERC20_init(_sharesName, _sharesSymbol);

        adaptersRegistryAddress = _adaptersRegistryAddress;
        contractsFactoryAddress = _contractsFactoryAddress;
        traderWalletAddress = _traderWalletAddress;
        dynamicValueAddress = _dynamicValueAddress;
        currentRound = 1;
    }

    function deposit(
        uint256 _assetsAmount,
        address _receiver
    ) public virtual override returns (uint256) {
        _assetsAmount; // avoid warnings
        _receiver; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function mint(
        uint256 _sharesAmount,
        address _receiver
    ) public virtual override returns (uint256) {
        _sharesAmount; // avoid warnings
        _receiver; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function withdraw(
        uint256 _assetsAmount,
        address _receiver,
        address _owner
    ) public virtual override returns (uint256) {
        _assetsAmount; // avoid warnings
        _receiver; // avoid warnings
        _owner; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function redeem(
        uint256 _sharesAmount,
        address _receiver,
        address _owner
    ) public virtual override returns (uint256) {
        _sharesAmount; // avoid warnings
        _receiver; // avoid warnings
        _owner; // avoid warnings
        revert FunctionCallNotAllowed();
    }

    function setAdaptersRegistryAddress(
        address _adaptersRegistryAddress
    )
        external
        onlyOwner
    // notZeroAddress(_adaptersRegistryAddress, "_adaptersRegistryAddress")
    {
        emit AdaptersRegistryAddressSet(_adaptersRegistryAddress);
        adaptersRegistryAddress = _adaptersRegistryAddress;
    }

    function setDynamicValueAddress(
        address _dynamicValueAddress
    )
        external
        onlyOwner
    // notZeroAddress(_dynamicValueAddress, "_dynamicValueAddress")
    {
        emit DynamicValueAddressSet(_dynamicValueAddress);
        dynamicValueAddress = _dynamicValueAddress;
    }

    function setContractsFactoryAddress(
        address _contractsFactoryAddress
    )
        external
        onlyOwner
    // notZeroAddress(_contractsFactoryAddress, "_contractsFactoryAddress")
    {
        emit ContractsFactoryAddressSet(_contractsFactoryAddress);
        contractsFactoryAddress = _contractsFactoryAddress;
    }

    function setTraderWalletAddress(
        address _traderWalletAddress
    ) external onlyOwner // notZeroAddress(_traderAddress, "_traderAddress")
    {
        if (
            !IContractsFactory(contractsFactoryAddress).isTraderAllowed(
                _traderWalletAddress
            )
        ) revert NewTraderNotAllowed();

        emit TraderAddressSet(_traderWalletAddress);
        traderWalletAddress = _traderWalletAddress;
    }

    /**
     * @dev Deposit/mint common workflow.
     */
    function userDeposit(
        uint256 _assetsAmount
    ) external onlyValidInvestors(_msgSender()) {
        SafeERC20Upgradeable.safeTransferFrom(
            IERC20Upgradeable(asset()),
            _msgSender(),
            address(this),
            _assetsAmount
        );

        emit Deposit(_msgSender(), _msgSender(), _assetsAmount, 0);

        uint128 userDepositAssets = userDeposits[_msgSender()].pendingAssets;

        //Convert previous round glp balance into unclaimed shares
        uint256 userDepositRound = userDeposits[_msgSender()].round;
        if (userDepositRound < currentRound && userDepositAssets > 0) {
            uint256 assetPerShareX128 = batchAssetsPerShareX128[
                userDepositRound
            ];
            userDeposits[_msgSender()].unclaimedShares += userDeposits[
                _msgSender()
            ].pendingAssets.mulDiv(Q128, assetPerShareX128).toUint128();
            userDepositAssets = 0;
        }

        //Update round and glp balance for current round
        userDeposits[_msgSender()].round = currentRound;
        userDeposits[_msgSender()].pendingAssets =
            userDepositAssets +
            _assetsAmount.toUint128();
        pendingDepositAssets += _assetsAmount.toUint128();
    }

    /**
     * @dev Withdraw/redeem common workflow.
     */
    function withdrawalRequest(
        // address _caller,
        // address _receiver,
        // address _owner,
        uint256 _assetsAmount,
        uint256 _sharesAmount
    ) external onlyValidInvestors(_msgSender()) {
        _burn(_msgSender(), _sharesAmount);

        emit Withdraw(
            _msgSender(),
            _msgSender(),
            _msgSender(),
            _assetsAmount,
            _sharesAmount
        );

        uint128 userWithdrawShares = userWithdrawals[_msgSender()]
            .pendingShares;

        //Convert previous round glp balance into unredeemed shares
        uint256 userWithdrawalRound = userWithdrawals[_msgSender()].round;
        if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
            uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                userWithdrawalRound
            ];
            userWithdrawals[_msgSender()].unclaimedAssets += userWithdrawShares
                .mulDiv(assetsPerShareX128, Q128)
                .toUint128();
            userWithdrawShares = 0;
        }

        //Update round and glp balance for current round
        userWithdrawals[_msgSender()].round = currentRound;
        userWithdrawals[_msgSender()].pendingShares =
            userWithdrawShares +
            _sharesAmount.toUint128();
        pendingWithdrawShares += _sharesAmount.toUint128();
    }

    // function _createDepositReceipt(uint256 _assetsAmount, address _receiver) internal {
    // }
    // function _createWithdrawalReceipt(uint256 _sharesAmount, address _owner) internal {
    // }

    function setAdapterAllowanceOnToken(
        uint256 _protocolId,
        address _tokenAddress,
        bool _revoke
    ) external onlyOwner returns (bool) {
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

        // mint the shares (?)
        // TO EACH USER ?

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

    function claimShares(uint256 _sharesAmount, address _receiver) public {
        uint128 userUnclaimedShares = userDeposits[_msgSender()]
            .unclaimedShares;
        uint128 userDepositAssets = userDeposits[_msgSender()].pendingAssets;
        {
            //Convert previous round glp balance into unredeemed shares
            uint256 userDepositRound = userDeposits[_msgSender()].round;
            if (userDepositRound < currentRound && userDepositAssets > 0) {
                uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                    userDepositRound
                ];
                userUnclaimedShares += userDepositAssets
                    .mulDiv(Q128, assetsPerShareX128)
                    .toUint128();
                userDeposits[_msgSender()].pendingAssets = 0;
            }
        }
        if (userUnclaimedShares < _sharesAmount.toUint128())
            revert InsufficientShares(userUnclaimedShares);
        userDeposits[_msgSender()].unclaimedShares =
            userUnclaimedShares -
            _sharesAmount.toUint128();
        transfer(_receiver, _sharesAmount);

        emit SharesClaimed(
            currentRound,
            _sharesAmount,
            _msgSender(),
            _receiver
        );
    }

    function claimAssets(uint256 _assetsAmount, address _receiver) public {
        uint128 userUnclaimedAssets = userWithdrawals[_msgSender()]
            .unclaimedAssets;
        uint128 userWithdrawShares = userWithdrawals[_msgSender()]
            .pendingShares;
        {
            uint256 userWithdrawalRound = userWithdrawals[_msgSender()].round;
            if (userWithdrawalRound < currentRound && userWithdrawShares > 0) {
                uint256 assetsPerShareX128 = batchAssetsPerShareX128[
                    userWithdrawalRound
                ];
                userUnclaimedAssets += userWithdrawShares
                    .mulDiv(assetsPerShareX128, Q128)
                    .toUint128();
                userWithdrawals[_msgSender()].pendingShares = 0;
            }
        }

        if (userUnclaimedAssets < _assetsAmount)
            revert InsufficientAssets(userUnclaimedAssets);

        userWithdrawals[_msgSender()].unclaimedAssets =
            userUnclaimedAssets -
            _assetsAmount.toUint128();

        emit AssetsClaimed(
            currentRound,
            _assetsAmount,
            _msgSender(),
            _receiver
        );

        SafeERC20Upgradeable.safeTransfer(
            IERC20Upgradeable(asset()),
            _receiver,
            _assetsAmount
        );
    }

    // function claimAllShares(
    //     address _receiver
    // ) external returns (uint256 _sharesAmount) {
    //     _sharesAmount = balanceOf(_msgSender());
    //     claimShares(_sharesAmount, _receiver);
    // }

    // function claimAllAssets(
    //     address _receiver
    // ) external returns (uint256 _assetsAmount) {
    //     _assetsAmount = balanceOf(_msgSender());
    //     claimAssets(_assetsAmount, _receiver);
    // }
}
