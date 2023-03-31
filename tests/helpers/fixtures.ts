import { ethers } from "hardhat";
import { BatchedVault } from "../../typechain-types";

export async function deployVault(): Promise<BatchedVault> {
  const BatchedVaultFactory = await ethers.getContractFactory("BatchedVault");
  const batchedVaultContract = await BatchedVaultFactory.deploy();
  if (batchedVaultContract === undefined)
    throw new Error(
      "batchedVaultContract NOT deployed. Something weird happened"
    );
  await batchedVaultContract.deployed();

  return batchedVaultContract as BatchedVault;
}
