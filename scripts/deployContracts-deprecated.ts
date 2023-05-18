import { ethers, upgrades } from "hardhat";
import { ContractFactory } from "ethers";
import {
  TraderWallet,
  UsersVault,
  ContractsFactoryMock,
  AdaptersRegistryMock,
  AdapterMock,
  GMXAdapter,
} from "../typechain-types";
import { tokens } from "../tests/_helpers/arbitrumAddresses";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
///////////////// DEPLOY CONFIGURATION /////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
const DEPLOY_LIBRARY = true;
const DEPLOY_REGISTRY = true;
const DEPLOY_ADAPTER = true;
const DEPLOY_FACTORY = true;
const DEPLOY_TRADER_WALLET = true;
const DEPLOY_USERS_VAULT = true;

const SHARES_NAME = "UserVaultShares";
const SHARES_SYMBOL = "UVS";
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

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

// deploy library
const deployGMXAdapter = async () => {
  console.log("DEPLOYING GMX Library");

  GMXAdapterLibraryFactory = await ethers.getContractFactory("GMXAdapter");
  gmxAdapterContract = (await GMXAdapterLibraryFactory.deploy()) as GMXAdapter;
  await gmxAdapterContract.deployed();

  console.log(
    "GMX Library DEPLOYED. txHash: ",
    gmxAdapterContract.deployTransaction.hash
  );
  console.log("Contract Address: ", gmxAdapterContract.address, "\n\n");
  return gmxAdapterContract;
};

// deploy mocked adaptersRegistry
const deployAdaptersRegistry = async () => {
  console.log("DEPLOYING AdaptersRegistry");

  AdaptersRegistryFactory = await ethers.getContractFactory(
    "AdaptersRegistryMock"
  );
  adaptersRegistryContract =
    (await AdaptersRegistryFactory.deploy()) as AdaptersRegistryMock;
  await adaptersRegistryContract.deployed();

  console.log(
    "AdaptersRegistry DEPLOYED. txHash: ",
    adaptersRegistryContract.deployTransaction.hash
  );
  console.log("Contract Address: ", adaptersRegistryContract.address, "\n\n");
  return adaptersRegistryContract;
};

// deploy mocked adapter
const deployAdapter = async () => {
  console.log("DEPLOYING Uniswap Adapter");

  AdapterFactory = await ethers.getContractFactory("AdapterMock");
  adapterContract = (await AdapterFactory.deploy()) as AdapterMock;
  await adapterContract.deployed();

  console.log(
    "Adapter DEPLOYED. txHash: ",
    adapterContract.deployTransaction.hash
  );
  console.log("Contract Address: ", adapterContract.address, "\n\n");
  return adapterContract;
};

// deploy mocked ContractsFactory
const deployContractsFactoryMock = async () => {
  console.log("DEPLOYING ContractsFatoryMock");

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

  console.log(
    "ContractsFactory DEPLOYED. txHash: ",
    contractsFactoryContract.deployTransaction.hash
  );
  console.log("Contract Address: ", contractsFactoryContract.address, "\n\n");
  return contractsFactoryContract;
};

// deploy Trader Wallet
const deployTraderWallet = async (deployerAddress: string) => {
  console.log("DEPLOYING TraderWallet");

  TraderWalletFactory = await ethers.getContractFactory("TraderWallet", {
    // libraries: {
    //   GMXAdapter: gmxAdapterContract.address,
    // },
  });

  traderWalletContract = (await upgrades.deployProxy(
    TraderWalletFactory,
    [
      tokens.usdc,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      deployerAddress,
      deployerAddress, // not used
    ]
    // { unsafeAllowLinkedLibraries: true }
  )) as TraderWallet;
  await traderWalletContract.deployed();

  console.log(
    "TraderWallet DEPLOYED. txHash: ",
    traderWalletContract.deployTransaction.hash
  );
  console.log("Contract Address: ", traderWalletContract.address, "\n\n");
  return traderWalletContract;
};

// deploy User Vault
const deployUsersVault = async (deployerAddress: string) => {
  console.log("DEPLOYING UsersVault");

  UsersVaultFactory = await ethers.getContractFactory("UsersVault", {
    // libraries: {
    //   GMXAdapter: gmxAdapterContract.address,
    // },
  });

  usersVaultContract = (await upgrades.deployProxy(
    UsersVaultFactory,
    [
      tokens.usdc,
      adaptersRegistryContract.address,
      contractsFactoryContract.address,
      traderWalletContract.address,
      deployerAddress, // not used
      SHARES_NAME,
      SHARES_SYMBOL,
    ]
    // { unsafeAllowLinkedLibraries: true }
  )) as UsersVault;
  await usersVaultContract.deployed();

  console.log(
    "UsersVault DEPLOYED. txHash: ",
    usersVaultContract.deployTransaction.hash
  );
  console.log("Contract Address: ", usersVaultContract.address, "\n\n");
  return usersVaultContract;
};

async function main(): Promise<void> {
  console.clear();
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("\n\n\nDEPLOYING....\n\n");
  console.log(
    "==================================================================\n\n"
  );

  if (DEPLOY_LIBRARY) {
    await deployGMXAdapter();
  }

  if (DEPLOY_REGISTRY) {
    await deployAdaptersRegistry();
  }

  if (DEPLOY_ADAPTER) {
    await deployAdapterMock();
  }
  if (DEPLOY_FACTORY) {
    await deployContractsFactoryMock();
  }
  if (DEPLOY_TRADER_WALLET) {
    await deployTraderWallet(deployerAddress);
  }
  if (DEPLOY_USERS_VAULT) {
    await deployUsersVault(deployerAddress);
    // set vault address in trader wallet
    await traderWalletContract
      .connect(deployer)
      .setVaultAddress(usersVaultContract.address);
  }

  console.log(
    "\n\n==================================================================\n"
  );
  console.log("DEPLOYMENT FINISHED....\n\n");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
