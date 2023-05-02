import { ethers } from "hardhat";
import { Signer, ContractTransaction, BigNumber } from "ethers";
import {
  SnapshotRestorer,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  TraderWallet,
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  ERC20Mock,
} from "../../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_1E18,
} from "./../_helpers/constants";
import {
  usersDeposit,
  mintForUsers,
  approveForUsers,
  claimShares,
} from "./../_helpers/functions";
import { setupContracts } from "./../_helpers/setup";

let snapshot: SnapshotRestorer;

let deployer: Signer;
let trader: Signer;
let dynamicValue: Signer;
let nonAuthorized: Signer;
let otherSigner: Signer;
let owner: Signer;
let user1: Signer;
let user2: Signer;
let user3: Signer;
let user4: Signer;
let user5: Signer;

let deployerAddress: string;
let traderAddress: string;
let underlyingTokenAddress: string;
let adaptersRegistryAddress: string;
let traderWalletAddress: string;
let dynamicValueAddress: string;
let otherAddress: string;
let ownerAddress: string;
let user1Address: string;
let user2Address: string;
let user3Address: string;
let user4Address: string;
let user5Address: string;

let txResult: ContractTransaction;
let traderWalletContract: TraderWallet;
let usersVaultContract: UsersVault;
let contractsFactoryContract: ContractsFactoryMock;
let adaptersRegistryContract: AdaptersRegistryMock;
let adapterContract: AdapterMock;

let usdcTokenContract: ERC20Mock;
let wethTokenContract: ERC20Mock;
let usdxTokenContract: ERC20Mock;

let userBalanceBefore: BigNumber;
let userBalanceAfter: BigNumber;
let vaultBalanceBefore: BigNumber;
let vaultBalanceAfter: BigNumber;

let signers: Array<Signer>;
let userAddresses: Array<string>;

describe("Vault and Wallet Flow Tests", function () {
  this.timeout(TEST_TIMEOUT);

  before(async () => {
    // get signers
    [
      deployer,
      dynamicValue,
      nonAuthorized,
      otherSigner,
      user1,
      user2,
      user3,
      user4,
      user5,
    ] = await ethers.getSigners();

    // get addresses
    [
      deployerAddress,
      dynamicValueAddress,
      otherAddress,
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ] = await Promise.all([
      deployer.getAddress(),
      dynamicValue.getAddress(),
      otherSigner.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
      user3.getAddress(),
      user4.getAddress(),
      user5.getAddress(),
    ]);

    // build signers array
    signers = [user1, user2, user3, user4, user5];

    // build user addresses array
    userAddresses = [
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ];

    // deploy contracts
    const contract = await setupContracts(deployer, deployerAddress);
    usdcTokenContract = contract.usdcTokenContract;
    wethTokenContract = contract.usdcTokenContract;
    usdxTokenContract = contract.usdxTokenContract;
    contractsFactoryContract = contract.contractsFactoryContract;
    adaptersRegistryContract = contract.adaptersRegistryContract;
    adapterContract = contract.adapterContract;
    traderWalletContract = contract.traderWalletContract;
    usersVaultContract = contract.usersVaultContract;

    // approve and mint to users 1000 USDC
    await mintForUsers(
      userAddresses,
      usdcTokenContract,
      AMOUNT_1E18.mul(1000),
      5
    );

    await approveForUsers(
      signers,
      usdcTokenContract,
      AMOUNT_1E18.mul(1000),
      usersVaultContract.address,
      5
    );

    trader = deployer;
    owner = deployer;
    traderAddress = deployerAddress;
    ownerAddress = deployerAddress;
    underlyingTokenAddress = usdcTokenContract.address;

    // take a snapshot
    snapshot = await takeSnapshot();
  });

  describe("WHEN Checking first Values", function () {
    it("THEN it should return correct ones after deployment", async () => {
      expect(await usersVaultContract.underlyingTokenAddress()).to.equal(
        underlyingTokenAddress
      );
      expect(await usersVaultContract.adaptersRegistryAddress()).to.equal(
        adaptersRegistryContract.address
      );
      expect(await usersVaultContract.contractsFactoryAddress()).to.equal(
        contractsFactoryContract.address
      );
      expect(await usersVaultContract.traderWalletAddress()).to.equal(
        traderWalletContract.address
      );

      expect(await usersVaultContract.owner()).to.equal(ownerAddress);

      /////////////////////////////////////////////////////////////
      /////////////////////////////////////////////////////////////
      
      expect(await traderWalletContract.vaultAddress()).to.equal(
        usersVaultContract.address
      );
      expect(await traderWalletContract.underlyingTokenAddress()).to.equal(
        underlyingTokenAddress
      );
      expect(await traderWalletContract.adaptersRegistryAddress()).to.equal(
        adaptersRegistryContract.address
      );
      expect(await traderWalletContract.contractsFactoryAddress()).to.equal(
        contractsFactoryContract.address
      );
      expect(await traderWalletContract.traderAddress()).to.equal(
        traderAddress
      );
      expect(await traderWalletContract.owner()).to.equal(ownerAddress);

      expect(await traderWalletContract.cumulativePendingDeposits()).to.equal(
        ZERO_AMOUNT
      );
      expect(
        await traderWalletContract.cumulativePendingWithdrawals()
      ).to.equal(ZERO_AMOUNT);
    });
  });
});
