// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

// This is largely replicating OpenZeppelin's ERC1155 - private access to owner
// mapping was needed for stashing.
contract IERC1155ReceiverMock is IERC1155Receiver {
    bool private _acceptAll = true;
    bool private _revertAll = false;

    function revertAll() external {
        _revertAll = true;
    }

    function rejectAll() external {
        _acceptAll = false;
        _revertAll = false;
    }

    function acceptAll() external {
        _acceptAll = true;
        _revertAll = false;
    }

    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external view override returns (bytes4) {
        require(!_revertAll, "Reverting all");
        if (_acceptAll) {
            return
                bytes4(
                    keccak256(
                        "onERC1155Received(address,address,uint256,uint256,bytes)"
                    )
                );
        }
        return bytes4(0);
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external view override returns (bytes4) {
        require(!_revertAll, "Reverting all");
        if (_acceptAll) {
            return
                bytes4(
                    keccak256(
                        "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
                    )
                );
        }
        return bytes4(0);
    }
}
