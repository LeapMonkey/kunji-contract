import { ethers } from "hardhat";
import { Signer,
  ContractTransaction,
  BigNumber,
  utils,
  constants
} from "ethers";
import {
  SnapshotRestorer,
  takeSnapshot,
} from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  TraderWallet,
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  ERC20Mock,
  IQuoterV2,
  UniswapV3Adapter,
  IUniswapV3Pool,
  IAdapter,
  IUniswapV3Router,
  IUniswapV3Factory,
  INonfungiblePositionManager
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
} from "../_helpers/functions";
import { setupContracts } from "../_helpers/setup";
import { addLiquidity, createPool, initializePool } from "../_helpers/UniswapV3/createPool";
import { tokens, uniswap } from "../_helpers/arbitrumAddresses";

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

let txResult: ContractTransaction;
let traderWalletContract: TraderWallet;
let usersVaultContract: UsersVault;
let contractsFactoryContract: ContractsFactoryMock;
let adaptersRegistryContract: AdaptersRegistryMock;
let adapterContract: AdapterMock;

let usdcTokenContract: ERC20Mock;
let wethTokenContract: ERC20Mock;
let usdxTokenContract: ERC20Mock;

let userBalanceBefore: BigNumber;
let userBalanceAfter: BigNumber;
let vaultBalanceBefore: BigNumber;
let vaultBalanceAfter: BigNumber;

let signers: Array<Signer>;
let userAddresses: Array<string>;

let uniswapAdapterContract: UniswapV3Adapter
let uniswapRouter: IUniswapV3Router;
// let uniswapQuoter: IQuoterV2;
let uniswapFactory: IUniswapV3Factory;
let uniswapPositionManager: INonfungiblePositionManager;

let roundCounter: BigNumber;


describe("Vault and Wallet Flow Tests", function () {

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
    wethTokenContract = contract.wethTokenContract;
    usdxTokenContract = contract.usdxTokenContract;
    contractsFactoryContract = contract.contractsFactoryContract;
    adaptersRegistryContract = contract.adaptersRegistryContract;
    adapterContract = contract.adapterContract;
    traderWalletContract = contract.traderWalletContract;
    usersVaultContract = contract.usersVaultContract;
    uniswapAdapterContract = contract.uniswapAdapterContract;

    // approve and mint to users 1000 USDC
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

    trader = deployer;
    owner = deployer;
    traderAddress = deployerAddress;
    ownerAddress = deployerAddress;
    underlyingTokenAddress = usdcTokenContract.address;

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

      await usdcTokenContract.mint(traderAddress, traderInputAmount)
      await usdcTokenContract.mint(user1Address, user1InputAmount)

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

      it("Should increase users shares preview", async () => {
        // console.log("user1InputAmount:", user1InputAmount);
        // console.log("shares preview:", await usersVaultContract.previewShares(user1Address));
        expect(await usersVaultContract.previewShares(user1Address)).to.equal(user1InputAmount);
      })

      describe("User claims shares after first rollover", function () {
        let shares: BigNumber;

        before(async() => {
          shares = await usersVaultContract.previewShares(user1Address);
          await usersVaultContract.connect(user1).claimShares(shares, user1Address);
        });

        it("Should increase User 1 share balance", async () => {
          expect(await usersVaultContract.balanceOf(user1Address)).to.equal(shares);
        });

        describe("User creates withdraw request", function () {
          before(async() => {
            const shares = await usersVaultContract.balanceOf(user1Address);

            await usersVaultContract.connect(user1).withdrawRequest(shares);
            // console.log("user's shares:", await usersVaultContract.balanceOf(user1Address));
            // console.log("UserWithdrawal1:", await usersVaultContract.userWithdrawals(user1Address));

          });

          it("Should transfer users shares from user to vault contract", async() => {
            expect(await usersVaultContract.balanceOf(user1Address)).to.equal(ZERO_AMOUNT);
          })
        });
      });
    
      describe("Uniswap Trading Flow", function () {
        let pool: IUniswapV3Pool;
        before(async() => {
          await mintForUsers(
            [deployerAddress],
            usdcTokenContract,
            AMOUNT_1E6.mul(5000000),
            1
          );
          await mintForUsers(
            [deployerAddress],
            wethTokenContract,
            AMOUNT_1E18.mul(5000000),
            1
          );
      
          uniswapRouter = await ethers.getContractAt("IUniswapV3Router", uniswap.routerAddress);
          uniswapFactory = await ethers.getContractAt("IUniswapV3Factory", uniswap.factoryAddress);
          uniswapPositionManager = await ethers.getContractAt("INonfungiblePositionManager", uniswap.positionManagerAddress);

          const fee = 500;
          await createPool(usdcTokenContract.address, wethTokenContract.address, fee);
          const poolAddress = await uniswapFactory.getPool(usdcTokenContract.address, wethTokenContract.address, fee);
          pool = await ethers.getContractAt("IUniswapV3Pool", poolAddress);
          const token0 = await pool.token0();  // usdc
          const token1 = await pool.token1();  // weth
          // console.log("token0", token0, usdcTokenContract.address);
          // console.log("token1", token1, wethTokenContract.address);
          const initSqrtPrice = BigNumber.from("1841935813391833257190961412530039");
          await initializePool(poolAddress, initSqrtPrice);
          const tickMiddle = 201090;
          const tickLower = tickMiddle - 5000;
          const tickUpper = tickMiddle + 5000;
          const amount0Desired = utils.parseUnits("1000000", 6);
          const amount1Desired = utils.parseUnits("540.172", 18);
          await addLiquidity(token0, token1, tickLower, tickUpper, fee, amount0Desired, amount1Desired);
        });

        describe("Sell execution for Wallet and Vault with whole balance", function () {
          const protocolId = 2;
          const operationId = 1;
          const replicate = true;
          const amountIn = utils.parseUnits("1000", 6);
          const fee = 500;

          let amountOutMin: BigNumber;
          // let balanceUsdt: BigNumber;
          let balanceUsdc: BigNumber;
          let expectedAmountOutWallet: BigNumber;
          let expectedAmountOutVault: BigNumber;

          before(async () => {
            const path = utils.solidityPack(
              ["address", "uint24", "address"],
              [usdcTokenContract.address, fee, wethTokenContract.address]
            );

            [ expectedAmountOutWallet ] = await uniswapAdapterContract.callStatic.getAmountOut(path, amountIn);
            [ expectedAmountOutVault] = await uniswapAdapterContract.callStatic.getAmountOut(path, amountIn.mul(5));

            amountOutMin = expectedAmountOutWallet.mul(90).div(100);

            const tradeData = abiCoder.encode(["bytes", "uint256", "uint256"], [path, amountIn, amountOutMin]);
            const tradeOperation = { operationId, data: tradeData };

            txResult = await traderWalletContract
              .connect(trader)
              .executeOnProtocol(protocolId, tradeOperation, replicate);
          });

          it("Should sell all USDC tokens", async () => {
            expect(
              await usdcTokenContract.balanceOf(traderWalletContract.address)
              ).to.equal(ZERO_AMOUNT);
            expect(
              await usdcTokenContract.balanceOf(usersVaultContract.address)
              ).to.equal(ZERO_AMOUNT);  
          });

          it("Should buy WETH tokens and increase balances of Wallet and Vault", async () => {
            expect(await wethTokenContract.balanceOf(traderWalletContract.address))
              .to.be.lte(expectedAmountOutWallet)
              .to.be.gt(expectedAmountOutWallet.mul(90).div(100))
              .to.be.gt(ZERO_AMOUNT);

            expect(await wethTokenContract.balanceOf(usersVaultContract.address))
              .to.be.lte(expectedAmountOutVault)
              .to.be.gt(expectedAmountOutVault.mul(90).div(100))
              .to.be.gt(ZERO_AMOUNT);
          });

          describe("Sell WETH tokens after increasing price of WETH", function () {
            before(async () => {
              // increase weth price by swapping huge amount of USDC to WETH
              let path = utils.solidityPack(
                ["address", "uint24", "address"],
                [usdcTokenContract.address, fee, wethTokenContract.address]
              );
              const amountIn = utils.parseUnits("500000", 6);
              const deadline = 1746350000;
              const swapParams= {
                path,
                recipient: deployerAddress,
                deadline,
                amountIn,
                amountOutMinimum: 0
              }
              await usdcTokenContract.connect(deployer).approve(uniswapRouter.address, constants.MaxUint256);
              await uniswapRouter.connect(deployer).exactInput(swapParams);
            
              // sell all weth tokens
              const currentWethBalance = await wethTokenContract.balanceOf(traderWalletContract.address);
              path = utils.solidityPack(
                ["address", "uint24", "address"],
                [wethTokenContract.address, fee, usdcTokenContract.address]
              );
              const amountOutMin = 0;
              const tradeData = abiCoder.encode(["bytes", "uint256", "uint256"], [path, currentWethBalance, amountOutMin]);
              const tradeOperation = { operationId, data: tradeData };
      
              txResult = await traderWalletContract
                .connect(trader)
                .executeOnProtocol(protocolId, tradeOperation, replicate);
            });

            it("Should sell all WETH tokens", async () => {
              expect(await wethTokenContract.balanceOf(traderWalletContract.address)).to.equal(ZERO_AMOUNT);
              expect(await wethTokenContract.balanceOf(usersVaultContract.address)).to.equal(ZERO_AMOUNT);
            });

            it("Should close position with profit of USDC", async () => {
              expect(await usdcTokenContract.balanceOf(traderWalletContract.address)).to.be.gt(traderInputAmount);
              expect(await usdcTokenContract.balanceOf(usersVaultContract.address)).to.be.gt(user1InputAmount);
              // console.log("cumulativePendingDeposits", await traderWalletContract.cumulativePendingDeposits());
              // console.log("cumulativePendingWithdrawals", await traderWalletContract.cumulativePendingWithdrawals());

            });
            
            describe("Rollover after first trade", function() {
              let traderBalanceBefore: BigNumber;
              let walletBalance: BigNumber;

              let shares: BigNumber;

              before(async() => {
                roundCounter = roundCounter.add(1);

                traderBalanceBefore = await usdcTokenContract.balanceOf(traderAddress);
                walletBalance = await usdcTokenContract.balanceOf(traderWalletContract.address);
                await traderWalletContract.connect(trader).withdrawRequest(walletBalance);

                const shares = await usersVaultContract.balanceOf(user1Address);

                // Rollover after trade
                await traderWalletContract.connect(trader).rollover();

                // console.log("vault  balance:", await usdcTokenContract.balanceOf(usersVaultContract.address))
                // console.log("trader balance:", await usdcTokenContract.balanceOf(traderAddress))
                // console.log("user1  balance:", await usdcTokenContract.balanceOf(user1Address))
              });

              it("Should increase current round counter after first trade", async () => {
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

                expect(await usdcTokenContract.balanceOf(traderAddress))
                  .to.be.gt(traderInitialBalance);
              });

              describe("User withdraws profit after trading", function() {
                let user1BalanceBefore: BigNumber;
                let vaultBalanceBefore: BigNumber;

                before(async() => {
                  user1BalanceBefore = await usdcTokenContract.balanceOf(user1Address);
                  vaultBalanceBefore = await usdcTokenContract.balanceOf(usersVaultContract.address);

                  // @todo fix contract issue with previewAssets() function and then refactor following
                  // const claimableAssets = await usersVaultContract.previewAssets(user1Address)
                  // console.log("claimableAssets:", claimableAssets);
                  // await usersVaultContract.connect(user1).claimAssets(claimableAssets, user1Address);

                  // mocked until 'todo' not fixed
                  const claimableAssetsMock = await usdcTokenContract.balanceOf(usersVaultContract.address);
                  await usersVaultContract.connect(user1).claimAssets(claimableAssetsMock, user1Address);
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
