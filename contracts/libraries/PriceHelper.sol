// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ChainlinkHelper} from "../libraries/ChainlinkHelper.sol";
import {FlagsInterface} from "@chainlink/contracts/src/v0.8/interfaces/FlagsInterface.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC20MetadataUpgradeable.sol";
import {MathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";

library PriceHelper {
    using MathUpgradeable for uint256;
    using ChainlinkHelper for AggregatorV3Interface;

    function getBalanceInUsdc(
        IERC20MetadataUpgradeable token,
        AggregatorV3Interface tokenAggregator,
        AggregatorV3Interface usdcAggregator,
        FlagsInterface chainlinkFlags,
        uint256 maxDelay
    ) internal view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 tokenPrice = tokenAggregator.getPrice(chainlinkFlags, maxDelay);
        uint256 usdcPrice = usdcAggregator.getPrice(chainlinkFlags, maxDelay);

        // balance * token price * 10**(usdcAggregator decimals + usdc decimals)/ (usdcPrice * 10**(tokenAggregator decimals + token decimals))
        return
            balance.mulDiv(
                tokenPrice * 10 ** (usdcAggregator.decimals() + 6),
                usdcPrice *
                    10 ** (tokenAggregator.decimals() + token.decimals())
            );
    }
}
