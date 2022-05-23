const {
    networkConfig,
} = require("./network.config");

module.exports = [
    /* limits */{
        size: 64,
        batchSize: 1024,
        deployerDiscountedTiles: 1024,
    },
    /* fees in gwei */ {
        mintFee: 999999,
        mintFeeMin: 9999,
        bulkDiscount: 999,
        colorFee: 999,
    },
    /* api url */ "https://pixels.watch/api/v1/tiles/",
    /* proxyRegistry */ networkConfig["rinkeby"].proxyRegistry,
];;