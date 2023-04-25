// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AdaptersRegistryMock is OwnableUpgradeable {
    bool public returnValue;
    address public returnAddress;

    uint256[] public validProtocols;

    function initialize() external initializer {
        validProtocols = [1, 2, 3, 4, 5, 6, 7, 8];
        returnValue = false;
        returnAddress = address(0);
    }

    function setReturnValue(bool _value) external {
        returnValue = _value;
    }

    function setReturnAddress(address _address) external {
        returnAddress = _address;
    }

    function getAdapterAddress(uint256 _protocolId) external view returns(bool, address) {
        _protocolId; // just to avoid warnings
        return (returnValue, returnAddress);
    }
    
    // function isValidAdapter(address _adapterAddress) external view returns (bool) {
    //     _adapterAddress;            // just to avoid warnings
    //     return returnValue;
    // }

    // function isValidProtocol(uint256 _protocolId) external view returns (bool) {
    //     _protocolId; // just to avoid warnings
    //     return returnValue;
    // }
}
