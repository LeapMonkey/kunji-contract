// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAdaptersRegistry {
    // function isValidAdapter(address) external view returns (bool);
    // function isValidProtocol(uint256 _protocolId) external view returns(bool);
    function getAdapterAddress(uint256 _protocolId) external view returns(bool, address);
}
