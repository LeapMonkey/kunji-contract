// import { ethers } from "hardhat";
import { Signer, BigNumber, Contract } from "ethers";

export const mintForUsers = async (
  _userAddresses: Array<string>,
  _tokenContract: Contract,
  _amount: BigNumber,
  _times: number
) => {
  for (let i = 0; i < _times; i++) {
    await _tokenContract.mint(_userAddresses[i], _amount);
  }
};

export const approveForUsers = async (
  _user: Array<Signer>,
  _tokenContract: Contract,
  _amount: BigNumber,
  _spenderAddress: string,
  _times: number
) => {
  for (let i = 0; i < _times; i++) {
    await _tokenContract.connect(_user[i]).approve(_spenderAddress, _amount);
  }
};

export const usersDeposit = async (
  _contract: Contract,
  _user: Array<Signer>,
  _amount: BigNumber,
  _times: number
) => {
  for (let i = 0; i < _times; i++) {
    await _contract
      .connect(_user[i])
      .userDeposit((_amount).mul(i + 1));
  }
};

export const claimShares = async (
  _contract: Contract,
  _user: Array<Signer>,
  _amount: BigNumber,
  _receiver: Array<string>,
  _times: number
) => {
  for (let i = 0; i < _times; i++) {
    await _contract.connect(_user[i]).claimShares(_amount, _receiver[i]);
  }
};
