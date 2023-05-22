// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {UsersVault} from "../UsersVault.sol";

library UsersVaultDeployer {
    event UsersVaultDeployed(
        address indexed _usersVaultAddress,
        address indexed _traderWalletAddress,
        address indexed _underlyingTokenAddress,
        string sharesName
    );

    function deployUsersVault(
        address _underlyingTokenAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _traderWalletAddress,
        // address _dynamicValueAddress,
        address _ownerAddress,
        string memory _sharesName,
        string memory _sharesSymbol
    ) external returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.number));
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,address,address,address,string,string)",
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _traderWalletAddress,
            // _dynamicValueAddress,
            _ownerAddress,
            _sharesName,
            _sharesSymbol
        );

        UsersVault usersVaultContract = new UsersVault{salt: salt}();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(usersVaultContract), // Address of the contract to be proxied
            _contractsFactoryAddress, // Address of the contract that will own the proxy
            data
        );

        emit UsersVaultDeployed(
            address(proxy),
            _ownerAddress,
            _traderWalletAddress,
            _sharesName
        );

        return (address(proxy));
    }
}
