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
  adaptersRegistryContract =
    (await AdaptersRegistryFactory.deploy()) as AdaptersRegistryMock;
  await adaptersRegistryContract.deployed();

  // deploy mocked adapter
  AdapterFactory = await ethers.getContractFactory("AdapterMock");
  adapterContract = (await AdapterFactory.deploy()) as AdapterMock;
  await adapterContract.deployed();

  // deploy Trader Wallet
  TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
    libraries: {
      GMXAdapter: gmxAdapterContract.address,
    },
  });

  traderWalletContract = (await upgrades.deployProxy(
    TraderWalletFactory,
    [
      usdcTokenContract.address,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      deployerAddress,
      deployerAddress, // not used
    ],
    { unsafeAllowLinkedLibraries: true }
  )) as TraderWallet;
  await traderWalletContract.deployed();

  // deploy User Vault
  UsersVaultFactory = await ethers.getContractFactory("UsersVault", {
    libraries: {
      GMXAdapter: gmxAdapterContract.address,
    },
  });

  usersVaultContract = (await upgrades.deployProxy(
    UsersVaultFactory,
    [
      usdcTokenContract.address,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      traderWalletContract.address,
      deployerAddress, // not used
      SHARES_NAME,
      SHARES_SYMBOL,
    ],
    { unsafeAllowLinkedLibraries: true }
  )) as UsersVault;
  await usersVaultContract.deployed();

  
  // set vault address in trader wallet
  await traderWalletContract
    .connect(deployer)
    .setVaultAddress(usersVaultContract.address);

  return {
    usdcTokenContract,
    wethTokenContract,
    usdxTokenContract,
    contractsFactoryContract,
    adaptersRegistryContract,
    adapterContract,
    traderWalletContract,
    usersVaultContract,
  };
};
