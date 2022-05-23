require("../../../../../../util/adminFirestore");

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { usersCollection } from "../../../../../../util/firestore";
import { ethers } from "ethers";

export default async function handler(req, res) {
    const walletId = req.query.walletId.toLowerCase();
    if (!ethers.utils.isAddress(walletId)) {
        return res.status(400).json({ "error": "invalid" });
    }

    const db = getFirestore();
    const userDoc = await db
        .collection(usersCollection)
        .doc(walletId)
        .get();

    if (userDoc.exists) {
        const existingNonce = userDoc.data()?.nonce;
        return res.status(200).json({ nonce: existingNonce });
    } else {
        // The user document does not exist, create it first
        const generatedNonce = Math.floor(Math.random() * 1000000).toString();

        // Create an Auth user
        const createdUser = await getAuth().createUser({
            uid: walletId,
        });

        // Associate the nonce with that user
        await db.collection(usersCollection).doc(createdUser.uid).set({
            nonce: generatedNonce,
        });
        return res.status(200).json({ nonce: generatedNonce });
    }
}