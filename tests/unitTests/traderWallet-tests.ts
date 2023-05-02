import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
} from "ethers";
import { SnapshotRestorer, takeSnapshot } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  TraderWallet,
  TraderWalletV2,
  GMXAdapter,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  UsersVaultMock,
  ERC20Mock,
} from "../../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_1E18,
} from "./../_helpers/constants";

let snapshot: SnapshotRestorer;

let deployer: Signer;
let vault: Signer;
let trader: Signer;
let dynamicValue: Signer;
let nonAuthorized: Signer;
let otherSigner: Signer;
let owner: Signer;

let deployerAddress: string;
let vaultAddress: string;
let underlyingTokenAddress: string;
let traderAddress: string;
let dynamicValueAddress: string;
let otherAddress: string;
let ownerAddress: string;

let txResult: ContractTransaction;
let ContractsFactoryFactory: ContractFactory;
let contractsFactoryContract: ContractsFactoryMock;
let TraderWalletFactory: ContractFactory;
let traderWalletContract: TraderWallet;
let AdaptersRegistryFactory: ContractFactory;
let adaptersRegistryContract: AdaptersRegistryMock;
let AdapterFactory: ContractFactory;
let adapterContract: AdapterMock;
let UsersVaultFactory: ContractFactory;
let usersVaultContract: UsersVaultMock;
let GMXAdapterLibraryFactory: ContractFactory;
let gmxAdapterContract: GMXAdapter;

let usdcTokenContract: ERC20Mock;
let contractBalanceBefore: BigNumber;
let contractBalanceAfter: BigNumber;
let traderBalanceBefore: BigNumber;
let traderBalanceAfter: BigNumber;

describe("Trader Wallet Contract Tests", function () {
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

    [deployer, vault, trader, dynamicValue, nonAuthorized, otherSigner] =
      await ethers.getSigners();

    [
      deployerAddress,
      vaultAddress,
      traderAddress,
      dynamicValueAddress,
      otherAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      vault.getAddress(),
      trader.getAddress(),
      dynamicValue.getAddress(),
      otherSigner.getAddress(),
    ]);
  });

  describe("TraderWallet contract Deployment Tests", function () {
    describe("GIVEN a Trader Wallet Factory", function () {
      before(async () => {
        owner = deployer;
        ownerAddress = deployerAddress;

        GMXAdapterLibraryFactory = await ethers.getContractFactory(
          "GMXAdapter"
        );
        gmxAdapterContract =
          (await GMXAdapterLibraryFactory.deploy()) as GMXAdapter;
        await gmxAdapterContract.deployed();

        TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
          libraries: {
            GMXAdapter: gmxAdapterContract.address,
          },
        });

        // deploy mocked Vault
        UsersVaultFactory = await ethers.getContractFactory("UsersVaultMock");
        usersVaultContract =
          (await UsersVaultFactory.deploy()) as UsersVaultMock;
        await usersVaultContract.deployed();

        // deploy ContractsFactory
        ContractsFactoryFactory = await ethers.getContractFactory(
          "ContractsFactoryMock"
        );
        contractsFactoryContract = (await upgrades.deployProxy(
          ContractsFactoryFactory,
          []
        )) as ContractsFactoryMock;
        await contractsFactoryContract.deployed();

        // set TRUE for response
        await contractsFactoryContract.setReturnValue(true);

        // deploy mocked adaptersRegistry
        AdaptersRegistryFactory = await ethers.getContractFactory(
          "AdaptersRegistryMock"
        );
        adaptersRegistryContract =
          (await AdaptersRegistryFactory.deploy()) as AdaptersRegistryMock;
        await adaptersRegistryContract.deployed();
      });

      describe("WHEN trying to deploy TraderWallet contract with invalid parameters", function () {
        it("THEN it should FAIL when _underlyingTokenAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(
              TraderWalletFactory,
              [
                ZERO_ADDRESS,
                adaptersRegistryContract.address,
                contractsFactoryContract.address,
                traderAddress,
                dynamicValueAddress,
              ],
              { unsafeAllowLinkedLibraries: true }
            )
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddress")
            .withArgs("_underlyingTokenAddress");
        });

        it("THEN it should FAIL when _adaptersRegistryAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(
              TraderWalletFactory,
              [
                underlyingTokenAddress,
                ZERO_ADDRESS,
                contractsFactoryContract.address,
                traderAddress,
                dynamicValueAddress,
              ],
              { unsafeAllowLinkedLibraries: true }
            )
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddress")
            .withArgs("_adaptersRegistryAddress");
        });

        it("THEN it should FAIL when _contractsFactoryAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(
              TraderWalletFactory,
              [
                underlyingTokenAddress,
                adaptersRegistryContract.address,
                ZERO_ADDRESS,
                traderAddress,
                dynamicValueAddress,
              ],
              { unsafeAllowLinkedLibraries: true }
            )
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddress")
            .withArgs("_contractsFactoryAddress");
        });

        it("THEN it should FAIL when _traderAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(
              TraderWalletFactory,
              [
                underlyingTokenAddress,
                adaptersRegistryContract.address,
                contractsFactoryContract.address,
                ZERO_ADDRESS,
                dynamicValueAddress,
              ],
              { unsafeAllowLinkedLibraries: true }
            )
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddress")
            .withArgs("_traderAddress");
        });

        it("THEN it should FAIL when _dynamicValueAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(
              TraderWalletFactory,
              [
                underlyingTokenAddress,
                adaptersRegistryContract.address,
                contractsFactoryContract.address,
                traderAddress,
                ZERO_ADDRESS,
              ],
              { unsafeAllowLinkedLibraries: true }
            )
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddress")
            .withArgs("_dynamicValueAddress");
        });
      });

      describe("WHEN trying to deploy TraderWallet contract with correct parameters", function () {
        before(async () => {
          traderWalletContract = (await upgrades.deployProxy(
            TraderWalletFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryContract.address,
              contractsFactoryContract.address,
              traderAddress,
              dynamicValueAddress,
            ],
            { unsafeAllowLinkedLibraries: true }
          )) as TraderWallet;
          await traderWalletContract.deployed();

          // change address to mocked adaptersRegistry
          await traderWalletContract
            .connect(owner)
            .setAdaptersRegistryAddress(adaptersRegistryContract.address);

          // set the vault in the trader wallet contract
          await traderWalletContract
            .connect(owner)
            .setVaultAddress(usersVaultContract.address);

          // deploy mocked adapter
          AdapterFactory = await ethers.getContractFactory("AdapterMock");
          adapterContract = (await AdapterFactory.deploy()) as AdapterMock;
          await adapterContract.deployed();

          // mint to trader
          await usdcTokenContract.mint(traderAddress, AMOUNT_1E18.mul(100));
          await usdcTokenContract
            .connect(trader)
            .approve(traderWalletContract.address, AMOUNT_1E18.mul(100));

          contractBalanceBefore = await usdcTokenContract.balanceOf(
            traderWalletContract.address
          );
          traderBalanceBefore = await usdcTokenContract.balanceOf(
            traderAddress
          );

          // take a snapshot
          snapshot = await takeSnapshot();
        });

        it("THEN it should return the same ones after deployment", async () => {
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
          expect(await traderWalletContract.dynamicValueAddress()).to.equal(
            dynamicValueAddress
          );
          expect(await traderWalletContract.owner()).to.equal(ownerAddress);

          expect(
            await traderWalletContract.cumulativePendingDeposits()
          ).to.equal(ZERO_AMOUNT);
          expect(
            await traderWalletContract.cumulativePendingWithdrawals()
          ).to.equal(ZERO_AMOUNT);
        });

        describe("WHEN trying to set the vaultAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setVaultAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setVaultAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_vaultAddress");
              });
            });

            describe("WHEN vaultAddress is not allowed", function () {
              before(async () => {
                // change returnValue to return false on function call
                await contractsFactoryContract.setReturnValue(false);
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setVaultAddress(otherAddress)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "InvalidVault"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              // change returnValue to return false on function call
              await contractsFactoryContract.setReturnValue(true);

              txResult = await traderWalletContract
                .connect(owner)
                .setVaultAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(await traderWalletContract.vaultAddress()).to.equal(
                otherAddress
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "VaultAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the adaptersRegistryAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setAdaptersRegistryAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setAdaptersRegistryAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_adaptersRegistryAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await traderWalletContract
                .connect(owner)
                .setAdaptersRegistryAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(
                await traderWalletContract.adaptersRegistryAddress()
              ).to.equal(otherAddress);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "AdaptersRegistryAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the contractsFactoryAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setContractsFactoryAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setContractsFactoryAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_contractsFactoryAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await traderWalletContract
                .connect(owner)
                .setContractsFactoryAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(
                await traderWalletContract.contractsFactoryAddress()
              ).to.equal(otherAddress);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "ContractsFactoryAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the dynamicValueAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setDynamicValueAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setDynamicValueAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_dynamicValueAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await traderWalletContract
                .connect(owner)
                .setDynamicValueAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(await traderWalletContract.dynamicValueAddress()).to.equal(
                otherAddress
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "DynamicValueAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the underlyingTokenAddress", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setUnderlyingTokenAddress(otherAddress)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .setUnderlyingTokenAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_underlyingTokenAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await traderWalletContract
                .connect(trader)
                .setUnderlyingTokenAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN new address should be stored", async () => {
              expect(
                await traderWalletContract.underlyingTokenAddress()
              ).to.equal(otherAddress);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "UnderlyingTokenAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to set the traderAddress", async () => {
          let FactoryOfContractsFactory: ContractFactory;
          let contractsFactoryContract: ContractsFactoryMock;

          before(async () => {
            // deploy mocked factory
            FactoryOfContractsFactory = await ethers.getContractFactory(
              "ContractsFactoryMock"
            );
            contractsFactoryContract =
              (await FactoryOfContractsFactory.deploy()) as ContractsFactoryMock;
            await contractsFactoryContract.deployed();

            // change address to mocked factory
            await traderWalletContract
              .connect(owner)
              .setContractsFactoryAddress(contractsFactoryContract.address);
          });
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setTraderAddress(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setTraderAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "ZeroAddress"
                  )
                  .withArgs("_traderAddress");
              });
            });
            describe("WHEN trader is not allowed", function () {
              before(async () => {
                // change returnValue to return false on function call
                await contractsFactoryContract.setReturnValue(false);
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(owner)
                    .setTraderAddress(otherAddress)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "TraderNotAllowed"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              // change returnValue to return true on function call
              await contractsFactoryContract.setReturnValue(true);

              txResult = await traderWalletContract
                .connect(owner)
                .setTraderAddress(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });

            it("THEN new address should be stored", async () => {
              expect(await traderWalletContract.traderAddress()).to.equal(
                otherAddress
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "TraderAddressSet")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to add/remove adapter to be used by trader", async () => {
          before(async () => {
            // change address to mocked adaptersRegistry
            await traderWalletContract
              .connect(owner)
              .setAdaptersRegistryAddress(adaptersRegistryContract.address);
          });
          after(async () => {
            await snapshot.restore();
          });

          describe("WHEN trying to add an adapter to use (addAdapterToUse)", async () => {
            describe("WHEN calling with invalid caller or parameters", function () {
              describe("WHEN caller is not trader", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(nonAuthorized)
                      .addAdapterToUse(1)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "CallerNotAllowed"
                  );
                });
              });
              describe("WHEN protocol does not exist in registry", function () {
                before(async () => {
                  // change returnValue to adapter registry to fail on function call
                  await adaptersRegistryContract.setReturnValue(false);
                  await adaptersRegistryContract.setReturnAddress(otherAddress);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).addAdapterToUse(1)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidProtocol"
                  );
                });
              });
            });

            describe("WHEN calling with correct caller and protocol", function () {
              let adapter1Address: string;

              before(async () => {
                // change returnValue to return true on function call
                adapter1Address = otherAddress;
                await adaptersRegistryContract.setReturnValue(true);
                await adaptersRegistryContract.setReturnAddress(
                  adapter1Address
                );

                txResult = await traderWalletContract
                  .connect(trader)
                  .addAdapterToUse(1);
              });

              it("THEN new adapter should be added to the trader array", async () => {
                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(0)
                ).to.equal(adapter1Address);
              });

              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "AdapterToUseAdded")
                  .withArgs(1, adapter1Address, traderAddress);
              });

              it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
                expect(
                  await traderWalletContract.adaptersPerProtocol(1)
                ).to.equal(adapter1Address);
              });

              describe("WHEN adapter already exists in traderArray ", function () {
                it("THEN adding the same one should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).addAdapterToUse(1)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AdapterPresent"
                  );
                });
              });
            });
          });

          describe("WHEN trying to remove an adapter (removeAdapterToUse)", async () => {
            // otherAddress is already added from previous flow (addAdapterToUse)
            // to add now deployerAddress, contractsFactoryAddress, dynamicValueAddress
            // just to store something and test the function
            let adapter1Address: string;
            let adapter2Address: string;
            let adapter3Address: string;
            let adapter4Address: string;
            let adapter10Address: string;

            before(async () => {
              adapter1Address = otherAddress;
              adapter2Address = deployerAddress;
              adapter3Address = contractsFactoryContract.address;
              adapter4Address = dynamicValueAddress;
              adapter10Address = vaultAddress;

              await adaptersRegistryContract.setReturnValue(true);
              await adaptersRegistryContract.setReturnAddress(adapter2Address);
              await traderWalletContract.connect(trader).addAdapterToUse(2);

              await adaptersRegistryContract.setReturnAddress(adapter3Address);
              await traderWalletContract.connect(trader).addAdapterToUse(3);

              await adaptersRegistryContract.setReturnAddress(adapter4Address);
              await traderWalletContract.connect(trader).addAdapterToUse(4);
            });
            describe("WHEN checking adapters", function () {
              it("THEN it should return correct values", async () => {
                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(0)
                ).to.equal(adapter1Address);

                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(1)
                ).to.equal(adapter2Address);

                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(2)
                ).to.equal(adapter3Address);

                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(3)
                ).to.equal(adapter4Address);
              });
              it("THEN it should return correct array length", async () => {
                expect(
                  await traderWalletContract.getTraderSelectedAdaptersLength()
                ).to.equal(BigNumber.from(4));
              });
              it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
                expect(
                  await traderWalletContract.adaptersPerProtocol(1)
                ).to.equal(adapter1Address);

                expect(
                  await traderWalletContract.adaptersPerProtocol(2)
                ).to.equal(adapter2Address);

                expect(
                  await traderWalletContract.adaptersPerProtocol(3)
                ).to.equal(adapter3Address);

                expect(
                  await traderWalletContract.adaptersPerProtocol(4)
                ).to.equal(adapter4Address);
              });
            });

            describe("WHEN calling with invalid caller or parameters", function () {
              describe("WHEN caller is not owner", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(nonAuthorized)
                      .removeAdapterToUse(1)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "CallerNotAllowed"
                  );
                });
              });
              describe("WHEN protocol does not exist in registry", function () {
                before(async () => {
                  // change returnValue to adapter registry to fail on function call
                  await adaptersRegistryContract.setReturnValue(false);
                  await adaptersRegistryContract.setReturnAddress(otherAddress);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).removeAdapterToUse(10)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidProtocol"
                  );
                });
              });

              describe("WHEN adapter does not exist in array", function () {
                before(async () => {
                  await adaptersRegistryContract.setReturnValue(true);
                  await adaptersRegistryContract.setReturnAddress(
                    adapter10Address
                  );
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).removeAdapterToUse(10)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AdapterNotPresent"
                  );
                });
              });
            });

            describe("WHEN calling with correct caller and address", function () {
              before(async () => {
                await adaptersRegistryContract.setReturnValue(true);
                await adaptersRegistryContract.setReturnAddress(
                  adapter3Address
                );
                txResult = await traderWalletContract
                  .connect(trader)
                  .removeAdapterToUse(3);
              });

              it("THEN adapter should be removed from array", async () => {
                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(0)
                ).to.equal(adapter1Address);

                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(1)
                ).to.equal(adapter2Address);

                expect(
                  await traderWalletContract.traderSelectedAdaptersArray(2)
                ).to.equal(adapter4Address);
              });

              it("THEN it should return correct array length", async () => {
                expect(
                  await traderWalletContract.getTraderSelectedAdaptersLength()
                ).to.equal(BigNumber.from(3));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "AdapterToUseRemoved")
                  .withArgs(adapter3Address, traderAddress);
              });
              it("THEN it should be removed from adaptersPerProtocol mapping", async () => {
                expect(
                  await traderWalletContract.adaptersPerProtocol(3)
                ).to.equal(ZERO_ADDRESS);
              });
            });
          });
        });

        describe("WHEN trying to make a traderDeposit", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .traderDeposit(AMOUNT_1E18)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });

            describe("WHEN trader does not have the amount", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .traderDeposit(AMOUNT_1E18.mul(100000))
                ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
              });
            });

            describe("WHEN amount is ZERO", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .traderDeposit(ZERO_AMOUNT)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "ZeroAmount"
                );
              });
            });

            describe("WHEN transferFrom fails", function () {
              before(async () => {
                await usdcTokenContract.setReturnBoolValue(false);
              });
              after(async () => {
                await snapshot.restore();
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .traderDeposit(AMOUNT_1E18)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "TokenTransferFailed"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and amount", function () {
            const AMOUNT = AMOUNT_1E18.mul(100).div(2);

            before(async () => {
              txResult = await traderWalletContract
                .connect(trader)
                .traderDeposit(AMOUNT);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN contract should return correct vaules", async () => {
              expect(
                await traderWalletContract.getCumulativePendingDeposits()
              ).to.equal(AMOUNT);
              expect(
                await traderWalletContract.cumulativePendingDeposits()
              ).to.equal(AMOUNT);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "TraderDeposit")
                .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
            });
            it("THEN contract balance should increase", async () => {
              contractBalanceAfter = await usdcTokenContract.balanceOf(
                traderWalletContract.address
              );
              expect(contractBalanceAfter).to.equal(
                contractBalanceBefore.add(AMOUNT)
              );
            });
            it("THEN trader balance should decrease", async () => {
              traderBalanceAfter = await usdcTokenContract.balanceOf(
                traderAddress
              );
              expect(traderBalanceAfter).to.equal(
                traderBalanceBefore.sub(AMOUNT)
              );
            });

            describe("WHEN calling again with correct caller and amount", function () {
              before(async () => {
                txResult = await traderWalletContract
                  .connect(trader)
                  .traderDeposit(AMOUNT);
              });

              it("THEN contract should return correct vaules", async () => {
                expect(
                  await traderWalletContract.getCumulativePendingDeposits()
                ).to.equal(AMOUNT_1E18.mul(100));
                expect(
                  await traderWalletContract.cumulativePendingDeposits()
                ).to.equal(AMOUNT_1E18.mul(100));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "TraderDeposit")
                  .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
              });
              it("THEN contract balance should increase", async () => {
                contractBalanceAfter = await usdcTokenContract.balanceOf(
                  traderWalletContract.address
                );
                expect(contractBalanceAfter).to.equal(
                  contractBalanceBefore.add(AMOUNT_1E18.mul(100))
                );
              });
              it("THEN trader balance should decrease", async () => {
                traderBalanceAfter = await usdcTokenContract.balanceOf(
                  traderAddress
                );
                expect(traderBalanceAfter).to.equal(
                  traderBalanceBefore.sub(AMOUNT_1E18.mul(100))
                );
              });
            });
          });
        });

        describe("WHEN trying to make a withdrawRequest", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .withdrawRequest(AMOUNT_1E18.mul(100))
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });
            describe("WHEN amount is ZERO", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .withdrawRequest(ZERO_AMOUNT)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "ZeroAmount"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and amount", function () {
            const AMOUNT = AMOUNT_1E18.mul(100).div(2);

            before(async () => {
              txResult = await traderWalletContract
                .connect(trader)
                .withdrawRequest(AMOUNT);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN contract should return correct vaules", async () => {
              expect(
                await traderWalletContract.getCumulativePendingWithdrawals()
              ).to.equal(AMOUNT);
              expect(
                await traderWalletContract.cumulativePendingWithdrawals()
              ).to.equal(AMOUNT);
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(traderWalletContract, "WithdrawRequest")
                .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
            });

            describe("WHEN calling again with correct caller and amount", function () {
              before(async () => {
                txResult = await traderWalletContract
                  .connect(trader)
                  .withdrawRequest(AMOUNT);
              });

              it("THEN contract should return correct vaules", async () => {
                expect(
                  await traderWalletContract.getCumulativePendingWithdrawals()
                ).to.equal(AMOUNT_1E18.mul(100));
                expect(
                  await traderWalletContract.cumulativePendingWithdrawals()
                ).to.equal(AMOUNT_1E18.mul(100));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "WithdrawRequest")
                  .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
              });
            });
          });
        });

        describe("WHEN trying to make an executeOnProtocol call", async () => {
          const traderOperation = {
            _operationId: 10,
            _data: ethers.utils.hexlify("0x1234"),
          };

          describe("WHEN calling with invalid caller or parameters", function () {
            after(async () => {
              await snapshot.restore();
            });

            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .executeOnProtocol(
                      1,
                      traderOperation,
                      false
                    )
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });

            describe("WHEN Adapter does not exist in registry", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnProtocol(11, traderOperation, false)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "InvalidAdapter"
                );
              });
            });

            describe("WHEN Adapter exists but execution fails", function () {
              before(async () => {
                // change returnValue to return true on function call
                await adaptersRegistryContract.setReturnValue(true);
                await adaptersRegistryContract.setReturnAddress(
                  adapterContract.address
                );

                // add the adapter into the array and mapping
                // so the call to the executeOnProtocol returns the adapter address
                await traderWalletContract.connect(trader).addAdapterToUse(2);

                // change returnValue to return true on function call on allowed operation
                await adapterContract.setExecuteOperationReturn(false);
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnProtocol(2, traderOperation, false)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AdapterOperationFailed"
                  )
                  .withArgs("trader");
              });
            });
          });

          describe("WHEN calling with correct parameters", function () {
            describe("WHEN executed correctly no replication needed", function () {
              before(async () => {
                // change returnValue to return true on function call
                await adaptersRegistryContract.setReturnValue(true);
                await adaptersRegistryContract.setReturnAddress(
                  adapterContract.address
                );

                // add the adapter into the array and mapping
                // so the call to the executeOnProtocol returns the adapter address
                await traderWalletContract.connect(trader).addAdapterToUse(2);

                // change returnValue to return true on function call on allowed operation
                await adapterContract.setExecuteOperationReturn(true);

                txResult = await traderWalletContract
                  .connect(trader)
                  .executeOnProtocol(2, traderOperation, false);
              });
              after(async () => {
                await snapshot.restore();
              });
              it("THEN it should emit an Event", async () => {
                // await expect(txResult)
                //   .to.emit(traderWalletContract, "OperationExecuted")
                //   .withArgs(
                //     adapterContract.address,
                //     { _timestamp: undefined } as any,
                //     "trader wallet",
                //     false,
                //     { _initialBalance: undefined } as any,
                //     BigNumber.from("1000000000000000000")
                //   );
                await expect(txResult).to.emit(
                  traderWalletContract,
                  "OperationExecuted"
                );
              });
            });

            describe("WHEN replication is issued", function () {
              before(async () => {
                // change returnValue to return true on function call
                await adaptersRegistryContract.setReturnValue(true);
                await adaptersRegistryContract.setReturnAddress(
                  adapterContract.address
                );

                // add the adapter into the array and mapping
                // so the call to the executeOnProtocol returns the adapter address
                await traderWalletContract.connect(trader).addAdapterToUse(2);
              });
              after(async () => {
                await snapshot.restore();
              });
              describe("WHEN executed on wallet ok but revert in users vault", function () {
                before(async () => {
                  // change returnValue to return true on function call on allowed operation
                  await adapterContract.setExecuteOperationReturn(true);

                  // change returnValue to return false on function call on result of execute on vault
                  await usersVaultContract.setExecuteOnProtocol(false);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(trader)
                      .executeOnProtocol(2, traderOperation, true)
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "UsersVaultOperationFailed"
                  );
                });
              });

              describe("WHEN executed on wallet ok and also in users vault", function () {
                before(async () => {
                  // change returnValue to return true on function call on allowed operation
                  await adapterContract.setExecuteOperationReturn(true);

                  // change returnValue to return true on function call on result of execute on vault
                  await usersVaultContract.setExecuteOnProtocol(true);

                  txResult = await traderWalletContract
                    .connect(trader)
                    .executeOnProtocol(2, traderOperation, true);
                });
                it("THEN it should emit an Event", async () => {
                  await expect(txResult).to.emit(
                    traderWalletContract,
                    "OperationExecuted"
                  );
                });
              });
            });
          });
        });

        describe("WHEN trying to make a rollover", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract.connect(nonAuthorized).rollover()
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });
            describe("WHEN no cumulatives pending", async () => {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract.connect(trader).rollover()
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "InvalidRollover"
                );
              });
            });

            describe("WHEN external contract operations fail", async () => {
              before(async () => {
                // mint to trader
                await usdcTokenContract.mint(
                  traderAddress,
                  AMOUNT_1E18.mul(100).mul(4)
                );
                await usdcTokenContract
                  .connect(trader)
                  .approve(
                    traderWalletContract.address,
                    AMOUNT_1E18.mul(100).mul(4)
                  );

                // mint to vault
                await usdcTokenContract.mint(
                  usersVaultContract.address,
                  AMOUNT_1E18.mul(100).mul(10).mul(8)
                );

                await traderWalletContract
                  .connect(trader)
                  .traderDeposit(AMOUNT_1E18.mul(100).mul(4));
              });

              describe("WHEN rollover fails on Users Vault", async () => {
                before(async () => {
                  // for rollover return false
                  await usersVaultContract.setReturnValue(false);
                });
                it("THEN rollover should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).rollover()
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "RolloverFailed"
                  );
                });
              });

              describe("WHEN transfer to trader fails after users vault rollover", async () => {
                before(async () => {
                  // for rollover return ok
                  await usersVaultContract.setReturnValue(true);
                  // for transfer return error
                  await usdcTokenContract.setReturnBoolValue(false);

                  // request withdraw so the transfer can take place
                  await traderWalletContract
                    .connect(trader)
                    .withdrawRequest(AMOUNT_1E18.mul(100));
                });
                // after(async () => {
                //   await snapshot.restore();
                // });
                it("THEN rollover should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).rollover()
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "SendToTraderFailed"
                  );
                });
              });
              describe("WHEN trader makes a really big withdraw request and it is processed after users vault rollover", async () => {
                before(async () => {
                  // for rollover return ok
                  await usersVaultContract.setReturnValue(true);
                  // for transfer return ok
                  await usdcTokenContract.setReturnBoolValue(true);

                  // request withdraw so the transfer can take place
                  await traderWalletContract
                    .connect(trader)
                    .withdrawRequest(AMOUNT_1E18.mul(100).mul(10));
                });
                after(async () => {
                  await snapshot.restore();
                });
                it("THEN rollover should fail", async () => {
                  await expect(
                    traderWalletContract.connect(trader).rollover()
                  ).to.be.revertedWith(
                    "ERC20: transfer amount exceeds balance"
                  );
                });
              });
            });
          });

          describe("WHEN calling with correct parameters on round ZERO", function () {
            before(async () => {
              // mint to trader 400
              await usdcTokenContract.mint(
                traderAddress,
                AMOUNT_1E18.mul(100).mul(4)
              );
              await usdcTokenContract
                .connect(trader)
                .approve(
                  traderWalletContract.address,
                  AMOUNT_1E18.mul(100).mul(4)
                );

              // mint to vault 8000
              await usdcTokenContract.mint(
                usersVaultContract.address,
                AMOUNT_1E18.mul(100).mul(10).mul(8)
              );

              // contractBalanceBefore = await usdcTokenContract.balanceOf(
              //   traderWalletContract.address
              // );
              // let vaultBalanceBefore = await usdcTokenContract.balanceOf(
              //   usersVaultContract.address
              // );
              // traderBalanceBefore = await usdcTokenContract.balanceOf(
              //   traderAddress
              // );

              await traderWalletContract
                .connect(trader)
                .traderDeposit(AMOUNT_1E18.mul(100).mul(4));
            });

            it("THEN before rollover all round balance variables should be ZERO", async () => {
              expect(
                await traderWalletContract.afterRoundVaultBalance()
              ).to.equal(ZERO_AMOUNT);
              expect(
                await traderWalletContract.afterRoundTraderBalance()
              ).to.equal(ZERO_AMOUNT);
              expect(
                await traderWalletContract.initialTraderBalance()
              ).to.equal(ZERO_AMOUNT);
              expect(await traderWalletContract.initialVaultBalance()).to.equal(
                ZERO_AMOUNT
              );
            });

            describe("WHEN rollover on users vault succeed", function () {
              before(async () => {
                // for rollover return ok
                await usersVaultContract.setReturnValue(true);
                // increase users vault round
                await usersVaultContract.setRound(1);
                // set the return value for vault
                await usersVaultContract.setLiquidity(
                  AMOUNT_1E18.mul(100).mul(10).mul(8)
                );

                txResult = await traderWalletContract
                  .connect(trader)
                  .rollover();
              });

              it("THEN after rollover afterRoundTraderBalance/afterRoundVaultBalance should be plain underlying balances", async () => {
                expect(
                  await traderWalletContract.afterRoundVaultBalance()
                ).to.equal(AMOUNT_1E18.mul(100).mul(10).mul(8));
                expect(
                  await traderWalletContract.afterRoundTraderBalance()
                ).to.equal(AMOUNT_1E18.mul(100).mul(4));
              });
              it("THEN after rollover initialVaultBalance/initialTraderBalance should be plain underlying balances", async () => {
                expect(
                  await traderWalletContract.initialVaultBalance()
                ).to.equal(AMOUNT_1E18.mul(100).mul(10).mul(8));
                expect(
                  await traderWalletContract.initialTraderBalance()
                ).to.equal(AMOUNT_1E18.mul(100).mul(4));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult).to.emit(
                  traderWalletContract,
                  "RolloverExecuted"
                );
                // .withArgs(BLOCK TIME STAMP, 0);
              });
              it("THEN currentRound should be increased", async () => {
                expect(await traderWalletContract.currentRound()).to.equal(1);
              });
              it("THEN cumulativePendingDeposits/traderProfit/vaultProfit should be ZERO", async () => {
                expect(
                  await traderWalletContract.cumulativePendingDeposits()
                ).to.equal(ZERO_AMOUNT);
                expect(await traderWalletContract.traderProfit()).to.equal(
                  ZERO_AMOUNT
                );
                expect(await traderWalletContract.vaultProfit()).to.equal(
                  ZERO_AMOUNT
                );
              });
              it("THEN ratio should be the expected one", async () => {
                const expectedRatio = AMOUNT_1E18.mul(100)
                  .mul(10)
                  .mul(8)
                  .mul(AMOUNT_1E18)
                  .div(AMOUNT_1E18.mul(100).mul(4));
                expect(await traderWalletContract.ratioProportions()).to.equal(
                  expectedRatio
                );
              });
            });
          });
        });


        /// UPGRADABILITY TESTS
        /// UPGRADABILITY TESTS
        /// UPGRADABILITY TESTS
        /// UPGRADABILITY TESTS
        describe("WHEN trying to UPGRADE the contract", async () => {
          let TraderWalletV2Factory: ContractFactory;
          let traderWalletV2Contract: TraderWalletV2;
          before(async () => {
            TraderWalletV2Factory = await ethers.getContractFactory(
              "TraderWalletV2",
              {
                libraries: {
                  GMXAdapter: gmxAdapterContract.address,
                },
              }
            );
            traderWalletV2Contract = (await upgrades.upgradeProxy(
              traderWalletContract.address,
              TraderWalletV2Factory,
              { unsafeAllowLinkedLibraries: true }
            )) as TraderWalletV2;
            await traderWalletV2Contract.deployed();
          });
          it("THEN it should maintain previous storage", async () => {
            expect(await traderWalletV2Contract.vaultAddress()).to.equal(
              usersVaultContract.address
            );
            expect(
              await traderWalletV2Contract.underlyingTokenAddress()
            ).to.equal(underlyingTokenAddress);
            expect(
              await traderWalletV2Contract.adaptersRegistryAddress()
            ).to.equal(adaptersRegistryContract.address);
            expect(
              await traderWalletV2Contract.contractsFactoryAddress()
            ).to.equal(contractsFactoryContract.address);
            expect(await traderWalletV2Contract.traderAddress()).to.equal(
              traderAddress
            );
            expect(await traderWalletV2Contract.dynamicValueAddress()).to.equal(
              dynamicValueAddress
            );
            expect(await traderWalletV2Contract.owner()).to.equal(ownerAddress);
          });

          it("THEN it should contains the new function to set the added variable", async () => {
            await traderWalletV2Contract.addedMethod(AMOUNT_1E18.mul(100));

            expect(await traderWalletV2Contract.addedVariable()).to.equal(
              AMOUNT_1E18.mul(100)
            );
          });
        });
      });
    });
  });
});
