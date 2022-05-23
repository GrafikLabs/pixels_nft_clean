// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;


contract OwnableDelegateProxy {} // solhint-disable-line
contract ProxyRegistry {
  mapping(address => OwnableDelegateProxy) public proxies;
}