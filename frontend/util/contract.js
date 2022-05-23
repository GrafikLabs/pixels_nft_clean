import { xyFromId } from "./id";

async function getCanvasProps(tileContract) {
    const maxTiles = await tileContract.maxTiles();
    const maxMintSize = await tileContract.maxMintSize();
    const canvasSize = parseInt(Math.sqrt(maxTiles));

    const mintedTiles = parseInt(await tileContract.mintedTiles());

    const tilesLeft = maxTiles - mintedTiles;
    const nextTile = xyFromId(mintedTiles);

    return { canvasSize, tilesLeft, mintedTiles, nextTile, maxMintSize };
}

async function getTilesByOwner(tileContract, owner) {
    const mintedTiles = parseInt(await tileContract.mintedTiles());
    const ownedTiles = [];
    const batchSize = 4096;
    for (let i = 0; i < mintedTiles / batchSize; i++) {
        const requestOwners = Array(Math.min(batchSize, mintedTiles - i * batchSize)).fill(owner);
        const requestTiles = Array.from(requestOwners.keys()).map((tokenId) => tokenId + i * batchSize);
        const ownership = await tileContract.balanceOfBatch(requestOwners, requestTiles);
        ownedTiles.push(...requestTiles.filter((_, index) => ownership[index] == 1));
    }
    return ownedTiles;
}

export { getCanvasProps, getTilesByOwner };