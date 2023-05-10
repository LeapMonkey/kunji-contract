import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
} from "ethers";
import {
  SnapshotRestorer,
  takeSnapshot,
  impersonateAccount,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  UsersVault,
  UsersVaultV2,
  TraderWalletMock,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  GMXAdapter,
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

let snapshot: SnapshotRestorer;

let deployer: Signer;
let traderWallet: Signer;
let adaptersRegistry: Signer;
// let dynamicValue: Signer;
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
let traderWalletAddress: string;
// let dynamicValueAddress: string;
let otherAddress: string;
let ownerAddress: string;
let user1Address: string;
let user2Address: string;
let user3Address: string;
let user4Address: string;
let user5Address: string;

let txResult: ContractTransaction;
let UsersVaultFactory: ContractFactory;
let usersVaultContract: UsersVault;
let ContractsFactoryFactory: ContractFactory;
let contractsFactoryContract: ContractsFactoryMock;
let GMXAdapterLibraryFactory: ContractFactory;
let gmxAdapterContract: GMXAdapter;
let AdaptersRegistryFactory: ContractFactory;
let adaptersRegistryContract: AdaptersRegistryMock;
let AdapterFactory: ContractFactory;
let adapterContract: AdapterMock;

let usdcTokenContract: ERC20Mock;
let userBalanceBefore: BigNumber;
let userBalanceAfter: BigNumber;
let vaultBalanceBefore: BigNumber;
let vaultBalanceAfter: BigNumber;

let signers: Array<Signer>;
let userAddresses: Array<string>;

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
      // dynamicValue,
      nonAuthorized,
      otherSigner,
      owner,
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
      // dynamicValueAddress,
      otherAddress,
      ownerAddress,
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ] = await Promise.all([
      deployer.getAddress(),
      traderWallet.getAddress(),
      adaptersRegistry.getAddress(),
      // dynamicValue.getAddress(),
      otherSigner.getAddress(),
      owner.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
      user3.getAddress(),
      user4.getAddress(),
      user5.getAddress(),
    ]);

    signers = [user1, user2, user3, user4, user5];
    userAddresses = [
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ];
  });

  describe("UserVault deployment Tests", function () {
    before(async () => {
      GMXAdapterLibraryFactory = await ethers.getContractFactory("GMXAdapter");
      gmxAdapterContract =
        (await GMXAdapterLibraryFactory.deploy()) as GMXAdapter;
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

      // deploy mocked adaptersRegistry
      AdaptersRegistryFactory = await ethers.getContractFactory(
        "AdaptersRegistryMock"
      );
      adaptersRegistryContract = (await upgrades.deployProxy(
        AdaptersRegistryFactory,
        []
      )) as AdaptersRegistryMock;
      await adaptersRegistryContract.deployed();
            
      // deploy mocked adapter
      AdapterFactory = await ethers.getContractFactory("AdapterMock");
      adapterContract = (await AdapterFactory.deploy()) as AdapterMock;
      await adapterContract.deployed();

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
              contractsFactoryContract.address,
              traderWalletAddress,
              // dynamicValueAddress,
              ownerAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
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
              contractsFactoryContract.address,
              traderWalletAddress,
              // dynamicValueAddress,
              ownerAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
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
              // dynamicValueAddress,
              ownerAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
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
              contractsFactoryContract.address,
              ZERO_ADDRESS,
              // dynamicValueAddress,
              ownerAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_traderWalletAddress");
      });

      xit("THEN it should FAIL when _dynamicValueAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryContract.address,
              traderWalletAddress,
              // ZERO_ADDRESS,
              ownerAddress,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_dynamicValueAddress");
      });

      it("THEN it should FAIL when _ownerAddress is ZERO", async () => {
        await expect(
          upgrades.deployProxy(
            UsersVaultFactory,
            [
              underlyingTokenAddress,
              adaptersRegistryAddress,
              contractsFactoryContract.address,
              traderWalletAddress,
              // dynamicValueAddress,
              ZERO_ADDRESS,
              SHARES_NAME,
              SHARES_SYMBOL,
            ]
            // { unsafeAllowLinkedLibraries: true }
          )
        )
          .to.be.revertedWithCustomError(UsersVaultFactory, "ZeroAddress")
          .withArgs("_ownerAddress");
      });
    });

    describe("WHEN trying to deploy UserVault contract with correct parameters", function () {
      before(async () => {
        usersVaultContract = (await upgrades.deployProxy(
          UsersVaultFactory,
          [
            underlyingTokenAddress,
            adaptersRegistryContract.address,
            contractsFactoryContract.address,
            traderWalletAddress,
            // dynamicValueAddress,
            ownerAddress,
            SHARES_NAME,
            SHARES_SYMBOL,
          ]
          // { unsafeAllowLinkedLibraries: true }
        )) as UsersVault;
        await usersVaultContract.deployed();

        // approve and mint to users
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

        // take a snapshot
        snapshot = await takeSnapshot();
      });

      it("THEN it should return the same ones after deployment", async () => {
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
          traderWalletAddress
        );
        // expect(await usersVaultContract.dynamicValueAddress()).to.equal(
        //   dynamicValueAddress
        // );
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
            await snapshot.restore();
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
            await snapshot.restore();
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

      // describe("WHEN trying to set the dynamicValueAddress", async () => {
      //   describe("WHEN calling with invalid caller or parameters", function () {
      //     describe("WHEN caller is not owner", function () {
      //       it("THEN it should fail", async () => {
      //         await expect(
      //           usersVaultContract
      //             .connect(nonAuthorized)
      //             .setDynamicValueAddress(otherAddress)
      //         ).to.be.revertedWith("Ownable: caller is not the owner");
      //       });
      //     });

      //     describe("WHEN address is invalid", function () {
      //       it("THEN it should fail", async () => {
      //         await expect(
      //           usersVaultContract
      //             .connect(owner)
      //             .setDynamicValueAddress(ZERO_ADDRESS)
      //         )
      //           .to.be.revertedWithCustomError(
      //             usersVaultContract,
      //             "ZeroAddress"
      //           )
      //           .withArgs("_dynamicValueAddress");
      //       });
      //     });
      //   });

      //   describe("WHEN calling with correct caller and address", function () {
      //     before(async () => {
      //       txResult = await usersVaultContract
      //         .connect(owner)
      //         .setDynamicValueAddress(otherAddress);
      //     });
      //     after(async () => {
      //       await snapshot.restore();
      //     });
      //     it("THEN new address should be stored", async () => {
      //       expect(await usersVaultContract.dynamicValueAddress()).to.equal(
      //         otherAddress
      //       );
      //     });
      //     it("THEN it should emit an Event", async () => {
      //       await expect(txResult)
      //         .to.emit(usersVaultContract, "DynamicValueAddressSet")
      //         .withArgs(otherAddress);
      //     });
      //   });
      // });

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
            await snapshot.restore();
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

          describe("WHEN traderWalletAddress is not allowed", function () {
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
                "InvalidTraderWallet"
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
            await snapshot.restore();
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

      // describe("WHEN trying to add/remove adapter to be used by trader", async () => {
      //   let AdaptersRegistryFactory: ContractFactory;
      //   let adaptersRegistryContract: AdaptersRegistryMock;

      //   before(async () => {
      //     // deploy mocked adaptersRegistry
      //     AdaptersRegistryFactory = await ethers.getContractFactory(
      //       "AdaptersRegistryMock"
      //     );
      //     adaptersRegistryContract =
      //       (await AdaptersRegistryFactory.deploy()) as AdaptersRegistryMock;
      //     await adaptersRegistryContract.deployed();

      //     // change address to mocked adaptersRegistry
      //     await usersVaultContract
      //       .connect(owner)
      //       .setAdaptersRegistryAddress(adaptersRegistryContract.address);
      //   });
      //   after(async () => {
      //     await snapshot.restore();
      //   });

      //   describe("WHEN trying to add an adapter to use (addAdapterToUse)", async () => {
      //     describe("WHEN calling with invalid caller or parameters", function () {
      //       describe("WHEN caller is not owner", function () {
      //         it("THEN it should fail", async () => {
      //           await expect(
      //             usersVaultContract.connect(nonAuthorized).addAdapterToUse(1)
      //           ).to.be.revertedWith("Ownable: caller is not the owner");
      //         });
      //       });
      //       describe("WHEN protocol does not exist in registry", function () {
      //         before(async () => {
      //           // change returnValue to adapter registry to fail on function call
      //           await adaptersRegistryContract.setReturnValue(false);
      //           await adaptersRegistryContract.setReturnAddress(otherAddress);
      //         });
      //         it("THEN it should fail", async () => {
      //           await expect(
      //             usersVaultContract.connect(owner).addAdapterToUse(1)
      //           ).to.be.revertedWithCustomError(
      //             usersVaultContract,
      //             "InvalidProtocol"
      //           );
      //         });
      //       });
      //     });

      //     describe("WHEN calling with correct caller and protocol", function () {
      //       let adapter1Address: string;

      //       before(async () => {
      //         // change returnValue to return true on function call
      //         adapter1Address = otherAddress;
      //         await adaptersRegistryContract.setReturnValue(true);
      //         await adaptersRegistryContract.setReturnAddress(adapter1Address);

      //         txResult = await usersVaultContract
      //           .connect(owner)
      //           .addAdapterToUse(1);
      //       });

      //       it("THEN new adapter should be added to the trader array", async () => {
      //         expect(
      //           await usersVaultContract.traderSelectedAdaptersArray(0)
      //         ).to.equal(adapter1Address);
      //       });

      //       it("THEN it should emit an Event", async () => {
      //         await expect(txResult)
      //           .to.emit(usersVaultContract, "AdapterToUseAdded")
      //           .withArgs(1, adapter1Address, ownerAddress);
      //       });

      //       it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
      //         expect(await usersVaultContract.adaptersPerProtocol(1)).to.equal(
      //           adapter1Address
      //         );
      //       });

      //       describe("WHEN adapter already exists in traderArray ", function () {
      //         it("THEN adding the same one should fail", async () => {
      //           await expect(
      //             usersVaultContract.connect(owner).addAdapterToUse(1)
      //           ).to.be.revertedWithCustomError(
      //             usersVaultContract,
      //             "AdapterPresent"
      //           );
      //         });
      //       });
      //     });
      //   });

      //   // describe("WHEN trying to remove an adapter (removeAdapterToUse)", async () => {
      //   //   // otherAddress is already added from previous flow (addAdapterToUse)
      //   //   // to add now deployerAddress, contractsFactoryAddress, dynamicValueAddress
      //   //   // just to store something and test the function
      //   //   let adapter1Address: string;
      //   //   let adapter2Address: string;
      //   //   let adapter3Address: string;
      //   //   let adapter4Address: string;
      //   //   let adapter10Address: string;

      //   //   before(async () => {
      //   //     adapter1Address = otherAddress;
      //   //     adapter2Address = deployerAddress;
      //   //     adapter3Address = contractsFactoryContract.address;
      //   //     adapter4Address = dynamicValueAddress;
      //   //     adapter10Address = traderWalletAddress;

      //   //     await adaptersRegistryContract.setReturnValue(true);
      //   //     await adaptersRegistryContract.setReturnAddress(adapter2Address);
      //   //     await usersVaultContract.connect(owner).addAdapterToUse(2);

      //   //     await adaptersRegistryContract.setReturnAddress(adapter3Address);
      //   //     await usersVaultContract.connect(owner).addAdapterToUse(3);

      //   //     await adaptersRegistryContract.setReturnAddress(adapter4Address);
      //   //     await usersVaultContract.connect(owner).addAdapterToUse(4);
      //   //   });

      //   //   describe("WHEN checking adapters", function () {
      //   //     it("THEN it should return correct values", async () => {
      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(0)
      //   //       ).to.equal(adapter1Address);

      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(1)
      //   //       ).to.equal(adapter2Address);

      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(2)
      //   //       ).to.equal(adapter3Address);

      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(3)
      //   //       ).to.equal(adapter4Address);
      //   //     });
      //   //     it("THEN it should return correct array length", async () => {
      //   //       expect(
      //   //         await usersVaultContract.getTraderSelectedAdaptersLength()
      //   //       ).to.equal(BigNumber.from(4));
      //   //     });
      //   //     it("THEN it should be added to the adaptersPerProtocol mapping", async () => {
      //   //       expect(await usersVaultContract.adaptersPerProtocol(1)).to.equal(
      //   //         adapter1Address
      //   //       );

      //   //       expect(await usersVaultContract.adaptersPerProtocol(2)).to.equal(
      //   //         adapter2Address
      //   //       );

      //   //       expect(await usersVaultContract.adaptersPerProtocol(3)).to.equal(
      //   //         adapter3Address
      //   //       );

      //   //       expect(await usersVaultContract.adaptersPerProtocol(4)).to.equal(
      //   //         adapter4Address
      //   //       );
      //   //     });
      //   //   });

      //   //   describe("WHEN calling with invalid caller or parameters", function () {
      //   //     describe("WHEN caller is not owner", function () {
      //   //       it("THEN it should fail", async () => {
      //   //         await expect(
      //   //           usersVaultContract
      //   //             .connect(nonAuthorized)
      //   //             .removeAdapterToUse(1)
      //   //         ).to.be.revertedWith("Ownable: caller is not the owner");
      //   //       });
      //   //     });
      //   //     describe("WHEN protocol does not exist in registry", function () {
      //   //       before(async () => {
      //   //         // change returnValue to adapter registry to fail on function call
      //   //         await adaptersRegistryContract.setReturnValue(false);
      //   //         await adaptersRegistryContract.setReturnAddress(otherAddress);
      //   //       });
      //   //       it("THEN it should fail", async () => {
      //   //         await expect(
      //   //           usersVaultContract.connect(owner).removeAdapterToUse(10)
      //   //         ).to.be.revertedWithCustomError(
      //   //           usersVaultContract,
      //   //           "InvalidProtocol"
      //   //         );
      //   //       });
      //   //     });

      //   //     describe("WHEN adapter does not exist in array", function () {
      //   //       before(async () => {
      //   //         await adaptersRegistryContract.setReturnValue(true);
      //   //         await adaptersRegistryContract.setReturnAddress(
      //   //           adapter10Address
      //   //         );
      //   //       });
      //   //       it("THEN it should fail", async () => {
      //   //         await expect(
      //   //           usersVaultContract.connect(owner).removeAdapterToUse(10)
      //   //         ).to.be.revertedWithCustomError(
      //   //           usersVaultContract,
      //   //           "AdapterNotPresent"
      //   //         );
      //   //       });
      //   //     });
      //   //   });

      //   //   describe("WHEN calling with correct caller and address", function () {
      //   //     before(async () => {
      //   //       await adaptersRegistryContract.setReturnValue(true);
      //   //       await adaptersRegistryContract.setReturnAddress(adapter3Address);
      //   //       txResult = await usersVaultContract
      //   //         .connect(owner)
      //   //         .removeAdapterToUse(3);
      //   //     });

      //   //     it("THEN adapter should be removed from array", async () => {
      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(0)
      //   //       ).to.equal(adapter1Address);

      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(1)
      //   //       ).to.equal(adapter2Address);

      //   //       expect(
      //   //         await usersVaultContract.traderSelectedAdaptersArray(2)
      //   //       ).to.equal(adapter4Address);
      //   //     });
      //   //     it("THEN it should return correct array length", async () => {
      //   //       expect(
      //   //         await usersVaultContract.getTraderSelectedAdaptersLength()
      //   //       ).to.equal(BigNumber.from(3));
      //   //     });
      //   //     it("THEN it should emit an Event", async () => {
      //   //       await expect(txResult)
      //   //         .to.emit(usersVaultContract, "AdapterToUseRemoved")
      //   //         .withArgs(adapter3Address, ownerAddress);
      //   //     });
      //   //     it("THEN it should be removed from adaptersPerProtocol mapping", async () => {
      //   //       expect(await usersVaultContract.adaptersPerProtocol(3)).to.equal(
      //   //         ZERO_ADDRESS
      //   //       );
      //   //     });
      //   //   });
      //   // });
      // });

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
                  .userDeposit(AMOUNT_1E18)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "UserNotAllowed"
              );
            });
          });

          describe("WHEN user does not have the amount to transfer", function () {
            before(async () => {
              // change returnValue to return true on function call
              await contractsFactoryContract.setReturnValue(true);
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .userDeposit(AMOUNT_1E18.mul(100000))
              ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });
          });

          describe("WHEN amount is ZERO", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract.connect(user1).userDeposit(ZERO_AMOUNT)
              ).to.be.revertedWithCustomError(usersVaultContract, "ZeroAmount");
            });
          });

          describe("WHEN transferFrom fails", function () {
            before(async () => {
              // to  fail on transfer from
              await usdcTokenContract.setReturnBoolValue(false);
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract.connect(user1).userDeposit(AMOUNT_1E18)
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
              .userDeposit(AMOUNT);
          });
          after(async () => {
            await snapshot.restore();
          });

          it("THEN contract should return correct values", async () => {
            const userDeposits = await usersVaultContract.userDeposits(
              user1Address
            );
            expect(userDeposits.round).to.equal(BigNumber.from(0));

            expect(userDeposits.pendingAssets).to.equal(AMOUNT);

            expect(await usersVaultContract.pendingDepositAssets()).to.equal(
              AMOUNT
            );
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
                .userDeposit(AMOUNT);
            });

            it("THEN contract should return correct vaules", async () => {
              const userDeposits = await usersVaultContract.userDeposits(
                user1Address
              );
              expect(userDeposits.round).to.equal(BigNumber.from(0));

              expect(userDeposits.pendingAssets).to.equal(AMOUNT.add(AMOUNT));

              expect(await usersVaultContract.pendingDepositAssets()).to.equal(
                AMOUNT.add(AMOUNT)
              );
            });
          });
        });
      });

      describe("WHEN trying to make a withdrawRequest", async () => {
        describe("WHEN calling on round ZERO", function () {
          it("THEN it should fail", async () => {
            await expect(
              usersVaultContract.connect(user1).withdrawRequest(AMOUNT_1E18)
            ).to.be.revertedWithCustomError(usersVaultContract, "InvalidRound");
          });
        });

        describe("WHEN making the first rollover (for withdraw test)", function () {
          let vaultSharesBalance: BigNumber;

          before(async () => {
            // user deposits for starting on round 0
            await usersDeposit(
              usersVaultContract,
              signers,
              AMOUNT_1E18.mul(100),
              5
            );

            await usersVaultContract.connect(traderWallet).rolloverFromTrader();
          });
          after(async () => {
            await snapshot.restore();
          });

          it("THEN round should be 1 and assetsPerShareXRound should be 1", async () => {
            expect(await usersVaultContract.currentRound()).to.equal(
              BigNumber.from(1)
            );
            expect(await usersVaultContract.assetsPerShareXRound(0)).to.equal(
              AMOUNT_1E18
            );
          });

          it("THEN shares should be 100+200+300+400+500", async () => {
            vaultSharesBalance = await usersVaultContract.balanceOf(
              usersVaultContract.address
            );

            const sharesAmountOnContract = AMOUNT_1E18.mul(1500);
            expect(vaultSharesBalance).to.equal(sharesAmountOnContract);
          });

          it("THEN shares should be 10+20+30+40+50", async () => {
            vaultSharesBalance = await usersVaultContract.balanceOf(
              usersVaultContract.address
            );

            const sharesAmountOnContract = AMOUNT_1E18.mul(1500);
            expect(vaultSharesBalance).to.equal(sharesAmountOnContract);
            expect(vaultSharesBalance).to.equal(
              await usersVaultContract.getSharesContractBalance()
            );
          });

          /// FOLLOWING TESTS ARE LINKED ONE WITH EACH OTHER
          /// FOLLOWING TESTS ARE LINKED ONE WITH EACH OTHER
          /// DISABLING ONE, MAY MAKE THE OTHERS TO FAIL
          /// DISABLING ONE, MAY MAKE THE OTHERS TO FAIL
          describe("WHEN trying to make a withdrawRequest", function () {
            describe("WHEN calling with invalid caller or parameters", function () {
              describe("WHEN caller is not allowed", function () {
                before(async () => {
                  // change returnValue to return false on function call
                  await contractsFactoryContract.setReturnValue(false);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    usersVaultContract
                      .connect(nonAuthorized)
                      .withdrawRequest(AMOUNT_1E18)
                  ).to.be.revertedWithCustomError(
                    usersVaultContract,
                    "UserNotAllowed"
                  );
                });
              });
              describe("WHEN amount is ZERO", function () {
                before(async () => {
                  // change returnValue to return true on function call
                  await contractsFactoryContract.setReturnValue(true);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    usersVaultContract
                      .connect(user1)
                      .withdrawRequest(ZERO_AMOUNT)
                  ).to.be.revertedWithCustomError(
                    usersVaultContract,
                    "ZeroAmount"
                  );
                });
              });
              describe("WHEN amount is higher than user shares", function () {
                before(async () => {
                  // change returnValue to return true on function call
                  await contractsFactoryContract.setReturnValue(true);
                });
                it("THEN it should fail", async () => {
                  await expect(
                    usersVaultContract
                      .connect(user1)
                      .withdrawRequest(AMOUNT_1E18.mul(10000))
                  ).to.be.revertedWith("ERC20: burn amount exceeds balance");
                });
              });
            });

            describe("WHEN calling claimShares (for withdraw test)", function () {
              describe("WHEN calling with invalid caller or parameters", function () {
                describe("WHEN caller is not allowed", function () {
                  before(async () => {
                    // change returnValue to return false on function call
                    await contractsFactoryContract.setReturnValue(false);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(nonAuthorized)
                        .claimShares(AMOUNT_1E18, otherAddress)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "UserNotAllowed"
                    );
                  });
                });
                describe("WHEN amount is ZERO", function () {
                  before(async () => {
                    // change returnValue to return true on function call
                    await contractsFactoryContract.setReturnValue(true);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(user1)
                        .claimShares(ZERO_AMOUNT, user1Address)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "ZeroAmount"
                    );
                  });
                });
                describe("WHEN amount is higher than user shares", function () {
                  before(async () => {
                    // change returnValue to return true on function call
                    await contractsFactoryContract.setReturnValue(true);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(user1)
                        .claimShares(AMOUNT_1E18.mul(10000), user1Address)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "InsufficientShares"
                    );
                  });
                });

                // ===================================================================================================
                // ===================================================================================================
                // FALTARIA HACER FALLAR EL TRANSFER DE LAS SHARES
                // ===================================================================================================
                // ===================================================================================================
              });

              describe("WHEN calling claimShares with right parameters (for withdraw test)", function () {
                before(async () => {
                  // users need to claim before requesting withdraw
                  await claimShares(
                    usersVaultContract,
                    signers,
                    AMOUNT_1E18.mul(10), // 10 shares per user
                    userAddresses,
                    3
                  );
                });

                it("THEN users shares should increase", async () => {
                  expect(
                    await usersVaultContract.balanceOf(user1Address)
                  ).to.equal(AMOUNT_1E18.mul(10));
                  expect(
                    await usersVaultContract.balanceOf(user2Address)
                  ).to.equal(AMOUNT_1E18.mul(10));
                  expect(
                    await usersVaultContract.balanceOf(user3Address)
                  ).to.equal(AMOUNT_1E18.mul(10));
                });

                it("THEN contract shares should decrease", async () => {
                  vaultSharesBalance = await usersVaultContract.balanceOf(
                    usersVaultContract.address
                  );
                  const sharesAmountOnContract = AMOUNT_1E18.mul(1500).sub(
                    AMOUNT_1E18.mul(30)
                  );
                  expect(vaultSharesBalance).to.equal(sharesAmountOnContract);
                  expect(vaultSharesBalance).to.equal(
                    await usersVaultContract.getSharesContractBalance()
                  );
                });
              });
            });
            describe("WHEN calling withdrawRequest with right parameters", function () {
              before(async () => {
                txResult = await usersVaultContract
                  .connect(user3)
                  .withdrawRequest(AMOUNT_1E18.mul(10));
              });
              it("THEN contract should return correct vaules", async () => {
                const userWithdrawals =
                  await usersVaultContract.userWithdrawals(user3Address);
                expect(userWithdrawals.round).to.equal(1);
                expect(userWithdrawals.pendingShares).to.equal(
                  AMOUNT_1E18.mul(10)
                );
                expect(
                  await usersVaultContract.pendingWithdrawShares()
                ).to.equal(AMOUNT_1E18.mul(10));
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult)
                  .to.emit(usersVaultContract, "WithdrawRequest")
                  .withArgs(
                    user3Address,
                    underlyingTokenAddress,
                    AMOUNT_1E18.mul(10)
                  );
              });
              describe("WHEN calling AGAIN with correct parameters", function () {
                before(async () => {
                  txResult = await usersVaultContract
                    .connect(user2)
                    .withdrawRequest(AMOUNT_1E18.mul(10));
                });

                it("THEN contract should return correct vaules", async () => {
                  const userWithdrawals =
                    await usersVaultContract.userWithdrawals(user2Address);
                  expect(userWithdrawals.round).to.equal(1);
                  expect(userWithdrawals.pendingShares).to.equal(
                    AMOUNT_1E18.mul(10)
                  );
                  expect(
                    await usersVaultContract.pendingWithdrawShares()
                  ).to.equal(AMOUNT_1E18.mul(20));
                });
                it("THEN it should emit an Event", async () => {
                  await expect(txResult)
                    .to.emit(usersVaultContract, "WithdrawRequest")
                    .withArgs(
                      user2Address,
                      underlyingTokenAddress,
                      AMOUNT_1E18.mul(10)
                    );
                });
              });
            });

            describe("WHEN trying to call claimAssets", function () {
              describe("WHEN calling with invalid caller or parameters", function () {
                describe("WHEN caller is not allowed", function () {
                  before(async () => {
                    // change returnValue to return false on function call
                    await contractsFactoryContract.setReturnValue(false);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(nonAuthorized)
                        .claimAssets(AMOUNT_1E18, otherAddress)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "UserNotAllowed"
                    );
                  });
                });
                describe("WHEN amount is ZERO", function () {
                  before(async () => {
                    // change returnValue to return true on function call
                    await contractsFactoryContract.setReturnValue(true);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(user1)
                        .claimAssets(ZERO_AMOUNT, otherAddress)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "ZeroAmount"
                    );
                  });
                });
                describe("WHEN amount is higher than user assets", function () {
                  before(async () => {
                    // change returnValue to return true on function call
                    await contractsFactoryContract.setReturnValue(true);
                  });
                  it("THEN it should fail", async () => {
                    await expect(
                      usersVaultContract
                        .connect(user3)
                        .claimAssets(AMOUNT_1E18.mul(100000), user3Address)
                    ).to.be.revertedWithCustomError(
                      usersVaultContract,
                      "InsufficientAssets"
                    );
                  });
                });
                // ===================================================================================================
                // ===================================================================================================
                // FALTARIA HACER FALLAR EL TRANSFER DE LOS ASSETS
                // ===================================================================================================
                // ===================================================================================================
              });
              describe("WHEN calling rollover again (to test claimAssets)", function () {
                before(async () => {
                  await usersVaultContract
                    .connect(traderWallet)
                    .rolloverFromTrader();
                });

                it("THEN round should be 1 and assetsPerShareXRound should be 1", async () => {
                  expect(await usersVaultContract.currentRound()).to.equal(
                    BigNumber.from(2)
                  );
                  expect(
                    await usersVaultContract.assetsPerShareXRound(0)
                  ).to.equal(AMOUNT_1E18);
                });
              });

              describe("WHEN calling claimAssets with right parameters", function () {
                before(async () => {
                  // two users want to withdraw 20 shares in total
                  // contract has 1500 en asset
                  // contract has 1480 en shares
                  // assetPerShare 1500 / 1480 = 1,0135135135135135135135135135 asset per 1 share
                  // processedWithdrawAssets is 20 * 1,0135135135135135135135135135 = 20,27027027027027027027027027
                  // user 3 asked to withdraw 10 shares
                  // so pendingShares for user 3 is 10
                  // user 3 asked to claim 10 assets
                  // contracts converts user 3 pendingShares to unclaimedAssets (doing pendingShares * assetPerShare)
                  // 10 * 1,0135135135135135135135135135 = 10,135135135135135135135135135 = unclaimed assets
                  // contracts substract from unclaimedAssets, what user requested
                  // 10,135135135135135135135135135 - 10 = 0,135135135135135135135135135
                  // leaves the result in unclaimedAssets for that user

                  userBalanceBefore = await usdcTokenContract.balanceOf(
                    user3Address
                  );
                  vaultBalanceBefore = await usdcTokenContract.balanceOf(
                    usersVaultContract.address
                  );

                  txResult = await usersVaultContract
                    .connect(user3)
                    .claimAssets(AMOUNT_1E18.mul(10), user3Address);
                });

                it("THEN contract should return correct vaules", async () => {
                  const user3withdrawal =
                    await usersVaultContract.userWithdrawals(user3Address);
                  // (1500/1480 * 10) - (claimedAmount)
                  const assetPerShare = AMOUNT_1E18.mul(1500)
                    .mul(AMOUNT_1E18)
                    .div(AMOUNT_1E18.mul(1480));
                  const assetPerShareMulAmountClaimed = assetPerShare
                    .mul(AMOUNT_1E18.mul(10))
                    .div(AMOUNT_1E18);
                  const userUnclaimedAssets = assetPerShareMulAmountClaimed.sub(
                    AMOUNT_1E18.mul(10)
                  );
                  expect(user3withdrawal.round).to.equal(1);
                  expect(user3withdrawal.unclaimedAssets).to.equal(
                    userUnclaimedAssets
                  );

                  // assetPerShare * sum of withdrawals (20)
                  const processedWithdrawAssets = assetPerShare
                    .mul(AMOUNT_1E18.mul(20))
                    .div(AMOUNT_1E18);
                  expect(processedWithdrawAssets).to.equal(
                    await usersVaultContract.processedWithdrawAssets()
                  );
                });

                it("THEN contract underlying balance should be decreased", async () => {
                  vaultBalanceAfter = await usdcTokenContract.balanceOf(
                    usersVaultContract.address
                  );
                  expect(vaultBalanceBefore.sub(AMOUNT_1E18.mul(10))).to.equal(
                    vaultBalanceAfter
                  );
                });
                it("THEN user 3 balance should be increased", async () => {
                  userBalanceAfter = await usdcTokenContract.balanceOf(
                    user3Address
                  );
                  expect(userBalanceBefore.add(AMOUNT_1E18.mul(10))).to.equal(
                    userBalanceAfter
                  );
                });
                it("THEN it should emit an Event", async () => {
                  await expect(txResult)
                    .to.emit(usersVaultContract, "AssetsClaimed")
                    .withArgs(
                      BigNumber.from(2),
                      AMOUNT_1E18.mul(10),
                      user3Address,
                      user3Address
                    );
                });
              });
            });
          });
        });
      });

      describe("WHEN trying to make an executeOnProtocol call", async () => {
        let TraderWalletMockFactory: ContractFactory;
        let traderWalletMockContract: TraderWalletMock;

        const traderOperation = {
          operationId: 10,
          data: ethers.utils.hexlify("0x1234"),
        };

        before(async () => {
          TraderWalletMockFactory = await ethers.getContractFactory(
            "TraderWalletMock"
          );

          // deploy trader wallet mock to return a valid adapter address
          traderWalletMockContract =
            (await TraderWalletMockFactory.deploy()) as TraderWalletMock;
          await traderWalletMockContract.deployed();

          // set the wallet in the vault
          await usersVaultContract.setTraderWalletAddress(
            traderWalletMockContract.address
          );

          // set the vault in the mock contract
          await traderWalletMockContract.setUsersVault(
            usersVaultContract.address
          );
        });

        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not trader", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(nonAuthorized)
                  .executeOnProtocol(1, traderOperation, BigNumber.from(1))
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "UserNotAllowed"
              );
            });
          });

          describe("WHEN Adapter does not exist in registry", function () {
            it("THEN it should fail", async () => {
              await expect(
                traderWalletMockContract.callExecuteOnProtocolFromVault(
                  11,
                  traderOperation,
                  BigNumber.from(1)
                )
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "InvalidAdapter"
              );
            });
          });

          describe("WHEN Adapter exists but execution fails", function () {
            before(async () => {
              // : deprecated
              // change returnValue to return true on function call
              // await adaptersRegistryContract.setReturnValue(true);
              // await adaptersRegistryContract.setReturnAddress(
              //   adapterContract.address
              // );

              // : deprecated
              // add the adapter into the array and mapping
              // so the call to the executeOnProtocol returns the adapter address
              // await usersVaultContract.connect(owner).addAdapterToUse(2);

              // set the adapter address to return
              await traderWalletMockContract.setAddressToReturn(
                adapterContract.address
              );

              // change returnValue to return true on function call on allowed operation
              await adapterContract.setExecuteOperationReturn(false);
            });
            it("THEN it should fail", async () => {
              await expect(
                traderWalletMockContract.callExecuteOnProtocolFromVault(
                  2,
                  traderOperation,
                  BigNumber.from(1)
                )
              )
                .to.be.revertedWithCustomError(
                  usersVaultContract,
                  "AdapterOperationFailed"
                )
                .withArgs("vault");
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

              // : deprecated
              // add the adapter into the array and mapping
              // so the call to the executeOnProtocol returns the adapter address
              // await usersVaultContract.connect(owner).addAdapterToUse(2);

              // set the adapter address to return
              await traderWalletMockContract.setAddressToReturn(
                adapterContract.address
              );

              // change returnValue to return true on function call on allowed operation
              await adapterContract.setExecuteOperationReturn(true);

              txResult =
                await traderWalletMockContract.callExecuteOnProtocolFromVault(
                  2,
                  traderOperation,
                  BigNumber.from(1)
                );
            });
            after(async () => {
              await snapshot.restore();
            });
            it("THEN it should emit an Event", async () => {
              // await expect(txResult)
              //   .to.emit(usersVaultContract, "OperationExecuted")
              //   .withArgs(
              //     adapterContract.address,
              //     { _timestamp: undefined } as any,
              //     "trader wallet",
              //     false,
              //     { _initialBalance: undefined } as any,
              //     BigNumber.from("1000000000000000000")
              //   );
              await expect(txResult).to.emit(
                usersVaultContract,
                "OperationExecuted"
              );
            });
          });
        });
      });

      describe("WHEN trying to make a rollover", async () => {
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN caller is not trader", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract.connect(nonAuthorized).rolloverFromTrader()
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "UserNotAllowed"
              );
            });
          });
          describe("WHEN no cumulatives pending", async () => {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract.connect(traderWallet).rolloverFromTrader()
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "InvalidRollover"
              );
            });
          });
        });

        describe("WHEN calling with correct parameters on round ZERO", function () {
          before(async () => {
            // contractBalanceBefore = await usdcTokenContract.balanceOf(
            //   usersVaultContract.address
            // );
            vaultBalanceBefore = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            // traderBalanceBefore = await usdcTokenContract.balanceOf(
            //   traderAddress
            // );

            await usersVaultContract
              .connect(user1)
              .userDeposit(AMOUNT_1E18.mul(100).mul(8));
          });

          it("THEN before rollover all round balance variables should be ZERO", async () => {
            expect(await usersVaultContract.afterRoundVaultBalance()).to.equal(
              ZERO_AMOUNT
            );

            expect(await usersVaultContract.initialVaultBalance()).to.equal(
              ZERO_AMOUNT
            );
          });

          describe("WHEN rollover on users vault succeed", function () {
            before(async () => {
              txResult = await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();
            });

            it("THEN after rollover afterRoundVaultBalance should be plain underlying balances", async () => {
              expect(
                await usersVaultContract.afterRoundVaultBalance()
              ).to.equal(AMOUNT_1E18.mul(100).mul(8));
            });
            it("THEN after deposit initialVaultBalance should be plain underlying balances", async () => {
              expect(await usersVaultContract.initialVaultBalance()).to.equal(
                AMOUNT_1E18.mul(100).mul(8)
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult).to.emit(
                usersVaultContract,
                "RolloverExecuted"
              );
              // .withArgs(BLOCK TIME STAMP, 0);
            });
            it("THEN currentRound should be increased", async () => {
              expect(await usersVaultContract.currentRound()).to.equal(1);
            });

            it("THEN cumulativePendingDeposits/traderProfit/vaultProfit should be ZERO", async () => {
              expect(await usersVaultContract.pendingWithdrawShares()).to.equal(
                ZERO_AMOUNT
              );
              expect(await usersVaultContract.pendingDepositAssets()).to.equal(
                ZERO_AMOUNT
              );
              expect(await usersVaultContract.vaultProfit()).to.equal(
                ZERO_AMOUNT
              );
            });
          });
        });
      });

      // it("THEN ==> User 1 Claim ALL Shares", async () => {

      //   console.log('Balance user 1 Before claim: ', await usersVaultContract.balanceOf(user1Address));
      //   await usersVaultContract.connect(user1).claimAllShares(user1Address);
      //   console.log('Balance user 1 After claim: ', await usersVaultContract.balanceOf(user1Address));
      // });

      /// UPGRADABILITY TESTS
      /// UPGRADABILITY TESTS
      /// UPGRADABILITY TESTS
      /// UPGRADABILITY TESTS
      describe("WHEN trying to UPGRADE the contract", async () => {
        let UsersVaultV2Factory: ContractFactory;
        let usersVaultV2Contract: UsersVaultV2;

        before(async () => {
          UsersVaultV2Factory = await ethers.getContractFactory(
            "UsersVaultV2"
            // {
            //   libraries: {
            //     GMXAdapter: gmxAdapterContract.address,
            //   },
            // }
          );
          usersVaultV2Contract = (await upgrades.upgradeProxy(
            usersVaultContract.address,
            UsersVaultV2Factory
            // { unsafeAllowLinkedLibraries: true }
          )) as UsersVaultV2;
          await usersVaultV2Contract.deployed();
        });
        it("THEN it should maintain previous storage", async () => {
          expect(await usersVaultV2Contract.underlyingTokenAddress()).to.equal(
            underlyingTokenAddress
          );
          expect(await usersVaultV2Contract.adaptersRegistryAddress()).to.equal(
            adaptersRegistryContract.address
          );
          expect(await usersVaultV2Contract.contractsFactoryAddress()).to.equal(
            contractsFactoryContract.address
          );
          expect(await usersVaultV2Contract.traderWalletAddress()).to.equal(
            traderWalletAddress
          );
          // expect(await usersVaultV2Contract.dynamicValueAddress()).to.equal(
          //   dynamicValueAddress
          // );
          expect(await usersVaultV2Contract.owner()).to.equal(ownerAddress);
        });

        it("THEN it should contains the new function to set the added variable", async () => {
          await usersVaultV2Contract.addedMethod(AMOUNT_1E18);

          expect(await usersVaultV2Contract.addedVariable()).to.equal(
            AMOUNT_1E18
          );
        });
      });
    });
  });
});
