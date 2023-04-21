import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
  constants
} from "ethers";
import { ethers, upgrades } from "hardhat";
import { 
  GMXAdapter,
  TraderWallet,
  ERC20,
  IGmxReader,
  IGmxRouter,
  IGmxVault,
  IGmxPositionRouter
} from "../../typechain-types";
import {
    TEST_TIMEOUT,
    ZERO_AMOUNT,
    ZERO_ADDRESS,
    AMOUNT_100,
  } from "../helpers/constants";
import Reverter from "../helpers/reverter";
import { tokens, gmx, tokenHolders } from "../helpers/arbitrumAddresses";


const reverter = new Reverter();
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
let contractBalanceBefore: BigNumber;
let contractBalanceAfter: BigNumber;
let traderBalanceBefore: BigNumber;
let traderBalanceAfter: BigNumber;

let GMXAdapterFactory: ContractsFactory;
let gmxAdapterLibrary: GMXAdapter
let gmxRouter: IGmxRouter;
let gmxPositionRouter: IGmxPositionRouter;
let gmxReader: IGmxReader;
let gmxVault: IGmxVault;

const protocolId = 1;

const createIncreasePositionEvent = utils.keccak256(utils.toUtf8Bytes("CreateIncreasePosition(address,bytes32)"))
const createDecreasePositionEvent = utils.keccak256(utils.toUtf8Bytes("CreateDecreasePosition(address,bytes32)"))

function requestKeyFromEvent(event: any): string {
  const requestKey = event.data.slice(66)
  return `0x${requestKey}`;
}

describe("GMXAdapter", function() {
  before(async() => {
    gmxRouter = await ethers.getContractAt("IGmxRouter", gmx.routerAddress);
    gmxPositionRouter = await ethers.getContractAt("IGmxPositionRouter", gmx.positionRouterAddress);
    gmxReader = await ethers.getContractAt("IGmxReader", gmx.readerAddress);
    gmxVault = await ethers.getContractAt("IGmxVault", gmx.vaultAddress);

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

    usdcTokenContract = await ethers.getContractAt("ERC20", tokens.usdc);
    underlyingTokenAddress = usdcTokenContract.address;

    const usdcHolder0 = await ethers.getImpersonatedSigner(tokenHolders.usdc[0]);
    await usdcTokenContract.connect(usdcHolder0).transfer(traderAddress, utils.parseUnits("1000", 6));

    GMXAdapterFactory = await ethers.getContractFactory("GMXAdapter");
    gmxAdapterLibrary = await GMXAdapterFactory.deploy();
    await gmxAdapterLibrary.deployed();

    TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
      // libraries: {
      //   GMXAdapter: gmxAdapterLibrary.address,
      // }, 
    });
    traderWalletContract = (await upgrades.deployProxy(
      TraderWalletFactory,
      [
        vaultAddress,
        underlyingTokenAddress,
        adaptersRegistryAddress,
        contractsFactoryAddress,
        traderAddress,
        dynamicValueAddress,
      ],
      { 
        initializer: "initialize",
      }
    )) as TraderWallet;

    await traderWalletContract.deployed();

     // mock interaction
    await traderWalletContract.connect(trader).addAdapterToUse(protocolId, gmx.routerAddress);
    
  });

  describe("Adapter deployment parameters", function() {
    describe("Correct initial fixture", function () {
      it("Should has USDC balance on the trader address",async () => {
        expect(await usdcTokenContract.balanceOf(traderAddress)).to.equal(
          utils.parseUnits("1000", 6)
        );
      });
    });

    describe("Correct initial parameters", function () {
      it("Should has approval for positionRouter plugin",async () => {
        expect(await gmxRouter.approvedPlugins(traderWalletContract.address, gmxPositionRouter.address)).to.equal(
          true
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
        await usdcTokenContract.connect(trader).approve(traderWalletContract.address, amount);
        await traderWalletContract.connect(trader).traderDeposit(usdcTokenContract.address, amount);
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
        const operationId = 0;  // increasePosition
        const tradeOperation = {operationId, data: tradeData};
        const msgValue = await gmxPositionRouter.minExecutionFee();

        txResult = await traderWalletContract.connect(trader).executeOnProtocol(
          protocolId,
          tradeOperation,
          replicate,
          { value: msgValue }
        );
        const txReceipt = await txResult.wait();
        
        const events = txReceipt.events?.filter((event: any) => event.topics[0] === createIncreasePositionEvent)[0];
        requestKey = requestKeyFromEvent(events);
      });

      after(async () => {
        await reverter.revert();
      });

      it("Should emit event with create increase position requestKey", async() => {
        // const gmxAdapterLibrary = await ethers.getContractAt("GMXAdapter", traderWalletContract.address);
        await expect(txResult)
          .to.emit(gmxAdapterLibrary.attach(traderWalletContract.address), "CreateIncreasePosition")
          .withArgs(traderWalletContract.address, requestKey);
      });

      it("Should spent all trader's balance", async() => {
        expect(await usdcTokenContract.balanceOf(traderAddress)).to.equal(0);
      });

      it("Should create IncreasePositionRequest in GMX.PositionRouter contract ", async() => {
        const createdRequest = await gmxPositionRouter.increasePositionRequests(requestKey);
        expect(createdRequest.account).to.equal(traderWalletContract.address);
        expect(createdRequest.amountIn).to.equal(amount);
      });

      describe("Execute increasing position by a keeper", function () {
        before(async () => {
          keeper = await ethers.getImpersonatedSigner(gmx.keeper);
          await setBalance(gmx.keeper, utils.parseEther("10"));
          await gmxPositionRouter.connect(keeper).executeIncreasePosition(requestKey, gmx.keeper);
        });

        it("Should remove IncreasePositionRequest after executing ", async() => {
          const createdRequest = await gmxPositionRouter.increasePositionRequests(requestKey);
          expect(createdRequest.account).to.equal(constants.AddressZero);
          expect(createdRequest.indexToken).to.equal(constants.AddressZero);
          expect(createdRequest.amountIn).to.equal(constants.Zero);
        });

        it("Should return opened position from positions list", async() => {
          const position = await gmxAdapterLibrary.getPositions(
              traderWalletContract.address,
              [collateralToken],
              [indexToken],
              [isLong]
            );
          const [ size ] = position;
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
          const msgValue = await gmxPositionRouter.minExecutionFee();
          
          txResult = await traderWalletContract.connect(trader).executeOnProtocol(
            protocolId,
            tradeOperation,
            replicate,
            { value: msgValue }
          );
          const txReceipt = await txResult.wait();
        
          const events = txReceipt.events?.filter((event: any) => event.topics[0] === createDecreasePositionEvent)[0];
          requestKey = requestKeyFromEvent(events);
        });

        it("Should emit event with create decrease position requestKey", async() => {
          // const gmxAdapterLibrary = await ethers.getContractAt("GMXAdapter", traderWalletContract.address);
          await expect(txResult)
            .to.emit(gmxAdapterLibrary.attach(traderWalletContract.address), "CreateDecreasePosition")
            .withArgs(traderWalletContract.address, requestKey);
        });

        it("Should create DecreasePositionRequest in GMX.PositionRouter contract ", async() => {
          const createdRequest = await gmxPositionRouter.decreasePositionRequests(requestKey);
          expect(createdRequest.account).to.equal(traderWalletContract.address);
          expect(createdRequest.sizeDelta).to.equal(sizeDelta).to.equal(utils.parseUnits("2000", 30));
        });

        describe("Execute decreasing position by a keeper", function () {
          before(async () => {
            await gmxPositionRouter.connect(keeper).executeDecreasePosition(requestKey, gmx.keeper);
          });
  
          it("Should remove DecreasePositionRequest after executing ", async() => {
            const createdRequest = await gmxPositionRouter.decreasePositionRequests(requestKey);
            expect(createdRequest.account).to.equal(constants.AddressZero);
            expect(createdRequest.indexToken).to.equal(constants.AddressZero);
            expect(createdRequest.sizeDelta).to.equal(constants.Zero);
          });
  
          it("Should return zeros for traderWallet position from positions list", async() => {
            const position = await gmxAdapterLibrary.getPositions(
                traderWalletContract.address,
                [collateralToken],
                [indexToken],
                [isLong]
              );
            const [ size ] = position;
            expect(size).to.equal(constants.Zero);
          });
        });

      });

    });

    xdescribe("Open and close SHORT trader position", function () {
      before(async () => {

      });

      xit("Should create increase positions", async() => {

      });
    });
  });
});
