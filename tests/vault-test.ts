import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployVault } from "./helpers/fixture";
import { BatchedVault } from "../typechain-types";


describe("Use Fixture to deploy Batched Vault", function () {
  it("Should return 1 for current round", async function () {
    const vaultContract:BatchedVault = await loadFixture(deployVault);
    const currentRound = await vaultContract.currentRound();
    expect(currentRound).to.equal(1);
  });
});
