// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../../interfaces/IPlatformAdapter.sol";
import "../../interfaces/IAdapter.sol";
import "./interfaces/IGMXAdapter.sol";

library GMXAdapter {
    error AddressZero();
    error InvalidOperationId();

    IGmxReader public gmxReader;
    IGmxRouter public gmxRouter;
    IGmxPositionRouter public gmxPositionRouter;
    IGmxVault public gmxVault;

    struct AdapterOperation {
        uint8 operationId;
        bytes data;
    }

    function initialize(
        address _gmxRouter,
        address _gmxPositionRouter,
        address _gmxReader,
        address _gmxVault
    ) external initializer {
        if (
            _gmxRouter == address(0) ||
            _gmxPositionRouter == address(0) ||
            _gmxReader == address(0) ||
            _gmxVault == address(0)
        ) revert AddressZero();
        gmxRouter = IGmxRouter(_gmxRouter);
        gmxPositionRouter = IGmxPositionRouter(_gmxPositionRouter);
        gmxReader = IGmxReader(_gmxReader);
        gmxVault = IGmxVault(_gmxVault);
    }

    /// @notice Gives approve to operate with gmxPositionRouter
    /// @dev Needs to be called with delegatecall from wallet and vault in initialization
    function initApprove() external {
        gmxRouter.approvePlugin(address(gmxPositionRouter));
    }

    // @todo refactor input params according updates in the Wallet
    function executeOperation(
        uint256 ratio,
        IAdapter.AdapterOperation memory traderOperation
    ) external returns (bytes32) {
        if (traderOperation.operationId == 0) {
            uint256 outputAmount = _swap(ratio, traderOperation.data);
            return bytes32(abi.encodePacked(outputAmount));
        } else if (traderOperation.operationId == 1) {
            return _increasePosition(ratio, traderOperation.data);
        } else if (traderOperation.operationId == 2) {
            return _decreasePosition(ratio, traderOperation.data);
        }

        revert InvalidOperationId();
    }

    /* 
    @notice Performs swap along the path
    @dev Must be executed using delegate call, that's why we use address(this)
    @param tradeData - swap data, must contain:
        path:       the swap path as array: [tokenIn, tokenOut]
        amountIn:   the amount of tokenIn to swap
        minOut:     minimum expected output amount
        receiver:   address of the receiver of tokenOut (will be address(this) in terms of delegate call)
    @return boughtAmount - bought amount of target swap token
    */
    function _swap(uint256 ratio, bytes memory tradeData) internal returns (uint256) {
        (address[] memory path, uint256 amountIn, uint256 minOut) = abi.decode(
            tradeData,
            (address[], uint256, uint256)
        );

        address tokenOut = path[path.length - 1];
        uint256 balance = IERC20(tokenOut).balanceOf(address(this));

        if (ratio != ratioDenominator) {
            // scaling for Vault
            amountIn = amountIn * ratio / ratioDenominator;
            // increasing slippage allowance due to higher amounts
            minOut = minOut * ratio / (ratioDenominator + slippageMax);
        }

        _checkUpdateAllowance(tokenOut, address(gmxRouter), amountIn);
        gmxRouter.swap(path, amountIn, minOut, address(this));
        uint256 boughtAmount = IERC20(tokenOut).balanceOf(address(this)) -
            balance;
        return boughtAmount;
    }

    /* 
    @notice Opens new or increases the size of an existing position
    @dev Must be executed using delegate call, that's why we use address(this)
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
    @dev Must be executed using delegate call, that's why we use address(this)
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
            IERC20(token).approve(spender, type(uint256).max);
        }
    }
}
