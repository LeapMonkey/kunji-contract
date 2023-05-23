// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import {IBaseVault} from "./IBaseVault.sol";
import {IAdapter} from "./IAdapter.sol";

interface ITraderWallet is IBaseVault {
    function setVaultAddress(address vaultAddress) external;

    function setUnderlyingTokenAddress(address underlyingTokenAddress) external;

    function setTraderAddress(address traderAddress) external;

    function addAdapterToUse(uint256 protocolId) external;

    function removeAdapterToUse(uint256 protocolId) external;

    function traderDeposit(uint256 amount) external;

    function withdrawRequest(uint256 amount) external;

    function setAdapterAllowanceOnToken(
        uint256 protocolId,
        address tokenAddress,
        bool revoke
    ) external returns (bool);

    function rollover() external;

    function getTraderSelectedAdaptersLength() external view returns (uint256);

    function getCumulativePendingWithdrawals() external view returns (uint256);

    function getCumulativePendingDeposits() external view returns (uint256);

    function getBalances() external view returns (uint256, uint256);

    function calculateRatio() external view returns (uint256);

    function getRatio() external view returns (uint256);

    function executeOnProtocol(
        uint256 protocolId,
        IAdapter.AdapterOperation memory traderOperation,
        bool replicate
    ) external returns (bool);

    function getAdapterAddressPerProtocol(
        uint256 protocolId
    ) external view returns (address);
}
