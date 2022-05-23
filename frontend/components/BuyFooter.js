import styles from '../styles/Footer.module.css'
import React from 'react';
import AppContext from '../context/AppContext';
import { BigNumber, ethers } from 'ethers';
import { getPatchLayers, idFromXY, layerDataFromXY } from '../util/id';
import { openSeaUrl, Tile } from '../util/network.config';
import { toast } from 'react-toastify';

export default class BuyFooter extends React.PureComponent {
    constructor(props) {
        super(props);

        this.web3Context = props.web3Context;
    }

    async onBuy(sellOrder) {
        toast.promise(
            this.web3Context.seaport.fulfillOrder({
                order: sellOrder,
                accountAddress: this.web3Context.metamaskAccount
            }),
            {
                pending: "Attempting purchase with OpenSea...",
                error: "Failed!",
                success: "Success!"
            }
        );
    }

    render() {
        const { web3Context } = this.props;

        this.web3Context = web3Context;

        const hasSelection = this.context.selectedTile || this.context.selectedPatch;
        const selectionType = this.context.selectedTile
            ? "tile"
            : "patch";

        const sellOrder = this.context.selectedAsset?.sellOrders?.orders.find((o) => !o.cancelledOrFinalized);
        const currentBid = BigNumber.from(sellOrder?.currentPrice?.toFixed() ?? 0);
        let listingType = "none";
        if (sellOrder?.saleKind == 0 && sellOrder?.howToCall == 0) {
            listingType = "auction";
        } else if (sellOrder?.saleKind == 0 && sellOrder?.howToCall == 1) {
            listingType = "fixedPrice";
        } else if (sellOrder?.saleKind == 1 && sellOrder?.howToCall == 1) {
            listingType = "decreasingAuction";
        }
        const assetLink =
            this.context.selectedAsset?.openseaLink ??
            `${openSeaUrl}/assets/${Tile.address}/${idFromXY(this.context.selectedTile ?? { x: 0, y: 0 })}`;

        const ui = [];
        if (this.context.selectedTile) {
            const layerData = this.context.selectedTile ? layerDataFromXY(this.context.selectedTile) : undefined;
            ui.push(<div key="coords" className={styles.priceArea}>R{layerData.layer + 1}, T{layerData.layerId + 1}</div>);
        } else if (this.context.selectedPatch) {
            const numBounds = {
                x: parseInt(this.context.selectedPatch.x),
                y: parseInt(this.context.selectedPatch.y),
                width: parseInt(this.context.selectedPatch.width),
                height: parseInt(this.context.selectedPatch.height),
            };
            numBounds.maxX = numBounds.x + numBounds.width - 1;
            numBounds.maxY = numBounds.y + numBounds.height - 1;
            const layers = getPatchLayers(numBounds);
            ui.push(<div key="coords" className={styles.priceArea}>Tile Patch @ R{layers.minLayer + 1}-R{layers.maxLayer + 1}</div>);
        } else {
            ui.push(<div key="loading" className={styles.promptArea}>Select a tile you&apos;d like to buy</div>);
        }

        if (hasSelection) {
            if (this.web3Context.waitingForAsset) {
                ui.push(<div key="loading" className={styles.priceArea}>...</div>);
            } else {
                if (sellOrder) {
                    ui.push(
                        <div key="price" className={styles.priceArea}>
                            <span>Price</span>
                            <span className={styles.discountedPrice}>Ξ{web3Context.formatEth(currentBid)}</span>
                            <span className={styles.fiatPrice}>(${web3Context.calculateUSD(currentBid)})</span>
                        </div>
                    );
                } else {
                    ui.push(<div key="unlisted" className={styles.priceArea}>This {selectionType} is unlisted</div>);
                }
            }

            if (listingType == "fixedPrice" || listingType == "decreasingAuction") {
                ui.push(
                    <div key="buy" className={styles.actionButton} onClick={this.onBuy.bind(this, sellOrder)}>Buy</div>,
                    <div key="divider" className={styles.divider}></div>,
                    <a
                        key="offer"
                        className={[styles.actionButton, styles.light].join(" ")}
                        href={assetLink}
                        target="_blank"
                        rel="noreferrer noopener">
                        Or Make an Offer
                    </a>,
                )
            } else {
                ui.push(
                    <a
                        key="offer"
                        className={[styles.actionButton, styles.light].join(" ")}
                        href={assetLink}
                        target="_blank"
                        rel="noreferrer noopener">
                        Make an Offer
                    </a>
                );
            }
        }

        return <div className={styles.footerDetails}>{ui}</div>;
    }
}
BuyFooter.contextType = AppContext;