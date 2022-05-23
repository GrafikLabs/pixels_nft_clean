import React from 'react';
import { Tile, openseaConfig, Patch } from '../util/network.config';
import { toast } from 'react-toastify';
import Web3Context from '../context/Web3Context';
import { BigNumber, ethers } from 'ethers';
import EventfulProvider from './EventfulProvider';
import { authSignature } from '../util/firestore';
import { OpenSeaPort } from 'opensea-js';
import { OrderSide } from 'opensea-js/lib/types';
import detectEthereumProvider from '@metamask/detect-provider';

export default class Web3Provider extends EventfulProvider {
    constructor(props) {
        super(props);

        this.state = Object.assign(this.state, {
            isReady: false,
            metamaskAccount: undefined,
            web3Provider: undefined,
            tileContract: undefined,
            patchContract: undefined,
            ethPrice: undefined,
            requestLink: this.requestLink.bind(this),
            requestSign: this.requestSign.bind(this),
            fetchTileAsset: this.fetchTileAsset.bind(this),
            fetchPatchAsset: this.fetchPatchAsset.bind(this),
            formatEth: this.formatEth.bind(this),
            calculateUSD: this.calculateUSD.bind(this)
        });

        this.isAttemptingMetamaskConnect = false;
        this.isAttemptingSign = false;
        this.handleAccountsChanged = this.onAccountsChanged.bind(this);
        this.handleNetworkChanged = this.onNetworkChanged.bind(this);
        this.networkToast = undefined;

        this.weisInEther = BigNumber.from(10).pow(18);
        this.usdPrecision = BigNumber.from(10).pow(4);
        this.weisInSzabo = BigNumber.from(10).pow(12);
        this.szabosInEth = this.weisInEther.div(this.weisInSzabo);
        this.totalAccuracy = this.szabosInEth.mul(this.usdPrecision);
    }

    async onAccountsChanged(accounts) {
        if (accounts.length == 0) {
            const tileContract = new ethers.Contract(Tile.address, Tile.abi, this.state.web3Provider);
            const patchContract = new ethers.Contract(Patch.address, Patch.abi, this.state.web3Provider);
            this.setState(async (state) => {
                state.metamaskAccount = undefined;
                state.tileContract = tileContract;
                state.patchContract = patchContract;
                return state;
            });
            return;
        }
        await this.connectMetamaskAccount(accounts[0]);
    }

    async connectMetamaskAccount(metamaskAccount, callback) {
        this.signer = this.state.web3Provider.getSigner();
        const tileContract = new ethers.Contract(Tile.address, Tile.abi, this.signer);
        const patchContract = new ethers.Contract(Patch.address, Patch.abi, this.signer);
        const triggerEvent = this.triggerEvent.bind(this);
        this.setState(async (state) => {
            state.metamaskAccount = metamaskAccount.toLowerCase();
            state.tileContract = tileContract;
            state.patchContract = patchContract;
            return state;
        }, async () => {
            if (callback) {
                await callback();
            }
            await triggerEvent("accountsChanged", metamaskAccount);
        });
    }

    async onNetworkChanged(chainId) {
        if (parseInt(chainId) == parseInt(process.env.NEXT_PUBLIC_CHAIN_ID)) {
            toast.dismiss(this.networkToast);
            await this.bootstrap();
            return;
        }

        this.networkToast = toast.warn(
            <div onClick={() => this.switchToNetwork()}>
                <div>This Dapp is on {process.env.NEXT_PUBLIC_CHAIN_NAME}.</div>
                <div>Click this toast to switch.</div>
            </div>,
            {
                autoClose: false,
                toastId: "network_switch",
                closeOnClick: false,
                closeButton: true,
            }
        );
        await this.teardown();
    }

    async bootstrap() {
        this.ethUpdate = setInterval(this.updateEthPrice.bind(this), 10 * 60 * 1000);

        this.isAttemptingMetamaskConnect = true;
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        let seaport;
        if (openseaConfig) {
            seaport = new OpenSeaPort(web3Provider.provider, openseaConfig);
        }
        const metamaskAccounts = await web3Provider.listAccounts();
        const triggerEvent = this.triggerEvent.bind(this);
        if (metamaskAccounts.length > 0) {
            this.setState((state) => {
                state.web3Provider = web3Provider;
                state.seaport = seaport;
                state.ready = true;
                return state;
            }, () => {
                this.connectMetamaskAccount(metamaskAccounts[0], async () => {
                    this.isAttemptingMetamaskConnect = false;
                    window.ethereum.on("accountsChanged", this.handleAccountsChanged);
                    await this.updateEthPrice();
                    await triggerEvent("ready");
                });
            });
        } else {
            const tileContract = new ethers.Contract(Tile.address, Tile.abi, web3Provider);
            const patchContract = new ethers.Contract(Patch.address, Patch.abi, web3Provider);
            this.setState((state) => {
                state.web3Provider = web3Provider;
                state.seaport = seaport;
                state.ready = true;
                state.tileContract = tileContract;
                state.patchContract = patchContract;
                this.isAttemptingMetamaskConnect = false;
                return state;
            }, async () => {
                await this.updateEthPrice();
                await triggerEvent("ready");
            });
        }
    }

    teardown() {
        clearInterval(this.ethUpdate);

        window.ethereum?.removeListener('accountsChanged', this.handleAccountsChanged);

        this.setState((state) => {
            state.metamaskAccount = undefined;
            state.web3Provider = undefined;
            state.ready = false;
            state.tileContract = undefined;
            state.patchContract = undefined;
            state.seaport = undefined;
            this.isAttemptingMetamaskConnect = false;
            return state;
        });
    }

    async switchToNetwork() {
        const chainId = "0x" + parseInt(process.env.NEXT_PUBLIC_CHAIN_ID).toString(16);
        try {
            const switchNetworkPromise = ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainId }],
            });
            await toast.promise(
                switchNetworkPromise,
                {
                    pending: "Accept the network switch in Metamask...",
                    success: "OK!"
                }
            );
        } catch (switchError) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: chainId,
                            chainName: process.env.NEXT_PUBLIC_CHAIN_NAME,
                            rpcUrls: [process.env.NEXT_PUBLIC_CHAIN_URL],
                        },
                    ],
                });
                await toast.promise(
                    switchNetworkPromise,
                    {
                        pending: `You don't have ${process.env.NEXT_PUBLIC_CHAIN_NAME} in Metamask. Accept the prompt to add it...`,
                        error: "You rejected the request!",
                        success: "OK!"
                    }
                );
            }
        }
    }

    async requestLink(callback) {
        if (this.isAttemptingMetamaskConnect) {
            return;
        }

        if (this.state.metamaskAccount) {
            toast("Already connected!");
            return;
        }

        try {
            this.isAttemptingMetamaskConnect = true;
            const [metamaskAccount] = await toast.promise(
                this.state.web3Provider.send("eth_requestAccounts", []),
                {
                    pending: "Approve the metamask request to continue...",
                    error: "Request rejected!",
                    success: "Success!"
                }
            );
            this.connectMetamaskAccount(metamaskAccount, async () => {
                this.isAttemptingMetamaskConnect = false;
                if (callback) {
                    await callback();
                }
            });
        } catch {
            this.isAttemptingMetamaskConnect = false;
        }
    }

    async requestSign(callback) {
        if (this.isAttemptingSign) {
            return;
        }
        this.isAttemptingSign = true;
        let { metamaskAccount } = this.state;
        if (!metamaskAccount) {
            await this.requestLink(() => {
                metamaskAccount = this.state.metamaskAccount;
                if (metamaskAccount) {
                    this.requestSign(callback);
                }
                this.isAttemptingSign = false;
            });
            return;
        }

        const getNonce = new Promise(async (resolve) => {
            const nonceEndpoint = await fetch(`api/v1/firebase/auth/${metamaskAccount}/nonce`);
            const nonceResponse = await nonceEndpoint.json();
            resolve(nonceResponse.nonce);
        });
        const nonce = await toast.promise(
            getNonce,
            {
                pending: "Please wait...",
                error: "Something went wrong!",
            }
        );

        try {
            const signature = await toast.promise(
                this.state.web3Provider.send("personal_sign", [authSignature(metamaskAccount, nonce), metamaskAccount]),
                {
                    pending: "Approve the metamask request to continue...",
                    error: "Request rejected!",
                }
            );
            const getToken = new Promise(async (resolve) => {
                const signEndpoint = await fetch(
                    `api/v1/firebase/auth/${metamaskAccount}/sign`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ signature }),
                    }
                );
                const signResponse = await signEndpoint.json();
                resolve(signResponse.token);
            });
            const token = await toast.promise(
                getToken,
                {
                    pending: "Please wait...",
                    error: "Something went wrong!",
                    success: "Authenticated successfully!"
                }
            );
            this.isAttemptingSign = false;
            callback(token);
        } catch {
            toast("You rejected the sign request!");
            this.isAttemptingSign = false;
        }
    }

    #fetchAsset(contractAddress, tokenId) {
        return new Promise((resolve) => {
            this.setState((state) => {
                state.waitingForAsset = true;
                return state;
            }, async () => {
                const asset = await this.state.seaport.api.getAsset({
                    tokenAddress: contractAddress,
                    tokenId: tokenId,
                });
                await new Promise(r => setTimeout(r, 1200));

                asset.sellOrders = await this.state.seaport.api.getOrders({
                    asset_contract_address: contractAddress,
                    token_ids: [tokenId],
                    side: OrderSide.Sell
                });
                this.setState((state) => {
                    state.waitingForAsset = false;
                    return state;
                }, async () => {
                    resolve(asset);
                });
            });
        })
    }

    fetchTileAsset(tileId) {
        return this.#fetchAsset(Tile.address, tileId);
    }

    fetchPatchAsset(patchId) {
        return this.#fetchAsset(Patch.address, patchId);
    }

    async updateEthPrice() {
        const priceEndpoint = await fetch('api/v1/eth/price');
        const ethPriceResponse = await priceEndpoint.json();

        this.setState((state) => {
            state.ethPrice = BigNumber.from(Math.floor(ethPriceResponse.ethPrice * parseInt(this.usdPrecision)));
            return state;
        })
    }

    formatEth(ethCost) {
        const Eth = parseInt(ethCost.div(this.weisInEther));
        const fract = parseInt(ethCost.mod(this.weisInEther).div(this.weisInSzabo)).toString().padStart(6, '0');
        return `${Eth}.${fract.replace(/0+$/, '')}`;
    }

    calculateUSD(ethCost) {
        const szabos = ethCost.div(this.weisInSzabo);
        const picoUSD = szabos.mul(this.state.ethPrice);
        const USD = parseInt(picoUSD.div(this.totalAccuracy));
        const fract = parseInt(picoUSD.mod(this.totalAccuracy).div(this.totalAccuracy.div(100))).toString().padStart(2, '0');
        return `${USD}.${fract}`;
    }

    async componentDidMount() {
        if (!window.ethereum) {
            if (window) {
                this.networkToast = toast.warn(
                    <span>This app works better with <a href="https://metamask.io/" target="_blank" rel="noreferrer noopener" style={{ textDecoration: "underline" }}>Metamask</a> installed</span>,
                    {
                        autoClose: false,
                        toastId: "metamask_prompt",
                        closeOnClick: false,
                        closeButton: true,
                    }
                );
            }
            return;
        }

        const provider = await detectEthereumProvider();
        if (provider) {
            const chainId = await ethereum.request({ method: 'eth_chainId' });
            this.onNetworkChanged(chainId);

            window.ethereum.on("chainChanged", this.handleNetworkChanged);
        }
    }

    async componentWillUnmount() {
        this.teardown();
        window.ethereum?.on("chainChanged", this.handleNetworkChanged);
    }

    render() {
        const { children } = this.props;
        return <Web3Context.Provider value={this.state}>
            {children}
        </Web3Context.Provider>;
    }
}