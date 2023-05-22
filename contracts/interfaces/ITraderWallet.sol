// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import {IAdapter} from "./IAdapter.sol";

interface ITraderWallet {
    function setVaultAddress(address) external;

    function setAdaptersRegistryAddress(address) external;

    function setDynamicValueAddress(address) external;

    function setContractsFactoryAddress(address) external;

    function setUnderlyingTokenAddress(address) external;

    function setTraderAddress(address) external;

    function addAdapterToUse(uint256) external;

    function removeAdapterToUse(uint256) external;

    function traderDeposit(address _tokenAddress, uint256 _amount) external;

    function withdrawRequest(address, uint256) external;

    function setAdapterAllowanceOnToken(uint256, address, bool) external;

    function rollover() external;

    function getTraderSelectedAdaptersLength() external view returns (uint256);

    function getCumulativePendingWithdrawals() external view returns (uint256);

    function getCumulativePendingDeposits() external view returns (uint256);

    function getBalances() external view returns (uint256, uint256);

    function calculateRatio() external view returns (uint256);

    function getRatio() external view returns (uint256);

    function executeOnProtocol(
        uint256,
        IAdapter.AdapterOperation memory,
        uint256
    ) external returns (bool);

    function rolloverFromTrader() external returns (bool);

    function getUnderlyingLiquidity() external view returns (uint256);

    function currentRound() external view returns (uint256);

    function getAdapterAddressPerProtocol(
        uint256
    ) external view returns (address);
}
