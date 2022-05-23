import React from 'react';

const Web3Context = React.createContext({
    isReady: undefined,
    metamaskAccount: undefined,
    web3Provider: undefined,
    tileContract: undefined,
    requestLink: undefined,
    addEventListener: undefined,
    removeEventListener: undefined,
});
export default Web3Context;