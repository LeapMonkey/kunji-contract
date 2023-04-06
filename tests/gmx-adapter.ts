import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ContractsFactory, GMXAdapter, IGmxReader, IGmxRouter, IGmxVault } from "../typechain-types";
import {
    TEST_TIMEOUT,
    ZERO_AMOUNT,
    ZERO_ADDRESS,
    AMOUNT_100,
  } from "._/helpers/constants";
import {tokens, gmx } from "._/helpers/arbitrumAddresses";
  const gmxRouterAddress = gmx.routerAddress;
  const gmxPositionRouterAddress = gmx.positionRouterAddress;
  const gmxReaderAddress = gmx.readerAddress;
  const gmxVaultAddress = gmx.vaultAddress;


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

  let GMXAdapterFactory: ContractsFactory;

  let gmxAdapterContract: GMXAdapter
  let gmxRouter: IGmxRouter;
  let gmxPositionRouter: IGmxPositionRouter;
  let gmxReader: IGmxReader;
  let gmxVault: IGmxVault;


// deploy
// approve
// get values
describe("GMXAdapter", function() {
  async function deploy() {
    const [ deployer, user ] = await ethers.getSigners();

    const gmxRouterAddress = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064";
    const gmxPositionRouterAddress = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868";
    const gmxReaderAddress = "0x22199a49A999c351eF7927602CFB187ec3cae489";
    const gmxVaultAddress = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

    const GMXAdapterF = await ethers.getContractFactory("GMXAdapter");
    const gmxAdapter: GMXAdapter = await upgrades.deployProxy(GMXAdapterF, [
        gmxRouterAddress, gmxPositionRouterAddress, gmxReaderAddress, gmxVaultAddress
    ], {
        initializer: "initialize"
    });
    await gmxAdapter.deployed();

    return gmxAdapter;
  }

  before(async() => {
    gmxRouter = await ethers.getContractAt("IGmxRouter", gmxRouterAddress);
    gmxPositionRouter = await ethers.getContractAt("IGmxPositionRouter", gmxPositionRouterAddress);
    gmxReader = await ethers.getContractAt("IGmxReader", gmxReaderAddress);
    gmxVault = await ethers.getContractAt("IGmxVault", gmxVaultAddress);

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

  describe("Deployment", function() {

    describe("Deployment with wrong parameters", function () {
      before(async () => {
        GMXAdapterFactory = await ethers.getContractFactory("GMXAdapter");
      });

      it("Should fail to deploy with zero gmxRouterAddress", async () => {
        await expect(upgrades.deployProxy(
          GMXAdapterFactory, [
            ZERO_ADDRESS,
            gmxPositionRouterAddress,
            gmxReaderAddress,
            gmxVaultAddress,
          ]
        )).to.be.revertedWithCustomError(GMXAdapterFactory, "AddressZero");
      });

      it("Should fail to deploy with zero gmxPositionRouterAddress", async () => {
        await expect(upgrades.deployProxy(
          GMXAdapterFactory, [
            gmxRouterAddress,
            ZERO_ADDRESS,
            gmxReaderAddress,
            gmxVaultAddress
          ]
        )).to.be.revertedWithCustomError(GMXAdapterFactory, "AddressZero");
      });

      it("Should fail to deploy with zero gmxReaderAddress", async () => {
        await expect(upgrades.deployProxy(
          GMXAdapterFactory, [
            gmxRouterAddress,
            gmxPositionRouterAddress,
            ZERO_ADDRESS,
            gmxVaultAddress
          ]
        )).to.be.revertedWithCustomError(GMXAdapterFactory, "AddressZero");
      });

      it("Should fail to deploy with zero gmxVaultAddress", async () => {
        await expect(upgrades.deployProxy(
          GMXAdapterFactory, [
            gmxRouterAddress,
            gmxPositionRouterAddress,
            gmxReaderAddress,
            ZERO_ADDRESS
          ]
        )).to.be.revertedWithCustomError(GMXAdapterFactory, "AddressZero");
      }); 
    });

    describe("Deploy with correct parameters", function () {
      before(async () => {
        gmxAdapterContract = await loadFixture(deploy);
      });

      it("Should return correct gmxRouter address",async () => {
        expect(await gmxAdapterContract.gmxRouter()).to.equal(
          gmxRouterAddress
        );
      });

      it("Should return correct gmxPositionRouter address",async () => {
        expect(await gmxAdapterContract.gmxPositionRouter()).to.equal(
          gmxPositionRouterAddress
        );
      });

      it("Should return correct gmxReader address",async () => {
        expect(await gmxAdapterContract.gmxReader()).to.equal(
          gmxReaderAddress
        );
      });

      it("Should return correct gmxVault address",async () => {
        expect(await gmxAdapterContract.gmxVault()).to.equal(
          gmxVaultAddress
        );
      });
    });

    describe("Swap preview functions", function () {
      before(async () => {
        gmxAdapterContract = await loadFixture(deploy);
      });

      it("Should revert getAmountOut() if checks unsupported token", async() => {
        await expect(gmxAdapterContract.getAmountOut(tokens.usdc, tokens.randomCoin, 100))
          .to.be.revertedWith("VaultPriceFeed: invalid price feed");
      });

      it("Should revert getMaxAmountIn() if checks unsupported token", async() => {
        await expect(gmxAdapterContract.getMaxAmountIn(tokens.usdc, tokens.randomCoin))
          .to.be.revertedWith("VaultPriceFeed: invalid price feed");
      });

      it("Should return swap amounts for tokens", async() => {
        const expectedAmountOut = 99;
        const expectedFee = 1;
        const [ amountOut, fee ] = await gmxAdapterContract.getAmountOut(tokens.usdc, tokens.usdt, 100);
        expect(amountOut).to.equal(expectedAmountOut);
        expect(fee).to.equal(expectedFee);
      });

      it("Should return swap max swap amounts for tokens", async() => {
        const expectedMaxAmountIn = "3636269524320000000000000";
        const maxAmountIn = await gmxAdapterContract.getMaxAmountIn(tokens.frax, tokens.usdt);
        expect(maxAmountIn).to.be.gt(0);
        expect(maxAmountIn).to.equal(expectedMaxAmountIn);
      });
   

    });

    describe("Positions viewer", function () {
      before(async () => {
        gmxAdapterContract = await loadFixture(deploy);
      });

      it("Should return leverage positions for random account from gmx", async() => {
        const account = "0xF6113e0e47b4AAd6388A3dEAfcf4c651A28250f0"; //
        const collaterals = [tokens.usdc, tokens.usdc];
        const indexTokens = [tokens.weth, tokens.weth];
        const isLongs = [true, true];
        const positions = await gmxAdapterContract.getPositions(account, collaterals, indexTokens, isLongs);
        
        expect(positions).to.not.be.empty; // @todo refactor weak check

      });
    });
  });
});
