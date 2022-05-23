import { ethers } from "ethers";
import Color from "color";
import { Tile, rpcUrl } from '../../../../../util/network.config';
import { xyFromId, zeroPad, compareId, layerDataFromXY } from "../../../../../util/id";
import { getColors } from "../../../../../util/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../../../../../util/network.config";
import ReactDOMServer from 'react-dom/server';

const targetSize = 1000;
const numSurroundingTiles = 4;
const highlightOffset = 3;

const tileSize = Math.round(targetSize / (numSurroundingTiles * 2 + 1));
const imageSize = tileSize * (numSurroundingTiles * 2 + 1);

function getRect(x, y, style) {
    return <rect x={x} y={y} width={tileSize} height={tileSize} style={style} />
}

export default async function handler(req, res) {
    const tileId = parseInt(req.query.tileId);
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const tileContract = new ethers.Contract(Tile.address, Tile.abi, provider);
    const mintedTiles = await tileContract.mintedTiles();
    const nextTile = xyFromId(mintedTiles);
    const coords = xyFromId(tileId);
    const ringId = zeroPad(coords.layer + 1, 2);
    const localTileId = zeroPad(coords.layerId + 1, 2);

    const xyData = [];
    const areaCoords = [];
    for (let i = coords.x - numSurroundingTiles; i <= coords.x + numSurroundingTiles; i++) {
        for (let j = coords.y - numSurroundingTiles; j <= coords.y + numSurroundingTiles; j++) {
            const coordXY = { x: i, y: j };
            if (compareId(coordXY, nextTile) < 0) {
                const x = i - coords.x + numSurroundingTiles;
                const y = -(j - coords.y) + numSurroundingTiles;
                xyData.push(coordXY);
                areaCoords.push(Object.assign({ x, y }, layerDataFromXY({ x: i, y: j })));
            }
        }
    }

    const middleI = Math.floor((numSurroundingTiles * 2 + 1) ** 2 / 2);

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const colors = await getColors(db, xyData);
    const tiles = [];
    for (let i = 0; i < colors.length; i++) {
        const { x, y, layer } = areaCoords[i];
        const style = {
            fill: colors[i]
        };

        if (i == middleI) {
            style.fill = "#000000";
        } else if (layer != coords.layer) {
            style.fill += "33";
        } else {
            style.outline = "1.5px solid #000000";
        }

        tiles.push(getRect(x * tileSize, y * tileSize, style));
    }
    const fontSize = Math.round((50 / 200) * tileSize);

    const middleTile = getRect(
        areaCoords[middleI].x * tileSize + highlightOffset,
        areaCoords[middleI].y * tileSize - highlightOffset,
        {
            fill: colors[middleI],
            outline: "1.5px solid #000000"
        }
    );
    const middleColor = Color(colors[middleI]);
    const textColor = middleColor.isLight() ? "#000000" : "#ffffff"

    const svg = <svg xmlns='http://www.w3.org/2000/svg' width={imageSize} height={imageSize}>
        {tiles}
        {middleTile}
        <text xmlns="http://www.w3.org/2000/svg" fill={textColor} dominantBaseline="central" textAnchor="middle" x={imageSize / 2 + highlightOffset} y={imageSize / 2 - highlightOffset} style={{ font: `bold ${fontSize}px sans-serif` }}>
            <tspan x={imageSize / 2 + highlightOffset} dy="-0.6em">Ring {ringId}</tspan>
            <tspan x={imageSize / 2 + highlightOffset} dy="1.2em">Tile {localTileId}</tspan>
        </text>
    </svg>
    res.status(200);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(ReactDOMServer.renderToStaticMarkup(svg));
}