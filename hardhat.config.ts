import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "solidity-coverage";
import "hardhat-contract-sizer";
import "hardhat-gas-reporter";
import "hardhat-abi-exporter";
import "hardhat-spdx-license-identifier";
import "hardhat-tracer";
import "solidity-docgen";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";

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
    excludeContracts: ["@openzeppelin/contracts/", "mocks/"],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
    except: ["@openzeppelin/contracts/", "mocks/"],
  },
  mocha: {
    timeout: 100000000,
  },
  spdxLicenseIdentifier: {
    overwrite: true,
    runOnCompile: true,
  },
  abiExporter: {
    path: "./data/abi",
    runOnCompile: true,
    clear: true,
    flat: true,
    spacing: 2,
    except: ["@openzeppelin/contracts/", "interfaces/", "mocks/"],
  },
};

export default config;
