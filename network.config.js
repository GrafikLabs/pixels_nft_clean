const networkConfig = {
    rinkeby: {
        // https://github.com/ProjectOpenSea/opensea-creatures/blob/f7257a043e82fae8251eec2bdde37a44fee474c4/migrations/2_deploy_contracts.js#L28
        proxyRegistry: "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A",
    },
    mainnet: {
        // https://github.com/ProjectOpenSea/opensea-creatures/blob/f7257a043e82fae8251eec2bdde37a44fee474c4/migrations/2_deploy_contracts.js#L28
        proxyRegistry: "0xa5409ec958c83c3f309868babaca7c86dcb077c1",
    },
}

const developmentChains = ["hardhat"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
}