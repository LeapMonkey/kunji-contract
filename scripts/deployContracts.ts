import { ethers, upgrades } from "hardhat";
import { BigNumber } from "ethers";
import {
  Lens,
  TraderWallet,
  UsersVault,
  ContractsFactory,
  AdaptersRegistryMock,
  GMXAdapter,
  UniswapV3Adapter,
  TraderWalletDeployer,
  UsersVaultDeployer,
} from "../typechain-types";
import { tokens } from "../tests/_helpers/arbitrumAddresses";
import { decodeEvent } from "./../tests/_helpers/functions";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
///////////////// DEPLOY CONFIGURATION /////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

const DEPLOY_LENS = true;
const DEPLOY_LIBRARY = true;
const DEPLOY_ADAPTER = true;
const DEPLOY_REGISTRY = true;
const DEPLOY_FACTORY_LIBRARIES = true;
const DEPLOY_FACTORY = true;
const DEPLOY_TRADER_WALLET = true;
const DEPLOY_USERS_VAULT = true;

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

let LensAddress = "";
let UnderlyingTokenAddress = "";
let GmxAdapterAddress = "";
let UniswapAdapterAddress = "";
let TraderWalletDeployerAddress = "";
let UsersVaultDeployerAddress = "";
let ContractsFactoryAddress = "";
let AdaptersRegistryAddress = "";
// let ContractsFactoryAddress = "0xe1C86FbcC22b130FD57Df020EF011d1757A41162";
// let AdaptersRegistryAddress = "0x212aD3d42722B905E47D96Cb86729d099E13F31C";
let TraderWalletAddress = "";
let UsersVaultAddress = "";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

const FEE = BigNumber.from("3000000000000000000"); // 3 % base 18
const SHARES_NAME = "UserVaultShares";
const SHARES_SYMBOL = "UVS";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

// deploy Lens
const deployLens = async () => {
  console.log("DEPLOYING Lens Contract");
  const LensFactory = await ethers.getContractFactory("Lens");
  const lensContract = (await LensFactory.deploy()) as Lens;
  await lensContract.deployed();

  console.log(
    "Lens Contract DEPLOYED. txHash: ",
    lensContract.deployTransaction.hash
  );
  console.log("Contract Address: ", lensContract.address, "\n\n");
  return lensContract;
};

// deploy library
const deployGMXAdapter = async () => {
  console.log("DEPLOYING GMX Library");

  const GMXAdapterLibraryFactory = await ethers.getContractFactory(
    "GMXAdapter"
  );
  const gmxAdapterContract =
    (await GMXAdapterLibraryFactory.deploy()) as GMXAdapter;
  await gmxAdapterContract.deployed();

  console.log(
    "GMX Library DEPLOYED. txHash: ",
    gmxAdapterContract.deployTransaction.hash
  );
  console.log("Contract Address: ", gmxAdapterContract.address, "\n\n");
  return gmxAdapterContract;
};

// deploy adapter
const deployUniswapAdapter = async () => {
  console.log("DEPLOYING UniswapV3Adapter");

  const UniswapAdapterF = await ethers.getContractFactory("UniswapV3Adapter");
  const uniswapAdapterContract = (await upgrades.deployProxy(
    UniswapAdapterF,
    [],
    {
      initializer: "initialize",
    }
  )) as UniswapV3Adapter;
  await uniswapAdapterContract.deployed();

  console.log(
    "Adapter DEPLOYED. txHash: ",
    uniswapAdapterContract.deployTransaction.hash
  );
  console.log("Contract Address: ", uniswapAdapterContract.address, "\n\n");

  return uniswapAdapterContract;
};

// deploy mocked adaptersRegistry
const deployAdaptersRegistry = async (uniswapAdapterAddress: string) => {
  console.log("DEPLOYING AdaptersRegistry");

  const AdapterRegistryFactory = await ethers.getContractFactory(
    "AdaptersRegistryMock"
  );
  const adaptersRegistryContract = (await upgrades.deployProxy(
    AdapterRegistryFactory,
    []
  )) as AdaptersRegistryMock;
  await adaptersRegistryContract.deployed();

  console.log(
    "AdaptersRegistry DEPLOYED. txHash: ",
    adaptersRegistryContract.deployTransaction.hash
  );
  console.log("Contract Address: ", adaptersRegistryContract.address, "\n\n");

  console.log("Set Uniswap Adapter on Registry");
  const txResult = await adaptersRegistryContract.setReturnAddress(
    uniswapAdapterAddress
  );
  console.log("Uniswap Adapter Set txHash: ", txResult.hash, "\n\n");

  return adaptersRegistryContract;
};

// Deploy TraderWalletDeployer Library
const deployTraderWalletDeployer = async () => {
  console.log("DEPLOYING TraderWalletDeployer");
  const TraderWalletDeployerFactory = await ethers.getContractFactory(
    "TraderWalletDeployer"
  );
  const traderWalletDeployerContract =
    (await TraderWalletDeployerFactory.deploy()) as TraderWalletDeployer;
  await traderWalletDeployerContract.deployed();

  console.log(
    "TraderWalletDeployer DEPLOYED. txHash: ",
    traderWalletDeployerContract.deployTransaction.hash
  );
  console.log(
    "Contract Address: ",
    traderWalletDeployerContract.address,
    "\n\n"
  );
  return traderWalletDeployerContract;
};

// Deploy UsersVaultDeployer Library
const deployUsersVaultDeployer = async () => {
  const UsersVaultDeployerFactory = await ethers.getContractFactory(
    "UsersVaultDeployer"
  );
  const usersVaultDeployerContract =
    (await UsersVaultDeployerFactory.deploy()) as UsersVaultDeployer;
  await usersVaultDeployerContract.deployed();

  console.log(
    "UsersVaultDeployer DEPLOYED. txHash: ",
    usersVaultDeployerContract.deployTransaction.hash
  );
  console.log("Contract Address: ", usersVaultDeployerContract.address, "\n\n");
  return usersVaultDeployerContract;
};

// deploy ContractsFactory
const deployContractsFactory = async (
  traderWalletDeployerAddress: string,
  usersVaultDeployerAddress: string,
  adaptersRegistryAddress: string
) => {
  console.log("DEPLOYING ContractsFactory");

  const ContractsFactoryContractFactory = await ethers.getContractFactory(
    "ContractsFactory",
    {
      libraries: {
        TraderWalletDeployer: traderWalletDeployerAddress,
        UsersVaultDeployer: usersVaultDeployerAddress,
      },
    }
  );

  const contractsFactoryContract = (await upgrades.deployProxy(
    ContractsFactoryContractFactory,
    [FEE],
    { unsafeAllowLinkedLibraries: true }
  )) as ContractsFactory;
  await contractsFactoryContract.deployed();

  console.log(
    "ContractsFactory DEPLOYED. txHash: ",
    contractsFactoryContract.deployTransaction.hash
  );
  console.log("Contract Address: ", contractsFactoryContract.address, "\n\n");

  console.log("Set Adapter Registry in Factory");

  // Set Adapter Registry in Factory
  // Set Adapter Registry in Factory
  const txResult = await contractsFactoryContract
    // .connect(deployer)
    .setAdaptersRegistryAddress(adaptersRegistryAddress);
  console.log("Adapter Registry Set txHash: ", txResult.hash, "\n\n");

  return contractsFactoryContract;
};

// deploy Trader Wallet
const deployTraderWallet = async (
  contractsFactoryAddress: string,
  deployerAddress: string,
  underlyingTokenAddress: string
) => {
  console.log("DEPLOYING TraderWallet");
  console.log("Getting Factory...");
  const contractsFactoryContract = await ethers.getContractAt(
    "ContractsFactory",
    contractsFactoryAddress
  );

  console.log("CALLING DEPLOY Function on factory");
  const txResult = await contractsFactoryContract.deployTraderWallet(
    underlyingTokenAddress,
    deployerAddress, // trader address
    deployerAddress // owner
  );

  const abi = [
    "event TraderWalletDeployed(address indexed _traderWalletAddress, address indexed _traderAddress, address indexed _underlyingTokenAddress)",
  ];
  const signature = "TraderWalletDeployed(address,address,address)";
  const txReceipt = await txResult.wait();
  const decodedEvent = await decodeEvent(abi, signature, txReceipt);
  const traderWalletAddress = decodedEvent.args._traderWalletAddress;

  const traderWalletContract = (await ethers.getContractAt(
    "TraderWallet",
    traderWalletAddress
  )) as TraderWallet;

  console.log("TraderWallet DEPLOYED. txHash: ", txResult.hash);
  console.log("Contract Address: ", traderWalletAddress, "\n\n");
  return traderWalletContract;
};

// deploy User Vault
const deployUsersVault = async (
  contractsFactoryAddress: string,
  deployerAddress: string,
  traderWalletAddress: string,
  SHARES_NAME: string,
  SHARES_SYMBOL: string
) => {
  console.log("DEPLOYING UsersVault");
  console.log("Getting Factory...");
  const contractsFactoryContract = await ethers.getContractAt(
    "ContractsFactory",
    contractsFactoryAddress
  );

  console.log("CALLING DEPLOY Function on factory");
  let txResult = await contractsFactoryContract
    // .connect(deployer)
    .deployUsersVault(
      traderWalletAddress,
      deployerAddress, // owner
      SHARES_NAME,
      SHARES_SYMBOL
    );

  const abi = [
    "event UsersVaultDeployed(address indexed _usersVaultAddress,address indexed _traderWalletAddress, address indexed _underlyingTokenAddress, string sharesName)",
  ];
  const signature = "UsersVaultDeployed(address,address,address,string)";

  const txReceipt = await txResult.wait();
  const decodedEvent = await decodeEvent(abi, signature, txReceipt);
  const usersVaultAddress = decodedEvent.args._usersVaultAddress;

  const usersVaultContract = (await ethers.getContractAt(
    "UsersVault",
    usersVaultAddress
  )) as UsersVault;

  console.log("UsersVault DEPLOYED. txHash: ", txResult.hash);
  console.log("Contract Address: ", usersVaultContract.address, "\n\n");

  console.log("Set Vault Address in Trader Wallet Contract");
  const traderWalletContract = (await ethers.getContractAt(
    "TraderWallet",
    traderWalletAddress
  )) as TraderWallet;

  // set vault address in trader wallet
  // set vault address in trader wallet
  txResult = await traderWalletContract
    // .connect(deployer)
    .setVaultAddress(usersVaultContract.address);
  console.log("Vault Set txHash: ", txResult.hash, "\n\n");

  return usersVaultContract;
};

async function main(): Promise<void> {
  console.clear();
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log("deployerAddress :>> ", deployerAddress);
  console.log("\n\n");

  let lensContract: Lens;
  let traderWalletDeployerContract: TraderWalletDeployer;
  let usersVaultDeployerContract: UsersVaultDeployer;
  let contractsFactoryContract: ContractsFactory;

  let gmxAdapterContract: GMXAdapter;
  let uniswapAdapterContract: UniswapV3Adapter;
  let adaptersRegistryContract: AdaptersRegistryMock;

  let traderWalletContract: TraderWallet;

  console.log("\n\n\nDEPLOYING....\n\n");
  console.log(
    "==================================================================\n\n"
  );

  if (DEPLOY_LENS) {
    lensContract = await deployLens();
    LensAddress = lensContract.address;
  }

  if (DEPLOY_LIBRARY) {
    gmxAdapterContract = await deployGMXAdapter();
    GmxAdapterAddress = gmxAdapterContract.address;
  }

  if (DEPLOY_ADAPTER) {
    uniswapAdapterContract = await deployUniswapAdapter();
    UniswapAdapterAddress = uniswapAdapterContract.address;
  }

  if (DEPLOY_REGISTRY) {
    if (UniswapAdapterAddress != "") {
      adaptersRegistryContract = await deployAdaptersRegistry(
        UniswapAdapterAddress
      );
      AdaptersRegistryAddress = adaptersRegistryContract.address;
    } else {
      console.log("\nCannot deploy Adapter Registry\n");
    }
  }

  if (DEPLOY_FACTORY_LIBRARIES) {
    traderWalletDeployerContract = await deployTraderWalletDeployer();
    TraderWalletDeployerAddress = traderWalletDeployerContract.address;

    usersVaultDeployerContract = await deployUsersVaultDeployer();
    UsersVaultDeployerAddress = usersVaultDeployerContract.address;
  }

  if (DEPLOY_FACTORY) {
    if (
      TraderWalletDeployerAddress != "" &&
      UsersVaultDeployerAddress != "" &&
      AdaptersRegistryAddress != ""
    ) {
      contractsFactoryContract = await deployContractsFactory(
        TraderWalletDeployerAddress,
        UsersVaultDeployerAddress,
        AdaptersRegistryAddress
      );
      ContractsFactoryAddress = contractsFactoryContract.address;
    } else {
      console.log("\nCannot deploy Contracts Factory\n");
    }
  }

  // PUT VALUE HERE TO DEPLOY VAULT AND WALLET WITHOUT DEPLOYING FACTORY
  // ContractsFactoryAddress = "";
  // PUT DEPLOY_FACTORY constant ON FALSE AT THE TOP

  // asign address of usdc token to underlying
  UnderlyingTokenAddress = tokens.usdc;
  if (
    DEPLOY_TRADER_WALLET &&
    ContractsFactoryAddress != "" &&
    UnderlyingTokenAddress != ""
  ) {
    traderWalletContract = await deployTraderWallet(
      ContractsFactoryAddress,
      deployerAddress,
      UnderlyingTokenAddress
    );
    TraderWalletAddress = traderWalletContract.address;
  } else {
    console.log("\nCannot deploy Trader Wallet\n");
  }

  if (
    DEPLOY_USERS_VAULT &&
    ContractsFactoryAddress != "" &&
    UnderlyingTokenAddress != "" &&
    TraderWalletAddress != ""
  ) {
    await deployUsersVault(
      ContractsFactoryAddress,
      deployerAddress, // owner
      TraderWalletAddress,
      SHARES_NAME,
      SHARES_SYMBOL
    );
  } else {
    console.log("\nCannot deploy Users Vault\n");
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
