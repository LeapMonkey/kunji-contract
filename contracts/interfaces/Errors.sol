// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface Errors {
    error ZeroAddress(string target);
    error ZeroAmount();
    error UserNotAllowed();
    error InvalidTraderWallet();
    error TokenTransferFailed();
    error InvalidRound();
    error InsufficientShares(uint256 unclaimedShareBalance);
    error InsufficientAssets(uint256 unclaimedAssetBalance);
    error InvalidRollover();
    error InvalidAdapter();
    error AdapterOperationFailed(string target);
    error ApproveFailed(address caller, address token, uint256 amount);
    error NotEnoughAssetsForWithdraw(
        uint256 underlyingContractBalance,
        uint256 processedWithdrawAssets
    );

    error InvalidVault();
    error CallerNotAllowed();
    error TraderNotAllowed();
    error InvalidProtocol();
    error AdapterPresent();
    error AdapterNotPresent();
    error UsersVaultOperationFailed();
    error RolloverFailed();
    error SendToTraderFailed();
}
