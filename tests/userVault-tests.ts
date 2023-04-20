import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  Contract,
} from "ethers";
import { expect } from "chai";
import Reverter from "./_helpers/reverter";
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
  AMOUNT_1E18,
  AMOUNT_100,
} from "./_helpers/constants";

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

const SHARES_NAME = "UserVaultShares";
const SHARES_SYMBOL = "UVS";

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
      const GMXAdapterLibraryFactory = await ethers.getContractFactory(
        "GMXAdapter"
      );
      const gmxAdapterContract = await GMXAdapterLibraryFactory.deploy();
      await gmxAdapterContract.deployed();

      UsersVaultFactory = await ethers.getContractFactory("UsersVault", {
        libraries: {
          GMXAdapter: gmxAdapterContract.address,
        },
      });
      ContractsFactoryFactory = await ethers.getContractFactory(
        "ContractsFactoryMock"
      );

      owner = deployer;
      ownerAddress = deployerAddress;
    });

    describe("WHEN trying to deploy UserVault contract with invalid parameters", function () {
      it("THEN it should FAIL when _underlyingTokenAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              ZERO_ADDRESS,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderWalletAddress,
              dynamicValueAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ],
            { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_underlyingTokenAddress");
      });

      it("THEN it should FAIL when _adaptersRegistryAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              ZERO_ADDRESS,
              contractsFactoryAddress,
              traderWalletAddress,
              dynamicValueAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ],
            { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_adaptersRegistryAddress");
      });

      it("THEN it should FAIL when _contractsFactoryAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryAddress,
              ZERO_ADDRESS,
              traderWalletAddress,
              dynamicValueAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ],
            { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_contractsFactoryAddress");
      });

      it("THEN it should FAIL when _traderWalletAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              ZERO_ADDRESS,
              dynamicValueAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ],
            { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_traderWalletAddress");
      });

      it("THEN it should FAIL when _dynamicValueAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryAddress,
              traderWalletAddress,
              ZERO_ADDRESS,
              SHARES_NAME,
              SHARES_SYMBOL,
            ],
            { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_dynamicValueAddress");
      });
    });

    describe("WHEN trying to deploy UserVault contract with correct parameters", function () {
      const mintForUsers = async (
        _userAddress: string,
        _tokenContract: Contract,
        _amount: BigNumber
      ) => {
        await _tokenContract.mint(_userAddress, _amount);
      };
      const approveForUsers = async (
        _user: Signer,
        _tokenContract: Contract,
        _amount: BigNumber,
        _spenderAddress: string
      ) => {
        await _tokenContract.connect(_user).approve(_spenderAddress, _amount);
      };

      before(async () => {
        // deploy ContractsFactory
        contractsFactoryContract = (await upgrades.deployProxy(
          ContractsFactoryFactory,
          []
        )) as ContractsFactoryMock;
        await contractsFactoryContract.deployed();
        // set TRUE for response
        await contractsFactoryContract.setReturnValue(true);

        usersVaultContract = (await upgrades.deployProxy(
          UsersVaultFactory,
          [
            underlyingTokenAddress,
            adaptersRegistryAddress,
            contractsFactoryContract.address,
            traderWalletAddress,
            dynamicValueAddress,
            SHARES_NAME,
            SHARES_SYMBOL,
          ],
          { unsafeAllowLinkedLibraries: true }
        )) as UsersVault;
        await usersVaultContract.deployed();

        const signers = [user1, user2, user3, user4, user5];
        const userAddresses = [
          user1Address,
          user2Address,
          user3Address,
          user4Address,
          user5Address,
        ];

        // approve and mint to users
        for (let i = 0; i < 5; i++) {
          await mintForUsers(
            userAddresses[i],
            usdcTokenContract,
            AMOUNT_1E18.mul(1000)
          );

          await approveForUsers(
            signers[i],
            usdcTokenContract,
            AMOUNT_1E18.mul(1000),
            usersVaultContract.address
          );
        }

        // take a snapshot
        await reverter.snapshot();
      });

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
        expect(await usersVaultContract.dynamicValueAddress()).to.equal(
          dynamicValueAddress
        );
        expect(await usersVaultContract.owner()).to.equal(ownerAddress);
      });

      describe("WHEN trying to set the adaptersRegistryAddress", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not owner", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .setAdaptersRegistryAddress(otherAddress)
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });

          describe("WHEN address is invalid", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setAdaptersRegistryAddress(ZERO_ADDRESS)
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAddress"
                )
                .withArgs("_adaptersRegistryAddress");
            });
          });
        });

        describe("WHEN calling with correct caller and address", function () {
          before(async () => {
            txResult = await usersVaultContract
              .connect(owner)
              .setAdaptersRegistryAddress(otherAddress);
          });
          after(async () => {
            await reverter.revert();
          });
          it("THEN new address should be stored", async () => {
            expect(await usersVaultContract.adaptersRegistryAddress()).to.equal(
              otherAddress
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "AdaptersRegistryAddressSet")
              .withArgs(otherAddress);
          });
        });
      });

      describe("WHEN trying to set the contractsFactoryAddress", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not owner", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .setContractsFactoryAddress(otherAddress)
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });

          describe("WHEN address is invalid", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setContractsFactoryAddress(ZERO_ADDRESS)
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAddress"
                )
                .withArgs("_contractsFactoryAddress");
            });
          });
        });

        describe("WHEN calling with correct caller and address", function () {
          before(async () => {
            txResult = await usersVaultContract
              .connect(owner)
              .setContractsFactoryAddress(otherAddress);
          });
          after(async () => {
            await reverter.revert();
          });
          it("THEN new address should be stored", async () => {
            expect(await usersVaultContract.contractsFactoryAddress()).to.equal(
              otherAddress
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "ContractsFactoryAddressSet")
              .withArgs(otherAddress);
          });
        });
      });

      describe("WHEN trying to set the dynamicValueAddress", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not owner", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .setDynamicValueAddress(otherAddress)
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });

          describe("WHEN address is invalid", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setDynamicValueAddress(ZERO_ADDRESS)
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAddress"
                )
                .withArgs("_dynamicValueAddress");
            });
          });
        });

        describe("WHEN calling with correct caller and address", function () {
          before(async () => {
            txResult = await usersVaultContract
              .connect(owner)
              .setDynamicValueAddress(otherAddress);
          });
          after(async () => {
            await reverter.revert();
          });
          it("THEN new address should be stored", async () => {
            expect(await usersVaultContract.dynamicValueAddress()).to.equal(
              otherAddress
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "DynamicValueAddressSet")
              .withArgs(otherAddress);
          });
        });
      });

      describe("WHEN trying to set the underlyingTokenAddress", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not owner", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .setUnderlyingTokenAddress(otherAddress)
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });

          describe("WHEN address is invalid", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setUnderlyingTokenAddress(ZERO_ADDRESS)
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAddress"
                )
                .withArgs("_underlyingTokenAddress");
            });
          });
        });

        describe("WHEN calling with correct caller and address", function () {
          before(async () => {
            txResult = await usersVaultContract
              .connect(owner)
              .setUnderlyingTokenAddress(otherAddress);
          });
          after(async () => {
            await reverter.revert();
          });
          it("THEN new address should be stored", async () => {
            expect(await usersVaultContract.underlyingTokenAddress()).to.equal(
              otherAddress
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "UnderlyingTokenAddressSet")
              .withArgs(otherAddress);
          });
        });
      });

      describe("WHEN trying to set the traderWalletAddress", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not owner", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .setTraderWalletAddress(otherAddress)
              ).to.be.revertedWith("Ownable: caller is not the owner");
            });
          });

          describe("WHEN address is invalid", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setTraderWalletAddress(ZERO_ADDRESS)
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAddress"
                )
                .withArgs("_traderWalletAddress");
            });
          });
          xdescribe("WHEN traderWalletADdress is INVALID ! ========>>>>>>> ", function () {
            before(async () => {
              // change returnValue to return false on function call
              await contractsFactoryContract.setReturnValue(false);
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(owner)
                  .setTraderWalletAddress(otherAddress)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "NewTraderNotAllowed"
              );
            });
          });
        });

        describe("WHEN calling with correct caller and address", function () {
          before(async () => {
            // change returnValue to return true on function call
            await contractsFactoryContract.setReturnValue(true);

            txResult = await usersVaultContract
              .connect(owner)
              .setTraderWalletAddress(otherAddress);
          });
          after(async () => {
            await reverter.revert();
          });

          it("THEN new address should be stored", async () => {
            expect(await usersVaultContract.traderWalletAddress()).to.equal(
              otherAddress
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "TraderWalletAddressSet")
              .withArgs(otherAddress);
          });
        });
      });

      describe("WHEN trying to add/remove adapter to be used by trader", async () => {
        let AdaptersRegistryFactory: ContractFactory;
        let adaptersRegistryContract: AdaptersRegistryMock;

        before(async () => {
          // deploy mocked adaptersRegistry
          AdaptersRegistryFactory = await ethers.getContractFactory(
            "AdaptersRegistryMock"
          );
          adaptersRegistryContract =
            (await AdaptersRegistryFactory.deploy()) as AdaptersRegistryMock;
          await adaptersRegistryContract.deployed();

          // change address to mocked adaptersRegistry
          await usersVaultContract
            .connect(owner)
            .setAdaptersRegistryAddress(adaptersRegistryContract.address);
        });
        after(async () => {
          await reverter.revert();
        });

        describe("WHEN trying to add an adapter to use (addAdapterToUse)", async () => {
          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  usersVaultContract.connect(nonAuthorized).addAdapterToUse(1)
                ).to.be.revertedWith("Ownable: caller is not the owner");
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
                  usersVaultContract.connect(owner).addAdapterToUse(1)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
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
              await adaptersRegistryContract.setReturnAddress(adapter1Address);

              txResult = await usersVaultContract
                .connect(owner)
                .addAdapterToUse(1);
            });

            it("THEN new adapter should be added to the trader array", async () => {
              expect(
                await usersVaultContract.traderSelectedAdaptersArray(0)
              ).to.equal(adapter1Address);
            });

            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(usersVaultContract, "AdapterToUseAdded")
                .withArgs(1, adapter1Address, ownerAddress);
            });

            it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
              expect(await usersVaultContract.adaptersPerProtocol(1)).to.equal(
                adapter1Address
              );
            });

            describe("WHEN adapter already exists in traderArray ", function () {
              it("THEN adding the same one should fail", async () => {
                await expect(
                  usersVaultContract.connect(owner).addAdapterToUse(1)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
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
            adapter3Address = contractsFactoryAddress;
            adapter4Address = dynamicValueAddress;
            adapter10Address = traderWalletAddress;

            await adaptersRegistryContract.setReturnValue(true);
            await adaptersRegistryContract.setReturnAddress(adapter2Address);
            await usersVaultContract.connect(owner).addAdapterToUse(2);

            await adaptersRegistryContract.setReturnAddress(adapter3Address);
            await usersVaultContract.connect(owner).addAdapterToUse(3);

            await adaptersRegistryContract.setReturnAddress(adapter4Address);
            await usersVaultContract.connect(owner).addAdapterToUse(4);
          });

          describe("WHEN checking adapters", function () {
            it("THEN it should return correct values", async () => {
              expect(
                await usersVaultContract.traderSelectedAdaptersArray(0)
              ).to.equal(adapter1Address);

              expect(
                await usersVaultContract.traderSelectedAdaptersArray(1)
              ).to.equal(adapter2Address);

              expect(
                await usersVaultContract.traderSelectedAdaptersArray(2)
              ).to.equal(adapter3Address);

              expect(
                await usersVaultContract.traderSelectedAdaptersArray(3)
              ).to.equal(adapter4Address);
            });
            it("THEN it should return correct array length", async () => {
              expect(
                await usersVaultContract.getTraderSelectedAdaptersLength()
              ).to.equal(BigNumber.from(4));
            });
            it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
              expect(await usersVaultContract.adaptersPerProtocol(1)).to.equal(
                adapter1Address
              );

              expect(await usersVaultContract.adaptersPerProtocol(2)).to.equal(
                adapter2Address
              );

              expect(await usersVaultContract.adaptersPerProtocol(3)).to.equal(
                adapter3Address
              );

              expect(await usersVaultContract.adaptersPerProtocol(4)).to.equal(
                adapter4Address
              );
            });
          });

          describe("WHEN calling with invalid caller or parameters", function () {
            describe("WHEN caller is not owner", function () {
              it("THEN it should fail", async () => {
                await expect(
                  usersVaultContract
                    .connect(nonAuthorized)
                    .removeAdapterToUse(1)
                ).to.be.revertedWith("Ownable: caller is not the owner");
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
                  usersVaultContract.connect(owner).removeAdapterToUse(10)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
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
                  usersVaultContract.connect(owner).removeAdapterToUse(10)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
                  "AdapterNotPresent"
                );
              });
            });
          });

          describe("WHEN calling with correct caller and address", function () {
            before(async () => {
              await adaptersRegistryContract.setReturnValue(true);
              await adaptersRegistryContract.setReturnAddress(adapter3Address);
              txResult = await usersVaultContract
                .connect(owner)
                .removeAdapterToUse(3);
            });

            it("THEN adapter should be removed from array", async () => {
              expect(
                await usersVaultContract.traderSelectedAdaptersArray(0)
              ).to.equal(adapter1Address);

              expect(
                await usersVaultContract.traderSelectedAdaptersArray(1)
              ).to.equal(adapter2Address);

              expect(
                await usersVaultContract.traderSelectedAdaptersArray(2)
              ).to.equal(adapter4Address);
            });
            it("THEN it should return correct array length", async () => {
              expect(
                await usersVaultContract.getTraderSelectedAdaptersLength()
              ).to.equal(BigNumber.from(3));
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(usersVaultContract, "AdapterToUseRemoved")
                .withArgs(adapter3Address, ownerAddress);
            });
            it("THEN it should be removed from adaptersPerProtocol mapping", async () => {
              expect(await usersVaultContract.adaptersPerProtocol(3)).to.equal(
                ZERO_ADDRESS
              );
            });
          });
        });
      });

      describe("WHEN trying to make a userDeposit", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN user is not allowed", function () {
            before(async () => {
              // change returnValue to return false on function call
              await contractsFactoryContract.setReturnValue(false);
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .userDeposit(underlyingTokenAddress, AMOUNT_100)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "UserNotAllowed"
              );
            });
          });

          describe("WHEN Token is not the underlying", function () {
            before(async () => {
              // change returnValue to return true on function call
              await contractsFactoryContract.setReturnValue(true);
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .userDeposit(otherAddress, AMOUNT_100)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "UnderlyingAssetNotAllowed"
              );
            });
          });

          describe("WHEN amount is ZERO", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .userDeposit(underlyingTokenAddress, ZERO_AMOUNT)
              ).to.be.revertedWithCustomError(usersVaultContract, "ZeroAmount");
            });
          });

          describe("WHEN transferFrom fails", function () {
            before(async () => {
              // to  fail on transfer from
              await usdcTokenContract.setReturnBoolValue(false);
            });
            after(async () => {
              await reverter.revert();
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .userDeposit(underlyingTokenAddress, AMOUNT_100)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "TokenTransferFailed"
              );
            });
          });
        });

        describe("WHEN calling with correct caller and amount", function () {
          const AMOUNT = AMOUNT_1E18.mul(100);

          before(async () => {
            vaultBalanceBefore = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );

            userBalanceBefore = await usdcTokenContract.balanceOf(user1Address);

            txResult = await usersVaultContract
              .connect(user1)
              .userDeposit(underlyingTokenAddress, AMOUNT);
          });
          after(async () => {
            await reverter.revert();
          });

          xit("THEN contract should return correct vaules", async () => {
            expect(
              await usersVaultContract.getCumulativePendingDeposits()
            ).to.equal(AMOUNT);
            expect(
              await usersVaultContract.cumulativePendingDeposits()
            ).to.equal(AMOUNT);
          });

          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "UserDeposited")
              .withArgs(user1Address, underlyingTokenAddress, AMOUNT);
          });

          it("THEN contract balance should increase", async () => {
            vaultBalanceAfter = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore.add(AMOUNT));
          });

          it("THEN user balance should decrease", async () => {
            userBalanceAfter = await usdcTokenContract.balanceOf(user1Address);
            expect(userBalanceAfter).to.equal(userBalanceBefore.sub(AMOUNT));
          });

          describe("WHEN calling again with correct caller and amount", function () {
            before(async () => {
              vaultBalanceBefore = await usdcTokenContract.balanceOf(
                usersVaultContract.address
              );

              userBalanceBefore = await usdcTokenContract.balanceOf(
                user1Address
              );

              txResult = await usersVaultContract
                .connect(user1)
                .userDeposit(underlyingTokenAddress, AMOUNT);
            });

            xit("THEN contract should return correct vaules", async () => {
              expect(
                await usersVaultContract.getCumulativePendingDeposits()
              ).to.equal(AMOUNT_100);
              expect(
                await usersVaultContract.cumulativePendingDeposits()
              ).to.equal(AMOUNT_100);
            });
          });
        });
      });

      // it("THEN ==> User 1 Claim ALL Shares", async () => {
      //   console.log('Balance user 1 Before claim: ', await usersVaultContract.balanceOf(user1Address));
      //   await usersVaultContract.connect(user1).claimAllShares(user1Address);
      //   console.log('Balance user 1 After claim: ', await usersVaultContract.balanceOf(user1Address));
      // });
    });
  });
});
