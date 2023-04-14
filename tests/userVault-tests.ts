import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
} from "ethers";
import { expect } from "chai";
import Reverter from "./helpers/reverter";
import {
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  // TraderWalletMock,
  ERC20Mock,
} from "../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_100,
  AMOUNT_1000,
} from "./helpers/constants";

const reverter = new Reverter();

let deployer: Signer;
let vault: Signer;
let traderWallet: Signer;
let adaptersRegistry: Signer;
let contractsFactory: Signer;
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
let vaultAddress: string;
let underlyingTokenAddress: string;
let adaptersRegistryAddress: string;
let contractsFactoryAddress: string;
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
let TraderWalletFactory: ContractFactory;
// let traderWalletContract: TraderWalletMock;
let UsersVaultFactory: ContractFactory;
let usersVaultContract: UsersVault;

let ContractsFactoryFactory: ContractFactory;
let contractsFactoryContract: ContractsFactoryMock;

let usdcTokenContract: ERC20Mock;
let userBalanceBefore: BigNumber;
let userBalanceAfter: BigNumber;
let vaultBalanceBefore: BigNumber;
let vaultBalanceAfter: BigNumber;

describe("User Vault Contract Tests", function () {
  this.timeout(TEST_TIMEOUT);

  before(async () => {
    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");

    usdcTokenContract = (await ERC20MockFactory.deploy(
      "USDC",
      "USDC",
      6
    )) as ERC20Mock;
    await usdcTokenContract.deployed();
    underlyingTokenAddress = usdcTokenContract.address;

    [
      deployer,
      vault,
      traderWallet,
      adaptersRegistry,
      contractsFactory,
      dynamicValue,
      nonAuthorized,
      otherSigner,
      user1,
      user2,
      user3,
      user4,
      user5,
    ] = await ethers.getSigners();

    [
      deployerAddress,
      vaultAddress,
      traderWalletAddress,
      adaptersRegistryAddress,
      contractsFactoryAddress,
      dynamicValueAddress,
      otherAddress,
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ] = await Promise.all([
      deployer.getAddress(),
      vault.getAddress(),
      traderWallet.getAddress(),
      adaptersRegistry.getAddress(),
      contractsFactory.getAddress(),
      dynamicValue.getAddress(),
      otherSigner.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
      user3.getAddress(),
      user4.getAddress(),
      user5.getAddress(),
    ]);
  });

  describe("UserVault deployment Tests", function () {
    before(async () => {
      UsersVaultFactory = await ethers.getContractFactory("UsersVault");
      ContractsFactoryFactory = await ethers.getContractFactory(
        "ContractsFactoryMock"
      );

      // deploy ContractsFactory
      contractsFactoryContract = (await upgrades.deployProxy(
        ContractsFactoryFactory,
        []
      )) as ContractsFactoryMock;
      await contractsFactoryContract.deployed();
      // set TRUE for response
      await contractsFactoryContract.setReturnValue(true);

      owner = deployer;
      ownerAddress = deployerAddress;
    });
    describe("WHEN trying to deploy TraderWallet contract with correct parameters", function () {
      before(async () => {
        usersVaultContract = (await upgrades.deployProxy(UsersVaultFactory, [
          underlyingTokenAddress,
          adaptersRegistryAddress,
          contractsFactoryContract.address,
          traderWalletAddress,
          dynamicValueAddress,
          "UserVaultShares",
          "UVS",
        ])) as UsersVault;
        await usersVaultContract.deployed();

        // approve and mint to users
        await usdcTokenContract.mint(user1Address, AMOUNT_1000);
        await usdcTokenContract.mint(user2Address, AMOUNT_1000);
        await usdcTokenContract.mint(user3Address, AMOUNT_1000);
        await usdcTokenContract.mint(user4Address, AMOUNT_1000);
        await usdcTokenContract.mint(user5Address, AMOUNT_1000);

        await usdcTokenContract
          .connect(user1)
          .approve(usersVaultContract.address, AMOUNT_1000);
        await usdcTokenContract
          .connect(user2)
          .approve(usersVaultContract.address, AMOUNT_1000);
        await usdcTokenContract
          .connect(user3)
          .approve(usersVaultContract.address, AMOUNT_1000);
        await usdcTokenContract
          .connect(user4)
          .approve(usersVaultContract.address, AMOUNT_1000);
        await usdcTokenContract
          .connect(user5)
          .approve(usersVaultContract.address, AMOUNT_1000);

        // contractBalanceBefore = await usdcTokenContract.balanceOf(
        //   usersVaultContract.address
        // );

        vaultBalanceBefore = await usdcTokenContract.balanceOf(
          usersVaultContract.address
        );

        // take a snapshot
        await reverter.snapshot();
      });

      it("THEN it should return the same ones after deployment", async () => {
        expect(await usersVaultContract.asset()).to.equal(
          underlyingTokenAddress
        );
        expect(await usersVaultContract.adaptersRegistryAddress()).to.equal(
          adaptersRegistryAddress
        );
        expect(await usersVaultContract.contractsFactoryAddress()).to.equal(
          contractsFactoryContract.address
        );
        expect(await usersVaultContract.traderWalletAddress()).to.equal(
          traderWalletAddress
        );
        expect(await usersVaultContract.dynamicValueAddress()).to.equal(
          dynamicValueAddress
        );
        expect(await usersVaultContract.owner()).to.equal(ownerAddress);
        expect(await usersVaultContract.owner()).to.equal(ownerAddress);
      });

      it("THEN general contract tests DRAFT !!!!", async () => {
        await usersVaultContract
          .connect(user1)
          .userDeposit(BigNumber.from("10"));
        await usersVaultContract
          .connect(user1)
          .userDeposit(BigNumber.from("20"));
        await usersVaultContract
          .connect(user1)
          .userDeposit(BigNumber.from("30"));
        await usersVaultContract
          .connect(user1)
          .userDeposit(BigNumber.from("40"));
        await usersVaultContract
          .connect(user1)
          .userDeposit(BigNumber.from("50"));
      });
    });
  });
});
