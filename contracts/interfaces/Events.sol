// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface Events {
    event AdaptersRegistryAddressSet(address indexed adaptersRegistryAddress);
    event ContractsFactoryAddressSet(address indexed contractsFactoryAddress);

    event TraderWalletAddressSet(address indexed traderWalletAddress);
    event UserDeposited(
        address indexed caller,
        address tokenAddress,
        uint256 assetsAmount
    );
    event WithdrawRequest(
        address indexed account,
        address indexed token,
        uint256 amount
    );
    event SharesClaimed(
        uint256 round,
        uint256 shares,
        address caller,
        address receiver
    );
    event AssetsClaimed(
        uint256 round,
        uint256 assets,
        address owner,
        address receiver
    );
    event UserVaultRolloverExecuted(
        uint256 round,
        uint256 newDeposit,
        uint256 newWithdrawal
    );

    event VaultAddressSet(address indexed vaultAddress);
    event UnderlyingTokenAddressSet(address indexed underlyingTokenAddress);
    event TraderAddressSet(address indexed traderAddress);
    event AdapterToUseAdded(
        uint256 protocolId,
        address indexed adapter,
        address indexed trader
    );
    event AdapterToUseRemoved(address indexed adapter, address indexed caller);
    event TraderDeposit(
        address indexed account,
        address indexed token,
        uint256 amount
    );
    event OperationExecuted(
        uint256 protocolId,
        uint256 timestamp,
        string target,
        bool replicate,
        uint256 initialBalance,
        uint256 walletRatio
    );
    event TraderWalletRolloverExecuted(
        uint256 timestamp,
        uint256 round,
        int256 traderProfit,
        int256 vaultProfit
    );
}
