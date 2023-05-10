import { setBalance, setCode } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
  constants,
} from "ethers";
import { ethers, upgrades } from "hardhat";
import {
  GMXAdapter,
  TraderWallet,
  Lens,
  ERC20,
  IGmxReader,
  IGmxRouter,
  IGmxVault,
  IGmxPositionRouter,
  IGmxOrderBook,
  GmxVaultPriceFeedMock,
  IGmxPositionManager,
} from "../../typechain-types";
import Reverter from "../_helpers/reverter";
import { ReverterLocal } from "../_helpers/reverter";
import { tokens, gmx, tokenHolders } from "../_helpers/arbitrumAddresses";

const reverter = new Reverter();
const reverterLocal = new ReverterLocal();

const abiCoder = new utils.AbiCoder();

let deployer: Signer;
let vault: Signer;
let trader: Signer;
let adaptersRegistry: Signer;
let contractsFactory: Signer;
let dynamicValue: Signer;
let nonAuthorized: Signer;
let otherSigner: Signer;
let owner: Signer;
let usdcHolder0: Signer;

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
let usdcTokenContract: ERC20;
let wbtcTokenContract: ERC20;
let contractBalanceBefore: BigNumber;
let contractBalanceAfter: BigNumber;
let traderBalanceBefore: BigNumber;
let traderBalanceAfter: BigNumber;

let GMXAdapterFactory: ContractFactory;
let gmxAdapterLibrary: GMXAdapter;
let gmxRouter: IGmxRouter;
let gmxPositionRouter: IGmxPositionRouter;
let gmxReader: IGmxReader;
let gmxVault: IGmxVault;
let gmxOrderBook: IGmxOrderBook;
let gmxVaultPriceFeedMockContract: GmxVaultPriceFeedMock;
let gmxVaultPriceFeedMock: GmxVaultPriceFeedMock;
let gmxPositionManager: IGmxPositionManager;
let LensFactory: ContractFactory;
let lensContract: Lens;

const protocolId = 1; // GMX

const createIncreasePositionEvent = utils.keccak256(
  utils.toUtf8Bytes("CreateIncreasePosition(address,bytes32)")
);
const createDecreasePositionEvent = utils.keccak256(
  utils.toUtf8Bytes("CreateDecreasePosition(address,bytes32)")
);
// const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function requestKeyFromEvent(event: any): string {
  const requestKey = event.data.slice(66);
  return `0x${requestKey}`;
}

describe("GMXAdapter", function () {
  before(async () => {
    gmxRouter = await ethers.getContractAt("IGmxRouter", gmx.routerAddress);
    gmxPositionRouter = await ethers.getContractAt(
      "IGmxPositionRouter",
      gmx.positionRouterAddress
    );
    gmxReader = await ethers.getContractAt("IGmxReader", gmx.readerAddress);
    gmxVault = await ethers.getContractAt("IGmxVault", gmx.vaultAddress);
    gmxOrderBook = await ethers.getContractAt(
      "IGmxOrderBook",
      gmx.orderBookAddress
    );
    gmxPositionManager = await ethers.getContractAt(
      "IGmxPositionManager",
      gmx.positionManagerAddress
    );

    [
      deployer,
      vault,
      trader,
      adaptersRegistry,
      contractsFactory,
      dynamicValue,
      nonAuthorized,
      otherSigner,
      owner,
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
      ownerAddress,
    ] = await Promise.all([
      deployer.getAddress(),
      vault.getAddress(),
      trader.getAddress(),
      adaptersRegistry.getAddress(),
      contractsFactory.getAddress(),
      dynamicValue.getAddress(),
      nonAuthorized.getAddress(),
      otherSigner.getAddress(),
      owner.getAddress(),
    ]);

    wbtcTokenContract = await ethers.getContractAt("ERC20", tokens.wbtc);
    usdcTokenContract = await ethers.getContractAt("ERC20", tokens.usdc);
    underlyingTokenAddress = usdcTokenContract.address;

    usdcHolder0 = await ethers.getImpersonatedSigner(tokenHolders.usdc[0]);
    await usdcTokenContract
      .connect(usdcHolder0)
      .transfer(traderAddress, utils.parseUnits("1000", 6));

    LensFactory = await ethers.getContractFactory("Lens");
    lensContract = (await LensFactory.deploy()) as Lens;
    await lensContract.deployed();

    GMXAdapterFactory = await ethers.getContractFactory("GMXAdapter");
    gmxAdapterLibrary = (await GMXAdapterFactory.deploy()) as GMXAdapter;
    await gmxAdapterLibrary.deployed();

    TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
      // libraries: {
      //   GMXAdapter: gmxAdapterLibrary.address,
      // },
    });
    traderWalletContract = (await upgrades.deployProxy(
      TraderWalletFactory,
      [
        underlyingTokenAddress,
        adaptersRegistryAddress,
        contractsFactoryAddress,
        traderAddress,
        dynamicValueAddress,
        ownerAddress,
      ],
      {
        initializer: "initialize",
      }
    )) as TraderWallet;

    await traderWalletContract.deployed();

    // mock interaction
    // await traderWalletContract.connect(trader).addAdapterToUse(protocolId, gmx.routerAddress);

    const GmxPriceFeedFactory = await ethers.getContractFactory(
      "GmxVaultPriceFeedMock"
    );
    gmxVaultPriceFeedMockContract = await GmxPriceFeedFactory.deploy();
    await gmxVaultPriceFeedMockContract.deployed();

    await reverter.snapshot();
  });

  describe("Adapter deployment parameters", function () {
    describe("Correct initial fixture", function () {
      it("Should has USDC balance on the trader address", async () => {
        expect(await usdcTokenContract.balanceOf(traderAddress)).to.equal(
          utils.parseUnits("1000", 6)
        );
      });
    });

    describe("Correct initial parameters", function () {
      it("Should has approval for positionRouter plugin", async () => {
        expect(
          await gmxRouter.approvedPlugins(
            traderWalletContract.address,
            gmxPositionRouter.address
          )
        ).to.equal(true);
      });
    });

    describe("Reverts with creating new orders", function () {
      const amount = utils.parseUnits("1000", 6);
      const replicate = false;

      let indexToken: string;
      let collateralToken: string;
      let msgValue: BigNumber;
      let tradeOperation: any;
      before(async () => {
        await usdcTokenContract
          .connect(trader)
          .approve(traderWalletContract.address, amount);
        await traderWalletContract.connect(trader).traderDeposit(amount);
        const isLong = true;
        const tokenIn = tokens.usdc;
        collateralToken = tokens.wbtc;
        indexToken = collateralToken;
        const path = [tokenIn, collateralToken];
        const amountIn = amount.add(1);
        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);

        const tradeData = abiCoder.encode(
          ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
          [path, indexToken, amountIn, minOut, sizeDelta, isLong]
        );
        const operationId = 0; // increasePosition
        tradeOperation = { operationId, data: tradeData };
        msgValue = await gmxPositionRouter.minExecutionFee();
      });

      after(async () => {
        await reverter.revert();
      });

      it("Should revert if Wallet does not have enough Ether for fee", async () => {
        await expect(
          traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate)
        ).to.be.revertedWithCustomError(
          gmxAdapterLibrary.attach(traderWalletContract.address),
          "InsufficientEtherBalance"
        );
      });

      it("Should revert with insufficient balance", async () => {
        await trader.sendTransaction({
          to: traderWalletContract.address,
          value: utils.parseEther("0.2"),
        });
        await expect(
          traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate)
        )
          .to.be.revertedWithCustomError(
            gmxAdapterLibrary.attach(traderWalletContract.address),
            "CreateIncreasePositionFail"
          )
          .withArgs("ERC20: transfer amount exceeds balance");
      });

      it("Should revert if operation is invalid", async () => {
        const operationId = 10;
        tradeOperation.operationId = operationId;
        await expect(
          traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate)
        ).to.be.revertedWithCustomError(
          gmxAdapterLibrary.attach(traderWalletContract.address),
          "InvalidOperationId"
        );
      });
    });

    describe("Open and close LONG trader position", function () {
      const amount = utils.parseUnits("1000", 6);
      const replicate = false;
      const isLong = true;

      let indexToken: string;
      let collateralToken: string;
      let requestKey: string;
      let keeper: Signer;
      before(async () => {
        await trader.sendTransaction({
          to: traderWalletContract.address,
          value: utils.parseEther("0.2"),
        });
        await usdcTokenContract
          .connect(trader)
          .approve(traderWalletContract.address, amount);
        await traderWalletContract.connect(trader).traderDeposit(amount);
        const tokenIn = tokens.usdc;
        collateralToken = tokens.wbtc;
        indexToken = collateralToken;
        const path = [tokenIn, collateralToken];
        const amountIn = amount;
        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);
        // const acceptablePrice = await gmxVault.getMaxPrice(indexToken);

        const tradeData = abiCoder.encode(
          ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
          [path, indexToken, amountIn, minOut, sizeDelta, isLong]
        );
        const operationId = 0; // increasePosition
        const tradeOperation = { operationId, data: tradeData };
        // const msgValue = await gmxPositionRouter.minExecutionFee();

        txResult = await traderWalletContract
          .connect(trader)
          .executeOnProtocol(protocolId, tradeOperation, replicate);
        const txReceipt = await txResult.wait();

        const events = txReceipt.events?.filter(
          (event: any) => event.topics[0] === createIncreasePositionEvent
        )[0];
        requestKey = requestKeyFromEvent(events);
      });

      after(async () => {
        await reverter.revert();
      });

      it("Should emit event with create increase position requestKey", async () => {
        // const gmxAdapterLibrary = await ethers.getContractAt("GMXAdapter", traderWalletContract.address);
        await expect(txResult)
          .to.emit(
            gmxAdapterLibrary.attach(traderWalletContract.address),
            "CreateIncreasePosition"
          )
          .withArgs(traderWalletContract.address, requestKey);
      });

      it("Should spent all trader's balance", async () => {
        expect(await usdcTokenContract.balanceOf(traderAddress)).to.equal(0);
      });

      it("Should create IncreasePositionRequest in GMX.PositionRouter contract ", async () => {
        const createdRequest = await gmxPositionRouter.increasePositionRequests(
          requestKey
        );
        expect(createdRequest.account).to.equal(traderWalletContract.address);
        expect(createdRequest.amountIn).to.equal(amount);
      });

      describe("Execute increasing position by a keeper", function () {
        before(async () => {
          keeper = await ethers.getImpersonatedSigner(gmx.keeper);
          await setBalance(gmx.keeper, utils.parseEther("10"));
          await gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper);
        });

        it("Should remove IncreasePositionRequest after executing ", async () => {
          const createdRequest =
            await gmxPositionRouter.increasePositionRequests(requestKey);
          expect(createdRequest.account).to.equal(constants.AddressZero);
          expect(createdRequest.indexToken).to.equal(constants.AddressZero);
          expect(createdRequest.amountIn).to.equal(constants.Zero);
        });

        it("Should return opened position from positions list", async () => {
          const position = await lensContract.getPositions(
            traderWalletContract.address,
            [collateralToken],
            [indexToken],
            [isLong]
          );
          const [size] = position;
          expect(size).to.equal(utils.parseUnits("2000", 30));
        });
      });

      describe("Closing position", function () {
        let sizeDelta: BigNumber;

        before(async () => {
          const tokenOut = tokens.usdc;
          const path = [collateralToken, tokenOut];
          const collateralDelta = 0;
          sizeDelta = utils.parseUnits("2000", 30);
          // const acceptablePrice = await gmxVault.getMinPrice(indexToken);
          const minOut = 0;

          const tradeData = abiCoder.encode(
            ["address[]", "address", "uint256", "uint256", "bool", "uint256"],
            [path, indexToken, collateralDelta, sizeDelta, isLong, minOut]
          );
          const operationId = 1; // decrease position
          const tradeOperation = { operationId, data: tradeData };
          // const msgValue = await gmxPositionRouter.minExecutionFee();
          
          txResult = await traderWalletContract.connect(trader).executeOnProtocol(
            protocolId,
            tradeOperation,
            replicate
          );
          const txReceipt = await txResult.wait();

          const events = txReceipt.events?.filter(
            (event: any) => event.topics[0] === createDecreasePositionEvent
          )[0];
          requestKey = requestKeyFromEvent(events);
        });

        it("Should emit event with create decrease position requestKey", async () => {
          // const gmxAdapterLibrary = await ethers.getContractAt("GMXAdapter", traderWalletContract.address);
          await expect(txResult)
            .to.emit(
              gmxAdapterLibrary.attach(traderWalletContract.address),
              "CreateDecreasePosition"
            )
            .withArgs(traderWalletContract.address, requestKey);
        });

        it("Should create DecreasePositionRequest in GMX.PositionRouter contract ", async () => {
          const createdRequest =
            await gmxPositionRouter.decreasePositionRequests(requestKey);
          expect(createdRequest.account).to.equal(traderWalletContract.address);
          expect(createdRequest.sizeDelta)
            .to.equal(sizeDelta)
            .to.equal(utils.parseUnits("2000", 30));
        });

        describe("Execute decreasing position by a keeper", function () {
          before(async () => {
            await gmxPositionRouter
              .connect(keeper)
              .executeDecreasePosition(requestKey, gmx.keeper);
          });

          it("Should remove DecreasePositionRequest after executing ", async () => {
            const createdRequest =
              await gmxPositionRouter.decreasePositionRequests(requestKey);
            expect(createdRequest.account).to.equal(constants.AddressZero);
            expect(createdRequest.indexToken).to.equal(constants.AddressZero);
            expect(createdRequest.sizeDelta).to.equal(constants.Zero);
          });

          it("Should return zeros for traderWallet position from positions list", async () => {
            const position = await lensContract.getPositions(
              traderWalletContract.address,
              [collateralToken],
              [indexToken],
              [isLong]
            );
            const [size] = position;
            expect(size).to.equal(constants.Zero);
          });
        });
      });
    });

    describe("Open a SHORT trader position", function () {
      const amount = utils.parseUnits("1000", 6);
      const replicate = false;
      const isLong = false;

      let indexToken: string;
      let collateralToken: string;
      let requestKey: string;
      let keeper: Signer;
      before(async () => {
        await trader.sendTransaction({
          to: traderWalletContract.address,
          value: utils.parseEther("0.2"),
        });
        await usdcTokenContract
          .connect(trader)
          .approve(traderWalletContract.address, amount);
        await traderWalletContract.connect(trader).traderDeposit(amount);
        const tokenIn = tokens.usdc;
        collateralToken = tokenIn;
        indexToken = tokens.wbtc;
        const path = [collateralToken];
        const amountIn = amount;
        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);
        // const acceptablePrice = await gmxVault.getMaxPrice(indexToken);

        const tradeData = abiCoder.encode(
          ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
          [path, indexToken, amountIn, minOut, sizeDelta, isLong]
        );
        const operationId = 0; // increasePosition
        const tradeOperation = { operationId, data: tradeData };

        txResult = await traderWalletContract
          .connect(trader)
          .executeOnProtocol(protocolId, tradeOperation, replicate);
        const txReceipt = await txResult.wait();

        const events = txReceipt.events?.filter(
          (event: any) => event.topics[0] === createIncreasePositionEvent
        )[0];
        requestKey = requestKeyFromEvent(events);
      });

      after(async () => {
        await reverter.revert();
      });

      it("Should emit event with create increase position requestKey", async () => {
        // const gmxAdapterLibrary = await ethers.getContractAt("GMXAdapter", traderWalletContract.address);
        await expect(txResult)
          .to.emit(
            gmxAdapterLibrary.attach(traderWalletContract.address),
            "CreateIncreasePosition"
          )
          .withArgs(traderWalletContract.address, requestKey);
      });

      it("Should spent all trader's balance", async () => {
        expect(await usdcTokenContract.balanceOf(traderAddress)).to.equal(0);
      });

      it("Should create IncreasePositionRequest in GMX.PositionRouter contract ", async () => {
        const createdRequest = await gmxPositionRouter.increasePositionRequests(
          requestKey
        );
        expect(createdRequest.account).to.equal(traderWalletContract.address);
        expect(createdRequest.amountIn).to.equal(amount);
      });

      describe("Execute increasing position by a keeper", function () {
        before(async () => {
          keeper = await ethers.getImpersonatedSigner(gmx.keeper);
          await setBalance(gmx.keeper, utils.parseEther("10"));
          await gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper);
        });

        it("Should remove IncreasePositionRequest after executing ", async () => {
          const createdRequest =
            await gmxPositionRouter.increasePositionRequests(requestKey);
          expect(createdRequest.account).to.equal(constants.AddressZero);
          expect(createdRequest.indexToken).to.equal(constants.AddressZero);
          expect(createdRequest.amountIn).to.equal(constants.Zero);
        });

        it("Should return opened position from positions list", async () => {
          const position = await lensContract.getPositions(
            traderWalletContract.address,
            [collateralToken],
            [indexToken],
            [isLong]
          );
          const [size] = position;
          expect(size).to.equal(utils.parseUnits("2000", 30));
        });
      });
    });

    describe("Errors with opening positions LONG", function () {
      const amount = utils.parseUnits("1000", 6);
      const replicate = false;
      const isLong = true;
      let tokenIn: string;

      let indexToken: string;
      let collateralToken: string;
      let requestKey: string;
      let keeper: Signer;
      beforeEach(async () => {
        await trader.sendTransaction({
          to: traderWalletContract.address,
          value: utils.parseEther("0.2"),
        });
        await usdcTokenContract
          .connect(trader)
          .approve(traderWalletContract.address, amount);
        await traderWalletContract.connect(trader).traderDeposit(amount);

        keeper = await ethers.getImpersonatedSigner(gmx.keeper);
        await setBalance(gmx.keeper, utils.parseEther("10"));
      });

      afterEach(async () => {
        await reverter.revert();
      });

      it("Should revert increase Long position if collateral != indexToken", async () => {
        tokenIn = tokens.usdc;
        collateralToken = tokenIn;
        indexToken = tokens.wbtc;
        const path = [tokenIn];
        const amountIn = amount;
        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);
        const tradeData = abiCoder.encode(
          ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
          [path, indexToken, amountIn, minOut, sizeDelta, isLong]
        );
        const operationId = 0; // increasePosition
        const tradeOperation = { operationId, data: tradeData };

        txResult = await traderWalletContract
          .connect(trader)
          .executeOnProtocol(protocolId, tradeOperation, replicate);
        const txReceipt = await txResult.wait();

        const events = txReceipt.events?.filter(
          (event: any) => event.topics[0] === createIncreasePositionEvent
        )[0];
        requestKey = requestKeyFromEvent(events);

        await expect(
          gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper)
        ).to.be.revertedWith("Vault: mismatched tokens");
      });

      it("Should revert increase Long position if collateral == stableToken'", async () => {
        tokenIn = tokens.usdc;
        collateralToken = tokens.usdc;
        indexToken = tokens.usdc;
        const path = [tokenIn];
        const amountIn = amount;
        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);
        const tradeData = abiCoder.encode(
          ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
          [path, indexToken, amountIn, minOut, sizeDelta, isLong]
        );
        const operationId = 0; // increasePosition
        const tradeOperation = { operationId, data: tradeData };
        const msgValue = await gmxPositionRouter.minExecutionFee();

        txResult = await traderWalletContract
          .connect(trader)
          .executeOnProtocol(protocolId, tradeOperation, replicate);
        const txReceipt = await txResult.wait();

        const events = txReceipt.events?.filter(
          (event: any) => event.topics[0] === createIncreasePositionEvent
        )[0];
        requestKey = requestKeyFromEvent(events);

        await expect(
          gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper)
        ).to.be.revertedWith(
          "Vault: _collateralToken must not be a stableToken"
        );
      });
    });

    describe("Limit orders", function () {
      const amount = utils.parseUnits("1000", 6);
      const replicate = false;

      let indexToken: string;
      let collateralToken: string;
      let requestKey: string;
      let limitOrderKeeper: Signer;

      describe("Creating Long Increase Limit order", function () {
        const tokenIn = tokens.usdc;
        collateralToken = tokens.wbtc;
        indexToken = collateralToken; // wbtc
        const path = [tokenIn, collateralToken];
        const amountIn = amount;

        const minOut = 0;
        const sizeDelta = utils.parseUnits("2000", 30);
        const isLong = true;
        const triggerAboveThreshold = true;

        let currentPrice: BigNumber;
        let triggerPrice: BigNumber;

        before(async () => {
          await trader.sendTransaction({
            to: traderWalletContract.address,
            value: utils.parseEther("0.2"),
          });
          await usdcTokenContract
            .connect(trader)
            .approve(traderWalletContract.address, amount);
          await traderWalletContract.connect(trader).traderDeposit(amount);

          limitOrderKeeper = await ethers.getImpersonatedSigner(
            gmx.limitOrderKeeper
          );
          await setBalance(gmx.limitOrderKeeper, utils.parseEther("10"));

          currentPrice = await gmxVault.getMaxPrice(indexToken);
          triggerPrice = currentPrice.add(utils.parseUnits("100", 30));
          const tradeData = abiCoder.encode(
            [
              "address[]",
              "uint256",
              "address",
              "uint256",
              "uint256",
              "bool",
              "uint256",
              "bool",
            ],
            [
              path,
              amountIn,
              indexToken,
              minOut,
              sizeDelta,
              isLong,
              triggerPrice,
              triggerAboveThreshold,
            ]
          );
          const operationId = 2; // createIncreaseOrder
          const tradeOperation = { operationId, data: tradeData };
          txResult = await traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate);
          const txReceipt = await txResult.wait();
        });

        after(async () => {
          reverter.revert();
        });

        it("Should create increase order index for trader wallet account", async () => {
          expect(await lensContract.increaseOrdersIndex(traderWalletContract.address))
            .to.equal(1); // first increase order
        });

        it("Should return correct data of created limit order", async () => {
          const index = 0;
          
          const order = await lensContract.increaseOrders(traderWalletContract.address, index);
          expect(order.account).to.equal(traderWalletContract.address);
          expect(order.purchaseToken).to.equal(collateralToken);
          expect(order.collateralToken).to.equal(collateralToken);
          expect(order.indexToken).to.equal(indexToken);
          expect(order.sizeDelta).to.equal(sizeDelta);
          expect(order.triggerPrice).to.equal(triggerPrice);
        });

        describe("CANCEL the existing increase limit order", function () {
          const orderIndex = 0;
          before(async () => {
            reverterLocal.snapshot();

            const operationId = 4; // cancelIncreaseOrder
            const walletIndex = orderIndex;
            const vaultIndex = orderIndex; // mocked value
            const tradeData = abiCoder.encode(
              ["uint256[]"],
              [[walletIndex, vaultIndex]]
            );
            const tradeOperation = { operationId, data: tradeData };
            txResult = await traderWalletContract
              .connect(trader)
              .executeOnProtocol(protocolId, tradeOperation, replicate);
          });
          after(async () => {
            reverterLocal.revert();
          });

          it("Should return empty data at zero limit order index", async () => {
            const index = 0;
            
            const order = await lensContract.increaseOrders(traderWalletContract.address, index);
            expect(order.account).to.equal(constants.AddressZero);
            expect(order.purchaseToken).to.equal(constants.AddressZero);
            expect(order.collateralToken).to.equal(constants.AddressZero);
            expect(order.indexToken).to.equal(constants.AddressZero);
            expect(order.sizeDelta).to.equal(0);
            expect(order.triggerPrice).to.equal(0);
          });
        });

        describe("UPDATE the existing limit order", function () {
          const orderIndex = 0;
          let newSizeDelta: BigNumber;
          let newTriggerAboveThreshold: boolean;
          before(async () => {
            reverterLocal.snapshot();

            const operationId = 3; // updateIncreaseOrder
            const walletIndex = orderIndex;
            const vaultIndex = orderIndex; // mocked value

            newSizeDelta = sizeDelta.add(utils.parseUnits("100", 30));
            newTriggerAboveThreshold = false;
            const tradeData = abiCoder.encode(
              ["uint256[]", "uint256", "uint256", "bool"],
              [
                [walletIndex, vaultIndex],
                newSizeDelta,
                triggerPrice,
                newTriggerAboveThreshold,
              ]
            );
            const tradeOperation = { operationId, data: tradeData };
            txResult = await traderWalletContract
              .connect(trader)
              .executeOnProtocol(protocolId, tradeOperation, replicate);
          });
          after(async () => {
            reverterLocal.revert();
          });

          it("Should return updated data at zero increase limit order index", async () => {
            const index = 0;
            
            const order = await lensContract.increaseOrders(traderWalletContract.address, index);
            expect(order.account).to.equal(traderWalletContract.address);
            expect(order.purchaseToken).to.equal(collateralToken);
            expect(order.collateralToken).to.equal(collateralToken);
            expect(order.indexToken).to.equal(indexToken);
            expect(order.sizeDelta).to.equal(newSizeDelta);
            expect(order.triggerAboveThreshold).to.equal(
              newTriggerAboveThreshold
            );
          });
        });

        describe("Fail execution increase limit order because price didn't reach trigger", function () {
          it("Should revert order execution because price didn't reach trigger", async () => {
            await expect(
              gmxPositionManager
                .connect(limitOrderKeeper)
                .executeIncreaseOrder(
                  traderWalletContract.address,
                  0,
                  gmx.limitOrderKeeper
                )
            ).to.be.revertedWith("OrderBook: invalid price for execution");
          });
        });

        describe("Executing Long Increase Limit order by limitOrderKeeper", function () {
          before(async () => {
            // mock Gmx PriceFeed
            const gmxPriceFeedMockCode = await ethers.provider.getCode(
              gmxVaultPriceFeedMockContract.address
            );
            await setCode(gmx.vaultPriceFeedAddress, gmxPriceFeedMockCode);
            gmxVaultPriceFeedMock = await ethers.getContractAt(
              "GmxVaultPriceFeedMock",
              gmx.vaultPriceFeedAddress
            );

            // increase price
            await gmxVaultPriceFeedMock.setPrice(
              indexToken,
              triggerPrice.add(1)
            );
            // execute order
            await gmxPositionManager
              .connect(limitOrderKeeper)
              .executeIncreaseOrder(
                traderWalletContract.address,
                0,
                gmx.limitOrderKeeper
              );
          });

          after(async () => {
            reverter.revert();
          });

          it("Should execute created increase order", async () => {
            // check opened position
            expect(await lensContract.increaseOrdersIndex(traderWalletContract.address))
              .to.equal(1); // first increase order

            const position = await lensContract.getPositions(
              traderWalletContract.address,
              [collateralToken],
              [indexToken],
              [isLong]
            );

            const [size, collateralUsdValue] = position;
            expect(size).to.equal(sizeDelta);
            expect(collateralUsdValue).to.be.gt(utils.parseUnits("900", 30));
            expect(collateralUsdValue).to.be.lt(utils.parseUnits("1000", 30));
          });
        });
      });

      describe("Partial Decrease limit order flow", function () {
        const isLong = true;
        const replicate = false;

        let indexToken: string;
        let collateralToken: string;
        let requestKey: string;
        let sizeDelta: BigNumber;
        let openPrice: BigNumber;
        let triggerPrice: BigNumber;
        let keeper: Signer;
        let limitOrderKeeper: Signer;

        before(async () => {
          // prepare - open new long position
          await trader.sendTransaction({
            to: traderWalletContract.address,
            value: utils.parseEther("0.5"),
          });
          await usdcTokenContract
            .connect(trader)
            .approve(traderWalletContract.address, amount);
          await traderWalletContract.connect(trader).traderDeposit(amount);

          const tokenIn = tokens.usdc;
          collateralToken = tokens.wbtc;
          indexToken = collateralToken;
          const path = [tokenIn, collateralToken];
          const amountIn = amount;
          const minOut = 0;
          sizeDelta = utils.parseUnits("2000", 30);
          openPrice = await gmxVault.getMaxPrice(indexToken);

          const tradeData = abiCoder.encode(
            ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
            [path, indexToken, amountIn, minOut, sizeDelta, isLong]
          );
          const operationId = 0; // increasePosition
          const tradeOperation = { operationId, data: tradeData };

          txResult = await traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate);
          const txReceipt = await txResult.wait();
          const events = txReceipt.events?.filter(
            (event: any) => event.topics[0] === createIncreasePositionEvent
          )[0];
          requestKey = requestKeyFromEvent(events);

          // load keepers
          keeper = await ethers.getImpersonatedSigner(gmx.keeper);
          await setBalance(gmx.keeper, utils.parseEther("10"));
          await gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper);
          limitOrderKeeper = await ethers.getImpersonatedSigner(
            gmx.limitOrderKeeper
          );
          await setBalance(gmx.limitOrderKeeper, utils.parseEther("10"));
        });

        after(async () => {
          await reverter.revert();
        });

        it("Should return opened position from positions list", async () => {
          const position = await lensContract.getPositions(
            traderWalletContract.address,
            [collateralToken],
            [indexToken],
            [isLong]
          );
          const [size] = position;
          expect(size).to.equal(utils.parseUnits("2000", 30));
        });

        describe("Creating Partial decrease limit order", function () {
          const triggerAboveThreshold = true; // take part-profit
          const sizeDelta = utils.parseUnits("1000", 30); // decrease 50%
          const collateralDelta = utils.parseUnits("600", 30); // decrease collateral ~60%

          before(async () => {
            triggerPrice = openPrice.add(utils.parseUnits("100", 30));
            const tradeData = abiCoder.encode(
              [
                "address",
                "uint256",
                "address",
                "uint256",
                "bool",
                "uint256",
                "bool",
              ],
              [
                indexToken,
                sizeDelta,
                collateralToken,
                collateralDelta,
                isLong,
                triggerPrice,
                triggerAboveThreshold,
              ]
            );
            const operationId = 5; // createDecreaseOrder
            const tradeOperation = { operationId, data: tradeData };
            txResult = await traderWalletContract
              .connect(trader)
              .executeOnProtocol(protocolId, tradeOperation, replicate);
            const txReceipt = await txResult.wait();
          });

          it("Should create decrease order index for trader wallet account", async () => {
            expect(await lensContract.decreaseOrdersIndex(traderWalletContract.address))
              .to.equal(1); // first decrease order
          });

          it("Should return correct data of created decrease limit order", async () => {
            const index = 0;
            
            const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
            expect(order.account).to.equal(traderWalletContract.address);
            expect(order.collateralToken).to.equal(collateralToken);
            expect(order.collateralDelta).to.equal(collateralDelta);
            expect(order.indexToken).to.equal(indexToken);
            expect(order.sizeDelta).to.equal(sizeDelta);
            expect(order.triggerPrice).to.equal(triggerPrice);
          });

          describe("CANCEL the existing decrease limit order", function () {
            const orderIndex = 0;
            before(async () => {
              reverterLocal.snapshot();

              const operationId = 7; // cancelDecreaseOrder
              const walletIndex = orderIndex;
              const vaultIndex = orderIndex; // mocked value
              const tradeData = abiCoder.encode(
                ["uint256[]"],
                [[walletIndex, vaultIndex]]
              );
              const tradeOperation = { operationId, data: tradeData };
              txResult = await traderWalletContract
                .connect(trader)
                .executeOnProtocol(protocolId, tradeOperation, replicate);
            });

            after(async () => {
              reverterLocal.revert();
            });

            it("Should return empty data at zero limit order index", async () => {
              const index = 0;
              
              const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
              expect(order.account).to.equal(constants.AddressZero);
              expect(order.collateralToken).to.equal(constants.AddressZero);
              expect(order.collateralDelta).to.equal(0);
              expect(order.indexToken).to.equal(constants.AddressZero);
              expect(order.sizeDelta).to.equal(0);
              expect(order.triggerPrice).to.equal(0);
            });
          });

          describe("Update existing decrease limit order", function () {
            const orderIndex = 0;
            let newSizeDelta: BigNumber;
            let newTriggerAboveThreshold: boolean;
            before(async () => {
              reverterLocal.snapshot();

              const operationId = 6; // updateIncreaseOrder
              const walletIndex = orderIndex;
              const vaultIndex = orderIndex; // mocked value

              newSizeDelta = sizeDelta.add(utils.parseUnits("53.21", 30));
              newTriggerAboveThreshold = false;
              const tradeData = abiCoder.encode(
                ["uint256[]", "uint256", "uint256", "uint256", "bool"],
                [
                  [walletIndex, vaultIndex],
                  collateralDelta,
                  newSizeDelta,
                  triggerPrice,
                  newTriggerAboveThreshold,
                ]
              );
              const tradeOperation = { operationId, data: tradeData };
              txResult = await traderWalletContract
                .connect(trader)
                .executeOnProtocol(protocolId, tradeOperation, replicate);
            });
            after(async () => {
              reverterLocal.revert();
            });

            it("Should return updated data at zero decrease limit order index", async () => {
              const index = 0;

              const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
              expect(order.account).to.equal(traderWalletContract.address);
              expect(order.collateralToken).to.equal(collateralToken);
              expect(order.indexToken).to.equal(indexToken);
              expect(order.sizeDelta).to.equal(newSizeDelta);
              expect(order.triggerAboveThreshold).to.equal(
                newTriggerAboveThreshold
              );
            });
          });

          describe("Fail execution decrease limit order because price didn't reach trigger", function () {
            it("Should revert order execution because price didn't reach trigger", async () => {
              await expect(
                gmxPositionManager
                  .connect(limitOrderKeeper)
                  .executeDecreaseOrder(
                    traderWalletContract.address,
                    0,
                    gmx.limitOrderKeeper
                  )
              ).to.be.revertedWith("OrderBook: invalid price for execution");
            });
          });

          describe("Executing Long Decrease order by limitOrderKeeper", function () {
            before(async () => {
              // mock Gmx PriceFeed
              const gmxPriceFeedMockCode = await ethers.provider.getCode(
                gmxVaultPriceFeedMockContract.address
              );
              await setCode(gmx.vaultPriceFeedAddress, gmxPriceFeedMockCode);
              gmxVaultPriceFeedMock = await ethers.getContractAt(
                "GmxVaultPriceFeedMock",
                gmx.vaultPriceFeedAddress
              );

              // increase price
              await gmxVaultPriceFeedMock.setPrice(
                indexToken,
                triggerPrice.add(1)
              );
              // execute order
              txResult = await gmxPositionManager
                .connect(limitOrderKeeper)
                .executeDecreaseOrder(
                  traderWalletContract.address,
                  0,
                  gmx.limitOrderKeeper
                );

              // const txReceipt = await txResult.wait();
              // const events = txReceipt.events?.filter((event: any) => event.topics[0] === transferTopic)
            });

            it("Should execute created decrease order", async () => {
              // check opened position
              const amountIn = utils.parseUnits("1000", 30);
              expect(await lensContract.decreaseOrdersIndex(traderWalletContract.address))
                .to.equal(1); // first decrease order

              const position = await lensContract.getPositions(
                traderWalletContract.address,
                [collateralToken],
                [indexToken],
                [isLong]
              );

              const [size, collateralUsdValue] = position;
              expect(size).to.equal(sizeDelta); // position size in USD
              expect(collateralUsdValue).to.be.gt(
                amountIn.sub(collateralDelta).sub(utils.parseUnits("100", 30))
              ); // position collateral in USD
              expect(collateralUsdValue).to.be.lt(
                amountIn.sub(collateralDelta)
              );
            });
          });
        });
      });

      describe("Full Decrease limit order flow", function () {
        const isLong = true;
        const replicate = false;

        let indexToken: string;
        let collateralToken: string;
        let requestKey: string;
        let sizeDelta: BigNumber;
        let openPrice: BigNumber;
        let triggerPrice: BigNumber;
        let keeper: Signer;
        let limitOrderKeeper: Signer;

        before(async () => {
          // prepare - open new long position
          await trader.sendTransaction({
            to: traderWalletContract.address,
            value: utils.parseEther("0.5"),
          });
          await usdcTokenContract
            .connect(trader)
            .approve(traderWalletContract.address, amount);
          await traderWalletContract.connect(trader).traderDeposit(amount);

          const tokenIn = tokens.usdc;
          collateralToken = tokens.wbtc;
          indexToken = collateralToken;
          const path = [tokenIn, collateralToken];
          const amountIn = amount;
          const minOut = 0;
          sizeDelta = utils.parseUnits("2000", 30);
          openPrice = await gmxVault.getMaxPrice(indexToken);

          const tradeData = abiCoder.encode(
            ["address[]", "address", "uint256", "uint256", "uint256", "bool"],
            [path, indexToken, amountIn, minOut, sizeDelta, isLong]
          );
          const operationId = 0; // increasePosition
          const tradeOperation = { operationId, data: tradeData };

          txResult = await traderWalletContract
            .connect(trader)
            .executeOnProtocol(protocolId, tradeOperation, replicate);
          const txReceipt = await txResult.wait();
          const events = txReceipt.events?.filter(
            (event: any) => event.topics[0] === createIncreasePositionEvent
          )[0];
          requestKey = requestKeyFromEvent(events);

          // load keepers
          keeper = await ethers.getImpersonatedSigner(gmx.keeper);
          await setBalance(gmx.keeper, utils.parseEther("10"));
          await gmxPositionRouter
            .connect(keeper)
            .executeIncreasePosition(requestKey, gmx.keeper);
          limitOrderKeeper = await ethers.getImpersonatedSigner(
            gmx.limitOrderKeeper
          );
          await setBalance(gmx.limitOrderKeeper, utils.parseEther("10"));
        });

        after(async () => {
          await reverter.revert();
        });

        it("Should return opened position from positions list", async () => {
          const position = await lensContract.getPositions(
            traderWalletContract.address,
            [collateralToken],
            [indexToken],
            [isLong]
          );
          const [size] = position;
          expect(size).to.equal(utils.parseUnits("2000", 30));
        });

        describe("Creating Full decrease (close) limit order", function () {
          const triggerAboveThreshold = true; // take part-profit
          const sizeDelta = utils.parseUnits("2000", 30); // decrease 100%
          const collateralDelta = utils.parseUnits("0", 30); // doesn't matter when close position

          before(async () => {
            triggerPrice = openPrice.add(utils.parseUnits("100", 30));
            const tradeData = abiCoder.encode(
              [
                "address",
                "uint256",
                "address",
                "uint256",
                "bool",
                "uint256",
                "bool",
              ],
              [
                indexToken,
                sizeDelta,
                collateralToken,
                collateralDelta,
                isLong,
                triggerPrice,
                triggerAboveThreshold,
              ]
            );
            const operationId = 5; // createDecreaseOrder
            const tradeOperation = { operationId, data: tradeData };
            txResult = await traderWalletContract
              .connect(trader)
              .executeOnProtocol(protocolId, tradeOperation, replicate);
            const txReceipt = await txResult.wait();
          });

          it("Should create decrease order index for trader wallet account", async () => {
            expect(await lensContract.decreaseOrdersIndex(traderWalletContract.address))
              .to.equal(1); // first decrease order
          });

          it("Should return correct data of created decrease limit order", async () => {
            const index = 0;
            
            const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
            expect(order.account).to.equal(traderWalletContract.address);
            expect(order.collateralToken).to.equal(collateralToken);
            expect(order.collateralDelta).to.equal(collateralDelta);
            expect(order.indexToken).to.equal(indexToken);
            expect(order.sizeDelta).to.equal(sizeDelta);
            expect(order.triggerPrice).to.equal(triggerPrice);
          });

          describe("CANCEL the existing decrease limit order", function () {
            const orderIndex = 0;
            before(async () => {
              reverterLocal.snapshot();

              const operationId = 7; // cancelDecreaseOrder
              const walletIndex = orderIndex;
              const vaultIndex = orderIndex; // mocked value
              const tradeData = abiCoder.encode(
                ["uint256[]"],
                [[walletIndex, vaultIndex]]
              );
              const tradeOperation = { operationId, data: tradeData };
              txResult = await traderWalletContract
                .connect(trader)
                .executeOnProtocol(protocolId, tradeOperation, replicate);
            });

            after(async () => {
              reverterLocal.revert();
            });

            it("Should return empty data at zero limit order index", async () => {
              const index = 0;
              
              const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
              expect(order.account).to.equal(constants.AddressZero);
              expect(order.collateralToken).to.equal(constants.AddressZero);
              expect(order.collateralDelta).to.equal(0);
              expect(order.indexToken).to.equal(constants.AddressZero);
              expect(order.sizeDelta).to.equal(0);
              expect(order.triggerPrice).to.equal(0);
            });
          });

          describe("Update existing decrease limit order", function () {
            const orderIndex = 0;
            let newSizeDelta: BigNumber;
            let newTriggerAboveThreshold: boolean;
            before(async () => {
              reverterLocal.snapshot();

              const operationId = 6; // updateIncreaseOrder
              const walletIndex = orderIndex;
              const vaultIndex = orderIndex; // mocked value

              newSizeDelta = sizeDelta.add(utils.parseUnits("53.21", 30));
              newTriggerAboveThreshold = false;
              const tradeData = abiCoder.encode(
                ["uint256[]", "uint256", "uint256", "uint256", "bool"],
                [
                  [walletIndex, vaultIndex],
                  collateralDelta,
                  newSizeDelta,
                  triggerPrice,
                  newTriggerAboveThreshold,
                ]
              );
              const tradeOperation = { operationId, data: tradeData };
              txResult = await traderWalletContract
                .connect(trader)
                .executeOnProtocol(protocolId, tradeOperation, replicate);
            });
            after(async () => {
              reverterLocal.revert();
            });

            it("Should return updated data at zero decrease limit order index", async () => {
              const index = 0;
              
              const order = await lensContract.decreaseOrders(traderWalletContract.address, index);
              expect(order.account).to.equal(traderWalletContract.address);
              expect(order.collateralToken).to.equal(collateralToken);
              expect(order.indexToken).to.equal(indexToken);
              expect(order.sizeDelta).to.equal(newSizeDelta);
              expect(order.triggerAboveThreshold).to.equal(
                newTriggerAboveThreshold
              );
            });
          });

          describe("Fail execution decrease limit order because price didn't reach trigger", function () {
            it("Should revert order execution because price didn't reach trigger", async () => {
              await expect(
                gmxPositionManager
                  .connect(limitOrderKeeper)
                  .executeDecreaseOrder(
                    traderWalletContract.address,
                    0,
                    gmx.limitOrderKeeper
                  )
              ).to.be.revertedWith("OrderBook: invalid price for execution");
            });
          });

          describe("Executing Long Decrease order by limitOrderKeeper", function () {
            before(async () => {
              // mock Gmx PriceFeed
              const gmxPriceFeedMockCode = await ethers.provider.getCode(
                gmxVaultPriceFeedMockContract.address
              );
              await setCode(gmx.vaultPriceFeedAddress, gmxPriceFeedMockCode);
              gmxVaultPriceFeedMock = await ethers.getContractAt(
                "GmxVaultPriceFeedMock",
                gmx.vaultPriceFeedAddress
              );

              // increase price
              await gmxVaultPriceFeedMock.setPrice(
                indexToken,
                triggerPrice.add(1)
              );
              // execute order
              await gmxPositionManager
                .connect(limitOrderKeeper)
                .executeDecreaseOrder(
                  traderWalletContract.address,
                  0,
                  gmx.limitOrderKeeper
                );
            });

            it("Should execute created decrease order", async () => {
              // check opened position
              const amountIn = utils.parseUnits("1000", 30);
              expect(await lensContract.decreaseOrdersIndex(traderWalletContract.address))
                .to.equal(1); // first decrease order
  
              const position = await lensContract.getPositions(
                traderWalletContract.address,
                [collateralToken],
                [indexToken],
                [isLong]
              );

              const [size, collateralUsdValue] = position;
              expect(size).to.equal(0); // position size in USD
              expect(collateralUsdValue).to.equal(0);
            });

            it("Should return collateral tokens balance to contract", async () => {
              const initialAmountUsd = utils.parseUnits("1000", 6);

              const collateralPrice = await gmxVault.getMaxPrice(indexToken);
              const collateralReturn = await wbtcTokenContract.balanceOf(
                traderWalletContract.address
              );
              const returnedBalanceUsd = collateralReturn
                .mul(collateralPrice)
                .div(utils.parseUnits("1", 30));

              expect(returnedBalanceUsd).to.be.gt(initialAmountUsd);
            });
          });
        });
      });
    });
  });
});
