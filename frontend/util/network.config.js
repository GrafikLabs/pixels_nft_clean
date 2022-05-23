import HardhatTile from '../../deployments/localhost/Tile.json';
import HardhatPatch from '../../deployments/localhost/Patch.json';
import RinkebyTile from '../../deployments/rinkeby/Tile.json';
import RinkebyPatch from '../../deployments/rinkeby/Patch.json';

let Tile;
let Patch;
let openseaConfig;
const rpcUrl = process.env.RPC_URL;
const openSeaUrl = process.env.NEXT_PUBLIC_OPENSEA_URL;
const openSeaProfileLink = `${process.env.NEXT_PUBLIC_OPENSEA_URL}account?search[collections][0]=${process.env.NEXT_PUBLIC_OPENSEA_TILES_SLUG}&search[collections][1]=${process.env.NEXT_PUBLIC_OPENSEA_PATCHES_SLUG}`;
const wethAddress = process.env.WETH_ADDRESS;
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};
const firebaseSuffix = `_${process.env.NEXT_PUBLIC_ENVIRONMENT}`;

const env = process.env.NEXT_PUBLIC_ENVIRONMENT;
if (env == "local") {
    Tile = HardhatTile;
    Patch = HardhatPatch;
} else if (env == "dev") {
    Tile = RinkebyTile;
    Patch = RinkebyPatch;

    openseaConfig = {
        networkName: "rinkeby"
    };
} else if (env == "prod") {
    openseaConfig = {
        networkName: "mainnet",
        apiKey: process.env.OPENSEA_API_KEY
    };
}

export { Tile, Patch, openseaConfig, rpcUrl, openSeaUrl, openSeaProfileLink, wethAddress, firebaseConfig, firebaseSuffix };