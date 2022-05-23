const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

describe("Tile", function () {
    let tile, accounts;
    const baseUrl = "https://pixels.watch/api/v1/tiles/";
    const deployerDiscountedTiles = 1024;

    async function mintCount(count, acctId = 0) {
        const wei = await tile.getMintCost(count);
        const tx = await tile.mintTo(count, accounts[acctId].address, { value: wei });
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferBatch');
        return event.args.ids;
    }

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        await deployments.fixture(["mocks", "tile"]);
        tile = await ethers.getContract("Tile");
    });

    it("Should support IERC1155 & IERC1155MetadataURI", async () => {
        const supportsIERC1155 = await tile.supportsInterface(0xd9b67a26);
        const supportsIERC1155MetadataURI = await tile.supportsInterface(0x0e89341c);
        expect(supportsIERC1155).equal(true);
        expect(supportsIERC1155MetadataURI).equal(true);
    });

    it("Should return valid contract url", async () => {
        const contractUrl = await tile.contractURI();
        expect(contractUrl).equal(`${baseUrl}contract`);
    });

    it("Should decrease cost of minting each land with volume", async () => {
        let previousCost = undefined;
        for (const count of [1, 10, 100, 1000]) {
            const wei = await tile.getMintCost(count);
            if (previousCost) {
                expect(wei / count).lessThan(previousCost);
            }
            previousCost = wei / count;
        }
    });

    it("Should emit transfer events", async () => {
        const count = 100;
        const wei = await tile.getMintCost(count);
        expect(tile.mintTo(count, accounts[0].address, { value: wei })).to.emit(
            tile,
            "TransferBatch"
        );
        const tokenIds = await mintCount(count);
        expect(tile.safeTransferFrom(accounts[0].address, accounts[1].address, tokenIds[0], 1, 0)).to.emit(
            tile,
            "TransferSingle"
        );
        expect(tile.safeBatchTransferFrom(accounts[0].address, accounts[1].address, [tokenIds[1], tokenIds[2]], [1, 1], 0)).to.emit(
            tile,
            "TransferBatch"
        );
        await tile.setStasher(accounts[5].address);
        expect(tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]])).to.emit(
            tile,
            "TransferBatch"
        );
        expect(tile.connect(accounts[5]).unstashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]])).to.emit(
            tile,
            "TransferBatch"
        );
    });

    it("Should successfully mint tiles with payment", async () => {
        for (const count of [1, 10, 100, 1000]) {
            const wei = await tile.getMintCost(count);
            expect(tile.mintTo(count, accounts[0].address, { value: wei })).to.emit(
                tile,
                "TransferBatch"
            )
        }
    });

    it("Should not charge deployer for initial tiles", async () => {
        const preMintCost = await tile.getMintCost(deployerDiscountedTiles);
        expect(preMintCost).equal(0);

        await tile.mintTo(deployerDiscountedTiles, accounts[0].address);
        const postMintCost = await tile.getMintCost(1);
        expect(postMintCost).not.equal(0);
    });

    it("Should allow setting new fees", async () => {
        const mintFee = 111111;
        const mintFeeMin = 111100;
        const bulkDiscount = 11;
        const nonDeployerTile = tile.connect(accounts[2]);
        await tile.setFees({
            mintFee: mintFee,
            mintFeeMin: mintFeeMin,
            bulkDiscount: bulkDiscount,
        });

        const mintCost = await nonDeployerTile.getMintCost(1);
        expected = mintFee;
        expect(mintCost).equal(expected * 10 ** 9);

        const mintTwoCost = await nonDeployerTile.getMintCost(2);
        expected = mintFee * 2 - bulkDiscount;
        expect(mintTwoCost).equal(expected * 10 ** 9);

        const mintThreeCost = await nonDeployerTile.getMintCost(3);
        expected = mintFee * 3 - bulkDiscount * 2;
        expect(mintThreeCost).equal(expected * 10 ** 9);
    });

    it("Should return correct owner", async () => {
        const owners = [0, 3, 5, 7];
        const tilesEach = 5;
        const tileIds = (await Promise.all(owners.map((id) => mintCount(tilesEach, id)))).flat();

        for (let i = 0; i < owners.length * tilesEach; i++) {
            const owner = await tile.getOwningAddress(tileIds[i]);
            const expectedOwner = owners[parseInt(i / tilesEach)];
            expect(owner).equals(accounts[expectedOwner].address);
        }
    });

    it("Should return correct owners in batch", async () => {
        const owners = [0, 3, 5, 7];
        const tilesEach = 5;
        const tileIds = (await Promise.all(owners.map((id) => mintCount(tilesEach, id)))).flat();

        const returnedOwners = await tile.getOwningAddressBatch(tileIds);
        for (let i = 0; i < owners.length * tilesEach; i++) {
            const expectedOwner = owners[parseInt(i / tilesEach)];
            expect(returnedOwners[i]).equals(accounts[expectedOwner].address);
        }
    });

    it("Should return valid metadata url", async () => {
        const count = 100;
        const tileIds = await mintCount(count);
        for (let i = 0; i < count; i++) {
            const tileUrl = await tile.uri(tileIds[i]);
            expect(tileUrl).equal(`${baseUrl}token/${tileIds[i]}`);
        }
    });

    it("Should mint tiles to provided account", async () => {
        for (const [count, acctId] of [[1, 0], [10, 1], [100, 2]]) {
            const tokenIds = await mintCount(count, acctId);
            expect(tokenIds).length(count);
            const accts = [];
            for (let i = 0; i < count; i++) {
                accts.push(accounts[acctId].address);
            }
            const batchResult = (await tile.balanceOfBatch(accts, tokenIds));
            const sum = batchResult.reduce((partialSum, a) => partialSum + parseInt(a), 0);
            expect(sum).equal(count);
        }
    });

    it("Should reject tiles with insufficient payment", async () => {
        for (const count of [1, 10, 100, 1000]) {
            const wei = await tile.getMintCost(count);
            expect(tile.mintTo(count, accounts[0].address, { value: wei - 100 })).to.be.reverted;
        }
    });

    it("Should reject setting smaller size", async () => {
        const maxTiles = await tile.maxTiles();
        const boardSize = Math.sqrt(parseInt(maxTiles));
        expect(tile.setLimits({ size: boardSize - 2, batchSize: maxTiles })).to.be.reverted;
    });

    it("Should reject price check when exceeding max", async () => {
        const mintedTiles = await tile.mintedTiles();
        const maxTiles = await tile.maxTiles();
        const boardSize = Math.sqrt(parseInt(maxTiles));
        const mintLimit = await tile.maxMintSize();
        expect(tile.getMintCost(mintLimit + 1)).to.be.reverted;
        await tile.setLimits({ size: boardSize, batchSize: maxTiles, deployerDiscountedTiles: deployerDiscountedTiles });
        expect(tile.getMintCost(maxTiles - mintedTiles)).to.be.reverted;
        await tile.setLimits({ size: boardSize, batchSize: mintLimit, deployerDiscountedTiles: deployerDiscountedTiles });
    });

    it("Should reject mint when exceeding max", async () => {
        const mintedTiles = await tile.mintedTiles();
        const maxTiles = await tile.maxTiles();
        const boardSize = Math.sqrt(parseInt(maxTiles));
        const mintLimit = await tile.maxMintSize();
        expect(tile.mintTo(mintLimit + 1, accounts[0].address, { value: ethers.utils.parseEther("10") })).to.be.reverted;
        await tile.setLimits({ size: boardSize, batchSize: maxTiles, deployerDiscountedTiles: deployerDiscountedTiles });
        expect(tile.mintTo(maxTiles - mintedTiles, accounts[0].address, { value: ethers.utils.parseEther("10") })).to.be.reverted;
        await tile.setLimits({ size: boardSize, batchSize: mintLimit, deployerDiscountedTiles: deployerDiscountedTiles });
    });

    it("Should not allow stashing without stasher set", async () => {
        await mintCount(100);
        expect(tile.stashBatch(accounts[0].address, [0, 1, 2, 3])).to.be.reverted;
        expect(tile.unstashBatch(accounts[0].address, [0, 1, 2, 3])).to.be.reverted;
    });

    it("Should not allow stashing by anyone but stasher", async () => {
        // Mint 100
        const tokenIds = await mintCount(100);

        // Set stasher
        await tile.setStasher(accounts[5].address);

        // Attempt stash by someone else
        expect(tile.stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]])).to.be.reverted;
        expect(tile.unstashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]])).to.be.reverted;

        // Attempt stash by stasher
        await tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);
        await tile.connect(accounts[5]).unstashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);
    });

    it("Should not allow stashing prior to minting", async () => {
        const mintedTiles = await tile.mintedTiles();
        await tile.setStasher(accounts[5].address);
        expect(tile.connect(accounts[5]).stashBatch(0, [mintedTiles])).to.be.reverted;
    });

    it("Should not allow stashing already stashed", async () => {
        const tokenIds = await mintCount(100);
        await tile.setStasher(accounts[5].address);

        await tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);
        expect(tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0]])).to.be.reverted;
    });

    it("Should only allow unstashing stashed tokens", async () => {
        const tokenIds = await mintCount(100);
        await tile.setStasher(accounts[5].address);

        // Unstash without stashing should be rejected.
        expect(tile.unstashBatch(accounts[5].address, [tokenIds[0], tokenIds[1]])).to.be.reverted;

        // Stashing first should make it succeed.
        await tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);
        await tile.connect(accounts[5]).unstashBatch(accounts[0].address, [tokenIds[0]]);
    });


    it("Stashing should remove balance", async () => {
        const tokenIds = await mintCount(100);
        await tile.setStasher(accounts[5].address);

        let balance = await tile.balanceOf(accounts[0].address, tokenIds[0]);
        expect(balance).equal(1);

        await tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);

        balance = await tile.balanceOf(accounts[0].address, tokenIds[0]);
        expect(balance).equal(0);
    });

    it("Unstashing should add balance", async () => {
        const tokenIds = await mintCount(100);
        await tile.setStasher(accounts[5].address);
        await tile.connect(accounts[5]).stashBatch(accounts[0].address, [tokenIds[0], tokenIds[1]]);

        balance = await tile.balanceOf(accounts[0].address, tokenIds[0]);
        expect(balance).equal(0);

        await tile.connect(accounts[5]).unstashBatch(accounts[0].address, [tokenIds[0]]);

        balance = await tile.balanceOf(accounts[0].address, tokenIds[0]);
        expect(balance).equal(1);
    });

    it("Should allow manual proxy", async () => {
        const tokenIds = await mintCount(100, 3);
        await tile.connect(accounts[3]).setApprovalForAll(accounts[5].address, true);

        await tile.connect(accounts[5]).safeTransferFrom(accounts[3].address, accounts[2].address, tokenIds[0], 1, 0);

        const balance = await tile.balanceOf(accounts[2].address, tokenIds[0]);
        expect(balance).equal(1);

        await tile.connect(accounts[3]).setApprovalForAll(accounts[5].address, false);
        expect(tile.connect(accounts[5]).safeTransferFrom(accounts[3].address, accounts[2].address, tokenIds[0], 1, 0)).to.be.reverted;
    });

    it("Should allow proxy from registry", async () => {
        const tokenIds = await mintCount(100, 3);
        const registry = await ethers.getContract("ProxyRegistryMock");
        registry.connect(accounts[3]).setProxy(accounts[5].address);

        await tile.connect(accounts[5]).safeTransferFrom(accounts[3].address, accounts[2].address, tokenIds[0], 1, 0);

        const balance = await tile.balanceOf(accounts[2].address, tokenIds[0]);
        expect(balance).equal(1);
    });

    it("Should reject transfer to non-receiver contract", async () => {
        const tokenIds = await mintCount(100, 3);
        const registry = await ethers.getContract("ProxyRegistryMock");

        expect(tile.safeTransferFrom(accounts[3].address, registry.address, tokenIds[0], 1, 0)).to.be.reverted;
        expect(tile.safeBatchTransferFrom(accounts[3].address, registry.address, [tokenIds[0], tokenIds[1]], [1, 1], 0)).to.be.reverted;
    });

    it("Should reject transfer when receiver rejects", async () => {
        const tokenIds = await mintCount(100, 3);
        const receiver = await ethers.getContract("IERC1155ReceiverMock");

        await receiver.rejectAll();
        expect(tile.safeTransferFrom(accounts[3].address, receiver.address, tokenIds[0], 1, 0)).to.be.reverted;
        expect(tile.safeBatchTransferFrom(accounts[3].address, receiver.address, [tokenIds[0], tokenIds[1]], [1, 1], 0)).to.be.reverted;

        await receiver.revertAll();
        expect(tile.safeTransferFrom(accounts[3].address, receiver.address, tokenIds[0], 1, 0)).to.be.reverted;
        expect(tile.safeBatchTransferFrom(accounts[3].address, receiver.address, [tokenIds[0], tokenIds[1]], [1, 1], 0)).to.be.reverted;
    });

    it("Should allow withdraw by owner", async () => {
        const provider = waffle.provider;
        await mintCount(100, 3);
        const contractBalanceBefore = await provider.getBalance(tile.address);
        const accountBalanceBefore = await provider.getBalance(accounts[3].address);

        await tile.withdraw(accounts[3].address, contractBalanceBefore);

        const contractBalanceAfter = await provider.getBalance(tile.address);
        const accountBalanceAfter = await provider.getBalance(accounts[3].address);

        expect(contractBalanceAfter).equal(0);
        expect(accountBalanceAfter).equal(accountBalanceBefore.add(contractBalanceBefore));
    });

    it("Should return deployer @ 7% for royalties by default", async () => {
        const royaltyInfo = await tile.royaltyInfo(0, 100000);
        expect(royaltyInfo[0]).equal(accounts[0].address);
        expect(royaltyInfo[1]).equal(Math.floor(0.07 * 100000));
    });

    it("Should set royalties correctly", async () => {
        await tile.setRoyaltyConfig({ target: accounts[1].address, points: 255 });
        const royaltyInfo = await tile.royaltyInfo(0, 100000);
        expect(royaltyInfo[0]).equal(accounts[1].address);
        expect(royaltyInfo[1]).equal(Math.floor(0.255 * 100000));
    })
});