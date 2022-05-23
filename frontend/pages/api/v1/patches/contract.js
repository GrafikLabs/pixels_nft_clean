import { Patch, rpcUrl } from '../../../../util/network.config';
import { ethers } from 'ethers';

export default async function handler(req, res) {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const patchContract = new ethers.Contract(Patch.address, Patch.abi, provider);

    const protocol = req.headers["x-forwarded-proto"] || req.connection.encrypted
        ? "https"
        : "http";

    res.status(200).json({
        name: "The Wall - Patches",
        description: "Discover the next big thing in crowdsourced art. Or just go draw some immature stuff.",
        image: `${protocol}://${req.headers.host}/images/logo.gif`,
        external_link: `${protocol}://${req.headers.host}/`,
        seller_fee_basis_points: 700,
        fee_recipient: await patchContract.owner()
    });
}