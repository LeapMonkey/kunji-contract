// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

import {IBaseVault} from "./IBaseVault.sol";
import {IAdapter} from "./IAdapter.sol";

interface IUsersVault is IBaseVault {
    struct UserDeposit {
        uint256 round;
        uint256 pendingAssets;
        uint256 unclaimedShares;
    }

    struct UserWithdrawal {
        uint256 round;
        uint256 pendingShares;
        uint256 unclaimedAssets;
    }

    function traderWalletAddress() external view returns (address);

    function pendingDepositAssets() external view returns (uint256);

    function pendingWithdrawShares() external view returns (uint256);

    function processedWithdrawAssets() external view returns (uint256);

    function userDeposits(
        address
    )
        external
        view
        returns (uint256 round, uint256 pendingAssets, uint256 unclaimedShares);

    function userWithdrawals(
        address
    )
        external
        view
        returns (uint256 round, uint256 pendingShares, uint256 unclaimedAssets);

    function assetsPerShareXRound(uint256) external view returns (uint256);

    function setTraderWalletAddress(address traderWalletAddress) external;

    function setAdapterAllowanceOnToken(
        uint256 protocolId,
        address tokenAddress,
        bool revoke
    ) external returns (bool);

    function userDeposit(uint256 amount) external;

    function withdrawRequest(uint256 sharesAmount) external;

    function rolloverFromTrader() external returns (bool);

    function executeOnProtocol(
        uint256 protocolId,
        IAdapter.AdapterOperation memory traderOperation,
        uint256 walletRatio
    ) external returns (bool);

    function getUnderlyingLiquidity() external view returns (uint256);

    function previewShares(address receiver) external view returns (uint256);

    function getSharesContractBalance() external view returns (uint256);

    function claimShares(uint256 sharesAmount, address receiver) external;

    function claimAssets(uint256 assetsAmount, address receiver) external;
}
