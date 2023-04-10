// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IAdapter {
    
    struct AdapterOperation {
        // id to identify what type of operation the adapter should do
        // this is a generic operation
        uint8 _operationId;

        // signatura of the funcion
        // abi.encodeWithSignature
        bytes _data;
    }

    struct Parameters {
        // order in the function
        uint8 _order;

        // type of the parameter (uint256, address, etc)
        bytes32 _type;

        // value of the parameter
        string _value;
    }

    // receives the operation to perform in the adapter 
    // answers if the operation is one of the generic ones before sending it to the adapter
    function isOperationAllowed(AdapterOperation memory) external returns(bool);
    
    // receives the operation to perform in the adapter and the parameter list (type and value) of the function to be call 
    // answers if the operation was successfull and how much underlying was used
    // this uint256 will be used to scale the value in the vault
    function executeOperations(uint256, AdapterOperation memory) external returns(bool);
}