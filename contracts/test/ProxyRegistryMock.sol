// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../lib/ProxyRegistry.sol";

contract ProxyRegistryMock is ProxyRegistry {
  function setProxy(address proxy) public {
      proxies[msg.sender] = OwnableDelegateProxy(proxy);
  }
}