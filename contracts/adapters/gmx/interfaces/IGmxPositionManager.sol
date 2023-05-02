// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IGmxPositionManager {

    function executeDecreaseOrder(
        address _address,
        uint256 _orderIndex,
        address payable _feeReceiver) external;

    function executeIncreaseOrder(
        address _address,
        uint256 _orderIndex,
        address payable _feeReceiver
    ) external;

}
