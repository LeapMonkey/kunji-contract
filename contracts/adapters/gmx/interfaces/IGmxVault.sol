// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

interface IGmxVault {
    function getMaxPrice(address indexToken) external view returns (uint256);

    function getMinPrice(address indexToken) external view returns (uint256);

    function getPosition(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    )
        external
        view
        returns (
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            uint256,
            bool,
            uint256
        );

    function getPositionDelta(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (bool, uint256);

    function isLeverageEnabled() external view returns (bool);
}
