// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20Upgradeable as IERC20} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./uniswap/interfaces/IQuoterV2.sol";
import "./uniswap/interfaces/IUniswapV3Router.sol";
import "./gmx/interfaces/IGmxAdapter.sol";
import "./gmx/interfaces/IGmxReader.sol";
import "./gmx/interfaces/IGmxRouter.sol";
import "./gmx/interfaces/IGmxOrderBook.sol";
import "./gmx/interfaces/IGmxVault.sol";

// import "hardhat/console.sol";


contract Lens is OwnableUpgradeable {

    // uniswap
    IQuoterV2 constant public quoter = IQuoterV2(0x61fFE014bA17989E743c5F6cB21bF9697530B21e);

    // gmx
    IGmxPositionRouter constant public gmxPositionRouter = IGmxPositionRouter(0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868);
    IGmxOrderBookReader constant public gmxOrderBookReader = IGmxOrderBookReader(0xa27C20A7CF0e1C68C0460706bB674f98F362Bc21);
    IGmxVault constant public gmxVault = IGmxVault(0x489ee077994B6658eAfA855C308275EAd8097C4A);
    address constant public gmxOrderBook = 0x09f77E8A13De9a35a7231028187e9fD5DB8a2ACB;
    address constant public gmxReader = 0x22199a49A999c351eF7927602CFB187ec3cae489;


    function initialize() external initializer {
        __Ownable_init();
    }

    /// /// /// /// /// ///
    /// Uniswap
    /// /// /// /// /// ///

    /// @notice Returns the amount out received for a given exact input swap without executing the swap
    /// @param path The path of the swap, i.e. each token pair and the pool fee
    /// @param amountIn The amount of the first token to swap
    /// @return amountOut The amount of the last token that would be received
    /// @return sqrtPriceX96AfterList List of the sqrt price after the swap for each pool in the path
    /// @return initializedTicksCrossedList List of the initialized ticks that the swap crossed for each pool in the path
    /// @return gasEstimate The estimate of the gas that the swap consumes
    function getAmountOut(bytes memory path, uint256 amountIn) external returns (
            uint256 amountOut,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        ) {
        return quoter.quoteExactInput(path, amountIn);
    }


    /// @notice Returns the amount in required for a given exact output swap without executing the swap
    /// @param path The path of the swap, i.e. each token pair and the pool fee. Path must be provided in reverse order
    /// @param amountOut The amount of the last token to receive
    /// @return amountIn The amount of first token required to be paid
    /// @return sqrtPriceX96AfterList List of the sqrt price after the swap for each pool in the path
    /// @return initializedTicksCrossedList List of the initialized ticks that the swap crossed for each pool in the path
    /// @return gasEstimate The estimate of the gas that the swap consumes
    function getAmountIn(bytes memory path, uint256 amountOut) external returns (
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        ) {
        return quoter.quoteExactOutput(path, amountOut);
    }

    /// /// /// /// /// ///
    /// GMX
    /// /// /// /// /// ///

    /// increase requests
    function getIncreasePositionRequest(bytes32 requestKey) public view returns (IGmxPositionRouter.IncreasePositionRequest memory) {
        return gmxPositionRouter.increasePositionRequests(requestKey);
    }

    /// decrease requests
    function getDecreasePositionRequest(bytes32 requestKey) public view returns (IGmxPositionRouter.DecreasePositionRequest memory) {
        return gmxPositionRouter.decreasePositionRequests(requestKey);
    }

    function getIncreasePositionsIndex(address account) public view returns (uint256) {
        return gmxPositionRouter.increasePositionsIndex(account);
    }

    function getDecreasePositionsIndex(address account) public view returns (uint256) {
        return gmxPositionRouter.decreasePositionsIndex(account);
    }

    function getLatestIncreaseRequest(address account) external view returns (IGmxPositionRouter.IncreasePositionRequest memory) {
        uint256 index = getIncreasePositionsIndex(account);
        bytes32 latestIncreaseKey = gmxPositionRouter.getRequestKey(account, index);
        return getIncreasePositionRequest(latestIncreaseKey);
    }

    function getLatestDecreaseRequest(address account) external view returns (IGmxPositionRouter.DecreasePositionRequest memory) {
        uint256 index = getDecreasePositionsIndex(account);
        bytes32 latestIncreaseKey = gmxPositionRouter.getRequestKey(account, index);
        return getDecreasePositionRequest(latestIncreaseKey);
    }

    function getRequestKey(address account, uint256 index) external view returns (bytes32) {
        return gmxPositionRouter.getRequestKey(account, index);
    }

    /// @param account Wallet or Vault
    /// @param collateralTokens array of collaterals
    /// @param indexTokens array of shorted (or longed) tokens
    /// @param isLong array of position types ('true' for Long position)
    /// @return array with positions current characteristics:
    ///     0 size:         position size in USD
    ///     1 collateral:   position collateral in USD
    ///     2 averagePrice: average entry price of the position in USD
    ///     3 entryFundingRate: snapshot of the cumulative funding rate at the time the position was entered
    ///     4 hasRealisedProfit: '1' if the position has a positive realized profit, '0' otherwise
    ///     5 realisedPnl: the realized PnL for the position in USD
    ///     6 lastIncreasedTime: timestamp of the last time the position was increased
    ///     7 hasProfit: 1 if the position is currently in profit, 0 otherwise
    ///     8 delta: amount of current profit or loss of the position in USD
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

    function getIncreaseOrders(
        address account,
        uint256[] memory indices
    ) external view returns (uint256[] memory, address[] memory) {
        return gmxOrderBookReader.getIncreaseOrders(
            payable(gmxOrderBook),
            account,
            indices
        );
    }

    function getDecreaseOrders(
        address account,
        uint256[] memory indices
    ) external view returns (uint256[] memory, address[] memory) {
        return gmxOrderBookReader.getDecreaseOrders(
            payable(gmxOrderBook),
            account,
            indices
        );
    }


    // /// @notice Calculates the max amount of tokenIn that can be swapped
    // /// @param tokenIn The address of input token
    // /// @param tokenOut The address of output token
    // /// @return amountIn Maximum available amount to be swapped
    // function getMaxAmountIn(
    //     address tokenIn,
    //     address tokenOut
    // ) external view returns (uint256 amountIn) {
    //     return IGmxReader(gmxReader).getMaxAmountIn(address(gmxVault), tokenIn, tokenOut);
    // }

    // /// @notice Returns amount out after fees and the fee amount
    // /// @param tokenIn The address of input token
    // /// @param tokenOut The address of output token
    // /// @param amountIn The amount of tokenIn to be swapped
    // /// @return amountOutAfterFees The amount out after fees,
    // /// @return feeAmount The fee amount in terms of tokenOut
    // function getAmountOut(
    //     address tokenIn,
    //     address tokenOut,
    //     uint256 amountIn
    // ) external view returns (uint256 amountOutAfterFees, uint256 feeAmount) {
    //     return
    //         IGmxReader(gmxReader).getAmountOut(
    //             address(gmxVault),
    //             tokenIn,
    //             tokenOut,
    //             amountIn
    //         );
    // }

}
