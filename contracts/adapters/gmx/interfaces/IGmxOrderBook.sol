// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IGmxOrderBook {

    function minExecutionFee() external view returns (uint256);

    function createSwapOrder(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _triggerRatio, // tokenB / tokenA
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap,
        bool _shouldUnwrap
    ) external payable;

    function cancelSwapOrder(uint256 _orderIndex) external;

    function createIncreaseOrder(
        address[] memory _path,
        uint256 _amountIn,
        address _indexToken,
        uint256 _minOut,
        uint256 _sizeDelta,
        address _collateralToken,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold,
        uint256 _executionFee,
        bool _shouldWrap
    ) external payable;

    function updateIncreaseOrder(
        uint256 _orderIndex,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external;

    function cancelIncreaseOrder(uint256 _orderIndex) external;

    function createDecreaseOrder(
        address _indexToken,
        uint256 _sizeDelta,
        address _collateralToken,
        uint256 _collateralDelta,
        bool _isLong,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external payable;

    function updateDecreaseOrder(
        uint256 _orderIndex,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        uint256 _triggerPrice,
        bool _triggerAboveThreshold
    ) external;

    function cancelDecreaseOrder(uint256 _orderIndex) external;

    function cancelMultiple(
        uint256[] memory _swapOrderIndexes,
        uint256[] memory _increaseOrderIndexes,
        uint256[] memory _decreaseOrderIndexes
    ) external;


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


interface IGmxOrderBookReader {

    function getIncreaseOrders(
        address payable _orderBookAddress, 
        address _account,
        uint256[] memory _indices
    ) external view returns (uint256[] memory, address[] memory);


    function getDecreaseOrders(
        address payable _orderBookAddress, 
        address _account,
        uint256[] memory _indices
    ) external view returns (uint256[] memory, address[] memory);


    function getSwapOrders(
        address payable _orderBookAddress, 
        address _account,
        uint256[] memory _indices
    ) external view returns (uint256[] memory, address[] memory);

}
