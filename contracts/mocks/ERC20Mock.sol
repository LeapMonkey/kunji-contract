// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./ERC20CustomInherits.sol";

contract ERC20Mock is ERC20CustomInherits {
    uint8 private immutable _decimals;
    bool returnBoolValue = true;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) ERC20CustomInherits(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function setReturnBoolValue(bool _value) external {
        returnBoolValue = _value;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        if (!returnBoolValue) return false;

        super.transferFrom(sender, recipient, amount);

        return true;
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        if (!returnBoolValue) return false;

        super.transfer(recipient, amount);

        return true;
    }

    function mockBalanceOf(address _account, uint256 newBalance) external {
        _balances[_account] = newBalance;
    }
}
