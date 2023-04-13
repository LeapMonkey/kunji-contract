import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  Signer,
  ContractFactory,
  ContractTransaction,
  BigNumber,
  utils,
} from "ethers";
import { ContractsFactory, IQuoterV2, UniswapV3Adapter } from "../../typechain-types";
import {
    TEST_TIMEOUT,
    ZERO_AMOUNT,
    ZERO_ADDRESS,
    AMOUNT_100,
  } from "../helpers/constants";
import { tokens, uniswap } from "../helpers/arbitrumAddresses";
import Reverter from "../helpers/reverter";

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

let UniswapAdapterFactory: ContractsFactory;

let uniswapAdapterContract: UniswapV3Adapter
let uniswapRouter: IUniswapV3Router;
let uniswapQuoter: IQuoterV2;
let uniswapFactory: IUniswapV3Factory;
let uniswapPositionManager: INonfungiblePositionManager;


describe("UniswapAdapter", function() {
  async function deploy() {
    const [ deployer, user ] = await ethers.getSigners();

    const UniswapAdapterF = await ethers.getContractFactory("UniswapV3Adapter");
    const uniswapAdapter: UniswapV3Adapter = await upgrades.deployProxy(UniswapAdapterF, [], {
        initializer: "initialize"
    });
    await uniswapAdapter.deployed();

    return uniswapAdapter;
  }

  before(async() => {
    uniswapRouter = await ethers.getContractAt("IUniswapV3Router", uniswap.routerAddress);
    uniswapQuoter = await ethers.getContractAt("IQuoterV2", uniswap.quoterAddress);
    uniswapFactory = await ethers.getContractAt("IUniswapV3Factory", uniswap.factoryAddress);
    uniswapPositionManager = await ethers.getContractAt("INonfungiblePositionManager", uniswap.positionManagerAddress);

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

  describe("Adapter functionality", function() {

    describe("Deploy with correct parameters", function () {
      before(async () => {
        uniswapAdapterContract = await loadFixture(deploy);
      });

      it("Should return correct uniswap router address",async () => {
        expect(await uniswapAdapterContract.uniswapV3Router()).to.equal(
          uniswap.routerAddress
        );
      });

      it("Should return correct quoter address",async () => {
        expect(await uniswapAdapterContract.quoter()).to.equal(
          uniswap.quoterAddress
        );
      });

      it("Should return correct ratio denominator value",async () => {
        const ratioDenominator = ethers.utils.parseUnits("1", 18);
        expect(await uniswapAdapterContract.ratioDenominator()).to.equal(ratioDenominator);
      });

      it("Should return correct min slippage allowance",async () => {
        const slippageAllowanceMin = ethers.utils.parseUnits("0.001", 18); // 0.1%
        expect(await uniswapAdapterContract.slippageAllowanceMin()).to.equal(
          slippageAllowanceMin
        );
      });

      it("Should return correct max slippage allowance",async () => {
        const slippageAllowanceMax = ethers.utils.parseUnits("0.3", 18); // 30%
        expect(await uniswapAdapterContract.slippageAllowanceMax()).to.equal(
          slippageAllowanceMax
        );
      });

      it("Should return correct initial slippage allowance value",async () => {
        const slippageAllowance = ethers.utils.parseUnits("0.1", 18); // 10%
        expect(await uniswapAdapterContract.slippage()).to.equal(
          slippageAllowance
        );
      });
    });

    describe("Setting slippage allowance", function () {
      before(async () => {
        uniswapAdapterContract = await loadFixture(deploy);
      });

      describe("With incorrect parameters or callers", function () {
        it("Should revert if slippage lower than minimum", async() => {
          const newSlippage = utils.parseUnits("1", 10)
          await expect(uniswapAdapterContract.setSlippageAllowance(newSlippage))
            .to.be.revertedWithCustomError(uniswapAdapterContract, "InvalidSlippage");
        });

        it("Should revert if slippage a bit lower than min limit", async() => {
          const newSlippage = utils.parseUnits("0.00099", 18)
          await expect(uniswapAdapterContract.setSlippageAllowance(newSlippage))
            .to.be.revertedWithCustomError(uniswapAdapterContract, "InvalidSlippage");
        });

        it("Should revert if slippage greater than maximum", async() => {
          const newSlippage = utils.parseUnits("1", 18)
          await expect(uniswapAdapterContract.setSlippageAllowance(newSlippage))
            .to.be.revertedWithCustomError(uniswapAdapterContract, "InvalidSlippage");
        });

        it("Should revert if slippage a bit greater than maximum", async() => {
          const newSlippage = utils.parseUnits("0.30001", 18)
          await expect(uniswapAdapterContract.setSlippageAllowance(newSlippage))
            .to.be.revertedWithCustomError(uniswapAdapterContract, "InvalidSlippage");
        });

        it("Should revert caller is not the owner", async() => {
          const newSlippage = utils.parseUnits("0.2", 18)
          await expect(uniswapAdapterContract
            .connect(nonAuthorized)
            .setSlippageAllowance(newSlippage)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });
      });

      describe("With correct parameters", function () {
        const newSlippage = utils.parseUnits("0.2", 18);

        before(async () => {
          txResult = await uniswapAdapterContract.setSlippageAllowance(newSlippage);
        });
        after(async () => {
          await reverter.revert();
        });

        it("Should return new slippage allowance value", async () => {
          expect(await uniswapAdapterContract.slippage()).to.equal(newSlippage);
        });
        it("Should emit an Event", async () => {
          await expect(txResult).to.emit(uniswapAdapterContract, "SlippageAllowance")
            .withArgs(newSlippage);
        });
      });

    });

    describe("Getting expected amounts (view) from dex", function () {
      before(async () => {
        uniswapAdapterContract = await loadFixture(deploy);
      });

      it("Should return amountOut from uniswap", async() => {
        const fee = 100;
        const path = utils.solidityPack(
            ["address", "uint24", "address"],
            [tokens.usdc, fee, tokens.usdt]
          );
        const amountIn = utils.parseUnits("1", 6);
        const [ amountOut ] = await uniswapAdapterContract.callStatic.getAmountOut(path, amountIn);
        
        expect(amountOut).to.be.lt(amountIn.add(utils.parseUnits("1", 5)));
        expect(amountOut).to.be.gt(amountIn.sub(utils.parseUnits("1", 5)));
      });

      it("Should return amountIn from uniswap", async() => {
        const fee = 100;
        const path = utils.solidityPack(
            ["address", "uint24", "address"],
            [tokens.usdc, fee, tokens.usdt]
          );
        const amountOut = utils.parseUnits("1", 6);
        const [ amountIn ] = await uniswapAdapterContract.callStatic.getAmountIn(path, amountOut);
        
        expect(amountIn).to.be.lt(amountOut.add(utils.parseUnits("1", 5)));
        expect(amountIn).to.be.gt(amountOut.sub(utils.parseUnits("1", 5)));
      });
    });

    describe("Trading tokens", function () {
      // crate pool
      // describe trade without ratio
      // describe trade with ratio
    });
  });
});
