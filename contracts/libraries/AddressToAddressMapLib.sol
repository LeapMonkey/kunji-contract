import {EnumerableMapUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableMapUpgradeable.sol";

library AddressToAddressMapLib {
    // AddressToAddressMap
    using EnumerableMapUpgradeable for EnumerableMapUpgradeable.Bytes32ToBytes32Map;
    struct AddressToAddressMap {
        EnumerableMapUpgradeable.Bytes32ToBytes32Map _inner;
    }

    /**
     * @dev Adds a key-value pair to a map, or updates the value for an existing
     * key. O(1).
     *
     * Returns true if the key was added to the map, that is if it was not
     * already present.
     */
    function set(
        AddressToAddressMap storage map,
        address key,
        address value
    ) internal returns (bool) {
        return
            map._inner.set(
                bytes32(uint256(uint160(key))),
                bytes32(uint256(uint160(value)))
            );
    }

    /**
     * @dev Removes a value from a set. O(1).
     *
     * Returns true if the key was removed from the map, that is if it was present.
     */
    function remove(
        AddressToAddressMap storage map,
        address key
    ) internal returns (bool) {
        return map._inner.remove(bytes32(uint256(uint160(key))));
    }

    /**
     * @dev Returns true if the key is in the map. O(1).
     */
    function contains(
        AddressToAddressMap storage map,
        address key
    ) internal view returns (bool) {
        return map._inner.contains(bytes32(uint256(uint160(key))));
    }

    /**
     * @dev Returns the number of elements in the map. O(1).
     */
    function length(
        AddressToAddressMap storage map
    ) internal view returns (uint256) {
        return map._inner.length();
    }

    /**
     * @dev Returns the element stored at position `index` in the set. O(1).
     * Note that there are no guarantees on the ordering of values inside the
     * array, and it may change when more values are added or removed.
     *
     * Requirements:
     *
     * - `index` must be strictly less than {length}.
     */
    function at(
        AddressToAddressMap storage map,
        uint256 index
    ) internal view returns (address, address) {
        (bytes32 key, bytes32 value) = map._inner.at(index);
        return (
            address(uint160(uint256(key))),
            address(uint160(uint256(value)))
        );
    }

    /**
     * @dev Tries to returns the value associated with `key`. O(1).
     * Does not revert if `key` is not in the map.
     */
    function tryGet(
        AddressToAddressMap storage map,
        address key
    ) internal view returns (bool, address) {
        (bool success, bytes32 value) = map._inner.tryGet(
            bytes32(uint256(uint160(key)))
        );
        return (success, address(uint160(uint256(value))));
    }

    /**
     * @dev Returns the value associated with `key`. O(1).
     *
     * Requirements:
     *
     * - `key` must be in the map.
     */
    function get(
        AddressToAddressMap storage map,
        address key
    ) internal view returns (address) {
        return
            address(
                uint160(
                    uint256((map._inner.get(bytes32(uint256(uint160(key))))))
                )
            );
    }

    /**
     * @dev Same as {get}, with a custom error message when `key` is not in the map.
     *
     * CAUTION: This function is deprecated because it requires allocating memory for the error
     * message unnecessarily. For custom revert reasons use {tryGet}.
     */
    function get(
        AddressToAddressMap storage map,
        address key,
        string memory errorMessage
    ) internal view returns (uint256) {
        return
            uint256(
                map._inner.get(bytes32(uint256(uint160(key))), errorMessage)
            );
    }
}
