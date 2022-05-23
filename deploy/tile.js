const { network, run } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../network.config");

async function deployTestContracts({ getNamedAccounts, deployments }) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    let blockConfirmations;
    let proxyRegistryAddress;

    if (developmentChains.includes(network.name)) {
        blockConfirmations = 1;
        const proxyRegistryMock = await ethers.getContract("ProxyRegistryMock");
        proxyRegistryAddress = proxyRegistryMock.address;
    } else {
        blockConfirmations = VERIFICATION_BLOCK_CONFIRMATIONS;
        proxyRegistryAddress = networkConfig[network.name].proxyRegistry;
    }
    const args = [
        /* limits */{
            size: 128,
            batchSize: 1024,
            deployerDiscountedTiles: 1024,
        },
        /* fees in gwei */ {
            mintFee: 999999,
            mintFeeMin: 9999,
            bulkDiscount: 999,
            colorFee: 999,
        },
        /* api url */ "https://pixels.watch/api/v1/",
        /* proxyRegistry */ proxyRegistryAddress,
    ];
    const tile = await deploy('Tile', {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: blockConfirmations,
    });
};
module.exports = deployTestContracts;
module.exports.tags = ['all', 'tile'];
module.exports.dependencies = ['mocks'];