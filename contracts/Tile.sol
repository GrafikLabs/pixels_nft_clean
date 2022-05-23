// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./lib/ERC1155NFT.sol";

contract Tile is ERC1155NFT {
    struct Fees {
        // Charged for the first tile minted in a batch.
        uint256 mintFee;
        // Each tile in the same batch is this much cheaper than the previous one.
        uint256 bulkDiscount;
        // Minimum fee to be charged for the last tiles in a batch.
        uint256 mintFeeMin;
    }

    struct Limits {
        // The size of the board.
        uint128 size;
        // The maximum number of tiles that can be minted in one batch.
        uint16 batchSize;
        // The number of tiles that are free for the contract deployer *only*.
        uint256 deployerDiscountedTiles;
    }

    // A contract allowed to stash/unstash tiles (used for making blocks).
    address private _stasher = address(0);

    // Fees - use getMintCost to query.
    Fees private _fees;

    // Limits - use maxTiles / maxMintSize to query.
    Limits private _limits;

    // Account that deployed the contract.
    address private _deployer;

    constructor(
        Limits memory initialLimits,
        Fees memory initialFees,
        string memory apiUrl,
        address proxyRegistryAddress
    ) ERC1155NFT(string(abi.encodePacked(apiUrl, "tiles/")), proxyRegistryAddress) {
        require(initialFees.mintFeeMin < initialFees.mintFee, "Minimum fee exceeds starting fee");
        require(initialLimits.size % 2 == 0, "Size not even");
        _fees = Fees({
            mintFee: initialFees.mintFee * 10**9,
            mintFeeMin: initialFees.mintFeeMin * 10**9,
            bulkDiscount: initialFees.bulkDiscount * 10**9
        });
        _limits = initialLimits;
        _deployer = msg.sender;
    }

    /**
     * @dev Gets the current limit to tiles.
     */
    function maxTiles() public view returns (uint256) {
        return _limits.size**2;
    }

    /**
     * @dev Gets the current number of minted tiles
     * (convenience function identical to mintedTokens)
     */
    function mintedTiles() public view returns (uint256) {
        return mintedTokens;
    }

    /**
     * @dev Gets the current limit for tiles in a single batch.
     * @return the batch limit. If 0, there is no batch limit.
     */
    function maxMintSize() public view returns (uint16) {
        return _limits.batchSize;
    }

    /**
     * @dev Gets the cost of minting tiles.
     * @param amount the amount of tiles to mint.
     * @return the cost of minting the given amount of tiles. Cost may be 0 for deployer.
     */
    function getMintCost(uint16 amount) public view returns (uint256) {
        // Total owed:
        // sum_(x=0)^amount (mintFee - bulkDiscount * x)
        // i.e. each subsequent tile is bulkDiscount cheaper than the previous
        // one, starting at mintFee for the first one, down to mintFeeMin.
        // same as below:
        require(mintedTokens + amount <= maxTiles(), "Amount exceeds available");
        uint16 exemptAmount = 0;
        if (msg.sender == _deployer && _limits.deployerDiscountedTiles > mintedTokens) {
            exemptAmount = uint16(Math.min(_limits.deployerDiscountedTiles - mintedTokens, 2**16));
        }
        if (exemptAmount >= amount) {
            return 0;
        }
        uint256 base = Math.min(
            amount - exemptAmount,
            (_fees.mintFee - _fees.mintFeeMin) / _fees.bulkDiscount
        );
        return
            base *
            (_fees.mintFee - ((base - 1) * _fees.bulkDiscount) / 2) +
            (amount - exemptAmount - base) *
            _fees.mintFeeMin;
    }

    /**
     * @notice Mint `amount` tiles to address `to`.
     * @dev Mints tiles in batch.
     * @param amount the amount of tiles to mint.
     * @param to the address to mint tiles to (does not have to be msg.sender).
     */
    function mintTo(uint16 amount, address to) external payable {
        require(mintedTokens + amount <= maxTiles(), "Amount exceeds available");
        require(maxMintSize() == 0 || amount <= maxMintSize(), "Amount exceeds batch limit");
        uint256 transactionTotal = getMintCost(amount);
        require(msg.value >= transactionTotal, "Must pay for mint");
        uint256[] memory tileIds = new uint256[](amount);
        uint256[] memory ones = new uint256[](amount);
        for (uint16 i = 0; i < amount; i++) {
            tileIds[i] = mintedTokens + i;
            ones[i] = 1;
            _tokenOwners.push(to);
        }
        mintedTokens += amount;
        _doSafeBatchTransferAcceptanceCheck(msg.sender, address(0), to, tileIds, ones, "");
        emit TransferBatch(msg.sender, address(0), to, tileIds, ones);
    }

    // Stasher API.

    modifier onlyStasher() {
        require(_stasher == msg.sender, "Not a designated stasher");
        _;
    }

    function stashBatch(address from, uint256[] memory tileIds) external onlyStasher {
        uint256[] memory ones = new uint256[](tileIds.length);
        for (uint256 i = 0; i < tileIds.length; ++i) {
            uint256 id = tileIds[i];

            require(_tokenOwners[id] == from, "ERC1155: insufficient balance");
            _tokenOwners[id] = address(0);
            ones[i] = 1;
        }
        emit TransferBatch(msg.sender, from, address(0), tileIds, ones);
    }

    function unstashBatch(address to, uint256[] memory tileIds) external onlyStasher {
        uint256[] memory ones = new uint256[](tileIds.length);
        for (uint256 i = 0; i < tileIds.length; i++) {
            require(tileIds[i] < mintedTokens, "Token does not exist");
            ones[i] = 1;
        }
        _safeBatchTransferFrom(address(0), to, tileIds, ones, "");
    }

    // Owner API.

    function setFees(Fees memory newFees) external onlyOwner {
        require(newFees.mintFeeMin < newFees.mintFee, "Minimum fee exceeds starting fee");
        _fees = Fees({
            mintFee: newFees.mintFee * 10**9,
            mintFeeMin: newFees.mintFeeMin * 10**9,
            bulkDiscount: newFees.bulkDiscount * 10**9
        });
    }

    function setLimits(Limits memory newLimits) external onlyOwner {
        require(newLimits.size % 2 == 0, "Size not even");
        require(newLimits.size >= _limits.size, "Size smaller than current");
        require(
            newLimits.deployerDiscountedTiles == _limits.deployerDiscountedTiles,
            "Deployer discount changed"
        );
        _limits = newLimits;
    }

    function setBaseUrl(string memory newBaseUrl) public virtual override onlyOwner {
        super.setBaseUrl(string(abi.encodePacked(newBaseUrl, "tile/")));
    }

    function setStasher(address stasherContract) external onlyOwner {
        _stasher = stasherContract;
    }
}
