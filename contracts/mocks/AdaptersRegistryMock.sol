// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract AdaptersRegistryMock is OwnableUpgradeable {
    bool public returnValue;
    address public adapterAddress;

    uint256[] public validProtocols;

    function initialize() external initializer {
        __Ownable_init();
        validProtocols = [1, 2];
        returnValue = false;
    }

    function setReturnValue(bool _value) external onlyOwner {
        returnValue = _value;
    }

    function setReturnAddress(address _address) external onlyOwner {
        adapterAddress = _address;
    }

    function getAdapterAddress(
        uint256 _protocolId
    ) external view returns (bool, address) {
        _protocolId; // just to avoid warnings
        return (returnValue, adapterAddress);
    }
}
