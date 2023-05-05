// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IAdapter} from "./IAdapter.sol";

interface IUsersVault {
    function setAdaptersRegistryAddress(address) external;

    function setDynamicValueAddress(address) external;

    function setContractsFactoryAddress(address) external;

    function setTraderWalletAddress(address) external;

    function setUnderlyingTokenAddress(address) external;

    function addAdapterToUse(uint256) external;

    function removeAdapterToUse(uint256) external;

    function setAdapterAllowanceOnToken(
        uint256,
        address,
        bool
    ) external returns (bool);

    function userDeposit(address, uint256) external;

    function withdrawRequest(uint256) external;

    function rolloverFromTrader() external returns (bool);

    function executeOnProtocol(
        uint256,
        IAdapter.AdapterOperation memory,
        uint256
    ) external returns (bool);

    function getUnderlyingLiquidity() external view returns (uint256);

    function getRound() external view returns (uint256);

    function claimAllAssets(address) external returns (uint256);

    function previewShares(address) external view returns (uint256);

    function getSharesContractBalance() external view returns (uint256);

    function getTraderSelectedAdaptersLength() external view returns (uint256);

    function claimShares(uint256, address) external;

    function claimAssets(uint256, address) external;

    function transferOwnership(address) external;

    /*

    function claimAllShares(address) external returns (uint256);

    */
}
