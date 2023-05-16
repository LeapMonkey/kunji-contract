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
let vaultBalanceBefore: BigNumber;
let userSharesBalanceBefore: BigNumber;
let vaultSharesBalanceBefore: BigNumber;

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

      // describe("WHEN trying to set the underlyingTokenAddress", async () => {
      //   describe("WHEN calling with invalid caller or parameters", function () {
      //     describe("WHEN caller is not owner", function () {
      //       it("THEN it should fail", async () => {
      //         await expect(
      //           usersVaultContract
      //             .connect(nonAuthorized)
      //             .setUnderlyingTokenAddress(otherAddress)
      //         ).to.be.revertedWith("Ownable: caller is not the owner");
      //       });
      //     });

      //     describe("WHEN address is invalid", function () {
      //       it("THEN it should fail", async () => {
      //         await expect(
      //           usersVaultContract
      //             .connect(owner)
      //             .setUnderlyingTokenAddress(ZERO_ADDRESS)
      //         )
      //           .to.be.revertedWithCustomError(
      //             usersVaultContract,
      //             "ZeroAddress"
      //           )
      //           .withArgs("_underlyingTokenAddress");
      //       });
      //     });
      //   });

      //   describe("WHEN calling with correct caller and address", function () {
      //     before(async () => {
      //       txResult = await usersVaultContract
      //         .connect(owner)
      //         .setUnderlyingTokenAddress(otherAddress);
      //     });
      //     after(async () => {
      //       await snapshot.restore();
      //     });
      //     it("THEN new address should be stored", async () => {
      //       expect(await usersVaultContract.underlyingTokenAddress()).to.equal(
      //         otherAddress
      //       );
      //     });
      //     it("THEN it should emit an Event", async () => {
      //       await expect(txResult)
      //         .to.emit(usersVaultContract, "UnderlyingTokenAddressSet")
      //         .withArgs(otherAddress);
      //     });
      //   });
      // });

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
            const vaultBalanceAfter = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            expect(vaultBalanceAfter).to.equal(vaultBalanceBefore.add(AMOUNT));
          });

          it("THEN user balance should decrease", async () => {
            const userBalanceAfter = await usdcTokenContract.balanceOf(
              user1Address
            );
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

      describe("WHEN trying to make a claimShares", async () => {
        after(async () => {
          await snapshot.restore();
        });
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN calling on round ZERO", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .claimShares(AMOUNT_1E18, user1Address)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "InvalidRound"
              );
            });
          });

          describe("WHEN rollover was executed so round is > 0", function () {
            before(async () => {
              // deposit so rollover can happen
              await usersVaultContract.connect(user1).userDeposit(AMOUNT_1E18);

              // rollover so minting can happen
              await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();
            });
            after(async () => {
              await snapshot.restore();
            });
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
                    .claimShares(
                      BigNumber.from(AMOUNT_1E18.mul(2)),
                      user1Address
                    )
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
                  "InsufficientShares"
                );
              });
            });
          });

          describe("WHEN calling claimShares with right parameters", function () {
            const AMOUNT = AMOUNT_1E18.mul(30);
            let userPendingAssets: BigNumber;
            let userUnclaimedShares: BigNumber;

            before(async () => {
              // user deposits for starting on round 0
              // user1 = 100
              // user2 = 200
              // user3 = 300
              // user4 = 400
              // user5 = 500
              await usersDeposit(
                usersVaultContract,
                signers,
                AMOUNT_1E18.mul(100),
                5
              );

              vaultSharesBalanceBefore = await usersVaultContract.balanceOf(
                usersVaultContract.address
              );
              userSharesBalanceBefore = await usersVaultContract.balanceOf(
                user3Address
              );

              // rollover so minting can happen
              await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();

              // preview and claim shares
              const sharesPreview = await usersVaultContract.previewShares(
                user3Address
              );
              expect(sharesPreview).to.equal(AMOUNT_1E18.mul(300));

              // get user previous mapping data
              const userDeposits = await usersVaultContract.userDeposits(
                user3Address
              );
              userPendingAssets = userDeposits.pendingAssets;
              userUnclaimedShares = userDeposits.unclaimedShares;
              expect(userPendingAssets).to.equal(AMOUNT_1E18.mul(300));
              expect(userUnclaimedShares).to.equal(ZERO_AMOUNT);

              txResult = await usersVaultContract
                .connect(user3)
                .claimShares(AMOUNT, user3Address);
            });

            it("THEN user shares should increase", async () => {
              const userSharesBalanceAfter = await usersVaultContract.balanceOf(
                user3Address
              );
              expect(userSharesBalanceAfter).to.equal(AMOUNT);
              expect(userSharesBalanceAfter).to.equal(
                userSharesBalanceBefore.add(AMOUNT)
              );
            });
            it("THEN contract shares should decrease", async () => {
              const vaultSharesBalance = await usersVaultContract.balanceOf(
                usersVaultContract.address
              );
              const sharesAmountOnContract = AMOUNT_1E18.mul(1500).sub(AMOUNT);
              expect(vaultSharesBalance).to.equal(sharesAmountOnContract);
              expect(vaultSharesBalance).to.equal(
                await usersVaultContract.getSharesContractBalance()
              );
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult)
                .to.emit(usersVaultContract, "SharesClaimed")
                .withArgs(
                  BigNumber.from(1),
                  AMOUNT,
                  user3Address,
                  user3Address
                );
            });
            it("THEN user3 deposit mapping should return correct values", async () => {
              const userDeposits = await usersVaultContract.userDeposits(
                user3Address
              );
              expect(await usersVaultContract.currentRound()).to.equal(
                BigNumber.from(1)
              );
              expect(userDeposits.round).to.equal(BigNumber.from(0));
              expect(userDeposits.pendingAssets).to.equal(BigNumber.from(0));
              expect(userDeposits.unclaimedShares).to.equal(
                userPendingAssets.sub(AMOUNT)
              );
            });
          });
        });
      });

      describe("WHEN trying to make a withdrawRequest", async () => {
        after(async () => {
          await snapshot.restore();
        });
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN calling on round ZERO", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract.connect(user1).withdrawRequest(AMOUNT_1E18)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "InvalidRound"
              );
            });
          });
          describe("WHEN rollover was executed so round is > 0", function () {
            before(async () => {
              // deposit so rollover can happen
              await usersVaultContract.connect(user1).userDeposit(AMOUNT_1E18);

              // rollover so minting can happen
              await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();
            });
            after(async () => {
              await snapshot.restore();
            });
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
                  usersVaultContract.connect(user1).withdrawRequest(ZERO_AMOUNT)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAmount"
                );
              });
            });
          });
        });

        describe("WHEN calling withdrawRequest with right parameters", function () {
          const AMOUNT = AMOUNT_1E18.mul(30);
          let userPendingShares: BigNumber;
          let userUnclaimedAssets: BigNumber;
          let contractPendingWithdrawShares: BigNumber;

          before(async () => {
            // user deposits for starting on round 0
            // user1 = 100
            // user2 = 200
            // user3 = 300
            // user4 = 400
            // user5 = 500
            await usersDeposit(
              usersVaultContract,
              signers,
              AMOUNT_1E18.mul(100),
              5
            );

            // rollover so minting can happen
            await usersVaultContract.connect(traderWallet).rolloverFromTrader();

            // claim shares so withdraw can happen
            await usersVaultContract
              .connect(user3)
              .claimShares(AMOUNT, user3Address);

            vaultSharesBalanceBefore = await usersVaultContract.balanceOf(
              usersVaultContract.address
            );
            userSharesBalanceBefore = await usersVaultContract.balanceOf(
              user3Address
            );

            // get user previous mapping data
            const userWithdrawals = await usersVaultContract.userWithdrawals(
              user3Address
            );
            userPendingShares = userWithdrawals.pendingShares;
            userUnclaimedAssets = userWithdrawals.unclaimedAssets;
            contractPendingWithdrawShares =
              await usersVaultContract.pendingWithdrawShares();
            expect(userPendingShares).to.equal(ZERO_AMOUNT);
            expect(userUnclaimedAssets).to.equal(ZERO_AMOUNT);
            expect(contractPendingWithdrawShares).to.equal(ZERO_AMOUNT);

            // approve so does not fail on allowance
            await usersVaultContract
              .connect(user3)
              .approve(user3Address, AMOUNT);
            txResult = await usersVaultContract
              .connect(user3)
              .withdrawRequest(AMOUNT);
          });

          it("THEN user shares should decrease", async () => {
            const userSharesBalanceAfter = await usersVaultContract.balanceOf(
              user3Address
            );
            expect(userSharesBalanceAfter).to.equal(ZERO_AMOUNT);
            expect(userSharesBalanceAfter).to.equal(
              userSharesBalanceBefore.sub(AMOUNT)
            );
          });
          it("THEN contract shares should increase", async () => {
            const vaultSharesBalance = await usersVaultContract.balanceOf(
              usersVaultContract.address
            );
            const sharesAmountOnContract = AMOUNT_1E18.mul(1500);
            expect(vaultSharesBalance).to.equal(sharesAmountOnContract);
            expect(vaultSharesBalance).to.equal(
              await usersVaultContract.getSharesContractBalance()
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "WithdrawRequest")
              .withArgs(user3Address, usdcTokenContract.address, AMOUNT);
          });
          it("THEN user3 withdraw mapping should return correct values", async () => {
            const userWithdrawals = await usersVaultContract.userWithdrawals(
              user3Address
            );
            expect(await usersVaultContract.currentRound()).to.equal(
              BigNumber.from(1)
            );

            expect(userWithdrawals.round).to.equal(BigNumber.from(1));
            expect(userWithdrawals.pendingShares).to.equal(AMOUNT);
            expect(userWithdrawals.unclaimedAssets).to.equal(ZERO_AMOUNT);

            const contractPendingWithdrawSharesNow =
              await usersVaultContract.pendingWithdrawShares();
            expect(contractPendingWithdrawSharesNow).to.equal(
              contractPendingWithdrawShares.add(AMOUNT)
            );
          });
        });
      });

      describe("WHEN trying to make a claimAssets", async () => {
        after(async () => {
          await snapshot.restore();
        });
        describe("WHEN calling with invalid caller or parameters", function () {
          describe("WHEN calling on round ZERO", function () {
            it("THEN it should fail", async () => {
              await expect(
                usersVaultContract
                  .connect(user1)
                  .claimAssets(AMOUNT_1E18, user1Address)
              ).to.be.revertedWithCustomError(
                usersVaultContract,
                "InvalidRound"
              );
            });
          });
          describe("WHEN rollover was executed so round is > 0", function () {
            const AMOUNT = AMOUNT_1E18.mul(30);
            before(async () => {
              // deposit so rollover can happen
              await usersVaultContract.connect(user3).userDeposit(AMOUNT);

              // rollover so minting can happen
              await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();

              // claim shares so withdraw can happen
              await usersVaultContract
                .connect(user3)
                .claimShares(AMOUNT, user3Address);

              // approve so does not fail on allowance
              await usersVaultContract
                .connect(user3)
                .approve(user3Address, AMOUNT);

              // withdraw request so claim assets can happen after rollover
              await usersVaultContract
                .connect(user3)
                .withdrawRequest(AMOUNT_1E18);
            });
            after(async () => {
              await snapshot.restore();
            });
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
                    .claimAssets(ZERO_AMOUNT, user1Address)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
                  "ZeroAmount"
                );
              });
            });
            describe("WHEN amount requested is larger than available for user", function () {
              before(async () => {
                // change returnValue to return true on function call
                await contractsFactoryContract.setReturnValue(true);
              });
              it("THEN it should fail", async () => {
                await expect(
                  usersVaultContract
                    .connect(user3)
                    .claimAssets(AMOUNT_1E18.mul(3000), user3Address)
                ).to.be.revertedWithCustomError(
                  usersVaultContract,
                  "InsufficientAssets"
                );
              });
            });
          });
        });

        describe("WHEN calling claimAssets with right parameters", function () {
          const AMOUNT = AMOUNT_1E18.mul(30);
          let userPendingShares: BigNumber;
          let userUnclaimedAssets: BigNumber;
          let contractPendingWithdrawShares: BigNumber;

          before(async () => {
            // user deposits for starting on round 0
            // user1 = 100
            // user2 = 200
            // user3 = 300
            // user4 = 400
            // user5 = 500
            await usersDeposit(
              usersVaultContract,
              signers,
              AMOUNT_1E18.mul(100),
              5
            );

            // rollover so minting can happen
            await usersVaultContract.connect(traderWallet).rolloverFromTrader();

            // claim shares so withdraw can happen
            await usersVaultContract
              .connect(user3)
              .claimShares(AMOUNT, user3Address);

            // approve so does not fail on allowance
            await usersVaultContract
              .connect(user3)
              .approve(user3Address, AMOUNT);

            // withdraw request so claim assets can happen after rollover
            await usersVaultContract.connect(user3).withdrawRequest(AMOUNT);

            // rollover so shares can be burned
            await usersVaultContract.connect(traderWallet).rolloverFromTrader();

            vaultBalanceBefore = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            userBalanceBefore = await usdcTokenContract.balanceOf(user3Address);

            // get user previous mapping data
            const userWithdrawals = await usersVaultContract.userWithdrawals(
              user3Address
            );
            userPendingShares = userWithdrawals.pendingShares;
            userUnclaimedAssets = userWithdrawals.unclaimedAssets;
            contractPendingWithdrawShares =
              await usersVaultContract.pendingWithdrawShares();
            expect(userPendingShares).to.equal(AMOUNT);
            expect(userUnclaimedAssets).to.equal(ZERO_AMOUNT);
            expect(contractPendingWithdrawShares).to.equal(ZERO_AMOUNT);

            txResult = await usersVaultContract
              .connect(user3)
              .claimAssets(AMOUNT.div(2), user3Address);
          });

          it("THEN user usdc balance should increase", async () => {
            const userBalanceAfter = await usdcTokenContract.balanceOf(
              user3Address
            );
            expect(userBalanceAfter).to.equal(
              AMOUNT_1E18.mul(700).add(AMOUNT.div(2))
            );
            expect(userBalanceAfter).to.equal(
              userBalanceBefore.add(AMOUNT.div(2))
            );
          });
          it("THEN contract usdc balance should decrease", async () => {
            const vaultBalance = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            expect(vaultBalance).to.equal(
              AMOUNT_1E18.mul(1500).sub(AMOUNT_1E18.mul(15))
            );
            expect(vaultBalance).to.equal(
              vaultBalanceBefore.sub(AMOUNT.div(2))
            );
          });
          it("THEN it should emit an Event", async () => {
            await expect(txResult)
              .to.emit(usersVaultContract, "AssetsClaimed")
              .withArgs(
                BigNumber.from(2),
                AMOUNT.div(2),
                user3Address,
                user3Address
              );
          });
          it("THEN user3 withdraw mapping should return correct values", async () => {
            const userWithdrawals = await usersVaultContract.userWithdrawals(
              user3Address
            );
            expect(await usersVaultContract.currentRound()).to.equal(
              BigNumber.from(2)
            );

            expect(userWithdrawals.round).to.equal(BigNumber.from(1));
            expect(userWithdrawals.pendingShares).to.equal(ZERO_AMOUNT);
            expect(userWithdrawals.unclaimedAssets).to.equal(AMOUNT.div(2));
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
        after(async () => {
          await snapshot.restore();
        });
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

        describe("WHEN trying to execute first rollover on round 0", function () {
          const AMOUNT = AMOUNT_1E18.mul(30);
          let userPendingShares: BigNumber;
          let userUnclaimedAssets: BigNumber;
          let contractPendingWithdrawShares: BigNumber;

          before(async () => {
            // user deposits for starting on round 0
            // user1 = 100
            // user2 = 200
            // user3 = 300
            // user4 = 400
            // user5 = 500
            await usersDeposit(
              usersVaultContract,
              signers,
              AMOUNT_1E18.mul(100),
              5
            );

            /*
            // rollover so minting can happen
            await usersVaultContract.connect(traderWallet).rolloverFromTrader();

            // claim shares so withdraw can happen
            await usersVaultContract
              .connect(user3)
              .claimShares(AMOUNT, user3Address);

            // approve so does not fail on allowance
            await usersVaultContract
              .connect(user3)
              .approve(user3Address, AMOUNT);

            // withdraw request so claim assets can happen after rollover
            await usersVaultContract.connect(user3).withdrawRequest(AMOUNT);
            */

            vaultBalanceBefore = await usdcTokenContract.balanceOf(
              usersVaultContract.address
            );
            userBalanceBefore = await usdcTokenContract.balanceOf(user3Address);

            vaultSharesBalanceBefore = await usersVaultContract.balanceOf(
              usersVaultContract.address
            );
            userSharesBalanceBefore = await usersVaultContract.balanceOf(
              user3Address
            );
          });

          it("THEN before rollover all round balance variables should be ZERO", async () => {
            expect(await usersVaultContract.afterRoundVaultBalance()).to.equal(
              ZERO_AMOUNT
            );

            expect(await usersVaultContract.initialVaultBalance()).to.equal(
              ZERO_AMOUNT
            );
          });

          describe("WHEN rollover is executed on round 0", function () {
            before(async () => {
              txResult = await usersVaultContract
                .connect(traderWallet)
                .rolloverFromTrader();
            });
            it("THEN it should emit an Event", async () => {
              await expect(txResult).to.emit(
                usersVaultContract,
                "RolloverExecuted"
              );
            });
            it("THEN currentRound should be increased", async () => {
              expect(await usersVaultContract.currentRound()).to.equal(
                BigNumber.from(1)
              );
            });
            it("THEN pendingWithdrawShares/pendingDepositAssets should be ZERO", async () => {
              expect(await usersVaultContract.pendingWithdrawShares()).to.equal(
                ZERO_AMOUNT
              );
              expect(await usersVaultContract.pendingDepositAssets()).to.equal(
                ZERO_AMOUNT
              );
            });
            it("THEN after rollover afterRoundVaultBalance should be plain underlying balances", async () => {              
              expect(
                await usersVaultContract.afterRoundVaultBalance()
              ).to.equal(AMOUNT_1E18.mul(1500));
            });
            it("THEN after rollover initialVaultBalance should be plain underlying balances", async () => {
              expect(await usersVaultContract.initialVaultBalance()).to.equal(
                AMOUNT_1E18.mul(1500)
              );
            });
            it("THEN contract shares balance should increase", async () => {
              const vaultBalance = await usersVaultContract.balanceOf(
                usersVaultContract.address
              );
              expect(vaultBalance).to.equal(AMOUNT_1E18.mul(1500));
              expect(vaultBalance).to.equal(
                vaultSharesBalanceBefore.add(AMOUNT_1E18.mul(1500))
              );
            });

            describe("WHEN trying to execute rollover on round 1", function () {
              before(async () => {
                // claim shares so withdraw can happen
                await usersVaultContract
                  .connect(user3)
                  .claimShares(AMOUNT, user3Address);

                // approve so does not fail on allowance
                await usersVaultContract
                  .connect(user3)
                  .approve(user3Address, AMOUNT);

                // withdraw request so claim assets can happen after rollover
                await usersVaultContract.connect(user3).withdrawRequest(AMOUNT);

                vaultSharesBalanceBefore = await usersVaultContract.balanceOf(
                  usersVaultContract.address
                );

                txResult = await usersVaultContract
                  .connect(traderWallet)
                  .rolloverFromTrader();
              });
              it("THEN it should emit an Event", async () => {
                await expect(txResult).to.emit(
                  usersVaultContract,
                  "RolloverExecuted"
                );
              });
              it("THEN currentRound should be increased", async () => {
                expect(await usersVaultContract.currentRound()).to.equal(
                  BigNumber.from(2)
                );
              });
              it("THEN pendingWithdrawShares/pendingDepositAssets should be ZERO", async () => {
                expect(
                  await usersVaultContract.pendingWithdrawShares()
                ).to.equal(ZERO_AMOUNT);
                expect(
                  await usersVaultContract.pendingDepositAssets()
                ).to.equal(ZERO_AMOUNT);
              });
              it("THEN after rollover initialVaultBalance should be plain underlying balances", async () => {
                expect(await usersVaultContract.initialVaultBalance()).to.equal(
                  AMOUNT_1E18.mul(1500)
                );
              });
              it("THEN contract shares balance should decrease", async () => {
                const vaultBalance = await usersVaultContract.balanceOf(
                  usersVaultContract.address
                );
                expect(vaultBalance).to.equal((AMOUNT_1E18.mul(1500)).sub(AMOUNT));
                expect(vaultBalance).to.equal(
                  vaultSharesBalanceBefore.sub(AMOUNT)
                );
              });
            });
          });
        });
      });

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
