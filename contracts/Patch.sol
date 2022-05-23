// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./lib/ERC1155NFT.sol";
import "./Tile.sol";

contract Patch is ERC1155NFT {
    struct Rectangle {
        // Bottom left corner
        int256 x;
        int256 y;
        // Size
        uint256 width;
        uint256 height;
    }

    // The tile contract to stash for.
    address private _tileContract = address(0);

    // The patch extents.
    mapping(uint256 => Rectangle) private _bounds;

    // Mapping of tile to patch
    mapping(uint256 => uint256) private _tileToPatch;

    constructor(
        address tileContract,
        string memory apiUrl,
        address proxyRegistryAddress
    ) ERC1155NFT(string(abi.encodePacked(apiUrl, "patches/")), proxyRegistryAddress) {
        _tileContract = tileContract;
    }

    /**
     * @dev Gets the patch for a given tile (if it exists).
     */
    function getTilePatch(uint256 id) external view returns (uint256) {
        return _tileToPatch[id];
    }

    /**
     * @dev Gets the bounds of a given patch.
     */
    function getBounds(uint256 id) external view returns (Rectangle memory) {
        return _bounds[id];
    }

    /**
     * @dev Gets the owner of a given tile (if a patch exists).
     */
    function getTileOwner(uint256 id) external view returns (address) {
        return _tokenOwners[_tileToPatch[id]];
    }

    /**
     * @dev Gets the owner(s) of a given batch of tiles (if a patch exists).
     */
    function getTileOwnerBatch(uint256[] memory ids) external view returns (address[] memory) {
        address[] memory batchOwners = new address[](ids.length);

        for (uint256 i = 0; i < ids.length; ++i) {
            batchOwners[i] = _tokenOwners[_tileToPatch[ids[i]]];
        }

        return batchOwners;
    }

    function abs(int256 val) private pure returns (int256) {
        return val >= 0 ? val : -val;
    }

    function idFromXY(int256 x, int256 y) private pure returns (uint256) {
        if (x == 0 && y == 0) {
            return 0;
        }
        if (x == 1 && y == 0) {
            return 1;
        }
        if (x == 1 && y == -1) {
            return 2;
        }
        if (x == 0 && y == -1) {
            return 3;
        }

        int256 absX = abs(x);
        int256 absY = abs(y);
        int256 layer;
        int256 layerId;
        if (absX > absY || (absX == absY && x < 0)) {
            if (x > 0) {
                layer = x - 1;
                layerId = (layer * 4 + 1) + absX - y - 1;
            } else {
                layer = absX;
                layerId = y - x;
            }
        } else {
            if (y > 0) {
                layer = y;
                layerId = (layer * 2) + absY + x;
            } else {
                layer = absY - 1;
                layerId = (layer * 6 + 1) - x - y + 1;
            }
        }

        return uint256(((layer) * 2)**2 + layerId);
    }

    function mintPatchTo(Rectangle memory patchBounds, address to) external {
        uint256[] memory batch = new uint256[](patchBounds.width * patchBounds.height);
        uint256 newPatchId = mintedTokens++;
        _bounds[newPatchId] = patchBounds;
        for (uint256 i = 0; i < patchBounds.width; i++) {
            for (uint256 j = 0; j < patchBounds.height; j++) {
                uint256 id = idFromXY(patchBounds.x + int256(i), patchBounds.y + int256(j));
                require(id < Tile(_tileContract).mintedTiles(), "Rect out of bounds");
                batch[j * patchBounds.width + i] = id;
                _tileToPatch[id] = newPatchId;
            }
        }

        Tile(_tileContract).stashBatch(to, batch);
        _tokenOwners.push(to);
        emit TransferSingle(msg.sender, address(0), to, newPatchId, 1);
    }

    function breakPatchFrom(uint256 patchId, address from) external {
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not approved"
        );
        require(_tokenOwners[patchId] == from, "ERC1155: insufficient balance");
        Rectangle memory patchBounds = _bounds[patchId];
        uint256[] memory batch = new uint256[](patchBounds.width * patchBounds.height);
        for (uint256 i = 0; i < patchBounds.width; i++) {
            for (uint256 j = 0; j < patchBounds.height; j++) {
                uint256 id = idFromXY(patchBounds.x + int256(i), patchBounds.y + int256(j));
                batch[j * patchBounds.width + i] = id;
                _tileToPatch[id] = 0;
            }
        }

        Tile(_tileContract).unstashBatch(from, batch);
        _tokenOwners[patchId] = address(0);
        emit TransferSingle(msg.sender, from, address(0), patchId, 1);
    }

    /**
     * @dev Combine two patches. Must have the same width or heigh and be adjacent.
     * The resulting shape must be a rectanle as well.
     */
    function combinePatches(
        uint256 firstPatchId,
        uint256 secondPatchId,
        address to
    ) external {
        Rectangle memory firstPatch = _bounds[firstPatchId];
        Rectangle memory secondPatch = _bounds[secondPatchId];
        Rectangle memory result;
        if (firstPatch.x == secondPatch.x) {
            require(firstPatch.width == secondPatch.width, "Mismatched sizes");
            if (firstPatch.y == secondPatch.y + int256(secondPatch.height)) {
                // first is on top of second.
                result = Rectangle({
                    x: secondPatch.x,
                    y: secondPatch.y,
                    width: secondPatch.width,
                    height: secondPatch.height + firstPatch.height
                });
            } else if (secondPatch.y == firstPatch.y + int256(firstPatch.height)) {
                // second is on top of first.
                result = Rectangle({
                    x: firstPatch.x,
                    y: firstPatch.y,
                    width: firstPatch.width,
                    height: firstPatch.height + secondPatch.height
                });
            } else {
                revert("Not adjacent");
            }
        } else if (firstPatch.y == secondPatch.y) {
            require(firstPatch.height == secondPatch.height, "Mismatched sizes");
            if (firstPatch.x == secondPatch.x + int256(secondPatch.width)) {
                // first is on the right of second.
                result = Rectangle({
                    x: secondPatch.x,
                    y: secondPatch.y,
                    width: secondPatch.width + firstPatch.width,
                    height: secondPatch.height
                });
            } else if (secondPatch.x == firstPatch.x + int256(firstPatch.width)) {
                // second is on the right of first.
                result = Rectangle({
                    x: firstPatch.x,
                    y: firstPatch.y,
                    width: firstPatch.width + secondPatch.width,
                    height: firstPatch.height
                });
            } else {
                revert("Not adjacent");
            }
        } else {
            revert("Resulting shape not rectangle.");
        }

        uint256 newPatchId = mintedTokens++;
        _bounds[newPatchId] = result;
        for (uint256 i = 0; i < result.width; i++) {
            for (uint256 j = 0; j < result.height; j++) {
                uint256 id = idFromXY(result.x + int256(i), result.y + int256(j));
                _tileToPatch[id] = newPatchId;
            }
        }

        _tokenOwners.push(to);

        // Burn
        uint256[] memory ids = new uint256[](2);
        ids[0] = firstPatchId;
        ids[1] = secondPatchId;
        uint256[] memory ones = new uint256[](2);
        ones[0] = 1;
        ones[1] = 1;
        require(_tokenOwners[firstPatchId] == to, "ERC1155: insufficient balance");
        _tokenOwners[firstPatchId] = address(0);
        require(_tokenOwners[secondPatchId] == to, "ERC1155: insufficient balance");
        _tokenOwners[secondPatchId] = address(0);
        emit TransferBatch(msg.sender, to, address(0), ids, ones);

        // Mint new
        emit TransferSingle(msg.sender, address(0), to, newPatchId, 1);
    }
}
