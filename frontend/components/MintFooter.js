import styles from '../styles/Footer.module.css'
import React from 'react';
import Web3Context from "../context/Web3Context";
import { toast } from 'react-toastify';
import { BigNumber, ethers } from 'ethers';
import AppContext from '../context/AppContext';

export default class MintFooter extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mintSize: props.mintSize,
            mintFullCost: BigNumber.from(2640000000000000),
            mintDiscountedCost: BigNumber.from(2000000000000000),
            usdCost: 7.22,
            maxMintSize: 1024,
        };

        this.handleMintSizeChange = this.updateMintingCosts.bind(this);
    }

    async onMintClick(setIsMinting) {
        if (this.props.isMinting) {
            toast("Wait for the current mint to complete!");
            return;
        }
        const { metamaskAccount } = this.context;
        const { mintSize } = this.props;
        const isConnected = metamaskAccount !== undefined;

        if (!isConnected) {
            toast("You must link your account to mint!");
            return;
        }

        if (this.state.maxMintSize == 0) {
            toast("All available tiles have been minted!");
            return;
        }

        const mintPrice = await this.context.tileContract.getMintCost(mintSize);
        try {
            await this.context.tileContract.mintTo(mintSize, this.context.metamaskAccount, { value: mintPrice });
            setIsMinting(true);
        }
        catch {
            toast("You rejected the transaction!");
        }
    }

    async updateMintingCosts() {
        const { mintSize } = this.props;
        const tileContract = this.context.tileContract;
        if (!tileContract) {
            return;
        }

        const maxTiles = await tileContract.maxTiles();
        const mintedTiles = await tileContract.mintedTiles();
        if (mintedTiles.gte(maxTiles)) {
            this.setState((state) => {
                state.mintSize = 0;
                state.mintFullCost = 0;
                state.mintDiscountedCost = 0;
                state.usdCost = 0;
                state.maxMintSize = 0;
                return state;
            });
            return;
        }

        const fullCost = (await tileContract.getMintCost(1)).mul(mintSize);
        const discountedCost = await tileContract.getMintCost(mintSize);
        const fiatCost = this.context.calculateUSD(discountedCost);
        const maxMintSize = await tileContract.maxMintSize();
        this.setState((state) => {
            state.mintSize = mintSize;
            state.mintFullCost = fullCost;
            state.mintDiscountedCost = discountedCost;
            state.usdCost = fiatCost;
            state.maxMintSize = parseInt(maxMintSize);
            return state;
        });
    }

    async componentDidUpdate() {
        const { mintSize } = this.props;
        const { mintSize: currentSize } = this.state;
        if (mintSize != currentSize) {
            await this.updateMintingCosts();
        }
    }

    componentDidMount() {
        this.context.addEventListener("ready", this.handleMintSizeChange);
        this.context.addEventListener("accountsChanged", this.handleMintSizeChange);
    }

    componentWillUnmount() {
        this.context.removeEventListener("ready", this.handleMintSizeChange);
        this.context.removeEventListener("accountsChanged", this.handleMintSizeChange);
    }

    render() {
        const { mintFullCost, mintDiscountedCost, maxMintSize, usdCost } = this.state;
        const { mintSize, isMinting, setMintSize, setIsMinting } = this.props;
        const { metamaskAccount } = this.context;
        const isConnected = metamaskAccount !== undefined;

        const mintButtonClasses = [styles.actionButton];
        if (!isConnected || maxMintSize == 0) {
            mintButtonClasses.push(styles.disabled);
        }

        const options = [];
        for (let possibleSize = 1; possibleSize <= maxMintSize; possibleSize *= 2) {
            options.push(possibleSize);
        }

        return (
            <div className={styles.footerDetails}>
                {isMinting ? mintButtonClasses.push(styles.disabled) && <></> : <></>}
                {options.length == 0
                    ? <></>
                    : <select
                        className={styles.tileCountPicker}
                        value={mintSize}
                        onChange={(e) => setMintSize(parseInt(e.target.value))}>
                        {options.map(possibleSize => {
                            return <option key={`mintSize_${possibleSize}`} value={possibleSize}>{possibleSize} Tile{possibleSize > 1 ? "s" : ""}</option>;
                        })}
                    </select>
                }
                <div className={styles.priceArea}>
                    {this.context.tileContract
                        ? <>
                            <span>Price</span>
                            {mintFullCost.eq(mintDiscountedCost)
                                ? <span className={styles.discountedPrice}>Ξ{this.context.formatEth(mintDiscountedCost)}</span>
                                : <>
                                    <span className={styles.regularPrice}>Ξ{this.context.formatEth(mintFullCost)}</span>
                                    <span className={styles.discountedPrice}>Ξ{this.context.formatEth(mintDiscountedCost)}</span>
                                </>
                            }
                            <span className={styles.fiatPrice}>(${usdCost})</span>
                        </>
                        : <span>Intall metamask for pricing...</span>}

                </div>
                <div className={mintButtonClasses.join(' ')} onClick={this.onMintClick.bind(this, setIsMinting)}>Mint</div>
            </div>
        );
    }
}
MintFooter.contextType = Web3Context;