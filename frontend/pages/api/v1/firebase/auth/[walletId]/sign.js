require("../../../../../../util/adminFirestore");

import { ethers } from "ethers";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { authSignature, usersCollection } from "../../../../../../util/firestore";
import { recoverPersonalSignature } from '@metamask/eth-sig-util';

export default async function handler(req, res) {
    const walletId = req.query.walletId.toLowerCase();
    if (!ethers.utils.isAddress(walletId)) {
        return res.status(400).json({ "error": "invalid" });
    }

    if (req.method !== 'POST') {
        return res.status(403).json({ "error": "invalid" });
    }
    if (!req.body.signature) {
        return res.status(403).json({ "error": "invalid" });
    }
    const signature = req.body.signature;

    const db = getFirestore();
    const userDocRef = db.collection(usersCollection).doc(walletId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
        const existingNonce = userDoc.data()?.nonce;
        const recoveredAddress = recoverPersonalSignature({
            data: authSignature(walletId, existingNonce),
            signature: signature,
        });

        if (recoveredAddress === walletId) {
            await userDocRef.update({
                nonce: Math.floor(Math.random() * 1000000).toString(),
            });
            const firebaseToken = await getAuth().createCustomToken(walletId);
            return res.status(200).json({ token: firebaseToken });
        } else {
            return res.status(401).json({ "error": "invalid" });
        }
    } else {
        return res.status(403).json({ "error": "invalid" });
    }
}