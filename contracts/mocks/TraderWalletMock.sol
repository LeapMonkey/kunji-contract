// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import {IUsersVault} from "./../interfaces/IUsersVault.sol";
import {IAdapter} from "../interfaces/IAdapter.sol";

contract TraderWalletMock {
    event RolloverExecuted();

    address public addressToReturn;
    address public usersVaultAddress;

    constructor() {
        
    }

    function setUsersVault(address _value) external {
        usersVaultAddress = _value;
    }

    function setAddressToReturn(address _value) external {
        addressToReturn = _value;
    }

    function getAdapterAddressPerProtocol(
        uint256 _protocolId
    ) external view returns (address) {
        _protocolId;
        return addressToReturn;
    }

    function callExecuteOnProtocolInVault(
        uint256 _protocolId,
        IAdapter.AdapterOperation memory _traderOperation,
        uint256 _walletRatio
    ) external {
        IUsersVault(usersVaultAddress).executeOnProtocol(
            _protocolId,
            _traderOperation,
            _walletRatio
        );
        emit RolloverExecuted();
    }

    function callRolloverInVault() external {
        IUsersVault(usersVaultAddress).rolloverFromTrader();
    }
}
