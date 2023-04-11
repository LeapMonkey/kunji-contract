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

  
    // receives the operation to perform in the adapter and the ratio to scale whatever needed
    // answers if the operation was successfull 
    function executeOperations(uint256, AdapterOperation memory) external returns(bool);
}