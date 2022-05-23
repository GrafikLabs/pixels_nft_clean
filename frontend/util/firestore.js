import { getDoc, setDoc, doc } from "firebase/firestore";
import { localFromXY } from "./id";
import { firebaseSuffix } from "./network.config";

const chunkSize = 32;
const padSize = Math.ceil(Math.log(chunkSize) / Math.log(10));
const chunksCollection = `chunks${firebaseSuffix}`;
const ownersCollection = `owners${firebaseSuffix}`;
const usersCollection = `users${firebaseSuffix}`;

const authSignature = (address, nonce) => `Welcome to The Wall!

In order to modify the canvas, you need to sign a quick message proving you own this wallet. Click below to sign it.

This request will not trigger a blockchain transaction or cost any gas fees.
Your authentication status will reset 1 hour after leaving this page.

Wallet address:
${address}

Nonce:
${nonce}`

function chunkDocId({ x, y }) {
    return `chunk_${y}_${x}`;
}

function tileProperty({ x, y }) {
    return `color_${y.toString().padStart(padSize, '0')}_${x.toString().padStart(padSize, '0')}`;
}

function xyFromTileProperty(tileProp) {
    const match = tileProp.match(/color_(\d+)_(\d+)/);
    return { x: parseInt(match[2]), y: parseInt(match[1]) };
}

async function checkSize(db, canvasSize) {
    const numChunks = canvasSize / chunkSize;
    for (let chunkX = -numChunks / 2 + 1; chunkX <= numChunks / 2; chunkX++) {
        for (let chunkY = -numChunks / 2; chunkY < numChunks / 2; chunkY++) {
            const chunkKey = chunkDocId({ x: chunkX, y: chunkY });
            const docId = doc(db, chunksCollection, chunkKey);
            const docSnapshot = await getDoc(docId);
            if (!docSnapshot.exists()) {
                const chunk = {};
                for (let i = 0; i < chunkSize; i++) {
                    for (let j = 0; j < chunkSize; j++) {
                        chunk[tileProperty({ x: j, y: i })] = Math.floor(Math.random() * (2 ** 24 - 1));
                    }
                }
                await setDoc(docId, chunk, { merge: true });
                continue;
            }
        }
    }
}

async function getChunks(db, canvasSize) {
    const numChunks = canvasSize / chunkSize;
    const chunks = new Array(numChunks).fill(undefined).map(() => new Array(numChunks));
    const owners = new Array(numChunks).fill(undefined).map(() => new Array(numChunks));
    for (let i = 0; i < numChunks; i++) {
        for (let j = 0; j < numChunks; j++) {
            const chunkY = numChunks / 2 - 1 - i;
            const chunkX = j + 1 - numChunks / 2;
            const chunkKey = chunkDocId({ x: chunkX, y: chunkY });

            const docId = doc(db, chunksCollection, chunkKey);
            const docSnapshot = await getDoc(docId);
            const chunkData = docSnapshot.data();
            chunks[i][j] = formatChunkData(chunkData);

            const ownersDocId = doc(db, ownersCollection, chunkKey);
            const ownersDocSnapshot = await getDoc(ownersDocId);
            const ownersData = ownersDocSnapshot.data();
            owners[i][j] = formatOwnershipData(ownersData);
        }
    }
    return { chunks, owners };
}

function formatColor(intColor) {
    return "#" + intColor.toString(16).padStart(6, '0');
}

function formatChunkData(chunkData) {
    const colors = Object.keys(chunkData).sort().map((index) => formatColor(chunkData[index]));
    const tiles = new Array(chunkSize).fill(undefined).map(() => new Array(chunkSize));
    for (let i = 0; i < chunkSize; i++) {
        for (let j = 0; j < chunkSize; j++) {
            tiles[i][j] = colors[i * chunkSize + j];
        }
    }
    return tiles;
}

function formatOwnershipData(ownershipData) {
    const ownership = {};
    for (const owner of Object.keys(ownershipData)) {
        ownership[owner] = [];
        for (const tileProp of ownershipData[owner]) {
            const { x, y } = xyFromTileProperty(tileProp);
            ownership[owner].push(y * chunkSize + x);
        }
    }
    return ownership;
}

async function getColor(db, { x, y }) {
    const local = localFromXY({ x, y });
    const chunkKey = chunkDocId({ x: local.chunkX, y: local.chunkY });
    const docId = doc(db, chunksCollection, chunkKey);
    const docSnapshot = await getDoc(docId);
    const docData = docSnapshot.data();
    return formatColor(docData[tileProperty({ x: local.x, y: local.y })]);
}

async function getColors(db, list) {
    const colors = [];
    const chunkKeys = new Set();
    for (const { x, y } of list) {
        const local = localFromXY({ x, y });
        chunkKeys.add(chunkDocId({ x: local.chunkX, y: local.chunkY }));
    }

    const chunkData = {};
    for (const chunkKey of chunkKeys) {
        const docId = doc(db, chunksCollection, chunkKey);
        const docSnapshot = await getDoc(docId);
        chunkData[chunkKey] = docSnapshot.data();
    }
    for (const { x, y } of list) {
        const local = localFromXY({ x, y });
        const chunkKey = chunkDocId({ x: local.chunkX, y: local.chunkY });
        const docData = chunkData[chunkKey];
        colors.push(formatColor(docData[tileProperty({ x: local.x, y: local.y })]));
    }
    return colors;
}

export {
    chunkSize,
    chunksCollection,
    ownersCollection,
    usersCollection,
    authSignature,
    chunkDocId,
    tileProperty,
    checkSize,
    getChunks,
    formatChunkData,
    formatOwnershipData,
    getColor,
    getColors,
}