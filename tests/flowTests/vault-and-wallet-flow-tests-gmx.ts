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
  ERC20,
  IGmxPositionRouter,
  Lens,
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
  claimShares,
} from "../_helpers/functions";
import { setupContracts } from "../_helpers/setupFork";
import { addLiquidity, createPool, initializePool } from "../helpers/UniswapV3/createPool";
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

let usdcTokenContract: ERC20;
let wbtcTokenContract: ERC20;

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

    before(async() => {
      traderInputAmount = utils.parseUnits("1000", 6);
      user1InputAmount = utils.parseUnits("5000", 6);

      // initial funds
      usdcHolder0 = await ethers.getImpersonatedSigner(tokenHolders.usdc[0]);
      await usdcTokenContract.connect(usdcHolder0).transfer(traderAddress, traderInputAmount);
      await usdcTokenContract.connect(usdcHolder0).transfer(user1Address, user1InputAmount);


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
    }); 
  
    describe("GMX Trading Flow", function () {
      
      before(async() => {

      });

      describe("Create Long Increase position for Wallet and Vault with whole balance", function () {
        const protocolId = 1;   // GMX 
        const operationId = 0;  // increasePosition
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
          sizeDelta = utils.parseUnits("2000", 30);
          isLong = true;
          const tradeData = abiCoder.encode(
            ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
            [path, indexToken, amountIn, minOut, sizeDelta, isLong]
            );
          const tradeOperation = { operationId, data: tradeData };

          txResult = await traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate);

          const txReceipt = await txResult.wait();
      
          const events = txReceipt.events?.filter((event: any) => event.topics[0] === createIncreasePositionEvent)

          walletRequestKey = requestKeyFromEvent(events[0]);
          vaultRequestKey = requestKeyFromEvent(events[1]);

          console.log("requestKey", walletRequestKey)
          console.log("requestKey", vaultRequestKey)

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
          
          // @todo
          // close positions
          // rollover
          xdescribe("Rollover after first trade", function() {
            let traderBalanceBefore: BigNumber;
            let walletBalance: BigNumber;

            before(async() => {
              roundCounter = roundCounter.add(1);

              traderBalanceBefore = await usdcTokenContract.balanceOf(traderAddress);
              walletBalance = await usdcTokenContract.balanceOf(traderWalletContract.address);

              await traderWalletContract.connect(trader).withdrawRequest(walletBalance);
              await usersVaultContract.connect(user1).claimShares(amountIn, user1Address);
              await usersVaultContract.connect(user1).withdrawRequest(amountIn);
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

            xit("Should pay to user1 trader (increase user1 balance)", async () => {

            });

            xdescribe("User withdraws profit after trading", function() {
              before(async() => {
                // @todo issue ZeroAmount();
                await usersVaultContract.connect(user1).claimAllAssets(user1Address)
              });
              
              xit("Should increase users balance", async () => {
                console.log("User balance after ", await usdcTokenContract.balanceOf(user1Address));
              });
            });

          });

        });
      });

    });
  
  });
});
