import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractReceipt,
  ContractTransaction,
  BigNumber,
} from "ethers";
import {
  SnapshotRestorer,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  AdaptersRegistryMock,
  ContractsFactory,
  TraderWalletDeployer,
  TraderWallet,
  // UsersVaultDeployer,
  // UsersVault,
  ERC20Mock,
} from "../../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
} from "./../_helpers/constants";
import { decodeEvent } from "./../_helpers/functions";

let snapshot: SnapshotRestorer;

let deployer: Signer;
let vault: Signer;
let trader: Signer;
let adaptersRegistry: Signer;
let contractsFactory: Signer;
let dynamicValue: Signer;
let nonAuthorized: Signer;
let otherSigner: Signer;
let owner: Signer;

let deployerAddress: string;
let vaultAddress: string;
let underlyingTokenAddress: string;
let adaptersRegistryAddress: string;
let traderAddress: string;
let dynamicValueAddress: string;
let traderWalletAddress: string;
let nonAuthorizedAddress: string;
let otherAddress: string;
let ownerAddress: string;

let txResult: ContractTransaction;
let txReceipt: ContractReceipt;

let TraderWalletDeployerFactory: ContractFactory;
let traderWalletDeployerContract: TraderWalletDeployer;
let ContractsFactoryFactory: ContractFactory;
let contractsFactoryContract: ContractsFactory;
let traderWalletContract: TraderWallet;
let usdcTokenContract: ERC20Mock;
let adaptersRegistryContract: AdaptersRegistryMock;
let contractBalanceBefore: BigNumber;
let contractBalanceAfter: BigNumber;
let traderBalanceBefore: BigNumber;
let traderBalanceAfter: BigNumber;
let feeRate: BigNumber = BigNumber.from(30);

describe("ContractsFactory Tests", function () {
  this.timeout(TEST_TIMEOUT);

  before(async () => {
    [deployer, trader, dynamicValue, nonAuthorized, otherSigner] =
      await ethers.getSigners();
    [
      deployerAddress,
      traderAddress,
      dynamicValueAddress,
      nonAuthorizedAddress,
      otherAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      trader.getAddress(),
      dynamicValue.getAddress(),
      nonAuthorized.getAddress(),
      otherSigner.getAddress(),
    ]);

    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    usdcTokenContract = (await ERC20MockFactory.deploy(
      "USDC",
      "USDC",
      6
    )) as ERC20Mock;
    await usdcTokenContract.deployed();
    underlyingTokenAddress = usdcTokenContract.address;

    const AdapterRegistryFactory = await ethers.getContractFactory(
      "AdaptersRegistryMock"
    );
    adaptersRegistryContract = (await upgrades.deployProxy(
      AdapterRegistryFactory,
      []
    )) as AdaptersRegistryMock;
    await adaptersRegistryContract.deployed();

    // Deploy Library
    TraderWalletDeployerFactory = await ethers.getContractFactory(
      "TraderWalletDeployer"
    );
    traderWalletDeployerContract =
      (await TraderWalletDeployerFactory.deploy()) as TraderWalletDeployer;
    await traderWalletDeployerContract.deployed();

    ContractsFactoryFactory = await ethers.getContractFactory(
      "ContractsFactory",
      {
        libraries: {
          TraderWalletDeployer: traderWalletDeployerContract.address,
        },
      }
    );
  });

  describe("Contracts Factory tests: ", function () {
    describe("Given a scenario to create Trader Wallet and Users Vault", function () {
      before(async () => {
        owner = deployer;
        ownerAddress = deployerAddress;
      });

      describe("WHEN trying to deploy ContractsFactory contract with invalid parameters", function () {
        it("THEN it should FAIL when feeRate is greater than 100", async () => {
          await expect(
            upgrades.deployProxy(
              ContractsFactoryFactory,
              [BigNumber.from(101)],
              { unsafeAllowLinkedLibraries: true }
            )
          ).to.be.revertedWithCustomError(
            ContractsFactoryFactory,
            "FeeRateError"
          );
        });
      });

      describe("WHEN trying to deploy ContractsFactory contract with correct parameters", function () {
        before(async () => {
          contractsFactoryContract = (await upgrades.deployProxy(
            ContractsFactoryFactory,
            [feeRate],
            { unsafeAllowLinkedLibraries: true }
          )) as ContractsFactory;
          await contractsFactoryContract.deployed();

          // take a snapshot
          snapshot = await takeSnapshot();
        });

        describe("WHEN trying to set the adaptersRegistryAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .setAdaptersRegistryAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .setAdaptersRegistryAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_adaptersRegistryAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await contractsFactoryContract
                .connect(owner)
                .setAdaptersRegistryAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(
                await contractsFactoryContract.adaptersRegistryAddress()
              ).to.equal(otherAddress);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "AdaptersRegistryAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the feeRate", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .setFeeRate(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .setFeeRate(BigNumber.from(200))
                ).to.be.revertedWithCustomError(
                  ContractsFactoryFactory,
                  "FeeRateError"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and parameter", function () {
            const NEW_FEE_RATE = BigNumber.from(20);
            before(async () => {
              txResult = await contractsFactoryContract
                .connect(owner)
                .setFeeRate(NEW_FEE_RATE);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new feeRate should be stored", async () => {
              expect(await contractsFactoryContract.feeRate()).to.equal(
                NEW_FEE_RATE
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "FeeRateSet")
                .withArgs(NEW_FEE_RATE);
            });
          });
        });

        describe("WHEN trying to create a trader wallet", async () => {
          before(async () => {
            // set adapters registry on factory to deploy wallet and vault
            await contractsFactoryContract.setAdaptersRegistryAddress(
              adaptersRegistryContract.address
            );

            txResult = await contractsFactoryContract
              .connect(deployer)
              .deployTraderWallet(
                usdcTokenContract.address,
                traderAddress,
                otherAddress
              );
          });

          it("THEN Trader Wallet Contract should be deployed", async () => {
            const abi = [
              "event TraderWalletDeployed(address indexed _traderWalletAddress, address indexed _traderAddress, address indexed _underlyingTokenAddress)",
            ];
            const signature = "TraderWalletDeployed(address,address,address)";

            txReceipt = await txResult.wait();
            const decodedEvent = await decodeEvent(abi, signature, txReceipt);
            traderWalletAddress = decodedEvent.args._traderWalletAddress;

            traderWalletContract = (await ethers.getContractAt(
              "TraderWallet",
              traderWalletAddress
            )) as TraderWallet;
          });

          it("THEN it should return the same ones after deployment", async () => {
            console.log("traderWallet     :>> ", traderWalletAddress);
            console.log("deployer         :>> ", deployerAddress);
            console.log(
              "factory          :>> ",
              contractsFactoryContract.address
            );
            console.log(
              "factory owner    :>> ",
              await contractsFactoryContract.owner()
            );
            console.log(
              "wallet owner     :>> ",
              await traderWalletContract.owner()
            );
            console.log("traderAddress    :>> ", traderAddress);

            expect(await traderWalletContract.vaultAddress()).to.equal(
              ZERO_ADDRESS
            );
            expect(
              await traderWalletContract.underlyingTokenAddress()
            ).to.equal(usdcTokenContract.address);
            expect(
              await traderWalletContract.adaptersRegistryAddress()
            ).to.equal(adaptersRegistryContract.address);
            expect(
              await traderWalletContract.contractsFactoryAddress()
            ).to.equal(contractsFactoryContract.address);

            expect(await traderWalletContract.traderAddress()).to.equal(
              traderAddress
            );
            expect(await traderWalletContract.dynamicValueAddress()).to.equal(
              otherAddress
            );
            expect(await traderWalletContract.owner()).to.equal(
              traderAddress
            );

            expect(
              await traderWalletContract.cumulativePendingDeposits()
            ).to.equal(ZERO_AMOUNT);
            expect(
              await traderWalletContract.cumulativePendingWithdrawals()
            ).to.equal(ZERO_AMOUNT);
          });

          it("THEN it should return the same ones after deployment", async () => {
            // await contractsFactoryContract
            //   .connect(deployer)
            //   .changeOwnershipToWallet(
            //     traderWalletContract.address,
            //     deployerAddress
            //   );

            await traderWalletContract.connect(trader).transferOwnership(deployerAddress);

            expect(await traderWalletContract.owner()).to.equal(
              deployerAddress
            );
          });
        });
      });
    });
  });
});
