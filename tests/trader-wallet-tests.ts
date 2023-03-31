import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  ContractReceipt,
} from "ethers";
import { expect } from "chai";
import Reverter from "./helpers/reverter";
import {
  TraderWallet,
  ContractsFactory,
  AdaptersRegistry,
} from "../typechain-types";
import { TEST_TIMEOUT, ZERO_AMOUNT, ZERO_ADDRESS } from "./helpers/constants";

const reverter = new Reverter();

let deployer: Signer;
let vault: Signer;
let trader: Signer;
let underlyingToken: Signer;
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
let contractsFactoryAddress: string;
let traderAddress: string;
let dynamicValueAddress: string;
let nonAuthorizedAddress: string;
let otherAddress: string;
let ownerAddress: string;

let txResult: ContractTransaction;
let TraderWalletFactory: ContractFactory;
let traderWalletContract: TraderWallet;

describe("Trader Wallet Contract Tests", function () {
  this.timeout(TEST_TIMEOUT);

  before(async () => {
    [
      deployer,
      vault,
      trader,
      underlyingToken,
      adaptersRegistry,
      contractsFactory,
      dynamicValue,
      nonAuthorized,
      otherSigner,
    ] = await ethers.getSigners();

    [
      deployerAddress,
      vaultAddress,
      traderAddress,
      underlyingTokenAddress,
      adaptersRegistryAddress,
      contractsFactoryAddress,
      dynamicValueAddress,
      nonAuthorizedAddress,
      otherAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      vault.getAddress(),
      trader.getAddress(),
      underlyingToken.getAddress(),
      adaptersRegistry.getAddress(),
      contractsFactory.getAddress(),
      dynamicValue.getAddress(),
      nonAuthorized.getAddress(),
      otherSigner.getAddress(),
    ]);
  });

  describe("Asset Token Deployment Tests", function () {
    describe("GIVEN a Trader Wallet Factory", function () {
      before(async () => {
        TraderWalletFactory = await ethers.getContractFactory("TraderWallet");

        owner = deployer;
        ownerAddress = deployerAddress;
      });

      describe("WHEN trying to deploy with invalid parameters", function () {
        it("THEN it should FAIL when _vaultAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              ZERO_ADDRESS,
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderAddress,
              dynamicValueAddress,
            ])
          ).to.revertedWith("INVALID address _vaultAddress");
        });

        it("THEN it should FAIL when _underlyingTokenAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              vaultAddress,
              ZERO_ADDRESS,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderAddress,
              dynamicValueAddress,
            ])
          ).to.revertedWith("INVALID address _underlyingTokenAddress");
        });

        it("THEN it should FAIL when _adaptersRegistryAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              vaultAddress,
              underlyingTokenAddress,
              ZERO_ADDRESS,
              contractsFactoryAddress,
              traderAddress,
              dynamicValueAddress,
            ])
          ).to.revertedWith("INVALID address _adaptersRegistryAddress");
        });

        it("THEN it should FAIL when _contractsFactoryAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              vaultAddress,
              underlyingTokenAddress,
              adaptersRegistryAddress,
              ZERO_ADDRESS,
              traderAddress,
              dynamicValueAddress,
            ])
          ).to.revertedWith("INVALID address _contractsFactoryAddress");
        });

        it("THEN it should FAIL when _traderAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              vaultAddress,
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              ZERO_ADDRESS,
              dynamicValueAddress,
            ])
          ).to.revertedWith("INVALID address _traderAddress");
        });

        it("THEN it should FAIL when _dynamicValueAddress is ZERO", async () => {
          await expect(
            upgrades.deployProxy(TraderWalletFactory, [
              vaultAddress,
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderAddress,
              ZERO_ADDRESS,
            ])
          ).to.revertedWith("INVALID address _dynamicValueAddress");
        });
      });

      describe("WHEN trying to deploy with correct parameters", function () {
        before(async () => {
          traderWalletContract = (await upgrades.deployProxy(
            TraderWalletFactory,
            [
              vaultAddress,
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderAddress,
              dynamicValueAddress,
            ]
          )) as TraderWallet;
          await traderWalletContract.deployed();

          await reverter.snapshot();
        });

        it("THEN it should return the same ones after depployment", async () => {
          expect(await traderWalletContract.vaultAddress()).to.equal(
            vaultAddress
          );
          expect(await traderWalletContract.underlyingTokenAddress()).to.equal(
            underlyingTokenAddress
          );
          expect(await traderWalletContract.adaptersRegistryAddress()).to.equal(
            adaptersRegistryAddress
          );
          expect(await traderWalletContract.contractsFactoryAddress()).to.equal(
            contractsFactoryAddress
          );
          expect(await traderWalletContract.traderAddress()).to.equal(
            traderAddress
          );
          expect(await traderWalletContract.dynamicValueAddress()).to.equal(
            dynamicValueAddress
          );
          expect(await traderWalletContract.owner()).to.equal(ownerAddress);
          expect(await traderWalletContract.owner()).to.equal(ownerAddress);

          expect(await traderWalletContract.traderFee()).to.equal(ZERO_AMOUNT);
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
                    "AddressZero"
                  )
                  .withArgs("_vaultAddress");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              txResult = await traderWalletContract
                .connect(owner)
                .setVaultAddress(otherAddress);
            });
            after(async () => {
              await reverter.revert();
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
                    "AddressZero"
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
              await reverter.revert();
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
                    "AddressZero"
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
              await reverter.revert();
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
                    "AddressZero"
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
              await reverter.revert();
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
                ).to.be.revertedWith("Caller not allowed");
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
                    "AddressZero"
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
              await reverter.revert();
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
          let contractsFactoryContract: ContractsFactory;

          before(async () => {
            // deploy mocked factory
            FactoryOfContractsFactory = await ethers.getContractFactory(
              "ContractsFactory"
            );
            contractsFactoryContract =
              (await FactoryOfContractsFactory.deploy()) as ContractsFactory;
            await contractsFactoryContract.deployed();

            // change address to mocked factory
            await (
              await traderWalletContract
                .connect(owner)
                .setContractsFactoryAddress(contractsFactoryContract.address)
            ).wait();
          });
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .setTraderAddress(otherAddress)
                ).to.be.revertedWith("Caller not allowed");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .setTraderAddress(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AddressZero"
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
                    .connect(trader)
                    .setTraderAddress(otherAddress)
                ).to.be.revertedWith("New trader is not allowed");
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              // change returnValue to return true on function call
              await contractsFactoryContract.setReturnValue(true);

              txResult = await traderWalletContract
                .connect(trader)
                .setTraderAddress(otherAddress);
            });
            after(async () => {
              await reverter.revert();
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

        describe("WHEN trying to add/remove protocol id to traderSelectedProtocols array", async () => {
          let AdaptersRegistryFactory: ContractFactory;
          let adaptersRegistryContract: AdaptersRegistry;
          const PROTOCOL_ID = BigNumber.from(10);

          before(async () => {
            // deploy mocked adaptersRegistry
            AdaptersRegistryFactory = await ethers.getContractFactory(
              "AdaptersRegistry"
            );
            adaptersRegistryContract =
              (await AdaptersRegistryFactory.deploy()) as AdaptersRegistry;
            await adaptersRegistryContract.deployed();

            // change address to mocked adaptersRegistry
            await (
              await traderWalletContract
                .connect(owner)
                .setAdaptersRegistryAddress(adaptersRegistryContract.address)
            ).wait();
          });
          after(async () => {
            await reverter.revert();
          });

          describe("WHEN trying to add a protocol to use (addProtocolToUse)", async () => {
            describe("WHEN calling with invalid caller or parameters", function () {
              describe("WHEN caller is not trader", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(nonAuthorized)
                      .addProtocolToUse(PROTOCOL_ID)
                  ).to.be.revertedWith("Caller not allowed");
                });
              });

              describe("WHEN protocolID does not exist in registry", function () {
                before(async () => {
                  // change returnAddress to return address(0) on function call
                  await adaptersRegistryContract.setReturnAddress(ZERO_ADDRESS);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(trader)
                      .addProtocolToUse(PROTOCOL_ID)
                  ).to.be.revertedWith("Invalid Protocol ID");
                });
              });
              describe("WHEN protocolID exists but adapter is not allowed", function () {
                before(async () => {
                  // change returnAddress to return an address on function call
                  await adaptersRegistryContract.setReturnAddress(otherAddress);

                  // change returnValue to return false on function call
                  await adaptersRegistryContract.setReturnValue(false);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(trader)
                      .addProtocolToUse(PROTOCOL_ID)
                  ).to.be.revertedWith("Invalid Protocol ID");
                });
              });
            });

            describe("WHEN calling with correct caller and address", function () {
              before(async () => {
                // change returnAddress to return an address on function call
                await adaptersRegistryContract.setReturnAddress(otherAddress);

                // change returnValue to return true on function call
                await adaptersRegistryContract.setReturnValue(true);

                txResult = await traderWalletContract
                  .connect(trader)
                  .addProtocolToUse(PROTOCOL_ID);
              });

              it("THEN new protocol id should be added to array", async () => {
                expect(
                  await traderWalletContract.traderSelectedProtocols(0)
                ).to.equal(PROTOCOL_ID);
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "ProtocolToUseAdded")
                  .withArgs(PROTOCOL_ID, traderAddress);
              });
            });
          });

          describe("WHEN trying to remove a protocol (removeProtocolToUse)", async () => {
            before(async () => {
              // add more protocols to array
              // 10 is already added from previous flow (addProtocolToUse)
              await traderWalletContract
                .connect(trader)
                .addProtocolToUse(PROTOCOL_ID.add(1));
              await traderWalletContract
                .connect(trader)
                .addProtocolToUse(PROTOCOL_ID.add(2));
              await traderWalletContract
                .connect(trader)
                .addProtocolToUse(PROTOCOL_ID.add(3));
            });

            describe("WHEN checking protocols IDs", function () {
              it("THEN it should return correct values", async () => {
                expect(
                  await traderWalletContract.traderSelectedProtocols(0)
                ).to.equal(PROTOCOL_ID);

                expect(
                  await traderWalletContract.traderSelectedProtocols(1)
                ).to.equal(PROTOCOL_ID.add(1));

                expect(
                  await traderWalletContract.traderSelectedProtocols(2)
                ).to.equal(PROTOCOL_ID.add(2));

                expect(
                  await traderWalletContract.traderSelectedProtocols(3)
                ).to.equal(PROTOCOL_ID.add(3));
              });
              it("THEN it should return correct array length", async () => {
                expect(
                  await traderWalletContract.getTraderSelectedProtocolsLength()
                ).to.equal(BigNumber.from(4));
              });
            });

            describe("WHEN calling with invalid caller or parameters", function () {
              describe("WHEN caller is not trader", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(nonAuthorized)
                      .removeProtocolToUse(PROTOCOL_ID)
                  ).to.be.revertedWith("Caller not allowed");
                });
              });
              describe("WHEN protocolID does not exist in array", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(trader)
                      .removeProtocolToUse(PROTOCOL_ID.sub(1))
                  ).to.be.revertedWith("Protocol ID not found");
                });
              });
            });

            describe("WHEN calling with correct caller and address", function () {
              before(async () => {
                txResult = await traderWalletContract
                  .connect(trader)
                  .removeProtocolToUse(PROTOCOL_ID.add(2));
              });
              after(async () => {
                await reverter.revert();
              });

              it("THEN new protocol id should be removed from array", async () => {
                expect(
                  await traderWalletContract.traderSelectedProtocols(0)
                ).to.equal(PROTOCOL_ID);

                expect(
                  await traderWalletContract.traderSelectedProtocols(1)
                ).to.equal(PROTOCOL_ID.add(1));

                expect(
                  await traderWalletContract.traderSelectedProtocols(2)
                ).to.equal(PROTOCOL_ID.add(3));
              });
              it("THEN it should return correct array length", async () => {
                expect(
                  await traderWalletContract.getTraderSelectedProtocolsLength()
                ).to.equal(BigNumber.from(3));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "ProtocolToUseRemoved")
                  .withArgs(PROTOCOL_ID.add(2), traderAddress);
              });
            });
          });
        });
      });
    });
  });
});
