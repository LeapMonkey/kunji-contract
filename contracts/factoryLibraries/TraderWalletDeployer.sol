// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {TraderWallet} from "../TraderWallet.sol";

library TraderWalletDeployer {
    event TraderWalletDeployed(
        address indexed _traderWalletAddress,
        address indexed _owner,
        address indexed _underlyingTokenAddress
    );

    function deployTraderWallet(
        address _underlyingTokenAddress,
        address _traderAddress,
        address _adaptersRegistryAddress,
        address _contractsFactoryAddress,
        address _owner
    ) external returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, block.number));
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,address,address,address)",
            _underlyingTokenAddress,
            _adaptersRegistryAddress,
            _contractsFactoryAddress,
            _traderAddress,
            _owner
        );

        TraderWallet traderWalletContract = new TraderWallet{salt: salt}();
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(traderWalletContract), // Address of the contract to be proxied
            _contractsFactoryAddress, // Address of the contract that will own the proxy
            data
        );

        emit TraderWalletDeployed(
            address(proxy),
            _owner,
            _underlyingTokenAddress
        );

        return (address(proxy));
    }
}
