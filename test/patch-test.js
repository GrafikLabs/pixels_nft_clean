const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("Patch", function () {
    let tile, patch, accounts;
    const baseUrl = "https://pixels.watch/api/v1/patches/";

    async function mintCount(count, acctId = 0) {
        const wei = await tile.getMintCost(count);
        const tx = await tile.mintTo(count, accounts[acctId].address, { value: wei });
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferBatch');
        return event.args.ids;
    }

    async function makePatch({ x, y, width, height }, acctId = 0) {
        const tx = await patch.mintPatchTo({ x, y, width, height }, accounts[acctId].address);
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferSingle');
        return event.args.id;
    }

    async function combinePatch(firstPatchId, secondPatchId, acctId = 0) {
        const tx = await patch.combinePatches(firstPatchId, secondPatchId, accounts[acctId].address);
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferSingle');
        return event.args.id;
    }

    beforeEach(async () => {
        accounts = await ethers.getSigners();
        await deployments.fixture(["mocks", "tile", "patch"]);
        tile = await ethers.getContract("Tile");
        patch = await ethers.getContract("Patch");
    });

    it("Should support IERC1155 & IERC1155MetadataURI", async () => {
        const supportsIERC1155 = await patch.supportsInterface(0xd9b67a26);
        const supportsIERC1155MetadataURI = await patch.supportsInterface(0x0e89341c);
        expect(supportsIERC1155).equal(true);
        expect(supportsIERC1155MetadataURI).equal(true);
    });

    it("Should return valid contract url", async () => {
        const contractUrl = await patch.contractURI();
        expect(contractUrl).equal(`${baseUrl}contract`);
    });

    it("Should correctly calculate IDs", async () => {
        await mintCount(256);
        const expectedIds = [
            255, 254, 253, 252, 251, 250, 249, 248, 247, 246, 245, 244, 243, 242, 241, 240,
            196, 195, 194, 193, 192, 191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 239,
            197, 144, 143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 181, 238,
            198, 145, 100, 99., 98., 97., 96., 95., 94., 93., 92., 91., 90., 131, 180, 237,
            199, 146, 101, 64., 63., 62., 61., 60., 59., 58., 57., 56., 89., 130, 179, 236,
            200, 147, 102, 65., 36., 35., 34., 33., 32., 31., 30., 55., 88., 129, 178, 235,
            201, 148, 103, 66., 37., 16., 15., 14., 13., 12., 29., 54., 87., 128, 177, 234,
            202, 149, 104, 67., 38., 17., 4.0, 3.0, 2.0, 11., 28., 53., 86., 127, 176, 233,
            203, 150, 105, 68., 39., 18., 5.0, 0.0, 1.0, 10., 27., 52., 85., 126, 175, 232,
            204, 151, 106, 69., 40., 19., 6.0, 7.0, 8.0, 9.0, 26., 51., 84., 125, 174, 231,
            205, 152, 107, 70., 41., 20., 21., 22., 23., 24., 25., 50., 83., 124, 173, 230,
            206, 153, 108, 71., 42., 43., 44., 45., 46., 47., 48., 49., 82., 123, 172, 229,
            207, 154, 109, 72., 73., 74., 75., 76., 77., 78., 79., 80., 81., 122, 171, 228,
            208, 155, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 170, 227,
            209, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 226,
            210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225
        ]
        const tx = await patch.mintPatchTo({ x: -7, y: -8, width: 16, height: 16 }, accounts[0].address);
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferBatch');
        const stashedIds = event.args.ids.map((id) => parseInt(id));
        expect(stashedIds).to.deep.equal(expectedIds);
    });

    it("Should mint new NFT for patch", async () => {
        await mintCount(256);
        const tokenId = await makePatch({ x: -7, y: -8, width: 16, height: 16 });
        const balance = await patch.balanceOf(accounts[0].address, tokenId);
        expect(balance).equal(1);
    });

    it("Should be able to get containing patch", async () => {
        const tileIds = await mintCount(256);
        const tokenId = await makePatch({ x: -7, y: -8, width: 16, height: 16 });
        for (const tileId of tileIds) {
            const patchId = await patch.getTilePatch(tileId);
            expect(patchId).equal(tokenId);
        }
    });

    it("Should be able to get bounds", async () => {
        await mintCount(256);
        const tokenId = await makePatch({ x: -7, y: -8, width: 16, height: 16 });
        const bounds = await patch.getBounds(tokenId);
        expect(bounds.map((bn) => parseInt(bn))).to.deep.equal([-7, -8, 16, 16]);
    });

    it("Should not allow minting unless owned", async () => {
        await mintCount(256);
        expect(makePatch({ x: -7, y: -8, width: 16, height: 16 }, 2)).to.be.reverted;
    });

    it("Should not allow minting out of bounds", async () => {
        await mintCount(256);

        // overlap
        expect(makePatch({ x: -8, y: -9, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: -8, y: 0, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: -8, y: 8, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: 0, y: 8, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: 7, y: 8, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: 7, y: 0, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: 7, y: -9, width: 5, height: 5 })).to.be.reverted;
        expect(makePatch({ x: 0, y: -9, width: 5, height: 5 })).to.be.reverted;

        // completely outside
        expect(makePatch({ x: -12, y: -12, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: -12, y: 0, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: -12, y: 12, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: 0, y: 12, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: 12, y: 12, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: 12, y: 0, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: 12, y: -12, width: 2, height: 2 })).to.be.reverted;
        expect(makePatch({ x: 0, y: -12, width: 2, height: 2 })).to.be.reverted;
    });

    it("Should allocate owner for patch's tiles correctly", async () => {
        const tileIds = await mintCount(256);
        const tokenId = await makePatch({ x: -7, y: -8, width: 16, height: 16 });
        for (const tileId of tileIds) {
            const owner = await patch.getTileOwner(tileId);
            expect(owner).equal(accounts[0].address);
        }
        const owners = await patch.getTileOwnerBatch(tileIds);
        for (const owner of owners) {
            expect(owner).equal(accounts[0].address);
        }
        const balance = await patch.balanceOf(accounts[0].address, tokenId);
        expect(balance).equal(1);
    });

    it("Should combine patches", async () => {
        await mintCount(256);
        const centerPatch = await makePatch({ x: 0, y: -1, width: 2, height: 2 });
        const abovePatch = await makePatch({ x: 0, y: 1, width: 2, height: 2 });
        const rightPatch = await makePatch({ x: 2, y: -1, width: 2, height: 2 });
        const aboveRightPatch = await makePatch({ x: 2, y: 1, width: 2, height: 2 });
        const belowPatch = await makePatch({ x: 0, y: -3, width: 2, height: 2 });
        const belowRightPatch = await makePatch({ x: 2, y: -3, width: 2, height: 2 });
        // first below second
        const lPatch = await combinePatch(centerPatch, abovePatch);

        // first above second
        const rPatch = await combinePatch(aboveRightPatch, rightPatch);

        // first left of second
        await combinePatch(lPatch, rPatch);

        // first right of second
        await combinePatch(belowRightPatch, belowPatch);
    });

    it("Should burn patches when combining", async () => {
        await mintCount(256);
        const centerPatch = await makePatch({ x: 0, y: -1, width: 2, height: 2 });
        const abovePatch = await makePatch({ x: 0, y: 1, width: 2, height: 2 });
        await combinePatch(centerPatch, abovePatch);

        const centerOwner = await patch.getOwningAddress(centerPatch);
        const aboveOwner = await patch.getOwningAddress(abovePatch);
        expect(centerOwner).equal(BigNumber.from(0));
        expect(aboveOwner).equal(BigNumber.from(0));
    });

    it("Should re-award tiles when breaking a patch", async () => {
        await mintCount(256);
        const expectedIds = [
            15., 14., 13., 12.,
            4.0, 3.0, 2.0, 11.,
            5.0, 0.0, 1.0, 10.,
            6.0, 7.0, 8.0, 9.0,
        ];
        const centerPatch = await makePatch({ x: -1, y: -2, width: 4, height: 4 });
        const tx = await patch.breakPatchFrom(centerPatch, accounts[0].address);
        const res = await tx.wait();
        const event = res.events.find(event => event.event === 'TransferBatch');
        const stashedIds = event.args.ids.map((id) => parseInt(id));
        expect(stashedIds).to.deep.equal(expectedIds);
        expect(event.args.to).equal(accounts[0].address);

        const owningAddresses = await tile.getOwningAddressBatch(expectedIds);
        for (const address of owningAddresses) {
            expect(address).equal(accounts[0].address);
        }
    });
});