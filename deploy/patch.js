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

    const tileContract = await ethers.getContract("Tile");
    const args = [
        /* tile contract */ tileContract.address,
        /* api url */ "https://pixels.watch/api/v1/",
        /* proxyRegistry */ proxyRegistryAddress,
    ];
    const patch = await deploy('Patch', {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: blockConfirmations,
    });

    await tileContract.setStasher(patch.address);
};
module.exports = deployTestContracts;
module.exports.tags = ['all', 'patch'];
module.exports.dependencies = ['tile'];