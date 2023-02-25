// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC4626Upgradeable} from "@openzeppelin/contracts-upgradeable/interfaces/IERC4626Upgradeable.sol";

interface IBatchedVault is IERC4626Upgradeable {
    function rolloverBatch() external;

    function claimShares(uint256 shares, address receiver) external;

    function claimAssets(uint256 assets, address receiver) external;

    function claimAllShares(address receiver) external returns (uint256 shares);

    function claimAllAssets(address receiver) external returns (uint256 assets);
}
