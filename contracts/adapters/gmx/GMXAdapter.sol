// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";

import "../../interfaces/IPlatformAdapter.sol";
import "../../interfaces/IAdapter.sol";
import "./interfaces/IGmxAdapter.sol";
import "./interfaces/IGmxOrderBook.sol";
import "./interfaces/IGmxReader.sol";
import "./interfaces/IGmxRouter.sol";
import "./interfaces/IGmxVault.sol";
// import "hardhat/console.sol";

library GMXAdapter {
    error AddressZero();
    error InsufficientEtherBalance();
    error InvalidOperationId();
    error CreateSwapOrderFail();
    error CreateIncreasePositionFail(string);
    error CreateDecreasePositionFail(string);
    error CreateIncreasePositionOrderFail(string);
    error CreateDecreasePositionOrderFail(string);

    address constant public gmxRouter = 0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064;
    address constant public gmxPositionRouter = 0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868;
    IGmxVault constant public gmxVault = IGmxVault(0x489ee077994B6658eAfA855C308275EAd8097C4A);
    address constant public gmxOrderBook = 0x09f77E8A13De9a35a7231028187e9fD5DB8a2ACB;
    address constant public gmxOrderBookReader = 0xa27C20A7CF0e1C68C0460706bB674f98F362Bc21;
    address constant public gmxReader = 0x22199a49A999c351eF7927602CFB187ec3cae489;

    uint256 constant public ratioDenominator = 1e18;


    event CreateIncreasePosition(address sender, bytes32 requestKey);
    event CreateDecreasePosition(address sender, bytes32 requestKey);

    /// @notice Gives approve to operate with gmxPositionRouter
    /// @dev Needs to be called from wallet and vault in initialization
    function __initApproveGmxPlugin() internal {
        IGmxRouter(gmxRouter).approvePlugin(gmxPositionRouter);
        IGmxRouter(gmxRouter).approvePlugin(gmxOrderBook);
    }


    /// @notice Executes operation with external protocol
    /// @param ratio Scaling ratio to
    /// @param tradeOperation Encoded operation data 
    /// @return bool 'true' if the operation completed successfully 
    function executeOperation(
        uint256 ratio,
        IAdapter.AdapterOperation memory tradeOperation
    ) internal returns (bool) {
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
        }
        revert InvalidOperationId();
    }


    /* 
    @notice Opens new or increases the size of an existing position
    @param tradeData must contain parameters:
        path:       [collateralToken] or [tokenIn, collateralToken] if a swap is needed
        indexToken: the address of the token to long or short
        amountIn:   the amount of tokenIn to deposit as collateral
        minOut:     the min amount of collateralToken to swap for (can be zero if no swap is required)
        sizeDelta:  the USD value of the change in position size  (scaled 1e30)
        isLong:     whether to long or short position

    Additional params for increasing position    
        executionFee:   can be set to PositionRouter.minExecutionFee
        referralCode:   referral code for affiliate rewards and rebates
        callbackTarget: an optional callback contract (note: has gas limit)
        acceptablePrice: the USD value of the max (for longs) or min (for shorts) index price acceptable when executing
    @return requestKey - Id in GMX increase position orders
    */
    function _increasePosition(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            address[] memory path,
            address indexToken,
            uint256 amountIn,
            uint256 minOut,
            uint256 sizeDelta,
            bool isLong
        ) = abi.decode(
                tradeData,
                (address[], address, uint256, uint256, uint256, bool)
            );

        if (ratio != ratioDenominator) {
            // scaling for Vault
            amountIn = amountIn * ratio / ratioDenominator;   // @todo replace with safe mulDiv
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            minOut = minOut * ratio / ratioDenominator;
        }

        _checkUpdateAllowance(path[0], address(gmxRouter), amountIn);
        uint256 executionFee = IGmxPositionRouter(gmxPositionRouter).minExecutionFee();
        if (address(this).balance < executionFee) revert InsufficientEtherBalance();

        uint256 acceptablePrice;
        if (isLong) {
            acceptablePrice = gmxVault.getMaxPrice(indexToken);
        } else {
            acceptablePrice = gmxVault.getMinPrice(indexToken);
        }

        (bool success, bytes memory data) = 
            gmxPositionRouter.call{value: executionFee}(
                abi.encodeWithSelector(
                    IGmxPositionRouter.createIncreasePosition.selector, 
                    path,
                    indexToken,
                    amountIn,
                    minOut,
                    sizeDelta,
                    isLong,
                    acceptablePrice,
                    executionFee,
                    0,          // referralCode
                    address(0)  // callbackTarget
                )
            );

        if(!success) {
            revert CreateIncreasePositionFail(_getRevertMsg(data));
        }
        emit CreateIncreasePosition(address(this), bytes32(data));
        return true;
    }

    /* 
    @notice Closes or decreases an existing position
    @param tradeData must contain parameters:
        path:            [collateralToken] or [collateralToken, tokenOut] if a swap is needed
        indexToken:      the address of the token that was longed (or shorted)
        collateralDelta: the amount of collateral in USD value to withdraw
        sizeDelta:       the USD value of the change in position size (scaled to 1e30)
        isLong:          whether the position is a long or short
        minOut:          the min output token amount (can be zero if no swap is required)

    Additional params for increasing position    
        receiver:       the address to receive the withdrawn tokens 
        acceptablePrice: the USD value of the max (for longs) or min (for shorts) index price acceptable when executing
        executionFee:   can be set to PositionRouter.minExecutionFee
        withdrawETH:    only applicable if WETH will be withdrawn, the WETH will be unwrapped to ETH if this is set to true
        callbackTarget: an optional callback contract (note: has gas limit)
    @return requestKey - Id in GMX increase position orders
    */
    function _decreasePosition(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            address[] memory path,
            address indexToken,
            uint256 collateralDelta,
            uint256 sizeDelta,
            bool isLong,
            uint256 minOut
        ) = abi.decode(
                tradeData,
                (
                    address[],
                    address,
                    uint256,
                    uint256,
                    bool,
                    uint256
                )
            );
        uint256 executionFee = IGmxPositionRouter(gmxPositionRouter).minExecutionFee();
        if (address(this).balance < executionFee) revert InsufficientEtherBalance();

        if (ratio != ratioDenominator) {
            // scaling for Vault
            collateralDelta = collateralDelta * ratio / ratioDenominator;
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            minOut = minOut * ratio / ratioDenominator;
        }

        uint256 acceptablePrice;
        if (isLong) {
            acceptablePrice = gmxVault.getMinPrice(indexToken);
        } else {
            acceptablePrice = gmxVault.getMaxPrice(indexToken);
        }

        (bool success, bytes memory data) = 
            gmxPositionRouter.call{value: executionFee}(
                abi.encodeWithSelector(
                IGmxPositionRouter.createDecreasePosition.selector,
                path,
                indexToken,
                collateralDelta,
                sizeDelta,
                isLong,
                address(this),    // receiver
                acceptablePrice,
                minOut,
                executionFee,
                false,      // withdrawETH
                address(0)  // callbackTarget
                )
            );

        if(!success) {
            revert CreateDecreasePositionFail(_getRevertMsg(data));
        }
        emit CreateDecreasePosition(address(this), bytes32(data));
        return true;
    }


    /// /// /// ///
    /// Orders
    /// /// /// ///

    /* 
    @notice Creates new order to open or increase position
            Also can be used to create stop-loss or take-profit orders
    @param tradeData must contain parameters:
        path:            [collateralToken] or [tokenIn, collateralToken] if a swap is needed
        amountIn:        the amount of tokenIn to deposit as collateral
        indexToken:      the address of the token to long or short
        minOut:          the min amount of collateralToken to swap for (can be zero if no swap is required)
        sizeDelta:       the USD value of the change in position size  (scaled 1e30)
        isLong:          whether to long or short position
        triggerPrice:    the price at which the order should be executed
        triggerAboveThreshold:
            in terms of Long position:
                'true' for creating new Long order
            in terms of Short position:
                'false' for creating new Short order

    Additional params for increasing position    
        collateralToken: the collateral token (must be path[path.length-1] )
        executionFee:   can be set to OrderBook.minExecutionFee
        shouldWrap:     true if 'tokenIn' is native and should be wrapped
    @return bool - Returns 'true' if order was successfully created
    */
    function _createIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            address[] memory path,
            uint256 amountIn,
            address indexToken,
            uint256 minOut,
            uint256 sizeDelta,
            bool isLong,
            uint256 triggerPrice,
            bool triggerAboveThreshold
        ) = abi.decode(
                tradeData,
                (address[], uint256, address, uint256, uint256, bool, uint256, bool)
            );
        uint256 executionFee = IGmxOrderBook(gmxOrderBook).minExecutionFee();
        if (address(this).balance < executionFee) revert InsufficientEtherBalance();

        if (ratio != ratioDenominator) {
            // scaling for Vault
            amountIn = amountIn * ratio / ratioDenominator;
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            minOut = minOut * ratio / ratioDenominator;
        }
        address collateralToken = path[path.length-1];


        _checkUpdateAllowance(path[0], address(gmxRouter), amountIn);

        (bool success, bytes memory data) = 
            gmxOrderBook.call{value: executionFee}(
                abi.encodeWithSelector(
                    IGmxOrderBook.createIncreaseOrder.selector,
                    path,
                    amountIn,
                    indexToken,
                    minOut,
                    sizeDelta,
                    collateralToken,
                    isLong,
                    triggerPrice,
                    triggerAboveThreshold,
                    executionFee,
                    false  // 'shouldWrap'
                )
            );

        if(!success) {
            revert CreateIncreasePositionOrderFail(_getRevertMsg(data));
        }
        return true;
    }


    /* 
    @notice Updates exist increase order
    @param tradeData must contain parameters:
        orderIndexes:      the array with Wallet and Vault indexes of the exist orders to update
        sizeDelta:       the USD value of the change in position size  (scaled 1e30)
        triggerPrice:    the price at which the order should be executed
        triggerAboveThreshold:
            in terms of Long position:
                'true' for creating new Long order
                'true' for take-profit orders, 'false' for stop-loss orders
            in terms of Short position:
                'false' for creating new Short order
                'false' for take-profit orders', true' for stop-loss orders 

    @return bool - Returns 'true' if order was successfully updated
    */
    function _updateIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            uint256[] memory orderIndexes,
            uint256 sizeDelta,
            uint256 triggerPrice,
            bool triggerAboveThreshold
        ) = abi.decode(
                tradeData,
                (uint256[], uint256, uint256, bool)
            );

        // default trader Wallet value
        uint256 orderIndex = orderIndexes[0];
        if (ratio != ratioDenominator) {
            // scaling for Vault
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            orderIndex = orderIndexes[1];
        }

        IGmxOrderBook(gmxOrderBook).updateIncreaseOrder(
            orderIndex,
            sizeDelta,
            triggerPrice,
            triggerAboveThreshold
        );
        return true;
    }

    /* 
    @notice Cancels exist increase order
    @param tradeData must contain parameters:
        orderIndexes:  the array with Wallet and Vault indexes of the exist orders to update
    @return bool - Returns 'true' if order was canceled
    */
    function _cancelIncreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (uint256[] memory orderIndexes) = abi.decode(tradeData, (uint256[]));

        // default trader Wallet value
        uint256 orderIndex = orderIndexes[0];
        if (ratio != ratioDenominator) {
            // value for Vault
            orderIndex = orderIndexes[1];
        }
        
        IGmxOrderBook(gmxOrderBook).cancelIncreaseOrder(orderIndex);
        return true;
    }


    /* 
    @notice Creates new order to close or decrease position
            Also can be used to create (partial) stop-loss or take-profit orders
    @param tradeData must contain parameters:
        indexToken:      the address of the token that was longed (or shorted)
        sizeDelta:       the USD value of the change in position size (scaled to 1e30)
        collateralToken: the collateral token address
        collateralDelta: the amount of collateral in USD value to withdraw
        isLong:          whether the position is a long or short
        triggerPrice:    the price at which the order should be executed
        triggerAboveThreshold:
            in terms of Long position:
                'true' for take-profit orders, 'false' for stop-loss orders
            in terms of Short position:
                'false' for take-profit orders', true' for stop-loss orders 
    @return bool - Returns 'true' if order was successfully created
    */
    function _createDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            address indexToken,
            uint256 sizeDelta,
            address collateralToken,
            uint256 collateralDelta,
            bool isLong,
            uint256 triggerPrice,
            bool triggerAboveThreshold
        ) = abi.decode(
                tradeData,
                (address, uint256, address, uint256, bool, uint256, bool)
            );
        
        // for decrease order gmx requires strict: 'msg.value > minExecutionFee'
        // thats why we need to add 1
        uint256 executionFee = IGmxOrderBook(gmxOrderBook).minExecutionFee() + 1; 
        if (address(this).balance < executionFee) revert InsufficientEtherBalance();

        if (ratio != ratioDenominator) {
            // scaling for Vault
            sizeDelta = sizeDelta * ratio / ratioDenominator;
        }

        (bool success, bytes memory data) = 
            gmxOrderBook.call{value: executionFee}(
                abi.encodeWithSelector(
                    IGmxOrderBook.createDecreaseOrder.selector,
                    indexToken,
                    sizeDelta,
                    collateralToken,
                    collateralDelta,
                    isLong,
                    triggerPrice,
                    triggerAboveThreshold
                )
            );

        if(!success) {
            revert CreateDecreasePositionOrderFail(_getRevertMsg(data));
        }
        return true;
    }

    function _updateDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (
            uint256[] memory orderIndexes,
            uint256 collateralDelta,
            uint256 sizeDelta,
            uint256 triggerPrice,
            bool triggerAboveThreshold
        ) = abi.decode(
                tradeData,
                (uint256[], uint256, uint256, uint256, bool)
            );

        // default trader Wallet value
        uint256 orderIndex = orderIndexes[0];
        if (ratio != ratioDenominator) {
            // scaling for Vault
            collateralDelta = collateralDelta * ratio / ratioDenominator;
            sizeDelta = sizeDelta * ratio / ratioDenominator;
            orderIndex = orderIndexes[1];
        }
    
        IGmxOrderBook(gmxOrderBook).updateDecreaseOrder(
            orderIndex,
            collateralDelta,
            sizeDelta,
            triggerPrice,
            triggerAboveThreshold
        );
        return true;
    }


    /* 
        @notice Cancels exist decrease order
        @param tradeData must contain parameters:
            orderIndexes:      the array with Wallet and Vault indexes of the exist orders to update
        @return bool - Returns 'true' if order was canceled
    */
    function _cancelDecreaseOrder(
        uint256 ratio,
        bytes memory tradeData
    ) internal returns (bool) {
        (uint256[] memory orderIndexes) = abi.decode(tradeData, (uint256[]));

        // default trader Wallet value
        uint256 orderIndex = orderIndexes[0];
        if (ratio != ratioDenominator) {
            // value for Vault
            orderIndex = orderIndexes[1];
        }
        
        IGmxOrderBook(gmxOrderBook).cancelDecreaseOrder(orderIndex);
        return true;
    }


    // @todo move to 'Lens' contract
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
        return IGmxReader(gmxReader).getMaxAmountIn(address(gmxVault), tokenIn, tokenOut);
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
            IGmxReader(gmxReader).getAmountOut(
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
            IGmxReader(gmxReader).getPositions(
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

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "Transaction reverted silently";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // All that remains is the revert string
    }
}
