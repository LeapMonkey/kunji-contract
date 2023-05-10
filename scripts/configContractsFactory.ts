import { ethers } from "hardhat";
import { ContractsFactory } from "../typechain-types";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
//////////////////////// CONFIGURATION /////////////////////////////////
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

const ADD_TRADER = true;
const REMOVE_TRADER = false;
const ADD_INVESTOR = true;
const REMOVE_INVESTOR = false;

const INVESTOR_ADDRESS = "";
const TRADER_ADDRESS = "";
const CONTRACTS_FACTORY_ADDRESS = "";

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

// Add Trader
const addTrader = async () => {
  console.log("Add Trader to Factory");
  const contractsFactoryContract = (await ethers.getContractAt(
    "ContractsFactory",
    CONTRACTS_FACTORY_ADDRESS
  )) as ContractsFactory;

  const txResult = await contractsFactoryContract.addTrader(TRADER_ADDRESS);
  console.log("Trader Added txHash: ", txResult.hash, "\n\n");
};

// Remove Trader
const removeTrader = async () => {
  console.log("Remove Trader from Factory");
  const contractsFactoryContract = (await ethers.getContractAt(
    "ContractsFactory",
    CONTRACTS_FACTORY_ADDRESS
  )) as ContractsFactory;

  const txResult = await contractsFactoryContract.removeTrader(TRADER_ADDRESS);
  console.log("Trader Removed txHash: ", txResult.hash, "\n\n");
};

// Add Investor
const addInvestor = async () => {
  console.log("Add Investor to Factory");
  const contractsFactoryContract = (await ethers.getContractAt(
    "ContractsFactory",
    CONTRACTS_FACTORY_ADDRESS
  )) as ContractsFactory;

  const txResult = await contractsFactoryContract.addInvestor(INVESTOR_ADDRESS);
  console.log("Investor Added txHash: ", txResult.hash, "\n\n");
};

// Add Investor
const removeInvestor = async () => {
  console.log("Remove Investor from Factory");
  const contractsFactoryContract = (await ethers.getContractAt(
    "ContractsFactory",
    CONTRACTS_FACTORY_ADDRESS
  )) as ContractsFactory;

  const txResult = await contractsFactoryContract.removeInvestor(
    INVESTOR_ADDRESS
  );
  console.log("Investor Removed txHash: ", txResult.hash, "\n\n");
};

async function main(): Promise<void> {
  console.log(
    "==================================================================\n\n"
  );

  if (CONTRACTS_FACTORY_ADDRESS != "") {
    if (ADD_TRADER && TRADER_ADDRESS != "") {
      await addTrader();
    }
    if (REMOVE_TRADER && TRADER_ADDRESS != "") {
      await removeTrader();
    }

    if (ADD_INVESTOR && INVESTOR_ADDRESS != "") {
      await addInvestor();
    }
    if (REMOVE_INVESTOR && INVESTOR_ADDRESS != "") {
      await removeInvestor();
    }
  } else {
    console.log("No contracts factory address provided");
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
