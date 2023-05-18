import { ethers } from "hardhat";
import { 
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
  constants
} from "ethers";
import {
  SnapshotRestorer,
  takeSnapshot,
  setBalance,
  setCode
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  TraderWallet,
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  ERC20Mock,
  IGmxPositionRouter,
  Lens,
  GmxVaultPriceFeedMock,
  IGmxVault,
} from "../../typechain-types";
import {
  TEST_TIMEOUT,
  ZERO_AMOUNT,
  ZERO_ADDRESS,
  AMOUNT_1E18,
  AMOUNT_1E6,
} from "../_helpers/constants";
import {
  usersDeposit,
  mintForUsers,
  approveForUsers,
  claimShares,
} from "../_helpers/functions";
import { setupContracts } from "../_helpers/setupFork";
import { addLiquidity, createPool, initializePool } from "../_helpers/UniswapV3/createPool";
import { tokens, gmx, tokenHolders } from "../_helpers/arbitrumAddresses";

const createIncreasePositionEvent = utils.keccak256(utils.toUtf8Bytes("CreateIncreasePosition(address,bytes32)"))
const createDecreasePositionEvent = utils.keccak256(utils.toUtf8Bytes("CreateDecreasePosition(address,bytes32)"))

function requestKeyFromEvent(event: any): string {
  const requestKey = event.data.slice(66)
  return `0x${requestKey}`;
}

const abiCoder = new utils.AbiCoder();
let snapshot: SnapshotRestorer;

let deployer: Signer;
let trader: Signer;
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
let traderAddress: string;
let underlyingTokenAddress: string;
let adaptersRegistryAddress: string;
let traderWalletAddress: string;
let dynamicValueAddress: string;
let otherAddress: string;
let ownerAddress: string;
let user1Address: string;
let user2Address: string;
let user3Address: string;
let user4Address: string;
let user5Address: string;
let usdcHolder0: Signer;


let txResult: ContractTransaction;
let traderWalletContract: TraderWallet;
let usersVaultContract: UsersVault;
let contractsFactoryContract: ContractsFactoryMock;
let adaptersRegistryContract: AdaptersRegistryMock;
let adapterContract: AdapterMock;
let gmxPositionRouter: IGmxPositionRouter;
let LensFactory: ContractFactory;
let lensContract: Lens;
let gmxVaultPriceFeedMockContract: GmxVaultPriceFeedMock;
let gmxVaultPriceFeedMock: GmxVaultPriceFeedMock;
let gmxVault: IGmxVault;

let usdcTokenContract: ERC20Mock;
let wbtcTokenContract: ERC20Mock;

let userBalanceBefore: BigNumber;
let userBalanceAfter: BigNumber;
let vaultBalanceBefore: BigNumber;
let vaultBalanceAfter: BigNumber;

let signers: Array<Signer>;
let userAddresses: Array<string>;

// let uniswapAdapterContract: UniswapV3Adapter
// let uniswapRouter: IUniswapV3Router;
// let uniswapQuoter: IQuoterV2;
// let uniswapFactory: IUniswapV3Factory;
// let uniswapPositionManager: INonfungiblePositionManager;

let roundCounter: BigNumber;


describe("Vault and Wallet Flow Tests on GMX", function () {

  before(async () => {
    // get signers
    [
      deployer,
      dynamicValue,
      nonAuthorized,
      otherSigner,
      user1,
      user2,
      user3,
      user4,
      user5,
    ] = await ethers.getSigners();

    // get addresses
    [
      deployerAddress,
      dynamicValueAddress,
      otherAddress,
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ] = await Promise.all([
      deployer.getAddress(),
      dynamicValue.getAddress(),
      otherSigner.getAddress(),
      user1.getAddress(),
      user2.getAddress(),
      user3.getAddress(),
      user4.getAddress(),
      user5.getAddress(),
    ]);

    // build signers array
    signers = [user1, user2, user3, user4, user5];

    // build user addresses array
    userAddresses = [
      user1Address,
      user2Address,
      user3Address,
      user4Address,
      user5Address,
    ];

    // deploy contracts
    const contract = await setupContracts(deployer, deployerAddress);
    usdcTokenContract = contract.usdcTokenContract;
    wbtcTokenContract = contract.wbtcTokenContract;
    contractsFactoryContract = contract.contractsFactoryContract;
    adaptersRegistryContract = contract.adaptersRegistryContract;
    adapterContract = contract.adapterContract;
    traderWalletContract = contract.traderWalletContract;
    usersVaultContract = contract.usersVaultContract;
    lensContract = contract.lensContract;
    gmxPositionRouter = await ethers.getContractAt("IGmxPositionRouter", gmx.positionRouterAddress);
    gmxVault = await ethers.getContractAt("IGmxVault", gmx.vaultAddress);

    trader = deployer;
    owner = deployer;
    traderAddress = deployerAddress;
    ownerAddress = deployerAddress;
    underlyingTokenAddress = usdcTokenContract.address;

    const GmxPriceFeedFactory = await ethers.getContractFactory("GmxVaultPriceFeedMock")
    gmxVaultPriceFeedMockContract = await GmxPriceFeedFactory.deploy();
    await gmxVaultPriceFeedMockContract.deployed();

    roundCounter = BigNumber.from(0);

    // take a snapshot
    snapshot = await takeSnapshot();
  });

  describe("WHEN Checking first Values", function () {
    it("THEN it should return correct ones after deployment", async () => {
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
        traderWalletContract.address
      );

      expect(await usersVaultContract.owner()).to.equal(ownerAddress);

      /////////////////////////////////////////////////////////////
      /////////////////////////////////////////////////////////////
      
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
      expect(await traderWalletContract.owner()).to.equal(ownerAddress);

      expect(await traderWalletContract.cumulativePendingDeposits()).to.equal(
        ZERO_AMOUNT
      );
      expect(
        await traderWalletContract.cumulativePendingWithdrawals()
      ).to.equal(ZERO_AMOUNT);
      expect(
        await traderWalletContract.currentRound()
      ).to.equal(roundCounter);

      expect(
        await usersVaultContract.totalSupply()
      ).to.equal(ZERO_AMOUNT);
      expect(
        await usersVaultContract.currentRound()
      ).to.equal(roundCounter);
    });
  });

  describe("Initial deposits", function () {
    let traderInputAmount: BigNumber;
    let user1InputAmount: BigNumber;
    let user2InputAmount: BigNumber;

    let traderInitialBalance: BigNumber;
    let user1InitialBalance: BigNumber;

    before(async() => {
      traderInputAmount = utils.parseUnits("1000", 6);
      user1InputAmount = utils.parseUnits("5000", 6);

      // initial funds
      usdcHolder0 = await ethers.getImpersonatedSigner(tokenHolders.usdc[0]);
      await usdcTokenContract.connect(usdcHolder0).transfer(traderAddress, traderInputAmount);
      await usdcTokenContract.connect(usdcHolder0).transfer(user1Address, user1InputAmount);

      traderInitialBalance = await usdcTokenContract.balanceOf(traderAddress);
      user1InitialBalance = await usdcTokenContract.balanceOf(user1Address);

      await usdcTokenContract.connect(trader)
        .approve(traderWalletContract.address, traderInputAmount);
      await usdcTokenContract.connect(user1)
        .approve(usersVaultContract.address, user1InputAmount);

      await traderWalletContract.connect(trader)
        .traderDeposit(traderInputAmount);
      await usersVaultContract.connect(user1)
        .userDeposit(user1InputAmount);
    })

    it("Should updates trader's and user's deposits in the contracts", async () => {
      expect(await traderWalletContract.cumulativePendingDeposits())
        .to.equal(traderInputAmount);

      const { round, pendingAssets, unclaimedShares } = await usersVaultContract
        .userDeposits(user1Address);
      expect(round).to.equal(ZERO_AMOUNT);
      expect(pendingAssets).to.equal(user1InputAmount);
      expect(unclaimedShares).to.equal(ZERO_AMOUNT);
    });

    it("Should increase USDC balances of the Wallet and Vault", async () => {
      expect(await usdcTokenContract.balanceOf(traderWalletContract.address))
        .to.equal(traderInputAmount);

      expect(await usdcTokenContract.balanceOf(usersVaultContract.address))
        .to.equal(user1InputAmount);

      // console.log(await usdcTokenContract.balanceOf(traderWalletContract.address));
      // console.log(await usdcTokenContract.balanceOf(usersVaultContract.address));
      
    });

    describe("Executing first rollover", function () {
      before(async() => {
        roundCounter = roundCounter.add(1);
        await traderWalletContract.connect(trader).rollover();
      });

      it("Should increase current round counter", async () => {
        expect(
          await traderWalletContract.currentRound()
        ).to.equal(roundCounter);
        expect(
          await usersVaultContract.currentRound()
        ).to.equal(roundCounter);
      });

      it("Should increase Vault's totalSupply", async () => {
        expect(
          await usersVaultContract.totalSupply()
        ).to.equal(user1InputAmount);

      });
    }); 
  
    describe("GMX Trading Flow", function () {
      
      before(async() => {

      });

      describe("Create Long Increase position for Wallet and Vault with whole balance", function () {
        const protocolId = 1;   // GMX 
        const replicate = true;
        let collateralToken: string;
        let indexToken: string;
        let sizeDelta: BigNumber;
        let isLong: boolean;

        let keeper: Signer;
        let walletRequestKey: string;
        let vaultRequestKey: string;
        
        before(async () => {
          // top-up ether balances to pay execution fee
          await trader.sendTransaction(
            { to: traderWalletContract.address, value: utils.parseEther("0.2") }
          );
          await trader.sendTransaction(
            { to: usersVaultContract.address, value: utils.parseEther("0.2") }
          );

          const tokenIn = usdcTokenContract.address;
          collateralToken = wbtcTokenContract.address;
          indexToken = collateralToken;
          const path = [tokenIn, collateralToken];
          const amountIn = traderInputAmount;
          const minOut = 0;
          sizeDelta = utils.parseUnits("10000", 30); // leverage x10
          isLong = true;
          const tradeData = abiCoder.encode(
            ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
            [path, indexToken, amountIn, minOut, sizeDelta, isLong]
            );
          const operationId = 0;  // increasePosition
          const tradeOperation = { operationId, data: tradeData };

          txResult = await traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate);

          const txReceipt = await txResult.wait();
      
          const events = txReceipt.events?.filter((event: any) => event.topics[0] === createIncreasePositionEvent)

          if (events) {
            walletRequestKey = requestKeyFromEvent(events[0]);
            vaultRequestKey = requestKeyFromEvent(events[1]);
          }
        });

        it("Should sell all USDC tokens", async () => {
          expect(
            await usdcTokenContract.balanceOf(traderWalletContract.address)
            ).to.equal(ZERO_AMOUNT);
          expect(
            await usdcTokenContract.balanceOf(usersVaultContract.address)
            ).to.equal(ZERO_AMOUNT);  
        });

        it("Should create IncreasePositionRequest in GMX.PositionRouter contract for Wallet ", async() => {
          const walletCreatedRequest = await gmxPositionRouter.increasePositionRequests(walletRequestKey);
          expect(walletCreatedRequest.account).to.equal(traderWalletContract.address);
          expect(walletCreatedRequest.amountIn).to.equal(traderInputAmount);
        });

        it("Should create IncreasePositionRequest in GMX.PositionRouter contract for Vault ", async() => {
          const vaultCreatedRequest = await gmxPositionRouter.increasePositionRequests(vaultRequestKey);
          expect(vaultCreatedRequest.account).to.equal(usersVaultContract.address);
          expect(vaultCreatedRequest.amountIn).to.equal(user1InputAmount);
        });


        describe("Execute increasing positions by a keeper", function () {
          before(async () => {
            keeper = await ethers.getImpersonatedSigner(gmx.keeper);
            await setBalance(gmx.keeper, utils.parseEther("10"));
            await gmxPositionRouter.connect(keeper).executeIncreasePosition(walletRequestKey, gmx.keeper);
            await gmxPositionRouter.connect(keeper).executeIncreasePosition(vaultRequestKey, gmx.keeper);

          });

          it("Should remove Wallet's IncreasePositionRequest after executing ", async() => {
            const createdRequest = await gmxPositionRouter.increasePositionRequests(walletRequestKey);
            expect(createdRequest.account).to.equal(constants.AddressZero);
            expect(createdRequest.indexToken).to.equal(constants.AddressZero);
            expect(createdRequest.amountIn).to.equal(constants.Zero);
          });

          it("Should remove Vault's IncreasePositionRequest after executing ", async() => {
            const createdRequest = await gmxPositionRouter.increasePositionRequests(vaultRequestKey);
            expect(createdRequest.account).to.equal(constants.AddressZero);
            expect(createdRequest.indexToken).to.equal(constants.AddressZero);
            expect(createdRequest.amountIn).to.equal(constants.Zero);
          });

          it("Should return opened position from positions list for Wallet", async() => {
            const position = await lensContract.getPositions(
                traderWalletContract.address,
                [collateralToken],
                [indexToken],
                [isLong]
              );
            const [ size ] = position;
            expect(size).to.equal(sizeDelta);
          });

          it("Should return opened position from positions list for Vault", async() => {
            const position = await lensContract.getPositions(
                usersVaultContract.address,
                [collateralToken],
                [indexToken],
                [isLong]
              );
            const [ size ] = position;
            expect(size).to.equal(sizeDelta.mul(5));
          });

          describe("When indexToken price rose up (+1000 USD)", function () {
            let currentPriceWbtc: BigNumber;
            let newPriceWbtc: BigNumber;

            before(async() => {
              // local snapshot?

              // get current price
              const usdcPrice = await gmxVault.getMaxPrice(usdcTokenContract.address);
              currentPriceWbtc = await gmxVault.getMaxPrice(indexToken);
              newPriceWbtc = currentPriceWbtc.add(utils.parseUnits("1000", 30)); 

              const gmxPriceFeedMockCode = await ethers.provider.getCode(gmxVaultPriceFeedMockContract.address);
              await setCode(gmx.vaultPriceFeedAddress, gmxPriceFeedMockCode);
              gmxVaultPriceFeedMock = await ethers.getContractAt("GmxVaultPriceFeedMock", gmx.vaultPriceFeedAddress);
  
              // increase price
              await gmxVaultPriceFeedMock.setPrice(indexToken, newPriceWbtc);
              // and set price for swap back token
              await gmxVaultPriceFeedMock.setPrice(usdcTokenContract.address, usdcPrice);
            });

            after(async() => {
              // revert local snapshot
            });

            describe("Closing position", function () {

              before(async() => {
                const tokenOut = tokens.usdc;
                const path = [collateralToken, tokenOut];
                const collateralDelta = 0;
                const minOut = 0;

                const tradeData = abiCoder.encode(
                  ["address[]", "address", "uint256", "uint256", "bool", "uint256"],
                  [path, indexToken, collateralDelta, sizeDelta, isLong, minOut]
                );
                const operationId = 1; // decrease position
                const tradeOperation = { operationId, data: tradeData };
                txResult = await traderWalletContract.connect(trader).executeOnProtocol(
                  protocolId,
                  tradeOperation,
                  replicate
                );
                const txReceipt = await txResult.wait();
              });

              it("Should create decrease requests for Wallet", async () => {
                const walletRequest = await lensContract
                  .getLatestDecreaseRequest(traderWalletContract.address);
                expect(walletRequest.sizeDelta).to.equal(sizeDelta);
                expect(walletRequest.indexToken).to.equal(wbtcTokenContract.address);
              });

              it("Should create decrease requests for Vault", async () => {
                const vaultRequest = await lensContract
                  .getLatestDecreaseRequest(usersVaultContract.address);
                expect(vaultRequest.sizeDelta).to.equal(sizeDelta.mul(5));
                expect(vaultRequest.indexToken).to.equal(wbtcTokenContract.address);
              });

              describe("Execute decreasing position by a keeper", function () {
                let walletDecreaseRequestKey: string;
                let vaultDecreaseRequestKey: string;
                before(async () => {
                  walletDecreaseRequestKey = await lensContract.getRequestKey(traderWalletContract.address, 1);
                  vaultDecreaseRequestKey = await lensContract.getRequestKey(usersVaultContract.address, 1);

                  await gmxPositionRouter.connect(keeper).executeDecreasePosition(walletDecreaseRequestKey, gmx.keeper);
                  await gmxPositionRouter.connect(keeper).executeDecreasePosition(vaultDecreaseRequestKey, gmx.keeper);
                });
                it("Should remove trader's DecreasePositionRequest after executing", async() => {
                  const walletRequest = await lensContract.getLatestDecreaseRequest(traderWalletContract.address);
                  expect(walletRequest.sizeDelta).to.equal(ZERO_AMOUNT);
                  expect(walletRequest.indexToken).to.equal(ZERO_ADDRESS);
                });
                it("Should remove vault's DecreasePositionRequest after executing", async() => {
                  const vaultRequest = await lensContract.getLatestDecreaseRequest(usersVaultContract.address);
                  expect(vaultRequest.sizeDelta).to.equal(ZERO_AMOUNT);
                  expect(vaultRequest.indexToken).to.equal(ZERO_ADDRESS);
                });
                it("Should return nothing for traderWallet position from positions list", async() => {
                  const position = await lensContract.getPositions(
                    traderWalletContract.address,
                    [collateralToken],
                    [indexToken],
                    [isLong]
                  );
                  const [ size ] = position;
                  expect(size).to.equal(ZERO_AMOUNT);
                });
                it("Should return nothing for Vault position from positions list", async() => {
                  const position = await lensContract.getPositions(
                    usersVaultContract.address,
                    [collateralToken],
                    [indexToken],
                    [isLong]
                  );
                  const [ size ] = position;
                  expect(size).to.equal(ZERO_AMOUNT);
                });
                it("Should increase Wallet USDC balance", async() => {
                  const walletNewBalance = await usdcTokenContract.balanceOf(usersVaultContract.address);
                  expect(walletNewBalance).to.be.gt(traderInputAmount);
                });
                it("Should increase Vault USDC balance", async() => {
                  const vaultNewBalance = await usdcTokenContract.balanceOf(usersVaultContract.address);
                  expect(vaultNewBalance).to.be.gt(user1InputAmount);
                });

                describe("Rollover after first trade", function() {
                  let traderBalanceBefore: BigNumber;
                  let walletBalance: BigNumber;
      
                  before(async() => {
                    roundCounter = roundCounter.add(1);

                    traderBalanceBefore = await usdcTokenContract.balanceOf(traderAddress);
                    walletBalance = await usdcTokenContract.balanceOf(traderWalletContract.address);
                    await traderWalletContract.connect(trader).withdrawRequest(walletBalance);

                    const shares = await usersVaultContract.previewShares(user1Address);
                    await usersVaultContract.connect(user1).claimShares(shares, user1Address);
                    await usersVaultContract.connect(user1).withdrawRequest(shares);
                    await traderWalletContract.connect(trader).rollover();
                  });
      
                  it("Should increase current round counter", async () => {
                    expect(
                      await traderWalletContract.currentRound()
                    ).to.equal(roundCounter);
                    expect(
                      await usersVaultContract.currentRound()
                    ).to.equal(roundCounter);
                  });
      
                  it("Should pay out whole profit to trader (increase trader balance)", async () => {
                    expect(await usdcTokenContract.balanceOf(traderWalletContract.address))
                      .to.equal(ZERO_AMOUNT);
                    expect(await usdcTokenContract.balanceOf(traderAddress))
                      .to.equal(traderBalanceBefore.add(walletBalance));
                  });
      
      
                  describe("User withdraws profit after trading", function() {
                    let user1BalanceBefore: BigNumber;
                    let vaultBalanceBefore: BigNumber;
    
                    before(async() => {
                      user1BalanceBefore = await usdcTokenContract.balanceOf(user1Address);
                      vaultBalanceBefore = await usdcTokenContract.balanceOf(usersVaultContract.address);
    
                      const claimableAssets = await usersVaultContract.previewAssets(user1Address)
                      // console.log("claimableAssets:", claimableAssets);
                      await usersVaultContract.connect(user1).claimAssets(claimableAssets, user1Address);
    
                    });
    
                    it("Should withdraw all tokens from Vault contract", async () => {
                      expect(await usdcTokenContract.balanceOf(usersVaultContract.address))
                        .to.equal(ZERO_AMOUNT);
                    });
    
                    it("Should return profitable user1 balance after trading", async () => {
                      const userBalance = await usdcTokenContract.balanceOf(user1Address)
    
                      expect(userBalance).to.equal(user1BalanceBefore.add(vaultBalanceBefore));
                      expect(userBalance).to.be.gt(user1InitialBalance);
                    });
    
                  });
      
                });
                
              });
            });
          });
        });
      });
    });
  });
});
