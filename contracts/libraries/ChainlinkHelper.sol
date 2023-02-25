// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FlagsInterface} from "@chainlink/contracts/src/v0.8/interfaces/FlagsInterface.sol";

library ChainlinkHelper {
    error SequencerOffline();
    error StalePrice();

    address private constant FLAG_ARBITRUM_SEQ_OFFLINE =
        address(
            bytes20(
                bytes32(
                    uint256(keccak256("chainlink.flags.arbitrum-seq-offline")) -
                        1
                )
            )
        );

    function getPrice(
        AggregatorV3Interface aggregator,
        FlagsInterface chainlinkFlags,
        uint256 maxDelay
    ) internal view returns (uint256) {
        if (address(chainlinkFlags) != address(0)) {
            bool isRaised = chainlinkFlags.getFlag(FLAG_ARBITRUM_SEQ_OFFLINE);
            if (isRaised) {
                revert SequencerOffline();
            }
        }
        (, int256 latestPrice, , uint256 latestTS, ) = aggregator
            .latestRoundData();

        if (latestTS + maxDelay > block.timestamp) revert StalePrice();

        return uint256(latestPrice);
    }
}
