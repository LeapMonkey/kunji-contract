// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FlagsInterface} from "@chainlink/contracts/src/v0.8/interfaces/FlagsInterface.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";

import {AddressToAddressMapLib} from "../../libraries/AddressToAddressMapLib.sol";
import {IPlatformAdapter} from "../../interfaces/IPlatformAdapter.sol";
import {UniswapHelper} from "./UniswapHelper.sol";
import {PriceHelper} from "../../libraries/PriceHelper.sol";

contract UniswapAdapter is
    OwnableUpgradeable,
    PausableUpgradeable,
    IPlatformAdapter
{
    using AddressToAddressMapLib for AddressToAddressMapLib.AddressToAddressMap;
    using MathUpgradeable for uint256;
    using UniswapHelper for ISwapRouter;
    using PriceHelper for IERC20MetadataUpgradeable;

    AddressToAddressMapLib.AddressToAddressMap tokenOracles;
    ISwapRouter swapRouter;
    FlagsInterface chainlinkFlags;
    address usdcOracle;
    uint256 constant MAX_DELAY = 10000;

    function initialize() external initializer {
        __Ownable_init();
        __Pausable_init();
    }

    function addSupportedToken(
        address token,
        address tokenOracle
    ) external onlyOwner {
        tokenOracles.set(token, tokenOracle);
    }

    function removeSupportedToken(address token) external onlyOwner {
        tokenOracles.remove(token);
    }

    function setParamters(
        ISwapRouter _swapRouter,
        FlagsInterface _chainlinkFlags
    ) external onlyOwner {
        swapRouter = _swapRouter;
        chainlinkFlags = _chainlinkFlags;
    }

    function createTrade(
        TradeOperation memory tradeOperation
    ) external returns (bytes memory) {
        if (tradeOperation.actionId == 0) {
            (bytes memory path, uint256 buyAmount, uint256 maxSellAmount) = abi
                .decode(tradeOperation.data, (bytes, uint256, uint256));
            (uint256 boughtAmount, uint256 soldAmount) = swapRouter.buy(
                path,
                buyAmount,
                maxSellAmount
            );
            return abi.encode(boughtAmount, soldAmount);
            // buy token with token amount (swap token out)
        } else if (tradeOperation.actionId == 1) {
            (bytes memory path, uint256 sellAmount, uint256 minBuyAmount) = abi
                .decode(tradeOperation.data, (bytes, uint256, uint256));
            (uint256 boughtAmount, uint256 soldAmount) = swapRouter.sell(
                path,
                sellAmount,
                minBuyAmount
            );
            return abi.encode(boughtAmount, soldAmount);
            // sell token with token amount (swap token in)
        } else
            revert InvalidOperation(
                tradeOperation.platformId,
                tradeOperation.actionId
            );
    }

    function totalAssets() external view returns (uint256 assets) {
        for (uint i = 0; i < tokenOracles.length(); i++) {
            (address token, address tokenOracle) = tokenOracles.at(i);

            assets += IERC20MetadataUpgradeable(token).getBalanceInUsdc(
                AggregatorV3Interface(tokenOracle),
                AggregatorV3Interface(usdcOracle),
                chainlinkFlags,
                MAX_DELAY
            );
        }
    }
}
