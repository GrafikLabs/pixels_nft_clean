require("@nomiclabs/hardhat-waffle");
require("dotenv").config();
require("hardhat-gas-reporter");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require('solidity-coverage');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            forking: {
                url: process.env.MAINNET_RPC_URL,
                blockNumber: parseInt(process.env.FORKING_BLOCK_NUMBER),
            },
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        rinkeby: {
            url: process.env.RINKEBY_RPC_URL,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 4,
            verify: {
                etherscan: {
                    apiKey: process.env.ETHERSCAN_API_KEY
                }
            },
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            saveDeployments: true,
            chainId: 1,
            verify: {
                etherscan: {
                    apiKey: process.env.ETHERSCAN_API_KEY
                }
            },
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS || false,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    namedAccounts: {
        deployer: 0,
    },
    solidity: {
        compilers: [
            {
                version: "0.8.13",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 99999999, // Etherscan runs does not allow 2 ** 32 - 1
                    },
                },
            },
        ],
    },
};
