import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import 'solidity-coverage';
import { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";
dotenv.config();

const arbitrum_rpc = process.env.ARBITRUM_NODE || "";
if (arbitrum_rpc === "") {
  throw new Error("Invalid ARBITRUM_NODE");
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  paths: {
    sources: "./contracts",
    tests: "./tests",
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 75,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: arbitrum_rpc,
        blockNumber: 77400000,
        enabled: true,
      },
    },
    arbitrum: {
      url: arbitrum_rpc,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    arbitrum_test: {
      url: process.env.TEST_ARBITRUM_NODE || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
