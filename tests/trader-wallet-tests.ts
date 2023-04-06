import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
} from "ethers";
import { expect } from "chai";
import Reverter from "./helpers/reverter";
import {
  TraderWallet,
  ContractsFactory,
  AdaptersRegistry,
  AdapterOperations,
  UserVault,
  ERC20Mock,
} from "../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_100,
} from "./helpers/constants";

const reverter = new Reverter();

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
let contractsFactoryAddress: string;
let traderAddress: string;
let dynamicValueAddress: string;
let nonAuthorizedAddress: string;
let otherAddress: string;
let ownerAddress: string;

let txResult: ContractTransaction;
let TraderWalletFactory: ContractFactory;
let traderWalletContract: TraderWallet;
let usdcTokenContract: ERC20Mock;
let contractBalanceBefore: BigNumber;
let contractBalanceAfter: BigNumber;
let traderBalanceBefore: BigNumber;
let traderBalanceAfter: BigNumber;

const addProtocolsToUse = async (
  _contract: TraderWallet,
  _signer: Signer,
  _baseProtocolID: BigNumber,
  _loopQty: Number
) => {
  for (let i = 0; i < _loopQty; i++) {
    await _contract.connect(_signer).addProtocolToUse(_baseProtocolID.add(i));
  }
};

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

    [
      deployer,
      vault,
      trader,
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
      adaptersRegistryAddress,
      contractsFactoryAddress,
      dynamicValueAddress,
      nonAuthorizedAddress,
      otherAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      vault.getAddress(),
      trader.getAddress(),
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

      describe("WHEN trying to deploy TraderWallet contract with invalid parameters", function () {
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_vaultAddress");
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_underlyingTokenAddress");
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_adaptersRegistryAddress");
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_contractsFactoryAddress");
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_traderAddress");
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
          )
            .to.be.revertedWithCustomError(TraderWalletFactory, "ZeroAddrees")
            .withArgs("_dynamicValueAddress");
        });
      });

      describe("WHEN trying to deploy TraderWallet contract with correct parameters", function () {
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

          // mint to trader
          await usdcTokenContract.mint(traderAddress, AMOUNT_100);
          await usdcTokenContract
            .connect(trader)
            .approve(traderWalletContract.address, AMOUNT_100);

          contractBalanceBefore = await usdcTokenContract.balanceOf(
            traderWalletContract.address
          );
          traderBalanceBefore = await usdcTokenContract.balanceOf(
            traderAddress
          );

          // take a snapshot
          await reverter.snapshot();
        });

        it("THEN it should return the same ones after deployment", async () => {
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
                    "ZeroAddrees"
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
                    "ZeroAddrees"
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
                    "ZeroAddrees"
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
                    "ZeroAddrees"
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
                    "ZeroAddrees"
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
                    "ZeroAddrees"
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
                  "NewTraderNotAllowed"
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
            await traderWalletContract
              .connect(owner)
              .setAdaptersRegistryAddress(adaptersRegistryContract.address);
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
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "CallerNotAllowed"
                  );
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
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidProtocolID"
                  );
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
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidProtocolID"
                  );
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
              // 10 is already added from previous flow (addProtocolToUse)
              // to add 11-12-13
              await addProtocolsToUse(
                traderWalletContract,
                trader,
                PROTOCOL_ID.add(1),
                3
              );
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
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "CallerNotAllowed"
                  );
                });
              });
              describe("WHEN protocolID does not exist in array", function () {
                it("THEN it should fail", async () => {
                  await expect(
                    traderWalletContract
                      .connect(trader)
                      .removeProtocolToUse(PROTOCOL_ID.sub(1))
                  ).to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidProtocolID"
                  );
                });
              });
            });

            describe("WHEN calling with correct caller and address", function () {
              before(async () => {
                txResult = await traderWalletContract
                  .connect(trader)
                  .removeProtocolToUse(PROTOCOL_ID.add(2));
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

        describe("WHEN trying to make a depositRequest", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .depositRequest(underlyingTokenAddress, AMOUNT_100)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });

            describe("WHEN Token is not the underlying", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .depositRequest(otherAddress, AMOUNT_100)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "UnderlyingAssetNotAllowed"
                );
              });
            });

            describe("WHEN amount is ZERO", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .depositRequest(underlyingTokenAddress, ZERO_AMOUNT)
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
                await reverter.revert();
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .depositRequest(underlyingTokenAddress, AMOUNT_100)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "TokenTransferFailed"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and amount", function () {
            const AMOUNT = AMOUNT_100.div(2);

            before(async () => {
              txResult = await traderWalletContract
                .connect(trader)
                .depositRequest(underlyingTokenAddress, AMOUNT);
            });
            after(async () => {
              await reverter.revert();
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
                .to.emit(traderWalletContract, "DepositRequest")
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
                  .depositRequest(underlyingTokenAddress, AMOUNT);
              });

              it("THEN contract should return correct vaules", async () => {
                expect(
                  await traderWalletContract.getCumulativePendingDeposits()
                ).to.equal(AMOUNT_100);
                expect(
                  await traderWalletContract.cumulativePendingDeposits()
                ).to.equal(AMOUNT_100);
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "DepositRequest")
                  .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
              });
              it("THEN contract balance should increase", async () => {
                contractBalanceAfter = await usdcTokenContract.balanceOf(
                  traderWalletContract.address
                );
                expect(contractBalanceAfter).to.equal(
                  contractBalanceBefore.add(AMOUNT_100)
                );
              });
              it("THEN trader balance should decrease", async () => {
                traderBalanceAfter = await usdcTokenContract.balanceOf(
                  traderAddress
                );
                expect(traderBalanceAfter).to.equal(
                  traderBalanceBefore.sub(AMOUNT_100)
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
                    .withdrawRequest(underlyingTokenAddress, AMOUNT_100)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
              });
            });

            describe("WHEN Token is not the underlying", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .withdrawRequest(otherAddress, AMOUNT_100)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "UnderlyingAssetNotAllowed"
                );
              });
            });

            describe("WHEN amount is ZERO", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .withdrawRequest(underlyingTokenAddress, ZERO_AMOUNT)
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "ZeroAmount"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and amount", function () {
            const AMOUNT = AMOUNT_100.div(2);

            before(async () => {
              txResult = await traderWalletContract
                .connect(trader)
                .withdrawRequest(underlyingTokenAddress, AMOUNT);
            });
            after(async () => {
              await reverter.revert();
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
                .to.emit(traderWalletContract, "WithdrawalRequest")
                .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
            });

            describe("WHEN calling again with correct caller and amount", function () {
              before(async () => {
                txResult = await traderWalletContract
                  .connect(trader)
                  .withdrawRequest(underlyingTokenAddress, AMOUNT);
              });

              it("THEN contract should return correct vaules", async () => {
                expect(
                  await traderWalletContract.getCumulativePendingWithdrawals()
                ).to.equal(AMOUNT_100);
                expect(
                  await traderWalletContract.cumulativePendingWithdrawals()
                ).to.equal(AMOUNT_100);
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "WithdrawalRequest")
                  .withArgs(traderAddress, underlyingTokenAddress, AMOUNT);
              });
            });
          });
        });

        describe("WHEN trying to make an executeOnAdapter call", async () => {
          let AdaptersRegistryFactory: ContractFactory;
          let adaptersRegistryContract: AdaptersRegistry;
          let AdapterOperationsFactory: ContractFactory;
          let adapterOperationsContract: AdapterOperations;

          const traderOperation = {
            _operationId: 10,
            _data: ethers.utils.hexlify("0x1234"),
          };

          const parameters = [
            {
              _order: BigNumber.from(0),
              _type: utils.formatBytes32String("address"),
              _value: String(otherAddress),
            },
            {
              _order: BigNumber.from(1),
              _type: utils.formatBytes32String("uint256"),
              // _value: "1000000000000000000",
              _value: ethers.utils.parseUnits("100", "ether").toString(),
            },
            {
              _order: BigNumber.from(2),
              _type: utils.formatBytes32String("uint256"),
              // _value: "2000000000000000000",
              _value: ethers.utils.parseUnits("200", "ether").toString(),
            },
            {
              _order: BigNumber.from(3),
              _type: utils.formatBytes32String("uint256"),
              // _value: "3000000000000000000",
              _value: ethers.utils.parseUnits("300", "ether").toString(),
            },
          ];

          const parametersToScale = [
            {
              _order: BigNumber.from(1),
              _type: utils.formatBytes32String("uint256"),
              // _value: "1000000000000000000",
              _value: ethers.utils.parseUnits("100", "ether").toString(),
            },
            {
              _order:BigNumber.from(3),
              _type: utils.formatBytes32String("uint256"),
              // _value: "3000000000000000000",
              _value: ethers.utils.parseUnits("300", "ether").toString(),
            },
          ];

          const PROTOCOL_ID = BigNumber.from(10);

          before(async () => {
            // deploy mocked adaptersRegistry
            AdaptersRegistryFactory = await ethers.getContractFactory(
              "AdaptersRegistry"
            );
            adaptersRegistryContract =
              (await AdaptersRegistryFactory.deploy()) as AdaptersRegistry;
            await adaptersRegistryContract.deployed();

            // deploy mocked adapterOperations
            AdapterOperationsFactory = await ethers.getContractFactory(
              "AdapterOperations"
            );
            adapterOperationsContract =
              (await AdapterOperationsFactory.deploy()) as AdapterOperations;
            await adapterOperationsContract.deployed();

            // change address to mocked adaptersRegistry
            await traderWalletContract
              .connect(owner)
              .setAdaptersRegistryAddress(adaptersRegistryContract.address);
          });

          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not trader", function () {
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(nonAuthorized)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      false
                    )
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "CallerNotAllowed"
                );
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
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      false
                    )
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "InvalidProtocolID"
                );
              });
            });
            describe("WHEN protocolID exists but adapter is not allowed", function () {
              before(async () => {
                // change returnAddress to return an address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return false on function call
                await adaptersRegistryContract.setReturnValue(false);
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      false
                    )
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "InvalidProtocolID"
                );
              });
            });
            describe("WHEN protocolID exists, adapter is allowed but operation is not allowed", function () {
              before(async () => {
                // change returnAddress to return the adapter address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return true on function call on registry contract
                await adaptersRegistryContract.setReturnValue(true);

                // change returnValue to return true on function call on registry contract
                await adapterOperationsContract.setOperationAllowedReturn(
                  false
                );
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      false
                    )
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "InvalidOperation"
                  )
                  .withArgs("_traderOperationStruct");
              });
            });
            describe("WHEN protocolID exists, adapter is allowed, operation is allowed but execution fails", function () {
              before(async () => {
                // change returnAddress to return the adapter address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return true on function call on registry contract
                await adaptersRegistryContract.setReturnValue(true);

                // change returnValue to return true on function call on allowed operation
                await adapterOperationsContract.setOperationAllowedReturn(true);

                // change returnValue to return false on function call on result of execute on adapter
                await adapterOperationsContract.setExecuteOperationReturn(
                  false
                );
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      false
                    )
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AdapterOperationFailed"
                  )
                  .withArgs("trader");
              });
            });
            describe("WHEN all parameters are ok, replication is needed but adapter returns an empty array to scale", function () {
              before(async () => {
                // change returnAddress to return the adapter address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return true on function call on registry contract
                await adaptersRegistryContract.setReturnValue(true);

                // change returnValue to return true on function call on allowed operation
                await adapterOperationsContract.setOperationAllowedReturn(true);

                // change returnValue to return false on function call on result of execute on adapter
                await adapterOperationsContract.setExecuteOperationReturn(true);

                // change returnValue to return desired parameters to scale
                await adapterOperationsContract.setReturnParameters(
                  parametersToScale,
                  true
                );
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      true
                    )
                ).to.be.revertedWithCustomError(
                  traderWalletContract,
                  "NothingToScale"
                );
              });
            });
            describe("WHEN all parameters are ok, replication is needed and adapter returns a non empty array", function () {
              before(async () => {
                // change returnAddress to return the adapter address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return true on function call on registry contract
                await adaptersRegistryContract.setReturnValue(true);

                // change returnValue to return true on function call on allowed operation
                await adapterOperationsContract.setOperationAllowedReturn(true);

                // change returnValue to return false on function call on result of execute on adapter
                await adapterOperationsContract.setExecuteOperationReturn(true);

                // change returnValue to return desired parameters to scale
                await adapterOperationsContract.setReturnParameters(
                  parametersToScale,
                  false
                );

                txResult = await traderWalletContract
                .connect(trader)
                .executeOnAdapter(
                  PROTOCOL_ID,
                  traderOperation,
                  parameters,
                  false
                )
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(traderWalletContract, "OperationExecuted")
                  // .withArgs(PROTOCOL_ID,  { _timestamp: undefined } as any, "trader wallet", false, { _initialBalance: undefined } as any );
              });

              
            });
            xdescribe("WHEN trader tx succeed but user vault fails", function () {
              let UserVaultFactory: ContractFactory;
              let userVaultContract: UserVault;
              const PROTOCOL_ID = BigNumber.from(10);

              before(async () => {
                // change returnAddress to return the adapter address on function call
                await adaptersRegistryContract.setReturnAddress(
                  adapterOperationsContract.address
                );

                // change returnValue to return true on function call on registry contract
                await adaptersRegistryContract.setReturnValue(true);

                // change returnValue to return true on function call on allowed operation
                await adapterOperationsContract.setOperationAllowedReturn(true);

                // change returnValue to return false on function call on result of execute on adapter
                await adapterOperationsContract.setExecuteOperationReturn(true);

                // deploy mocked User Vault
                UserVaultFactory = await ethers.getContractFactory("UserVault");
                userVaultContract =
                  (await UserVaultFactory.deploy()) as UserVault;
                await userVaultContract.deployed();

                // change address to mocked vault address
                await traderWalletContract
                  .connect(owner)
                  .setVaultAddress(userVaultContract.address);

                await userVaultContract.setExecuteOnAdapter(false);

                // add 10-11-12
                await addProtocolsToUse(
                  traderWalletContract,
                  trader,
                  PROTOCOL_ID,
                  3
                );
              });
              it("THEN it should fail", async () => {
                await expect(
                  traderWalletContract
                    .connect(trader)
                    .executeOnAdapter(
                      PROTOCOL_ID,
                      traderOperation,
                      parameters,
                      true
                    )
                )
                  .to.be.revertedWithCustomError(
                    traderWalletContract,
                    "AdapterOperationFailed"
                  )
                  .withArgs("user");
              });
            });
          });
        });
      });
    });
  });
});
