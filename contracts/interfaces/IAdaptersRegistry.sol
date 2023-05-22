// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IAdaptersRegistry {
    function getAdapterAddress(uint256) external view returns (bool, address);
}
