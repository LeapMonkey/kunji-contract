import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
} from "ethers";
import { expect } from "chai";
import Reverter from "../_helpers/reverter";
import {
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  // TraderWalletMock,
  ERC20Mock,
} from "../../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_1E18,
} from "../_helpers/constants";

const reverter = new Reverter();

let deployer: Signer;
let vault: Signer;
let traderWallet: Signer;
let adaptersRegistry: Signer;
let contractsFactory: Signer;
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
      const GMXAdapterLibraryFactory = await ethers.getContractFactory(
        "GMXAdapter"
      );
      const gmxAdapterContract = await GMXAdapterLibraryFactory.deploy();
      await gmxAdapterContract.deployed();

      UsersVaultFactory = await ethers.getContractFactory("UsersVault", {
        // libraries: {
        //   GMXAdapter: gmxAdapterContract.address,
        // },
      });
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
        usersVaultContract = (await upgrades.deployProxy(
          UsersVaultFactory,
          [
            underlyingTokenAddress,
            adaptersRegistryAddress,
            contractsFactoryContract.address,
            traderWalletAddress,
            deployerAddress,
            "UserVaultShares",
            "UVS",
          ],
          { unsafeAllowLinkedLibraries: true }
        )) as UsersVault;
        await usersVaultContract.deployed();

        // approve and mint to users
        await usdcTokenContract.mint(user1Address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract.mint(user2Address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract.mint(user3Address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract.mint(user4Address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract.mint(user5Address, AMOUNT_1E18.mul(1000));

        await usdcTokenContract
          .connect(user1)
          .approve(usersVaultContract.address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract
          .connect(user2)
          .approve(usersVaultContract.address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract
          .connect(user3)
          .approve(usersVaultContract.address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract
          .connect(user4)
          .approve(usersVaultContract.address, AMOUNT_1E18.mul(1000));
        await usdcTokenContract
          .connect(user5)
          .approve(usersVaultContract.address, AMOUNT_1E18.mul(1000));

        // contractBalanceBefore = await usdcTokenContract.balanceOf(
        //   usersVaultContract.address
        // );

        vaultBalanceBefore = await usdcTokenContract.balanceOf(
          usersVaultContract.address
        );

        // take a snapshot
        await reverter.snapshot();
      });

      describe("WHEN trying to deploy TraderWallet contract with correct parameters", function () {
        const showBalances = async () => {
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          console.log(
            "processedWithdrawAssets: ",
            await usersVaultContract.processedWithdrawAssets()
          );
          console.log(
            "pendingWithdrawShares  : ",
            await usersVaultContract.pendingWithdrawShares()
          );
          console.log("\n");
          console.log(
            "userDeposits 1         : ",
            await usersVaultContract.userDeposits(user1Address)
          );
          console.log(
            "userDeposits 2         : ",
            await usersVaultContract.userDeposits(user2Address)
          );
          console.log(
            "userDeposits 3         : ",
            await usersVaultContract.userDeposits(user3Address)
          );
          console.log("\n");
          console.log(
            "userWithdrawals 1      : ",
            await usersVaultContract.userWithdrawals(user1Address)
          );
          console.log(
            "userWithdrawals 2      : ",
            await usersVaultContract.userWithdrawals(user2Address)
          );
          console.log(
            "userWithdrawals 3      : ",
            await usersVaultContract.userWithdrawals(user3Address)
          );
          console.log("\n");
          console.log(
            "assetsPerShareXRound(0): ",
            await usersVaultContract.assetsPerShareXRound(0)
          );
          console.log(
            "assetsPerShareXRound(1): ",
            await usersVaultContract.assetsPerShareXRound(1)
          );
          console.log(
            "assetsPerShareXRound(2): ",
            await usersVaultContract.assetsPerShareXRound(2)
          );
          console.log("\n");
          console.log(
            "ROUND                  : ",
            await usersVaultContract.currentRound()
          );
          console.log(
            "contract USDC Balance  : ",
            await usdcTokenContract.balanceOf(usersVaultContract.address)
          );
          console.log(
            "Vault Shares Balance   : ",
            await usersVaultContract.getSharesContractBalance()
          );
        };

        it("THEN it should return the same ones after deployment", async () => {
          expect(await usersVaultContract.underlyingTokenAddress()).to.equal(
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
          expect(await usersVaultContract.owner()).to.equal(ownerAddress);
        });

        it("THEN ==> DEPOSIT ON ROUND 0 ==> NOT STARTED YET !!!!", async () => {
          await usersVaultContract
            .connect(user1)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(10)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user1)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(20)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user2)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(30)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user2)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(40)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user3)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(50)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
        });

        it("THEN ==> FAIL WHEN CLAIMING SHARES --> InvalidRound because is ROUND 0", async () => {
          await expect(
            usersVaultContract.claimShares(AMOUNT_1E18, user1Address)
          ).to.be.revertedWithCustomError(usersVaultContract, "InvalidRound");
        });

        it("THEN ==> Balanaces before and after FIRST rollover", async () => {
          await showBalances();
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          await usersVaultContract.connect(traderWallet).rolloverFromTrader();
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          await showBalances();

          console.log(
            "\n\nUser 1 Shares PRV    :>> ",
            await usersVaultContract.previewShares(user1Address)
          );
        });

        it("THEN ==> FAIL WHEN CLAIMING SHARES", async () => {
          await expect(
            usersVaultContract.claimShares(AMOUNT_1E18.mul(100), user1Address)
          ).to.be.revertedWithCustomError(
            usersVaultContract,
            "InsufficientShares"
          );
        });

        it("THEN ==> DEPOSIT ON ROUND 1 ==> VALID FOR ROUND 2", async () => {
          await usersVaultContract
            .connect(user1)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(1)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user1)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(2)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user2)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(3)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user2)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(4)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );
          await usersVaultContract
            .connect(user3)
            .userDeposit(BigNumber.from(AMOUNT_1E18.mul(5)));
          console.log(
            "pendingDepositAssets   : ",
            await usersVaultContract.pendingDepositAssets()
          );

          console.log(
            "\n\nUser 1 Shares PRV      :>> ",
            await usersVaultContract.previewShares(user1Address)
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
        });

        it("THEN ==> User 1 Claim 1 Share", async () => {
          console.log(
            "Balance user 1 Before claim: ",
            await usersVaultContract.balanceOf(user1Address)
          );
          await usersVaultContract
            .connect(user1)
            .claimShares(AMOUNT_1E18.mul(1), user1Address);
          console.log(
            "Balance user 1 After claim: ",
            await usersVaultContract.balanceOf(user1Address)
          );
        });

        it("THEN ==> User 2 FAILS to claim 5 Asset", async () => {
          await expect(
            usersVaultContract
              .connect(user2)
              .claimAssets(AMOUNT_1E18.mul(5), user2Address)
          ).to.be.revertedWithCustomError(
            usersVaultContract,
            "InsufficientAssets"
          );
        });

        it("THEN ==> User 2 Claim 2 shares", async () => {
          const balanceBefore = await usersVaultContract.balanceOf(
            user2Address
          );
          console.log("Balance user 2 Before claim: ", balanceBefore);
          await usersVaultContract
            .connect(user2)
            .claimShares(AMOUNT_1E18.mul(2), user2Address);
          const balanceAfter = await usersVaultContract.balanceOf(user2Address);
          expect(balanceBefore.add(AMOUNT_1E18.mul(2))).to.equal(balanceAfter);
        });

        it("THEN ==> User 3 Claim 3 shares", async () => {
          const balanceBefore = await usersVaultContract.balanceOf(
            user3Address
          );
          console.log("Balance user 3 Before claim: ", balanceBefore);
          await usersVaultContract
            .connect(user3)
            .claimShares(AMOUNT_1E18.mul(3), user3Address);
          const balanceAfter = await usersVaultContract.balanceOf(user3Address);
          expect(balanceBefore.add(AMOUNT_1E18.mul(3))).to.equal(balanceAfter);
        });

        it("THEN ==> User 3 Makes WithdrawRequest of 3 Asset", async () => {
          const balanceBefore = await usdcTokenContract.balanceOf(user3Address);
          console.log(
            "Balance user 3 Before claim: ",
            await usdcTokenContract.balanceOf(user3Address)
          );
          await usersVaultContract
            .connect(user3)
            .withdrawRequest(AMOUNT_1E18.mul(3));
          const balanceAfter = await usdcTokenContract.balanceOf(user3Address);
          expect(balanceBefore).to.equal(balanceAfter);
        });

        it("THEN ==> Balanaces before and after SECOND rollover PROFIT OF 35", async () => {
          await showBalances();

          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );

          await usdcTokenContract.mint(
            usersVaultContract.address,
            AMOUNT_1E18.mul(35)
          );
          await usersVaultContract.connect(traderWallet).rolloverFromTrader();
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );
          console.log(
            "--------------------------------------------------------------------------"
          );

          await showBalances();
        });

        it("THEN ==> User 3 Claim 3 Assets", async () => {
          console.log(
            "\n\nUser 1 Shares PRV      :>> ",
            await usersVaultContract.previewShares(user1Address)
          );

          const balanceBefore = await usdcTokenContract.balanceOf(user3Address);
          console.log(
            "Balance user 3 Before claim: ",
            await usdcTokenContract.balanceOf(user3Address)
          );
          await usersVaultContract
            .connect(user3)
            .claimAssets(AMOUNT_1E18.mul(3), user3Address);
          const balanceAfter = await usdcTokenContract.balanceOf(user3Address);
          expect(balanceBefore.add(AMOUNT_1E18.mul(3))).to.equal(balanceAfter);
        });
      });
    });
  });
});

/*

USER 1
3 pending assets
29 unclaimed shares
round 1

asset per share round 1 = 1258503401360544217

1.258503401360544217 asset per 1 share
1 asset = 0,7945945945945945950284002922 shares
3 asset = 2,3837837837837837850852008766 shares + 29 shares = 31,3837837837837837850852008766

*/
