// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAdaptersRegistry {
    function getAdapterAddressFromId(uint256) external view returns (address);

    function isAdapterAllowed(address) external view returns (bool);
}
