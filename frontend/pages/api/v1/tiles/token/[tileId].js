import { xyFromId, zeroPad } from "../../../../../util/id";
import Color from "color";
import { getColor } from "../../../../../util/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "../../../../../util/network.config";

export default async function handler(req, res) {
    const { tileId } = req.query;
    const coords = xyFromId(parseInt(tileId));

    const protocol = req.headers["x-forwarded-proto"] || req.connection.encrypted
        ? "https"
        : "http";

    const ringId = zeroPad(coords.layer + 1, 2);
    const localTileId = zeroPad(coords.layerId + 1, 2);
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const color = Color(await getColor(db, coords));

    res.status(200).json({
        name: `Ring ${ringId}, Tile ${localTileId}`,
        description: "It's a tile.",
        external_url: `${protocol}://${req.headers.host}/?tileId=${tileId}`,
        image: `${protocol}://${req.headers.host}/api/v1/images/tile/${tileId}`,
        attributes: [
            {
                display_type: "number",
                trait_type: "Ring",
                value: coords.layer + 1
            },
            {
                display_type: "boost_percentage",
                trait_type: "Red",
                value: Math.round(color.red() / 255 * 250) / 2.5
            },
            {
                display_type: "boost_percentage",
                trait_type: "Green",
                value: Math.round(color.green() / 255 * 250) / 2.5
            },
            {
                display_type: "boost_percentage",
                trait_type: "Blue",
                value: Math.round(color.blue() / 255 * 250) / 2.5
            }
        ]
    });
}