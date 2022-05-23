const { network } = require("hardhat");
const { developmentChains } = require("../network.config.js");

async function deployMocks({ getNamedAccounts, deployments }) {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        await deploy('ProxyRegistryMock', {
            from: deployer,
            log: true,
        });
        await deploy('IERC1155ReceiverMock', {
            from: deployer,
            log: true,
        });
    }
};
module.exports = deployMocks;
module.exports.tags = ['all', 'mocks'];