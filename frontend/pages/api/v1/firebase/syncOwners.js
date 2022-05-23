require("../../../../util/adminFirestore");

import { getFirestore } from "firebase-admin/firestore";
import { ethers } from "ethers";
import { Tile, rpcUrl, Patch } from '../../../../util/network.config';
import { chunkSize, chunkDocId, tileProperty, ownersCollection, chunksCollection, usersCollection } from "../../../../util/firestore";
import { idFromXY, xyFromLocal } from "../../../../util/id";


async function checkSize(db, numChunks) {
    for (let chunkX = -numChunks / 2 + 1; chunkX <= numChunks / 2; chunkX++) {
        for (let chunkY = -numChunks / 2; chunkY < numChunks / 2; chunkY++) {
            const chunkKey = chunkDocId({ x: chunkX, y: chunkY });
            const docId = db.collection(chunksCollection).doc(chunkKey);
            const docSnapshot = await docId.get();
            if (!docSnapshot.exists) {
                const chunk = {};
                for (let i = 0; i < chunkSize; i++) {
                    for (let j = 0; j < chunkSize; j++) {
                        chunk[tileProperty({ x: j, y: i })] = Math.floor(Math.random() * (2 ** 24 - 1));
                    }
                }
                await docId.set(chunk, { merge: true });
                continue;
            }
        }
    }
}

async function mapOwners(db, tileIds, owners, users, ownerMap) {
    for (let i = 0; i < tileIds.length; i++) {
        const owner = owners[i].toLowerCase();
        if (users[owner] === undefined) {
            const userDocId = db.collection(usersCollection).doc(owner);
            const docSnapshot = await userDocId.get();
            if (docSnapshot.exists) {
                users[owner] = docSnapshot.data();
            } else {
                // Unlocked by default
                users[owner] = { locked: false };
            }
        }
        ownerMap[tileIds[i]] = [owner];
        if (!users[owner].locked) {
            ownerMap[tileIds[i]].push("anyone");
        }
    }
}

export default async function handler(req, res) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const tileContract = new ethers.Contract(Tile.address, Tile.abi, provider);
    const patchContract = new ethers.Contract(Patch.address, Patch.abi, provider);
    const maxTiles = await tileContract.maxTiles();
    const mintedTiles = await tileContract.mintedTiles();
    const canvasSize = parseInt(Math.sqrt(maxTiles));
    const numChunks = canvasSize / chunkSize;

    const db = getFirestore();
    await checkSize(db, numChunks);

    const users = {};

    for (let chunkX = -numChunks / 2 + 1; chunkX <= numChunks / 2; chunkX++) {
        for (let chunkY = -numChunks / 2; chunkY < numChunks / 2; chunkY++) {
            const ownersDocKey = chunkDocId({ x: chunkX, y: chunkY });
            const docId = db.collection(ownersCollection).doc(ownersDocKey);
            const tileIds = {};
            const tileIdsList = [];
            for (let i = 0; i < chunkSize; i++) {
                for (let j = 0; j < chunkSize; j++) {
                    const tileId = idFromXY(xyFromLocal({ chunkX: chunkX, chunkY: chunkY, x: j, y: i }));
                    if (tileId < mintedTiles) {
                        tileIds[i] = tileIds[i] || {};
                        tileIds[i][j] = tileId;
                        tileIdsList.push(tileId);
                    }
                }
            }
            const owners = await tileContract.getOwningAddressBatch(tileIdsList);

            const patchedIds = [];
            for (let i = 0; i < tileIdsList.length; i++) {
                if (owners[i] == ethers.constants.AddressZero) {
                    patchedIds.push(tileIdsList[i]);
                }
            }
            const patchedOwners = await patchContract.getTileOwnerBatch(patchedIds);

            const ownerMap = {};
            await mapOwners(db, tileIdsList, owners, users, ownerMap);
            await mapOwners(db, patchedIds, patchedOwners, users, ownerMap);


            const ownersData = {};
            for (let i = 0; i < chunkSize; i++) {
                for (let j = 0; j < chunkSize; j++) {
                    if (tileIds[i]?.[j] === undefined) {
                        continue;
                    }
                    const owners = ownerMap[tileIds[i][j]];
                    for (const owner of owners) {
                        ownersData[owner] = ownersData[owner] || [];
                        ownersData[owner].push(tileProperty({ x: j, y: i }));
                    }
                }
            }
            await docId.set(ownersData);
        }
    }

    return res.status(200).json({ status: "ok" });
}