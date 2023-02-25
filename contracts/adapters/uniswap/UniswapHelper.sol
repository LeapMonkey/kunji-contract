pragma solidity ^0.8.9;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

library UniswapHelper {
    function buy(
        ISwapRouter swapRouter,
        bytes memory path,
        uint256 buyAmount,
        uint256 maxSellAmount
    ) internal returns (uint256 boughtAmount, uint256 soldAmount) {
        // exact output swap to ensure exact amount of tokens are received
        ISwapRouter.ExactOutputParams memory params = ISwapRouter
            .ExactOutputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp,
                amountOut: buyAmount,
                amountInMaximum: maxSellAmount
            });

        boughtAmount = buyAmount;
        soldAmount = swapRouter.exactOutput(params);
    }

    function sell(
        ISwapRouter swapRouter,
        bytes memory path,
        uint256 sellAmount,
        uint256 minBuyAmount
    ) internal returns (uint256 boughtAmount, uint256 soldAmount) {
        // exact input swap to convert exact amount of tokens into usdc
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: sellAmount,
                amountOutMinimum: minBuyAmount
            });

        // since exact input swap tokens used = token amount passed
        soldAmount = sellAmount;
        boughtAmount = swapRouter.exactInput(params);
    }
}
