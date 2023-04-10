// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAdaptersRegistry {
    function isValidAdapter(address) external view returns (bool);
}
