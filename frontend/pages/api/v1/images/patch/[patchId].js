import { ethers } from "ethers";
import { Tile, Patch, rpcUrl } from '../../../../../util/network.config';
import { xyFromId, compareId } from "../../../../../util/id";
import { getColors } from "../../../../../util/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../../../../../util/network.config";
import ReactDOMServer from 'react-dom/server';

const targetSize = 1000;
const highlightOffset = 3;

function getRect(x, y, tileSize, offset, style) {
    return <rect x={x * tileSize + offset} y={y * tileSize - offset} width={tileSize} height={tileSize} style={style} />
}

export default async function handler(req, res) {
    const { patchId } = req.query;
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const tileContract = new ethers.Contract(Tile.address, Tile.abi, provider);
    const mintedTiles = await tileContract.mintedTiles();

    const patchContract = new ethers.Contract(Patch.address, Patch.abi, provider);
    const bounds = await patchContract.getBounds(patchId);
    const numBounds = {
        x: parseInt(bounds.x),
        y: parseInt(bounds.y),
        width: parseInt(bounds.width),
        height: parseInt(bounds.height),
    };
    const numSurroundingTiles = parseInt(Math.min(numBounds.width, numBounds.height) / 4);
    const tileSize = Math.round(targetSize / (numSurroundingTiles * 2 + Math.max(numBounds.width, numBounds.height)));
    const imageSize = {
        width: tileSize * (numSurroundingTiles * 2 + numBounds.width),
        height: tileSize * (numSurroundingTiles * 2 + numBounds.height),
    }

    const nextTile = xyFromId(mintedTiles);

    const xyData = [];
    const areaCoords = [];
    for (let i = numBounds.x - numSurroundingTiles; i <= numBounds.x + numBounds.width + numSurroundingTiles; i++) {
        for (let j = numBounds.y - numSurroundingTiles; j <= numBounds.y + numBounds.height + numSurroundingTiles; j++) {
            const coordXY = { x: i, y: j };
            if (compareId(coordXY, nextTile) < 0) {
                const x = i - numBounds.x + numSurroundingTiles;
                const y = j - numBounds.y + numSurroundingTiles;
                xyData.push(coordXY);
                areaCoords.push({ x, y });
            }
        }
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const colors = await getColors(db, xyData);
    const areaTiles = [];
    const patchTiles = [];
    for (let i = 0; i < colors.length; i++) {
        const { x, y } = areaCoords[i];
        const style = {
            fill: colors[i]
        };

        let offset = 0;
        let tiles = areaTiles;
        if (xyData[i].x < numBounds.x ||
            xyData[i].x >= numBounds.x + numBounds.width ||
            xyData[i].y < numBounds.y ||
            xyData[i].y >= numBounds.y + numBounds.height) {
            style.fill += "33";
        } else {
            offset = highlightOffset;
            style.outline = "1.5px solid #000000";
            tiles = patchTiles;
        }

        tiles.push(getRect(x, y, tileSize, offset, style));
    }

    const svg = <svg xmlns='http://www.w3.org/2000/svg' width={imageSize.width} height={imageSize.height}>
        <rect
            x={numSurroundingTiles * tileSize}
            y={numSurroundingTiles * tileSize}
            width={numBounds.width * tileSize}
            height={numBounds.height * tileSize}
            style={{ fill: "#000000" }}
        />
        {areaTiles}
        {patchTiles}
    </svg>
    res.status(200);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(ReactDOMServer.renderToStaticMarkup(svg));
}