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
  UsersVaultDeployer,
  UsersVault,
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
let trader: Signer;
let dynamicValue: Signer;
let nonAuthorized: Signer;
let otherSigner: Signer;
let owner: Signer;

let deployerAddress: string;
let underlyingTokenAddress: string;
let traderAddress: string;
let dynamicValueAddress: string;
let traderWalletAddress: string;
let usersVaultAddress: string;
let nonAuthorizedAddress: string;
let otherAddress: string;
let ownerAddress: string;

let txResult: ContractTransaction;
let txReceipt: ContractReceipt;

let TraderWalletDeployerFactory: ContractFactory;
let traderWalletDeployerContract: TraderWalletDeployer;
let UsersVaultDeployerFactory: ContractFactory;
let usersVaultDeployerContract: UsersVaultDeployer;
let ContractsFactoryFactory: ContractFactory;
let contractsFactoryContract: ContractsFactory;
let traderWalletContract: TraderWallet;
let usersVaultContract: UsersVault;
let usdcTokenContract: ERC20Mock;
let adaptersRegistryContract: AdaptersRegistryMock;
let feeRate: BigNumber = BigNumber.from(30);

describe("ContractsFactory Tests", function () {
  this.timeout(TEST_TIMEOUT);

  before(async () => {
    [deployer, trader, dynamicValue, nonAuthorized, otherSigner, owner] =
      await ethers.getSigners();
    [
      deployerAddress,
      traderAddress,
      dynamicValueAddress,
      nonAuthorizedAddress,
      otherAddress,
      ownerAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      trader.getAddress(),
      dynamicValue.getAddress(),
      nonAuthorized.getAddress(),
      otherSigner.getAddress(),
      owner.getAddress(),
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

    // Deploy Library
    UsersVaultDeployerFactory = await ethers.getContractFactory(
      "UsersVaultDeployer"
    );
    usersVaultDeployerContract =
      (await UsersVaultDeployerFactory.deploy()) as UsersVaultDeployer;
    await usersVaultDeployerContract.deployed();

    ContractsFactoryFactory = await ethers.getContractFactory(
      "ContractsFactory",
      {
        libraries: {
          TraderWalletDeployer: traderWalletDeployerContract.address,
          UsersVaultDeployer: usersVaultDeployerContract.address,
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

        describe("WHEN trying to add an investor", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .addInvestor(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .addInvestor(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_investorAddress");
              });
            });
          });
          describe("WHEN calling with correct caller and parameter", function () {
            before(async () => {
              txResult = await contractsFactoryContract
                .connect(owner)
                .addInvestor(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN investorsAllowList should contain new investor", async () => {
              expect(
                await contractsFactoryContract.investorsAllowList(otherAddress)
              ).to.be.true;
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "InvestorAdded")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to remove an investor", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .removeInvestor(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .removeInvestor(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_investorAddress");
              });
            });
            describe("WHEN investor is not present", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .removeInvestor(otherAddress)
                ).to.be.revertedWithCustomError(
                  contractsFactoryContract,
                  "InvestorNotExists"
                );
              });
            });
          });
          describe("WHEN calling with correct caller and parameter", function () {
            before(async () => {
              // add an investor to delete it afterwards
              await contractsFactoryContract
                .connect(owner)
                .addInvestor(otherAddress);

              txResult = await contractsFactoryContract
                .connect(owner)
                .removeInvestor(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN investorsAllowList should NOT contain removed investor", async () => {
              expect(
                await contractsFactoryContract.investorsAllowList(otherAddress)
              ).to.be.false;
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "InvestorRemoved")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to add a trader", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .addTrader(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .addTrader(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_traderAddress");
              });
            });
          });
          describe("WHEN calling with correct caller and parameter", function () {
            before(async () => {
              txResult = await contractsFactoryContract
                .connect(owner)
                .addTrader(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN investorsAllowList should contain new investor", async () => {
              expect(
                await contractsFactoryContract.tradersAllowList(otherAddress)
              ).to.be.true;
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "TraderAdded")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to remove a trader", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(nonAuthorized)
                    .removeTrader(otherAddress)
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });

            describe("WHEN address is invalid", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .removeTrader(ZERO_ADDRESS)
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_traderAddress");
              });
            });
            describe("WHEN trader is not present", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(owner)
                    .removeTrader(otherAddress)
                ).to.be.revertedWithCustomError(
                  contractsFactoryContract,
                  "TraderNotExists"
                );
              });
            });
          });
          describe("WHEN calling with correct caller and parameter", function () {
            before(async () => {
              // add a trader to delete it afterwards
              await contractsFactoryContract
                .connect(owner)
                .addTrader(otherAddress);

              txResult = await contractsFactoryContract
                .connect(owner)
                .removeTrader(otherAddress);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN tradersAllowList should NOT contain removed trader", async () => {
              expect(
                await contractsFactoryContract.tradersAllowList(otherAddress)
              ).to.be.false;
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "TraderRemoved")
                .withArgs(otherAddress);
            });
          });
        });

        describe("WHEN trying to create a trader wallet", async () => {
          describe("WHEN calling with incorrect caller and parameter", function () {
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
                  otherAddress,
                  ownerAddress
                );
            });
            after(async () => {
              await snapshot.restore();
            });

            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(otherSigner)
                    .deployTraderWallet(
                      usdcTokenContract.address,
                      traderAddress,
                      otherAddress,
                      ownerAddress
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });
            describe("WHEN _underlyingTokenAddress is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployTraderWallet(
                      ZERO_ADDRESS,
                      traderAddress,
                      otherAddress,
                      ownerAddress
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_underlyingTokenAddress");
              });
            });
            describe("WHEN _traderAddress is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployTraderWallet(
                      usdcTokenContract.address,
                      ZERO_ADDRESS,
                      otherAddress,
                      ownerAddress
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_traderAddress");
              });
            });
            describe("WHEN _dynamicValueAddress address is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployTraderWallet(
                      usdcTokenContract.address,
                      traderAddress,
                      ZERO_ADDRESS,
                      ownerAddress
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_dynamicValueAddress");
              });
            });
            describe("WHEN _owner address is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployTraderWallet(
                      usdcTokenContract.address,
                      traderAddress,
                      otherAddress,
                      ZERO_ADDRESS
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_owner");
              });
            });
          });

          describe("WHEN calling with correct caller and parameter", function () {
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
                  otherAddress,
                  ownerAddress
                );

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

            it("THEN Trader Wallet contract should be deployed with correct parameters", async () => {
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
              expect(await traderWalletContract.owner()).to.equal(ownerAddress);

              expect(
                await traderWalletContract.cumulativePendingDeposits()
              ).to.equal(ZERO_AMOUNT);
              expect(
                await traderWalletContract.cumulativePendingWithdrawals()
              ).to.equal(ZERO_AMOUNT);
            });

            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "TraderWalletDeployed")
                .withArgs(
                  traderWalletAddress,
                  ownerAddress,
                  usdcTokenContract.address
                );
            });

            it("THEN underlyingPerDeployedWallet mapping on factory should have the new wallet", async () => {
              expect(
                await contractsFactoryContract.underlyingPerDeployedWallet(
                  traderWalletContract.address
                )
              ).to.equal(underlyingTokenAddress);
            });

            describe("WHEN transfering ownership on traderWallet contract", function () {
              before(async () => {
                await traderWalletContract
                  .connect(owner)
                  .transferOwnership(otherAddress);
              });
              it("THEN it should return the correct owner", async () => {
                expect(await traderWalletContract.owner()).to.equal(
                  otherAddress
                );
              });
            });
          });
        });

        describe("WHEN trying to create a users vault", async () => {
          const SHARES_NAME = "USV";
          const SHARES_SYMBOL = "USV";

          before(async () => {
            // set adapters registry on factory to deploy wallet and vault
            await contractsFactoryContract.setAdaptersRegistryAddress(
              adaptersRegistryContract.address
            );

            await contractsFactoryContract
              .connect(deployer)
              .deployTraderWallet(
                usdcTokenContract.address,
                traderAddress,
                otherAddress,
                ownerAddress
              );

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

          describe("WHEN calling with incorrect caller and parameter", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(otherSigner)
                    .deployUsersVault(
                      traderWalletAddress,
                      ownerAddress,
                      SHARES_NAME,
                      SHARES_SYMBOL
                    )
                ).to.be.revertedWith("Ownable: caller is not the owner");
              });
            });
            describe("WHEN _traderWalletAddress is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployUsersVault(
                      ZERO_ADDRESS,
                      ownerAddress,
                      SHARES_NAME,
                      SHARES_SYMBOL
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_traderWalletAddress");
              });
            });
            describe("WHEN _owner address is zero address", function () {
              it("THEN it should fail", async () => {
                await expect(
                  contractsFactoryContract
                    .connect(deployer)
                    .deployUsersVault(
                      usdcTokenContract.address,
                      ZERO_ADDRESS,
                      SHARES_NAME,
                      SHARES_SYMBOL
                    )
                )
                  .to.be.revertedWithCustomError(
                    contractsFactoryContract,
                    "ZeroAddress"
                  )
                  .withArgs("_owner");
              });
            });
          });

          describe("WHEN calling with correct caller and parameter", function () {
            before(async () => {
              // set adapters registry on factory to deploy wallet and vault
              await contractsFactoryContract.setAdaptersRegistryAddress(
                adaptersRegistryContract.address
              );

              txResult = await contractsFactoryContract
                .connect(deployer)
                .deployUsersVault(
                  traderWalletAddress,
                  ownerAddress,
                  SHARES_NAME,
                  SHARES_SYMBOL
                );

              const abi = [
                "event UsersVaultDeployed(address indexed _usersVaultAddress,address indexed _traderWalletAddress, address indexed _underlyingTokenAddress, string sharesName)",
              ];
              const signature = "UsersVaultDeployed(address,address,address,string)";

              txReceipt = await txResult.wait();
              const decodedEvent = await decodeEvent(abi, signature, txReceipt);
              usersVaultAddress = decodedEvent.args._usersVaultAddress;

              usersVaultContract = (await ethers.getContractAt(
                "UsersVault",
                usersVaultAddress
              )) as UsersVault;
            });

            it("THEN UsersVault contract should be deployed with correct parameters", async () => {
              expect(await usersVaultContract.traderWalletAddress()).to.equal(
                traderWalletContract.address
              );
              expect(
                await usersVaultContract.underlyingTokenAddress()
              ).to.equal(usdcTokenContract.address);
              expect(
                await usersVaultContract.adaptersRegistryAddress()
              ).to.equal(adaptersRegistryContract.address);
              expect(
                await usersVaultContract.contractsFactoryAddress()
              ).to.equal(contractsFactoryContract.address);
              
              expect(await usersVaultContract.owner()).to.equal(ownerAddress);

              expect(
                await usersVaultContract.pendingDepositAssets()
              ).to.equal(ZERO_AMOUNT);
              expect(
                await usersVaultContract.pendingWithdrawShares()
              ).to.equal(ZERO_AMOUNT);
            });

            xit("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(contractsFactoryContract, "UsersVaultDeployed")
                .withArgs(
                  usersVaultAddress,
                  ownerAddress,
                  usdcTokenContract.address,
                  SHARES_NAME
                );
            });

             it("THEN walletPerDeployedVault mapping on factory should have the new vault", async () => {
              expect(
                await contractsFactoryContract.walletPerDeployedVault(
                  usersVaultAddress
                )
              ).to.equal(traderWalletContract.address);
            });

            describe("WHEN transfering ownership on usersVault contract", function () {
              before(async () => {
                await usersVaultContract
                  .connect(owner)
                  .transferOwnership(otherAddress);
              });
              it("THEN it should return the correct owner", async () => {
                expect(await usersVaultContract.owner()).to.equal(
                  otherAddress
                );
              });
            });
          });
        });
      });
    });
  });
});
