import { ethers } from "ethers";
import { getPatchLayers } from "../../../../../util/id";
import { Patch, rpcUrl } from "../../../../../util/network.config";

export default async function handler(req, res) {
    const { patchId } = req.query;

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const patchContract = new ethers.Contract(Patch.address, Patch.abi, provider);
    const bounds = await patchContract.getBounds(patchId);

    const protocol = req.headers["x-forwarded-proto"] || req.connection.encrypted
        ? "https"
        : "http";

    const numBounds = {
        x: parseInt(bounds.x),
        y: parseInt(bounds.y),
        width: parseInt(bounds.width),
        height: parseInt(bounds.height),
    };

    numBounds.maxX = numBounds.x + numBounds.width - 1;
    numBounds.maxY = numBounds.y + numBounds.height - 1;

    res.status(200).json({
        name: `Patch`,
        description: "It's a patch of tiles.",
        external_url: `${protocol}://${req.headers.host}/?patchId=${patchId}`,
        image: `${protocol}://${req.headers.host}/api/v1/images/patch/${patchId}`,
        attributes: [
            {
                display_type: "number",
                trait_type: "Width",
                value: numBounds.width
            },
            {
                display_type: "number",
                trait_type: "Height",
                value: numBounds.height
            },
            {
                display_type: "number",
                trait_type: "Size",
                value: numBounds.width * numBounds.height
            },
            {
                display_type: "number",
                trait_type: "Distance from Center",
                value: getPatchLayers(numBounds).minLayer
            }
        ]
    });
}