import { ethers, upgrades } from "hardhat";
import { ContractFactory, Signer } from "ethers";
import {
  TraderWallet,
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  GMXAdapter,
  ERC20Mock,
  UniswapV3Adapter,
} from "../../typechain-types";

export const setupContracts = async (
  deployer: Signer,
  deployerAddress: string
) => {
  let TraderWalletFactory: ContractFactory;
  let traderWalletContract: TraderWallet;
  let UsersVaultFactory: ContractFactory;
  let usersVaultContract: UsersVault;
  let ContractsFactoryFactory: ContractFactory;
  let contractsFactoryContract: ContractsFactoryMock;
  let GMXAdapterLibraryFactory: ContractFactory;
  let gmxAdapterContract: GMXAdapter;
  let UniswapAdapterFactory: ContractFactory;
  let uniswapAdapterContract: UniswapV3Adapter;
  let AdaptersRegistryFactory: ContractFactory;
  let adaptersRegistryContract: AdaptersRegistryMock;
  let AdapterFactory: ContractFactory;
  let adapterContract: AdapterMock;
  let usdcTokenContract: ERC20Mock;
  let wethTokenContract: ERC20Mock;
  let usdxTokenContract: ERC20Mock;

  const SHARES_NAME = "UserVaultShares";
  const SHARES_SYMBOL = "UVS";

  // USDC contract
  const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
  usdcTokenContract = (await ERC20MockFactory.deploy(
    "USDC",
    "USDC",
    6
  )) as ERC20Mock;
  await usdcTokenContract.deployed();

  // WETH contract
  wethTokenContract = (await ERC20MockFactory.deploy(
    "WETH",
    "WETH",
    18
  )) as ERC20Mock;
  await wethTokenContract.deployed();

  // USDX contract
  usdxTokenContract = (await ERC20MockFactory.deploy(
    "USDX",
    "USDX",
    8
  )) as ERC20Mock;
  await usdxTokenContract.deployed();

  // deploy library
  GMXAdapterLibraryFactory = await ethers.getContractFactory("GMXAdapter");
  gmxAdapterContract = (await GMXAdapterLibraryFactory.deploy()) as GMXAdapter;
  await gmxAdapterContract.deployed();

  // deploy uniswap adapter
  UniswapAdapterFactory = await ethers.getContractFactory("UniswapV3Adapter");
  uniswapAdapterContract = (await upgrades.deployProxy(
    UniswapAdapterFactory,
    [],
    {
      initializer: "initialize",
    }
  )) as UniswapV3Adapter;
  await uniswapAdapterContract.deployed();

  // deploy mocked ContractsFactory
  ContractsFactoryFactory = await ethers.getContractFactory(
    "ContractsFactoryMock"
  );
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

  // set uniswap
  await adaptersRegistryContract.setReturnValue(true);
  await adaptersRegistryContract.setReturnAddress(
    uniswapAdapterContract.address
  );

  // deploy mocked adapter
  AdapterFactory = await ethers.getContractFactory("AdapterMock");
  adapterContract = (await AdapterFactory.deploy()) as AdapterMock;
  await adapterContract.deployed();

  // deploy Trader Wallet
  TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
    // libraries: {
    //   GMXAdapter: gmxAdapterContract.address,
    // },
  });

  traderWalletContract = (await upgrades.deployProxy(
    TraderWalletFactory,
    [
      usdcTokenContract.address,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      deployerAddress,
      deployerAddress, // owner
    ]
    // { unsafeAllowLinkedLibraries: true }
  )) as TraderWallet;
  await traderWalletContract.deployed();

  // deploy User Vault
  UsersVaultFactory = await ethers.getContractFactory("UsersVault", {
    // libraries: {
    //   GMXAdapter: gmxAdapterContract.address,
    // },
  });

  usersVaultContract = (await upgrades.deployProxy(
    UsersVaultFactory,
    [
      usdcTokenContract.address,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      traderWalletContract.address,
      deployerAddress, // owner
      SHARES_NAME,
      SHARES_SYMBOL,
    ]
    // { unsafeAllowLinkedLibraries: true }
  )) as UsersVault;
  await usersVaultContract.deployed();

  // set vault address in trader wallet
  await traderWalletContract
    .connect(deployer)
    .setVaultAddress(usersVaultContract.address);

  await traderWalletContract.connect(deployer).addAdapterToUse(2);

  await traderWalletContract
    .connect(deployer)
    .setAdapterAllowanceOnToken(2, usdcTokenContract.address, false);

  await traderWalletContract
    .connect(deployer)
    .setAdapterAllowanceOnToken(2, wethTokenContract.address, false);

  // await usersVaultContract
  //   .connect(deployer)
  //   .addAdapterToUse(2);

  await usersVaultContract
    .connect(deployer)
    .setAdapterAllowanceOnToken(2, usdcTokenContract.address, false);

  await usersVaultContract
    .connect(deployer)
    .setAdapterAllowanceOnToken(2, wethTokenContract.address, false);

  return {
    usdcTokenContract,
    wethTokenContract,
    usdxTokenContract,
    contractsFactoryContract,
    adaptersRegistryContract,
    adapterContract,
    traderWalletContract,
    usersVaultContract,
    uniswapAdapterContract,
  };
};
