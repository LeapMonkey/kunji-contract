// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/IPlatformAdapter.sol";
import "../../interfaces/IAdapter.sol";
import "./interfaces/IGmxAdapter.sol";
import "./interfaces/IGmxOrderBook.sol";
import "./interfaces/IGmxReader.sol";
import "./interfaces/IGmxRouter.sol";
import "./interfaces/IGmxVault.sol";


library GMXAdapter {
    error AddressZero();
    error InvalidOperationId();
    error CreateSwapOrderFail();

    IGmxReader constant public gmxReader = IGmxReader(0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064);
    IGmxRouter constant public gmxRouter = IGmxRouter(0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868);
    IGmxPositionRouter constant public gmxPositionRouter = IGmxPositionRouter(0x22199a49A999c351eF7927602CFB187ec3cae489);
    IGmxVault constant public gmxVault = IGmxVault(0x489ee077994B6658eAfA855C308275EAd8097C4A);
    IGmxOrderBook constant public gmxOrderBook = IGmxOrderBook(0x09f77E8A13De9a35a7231028187e9fD5DB8a2ACB);
    IGmxOrderBookReader constant public gmxOrderBookReader = IGmxOrderBookReader(0xa27C20A7CF0e1C68C0460706bB674f98F362Bc21);

    uint256 constant public ratioDenominator = 1e18;

    /// @notice The maximum slippage allowance
    uint256 constant public slippageMax = 1e17;  // 10%

    /// @notice Gives approve to operate with gmxPositionRouter
    /// @dev Needs to be called from wallet and vault in initialization
    // @todo move to contract constructor
    function initApprove() external {
        gmxRouter.approvePlugin(address(gmxPositionRouter));
    }


    /// @notice Executes operation with external protocol
    /// @param ratio Scaling ratio to
    /// @param tradeOperation Encoded operation data 
    function executeOperation(
        uint256 ratio,
        IAdapter.AdapterOperation memory tradeOperation
    ) external returns (bytes32) {
        if (uint256(tradeOperation.operationId) == 0) {
            return _increasePosition(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 1) {
            return _decreasePosition(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 2) {
            return _createIncreaseOrder(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 3) {
            return _updateIncreaseOrder(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 4) {
            return _cancelIncreaseOrder(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 5) {
            return _createDecreaseOrder(ratio, tradeOperation.data);
        
        } else if (tradeOperation.operationId == 6) {
            return _updateDecreaseOrder(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 7) {
            return _cancelDecreaseOrder(ratio, tradeOperation.data);

        } else if (tradeOperation.operationId == 8) {
            return _cancelMultipleOrder(ratio, tradeOperation.data);
        } 
        revert InvalidOperationId();
    }


    /* 
    @notice Opens new or increases the size of an existing position
    @param tradeData must contain packed parameters:
        path:       [collateralToken] or [tokenIn, collateralToken] if a swap is needed
        indexToken: the address of the token to long or short
        amountIn:   the amount of tokenIn to deposit as collateral
        minOut:     the min amount of collateralToken to swap for (can be zero if no swap is required)
        sizeDelta:  the USD value of the change in position size 
        isLong:     whether to long or short position
        acceptablePrice: the USD value of the max (for longs) or min (for shorts) index price acceptable when executing

    Additional params for increasing position    
        executionFee:   can be set to PositionRouter.minExecutionFee
        referralCode:   referral code for affiliate rewards and rebates
        callbackTarget: an optional callback contract (note: has gas limit)
    @return requestKey - Id in GMX increase position orders
    */
    function _increasePosition(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {
        (
            address[] memory path,
            address indexToken,
            uint256 amountIn,
            uint256 minOut,
            uint256 sizeDelta,
            bool isLong,
            uint256 acceptablePrice
        ) = abi.decode(
                tradeData,
                (address[], address, uint256, uint256, uint256, bool, uint256)
            );

        if (ratio != ratioDenominator) {
            // scaling for Vault
            amountIn = amountIn * ratio / ratioDenominator;
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            // increasing slippage allowance due to higher amounts
            minOut = minOut * ratio / (ratioDenominator + slippageMax);
        }

        address tokenOut = path[path.length - 1];
        _checkUpdateAllowance(tokenOut, address(gmxPositionRouter), amountIn);
        uint256 executionFee = gmxPositionRouter.minExecutionFee();

        requestKey = gmxPositionRouter.createIncreasePosition(
            path,
            indexToken,
            amountIn,
            minOut,
            sizeDelta,
            isLong,
            acceptablePrice,
            executionFee,
            0, // referralCode
            address(0) // callbackTarget
        );
    }

    /* 
    @notice Closes or decreases an existing position
    @param tradeData must contain packed parameters:
        path:            [collateralToken] or [collateralToken, tokenOut] if a swap is needed
        indexToken:      the address of the token that was longed (or shorted)
        collateralDelta: the amount of collateral in USD value to withdraw
        sizeDelta:       the USD value of the change in position size
        isLong:          whether the position is a long or short
        receiver:        the address to receive the withdrawn tokens 
        acceptablePrice: the USD value of the max (for longs) or min (for shorts) index price acceptable when executing
        minOut:          the min output token amount (can be zero if no swap is required)

    Additional params for increasing position    
        executionFee:   can be set to PositionRouter.minExecutionFee
        withdrawETH:    only applicable if WETH will be withdrawn, the WETH will be unwrapped to ETH if this is set to true
        callbackTarget: an optional callback contract (note: has gas limit)
    @return requestKey - Id in GMX increase position orders
    */
    function _decreasePosition(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {
        (
            address[] memory path,
            address indexToken,
            uint256 collateralDelta,
            uint256 sizeDelta,
            bool isLong,
            uint256 acceptablePrice,
            uint256 minOut
        ) = abi.decode(
                tradeData,
                (
                    address[],
                    address,
                    uint256,
                    uint256,
                    bool,
                    uint256,
                    uint256
                )
            );
        uint256 executionFee = gmxPositionRouter.minExecutionFee();

        // scaling for Vault
        if (ratio != ratioDenominator) {
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            // increasing slippage allowance due to higher amounts
            minOut = minOut * ratio / (ratioDenominator + slippageMax);
        }

        requestKey = gmxPositionRouter.createDecreasePosition(
            path,
            indexToken,
            collateralDelta,
            sizeDelta,
            isLong,
            address(this),      // receiver
            acceptablePrice,
            minOut,
            executionFee,
            false, // withdrawETH
            address(0) // callbackTarget
        );
    }


    /// /// /// ///
    /// Orders
    /// /// /// ///

    function _createIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _updateIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _cancelIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _createDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _updateDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _cancelDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}

    function _cancelMultipleOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bytes32 requestKey) {}


    /// /// /// /// /// ///
    /// View functions
    /// /// /// /// /// ///

    /// @notice Calculates the max amount of tokenIn that can be swapped
    /// @param tokenIn The address of input token
    /// @param tokenOut The address of output token
    /// @return amountIn Maximum available amount to be swapped
    function getMaxAmountIn(
        address tokenIn,
        address tokenOut
    ) external view returns (uint256 amountIn) {
        return gmxReader.getMaxAmountIn(address(gmxVault), tokenIn, tokenOut);
    }

    /// @notice Returns amount out after fees and the fee amount
    /// @param tokenIn The address of input token
    /// @param tokenOut The address of output token
    /// @param amountIn The amount of tokenIn to be swapped
    /// @return amountOutAfterFees The amount out after fees,
    /// @return feeAmount The fee amount in terms of tokenOut
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOutAfterFees, uint256 feeAmount) {
        return
            gmxReader.getAmountOut(
                address(gmxVault),
                tokenIn,
                tokenOut,
                amountIn
            );
    }

    /// @param account Wallet or Vault
    function getPositions(
        address account,
        address[] memory collateralTokens,
        address[] memory indexTokens,
        bool[] memory isLong
    ) external view returns (uint256[] memory) {
        return
            gmxReader.getPositions(
                address(gmxVault),
                account,
                collateralTokens,
                indexTokens,
                isLong
            );
    }

    function _checkUpdateAllowance(
        address token,
        address spender,
        uint256 amount
    ) internal {
        if (IERC20(token).allowance(address(this), spender) < amount) {
            IERC20(token).approve(spender, amount);
        }
    }
}
