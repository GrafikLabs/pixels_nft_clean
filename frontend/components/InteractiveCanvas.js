import React from 'react';
import styles from '../styles/InteractiveCanvas.module.css';
import { getCanvasProps, getTilesByOwner } from "../util/contract";
import { DragControls, motion, MotionValue } from "framer-motion";
import Web3Context from '../context/Web3Context';
import CanvasChunk from './CanvasChunk';
import { compareId, idFromXY, localFromXY, xyFromId } from '../util/id';
import { chunkSize } from '../util/firestore';
import { ethers } from 'ethers';


/**
 * Full-screen interactive canvas. Maintains its own state.
 * Uses `Web3Context`.
 */
export default class InteractiveCanvas extends React.Component {
    constructor(props) {
        super(props);

        this.appContext = this.props.appContext;

        this.canvasVariants = {
            zoomedOut: { scale: 1.05 },
            zoomedIn: { scale: 1 },
        }

        this.lockedNoticeVariants = {
            visible: { opacity: 1 },
            hidden: { opacity: 0 },
        }

        this.state = {
            canvasVariant: "zoomedOut",
            lockedNoticeVariant: "hidden",
            lockedNoticePosition: {},
            screenSize: this.props.screenSize,
            tilesLeft: this.props.tilesLeft,
            tileColors: this.props.tileColors,
            nextTile: this.props.nextTile,
            ownedTiles: new Set(),
        };

        this.dragControls = new DragControls();
        this.center = this.props.nextTile;
        this.currentSize = this.appContext.tileSize;
        const centerCoords = this.tileFromXY(this.center);
        this.canvasOffsetX = new MotionValue(-centerCoords.x + this.props.screenSize.x / 2);
        this.canvasOffsetY = new MotionValue(-centerCoords.y + this.props.screenSize.y / 2);
        this.handleResize = this.onResize.bind(this);
        this.syncOwnersCallback = this.syncOwners.bind(this);
        this.fetchTilesCallback = this.syncOwners.bind(this, this.fetchTiles);
        this.numChunks = this.appContext.canvasSize / chunkSize;
    }

    getDragConstraints() {
        const { canvasSize, tileSize } = this.appContext;
        const { screenSize } = this.state;

        const canvasTileSize = canvasSize * tileSize;
        const constraints = {
            top: -(canvasTileSize - screenSize.y) - 142,
            left: -(canvasTileSize - screenSize.x),
            right: 0,
            bottom: 60,
        };
        if (canvasTileSize < screenSize.y - 202) {
            constraints.top = (screenSize.y - canvasTileSize) / 2
            constraints.bottom = (screenSize.y - canvasTileSize) / 2
        }
        if (canvasTileSize < screenSize.x) {
            constraints.left = (screenSize.x - canvasTileSize) / 2
            constraints.right = (screenSize.x - canvasTileSize) / 2
        }

        return constraints;
    }

    getOffset() {
        return { x: this.canvasOffsetX.get(), y: this.canvasOffsetY.get() };
    }

    setOffset({ x, y }) {
        const constraints = this.getDragConstraints();
        this.canvasOffsetX.stop();
        this.canvasOffsetX.set(Math.min(constraints.right, Math.max(constraints.left, x)));
        this.canvasOffsetY.stop();
        this.canvasOffsetY.set(Math.min(constraints.bottom, Math.max(constraints.top, y)));
    }

    async fetchTiles() {
        // TODO: still check ownership lol
        this.appContext.setIsMinting(false);

        const props = await getCanvasProps(this.context.tileContract);
        this.setState((state) => {
            state.tilesLeft = props.tilesLeft;
            state.nextTile = props.nextTile;
            return state;
        }, () => this.appContext.setCanvasSize(props.canvasSize));
    }

    async syncOwners(callback) {
        const syncOwnersEndpoint = await fetch("api/v1/firebase/syncOwners");
        await syncOwnersEndpoint.json();
        let owned = []
        if (this.context.metamaskAccount) {
            owned = await getTilesByOwner(this.context.tileContract, this.context.metamaskAccount);
        }
        this.setState((state) => {
            state.ownedTiles = new Set(owned);
            return state;
        }, callback)
    }

    componentDidMount() {
        window.addEventListener('resize', this.handleResize);
        this.onResize();

        this.onAccountsChanged = async () => {
            if (this.context.metamaskAccount) {
                const owned = await getTilesByOwner(this.context.tileContract, this.context.metamaskAccount);
                this.setState((state) => {
                    state.ownedTiles = new Set(owned);
                    return state;
                })
            }
        }
        this.contextReady = async () => {
            this.onAccountsChanged();
            this.context.tileContract.on("TransferSingle", this.fetchTilesCallback);
            this.context.tileContract.on("TransferBatch", this.fetchTilesCallback);
            this.context.patchContract.on("TransferSingle", this.syncOwnersCallback);
            this.context.patchContract.on("TransferBatch", this.syncOwnersCallback);
        };

        this.context.addEventListener("ready", this.contextReady);
        this.context.addEventListener("accountsChanged", this.onAccountsChanged);
    }

    async componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        this.context.removeEventListener("ready", this.contextReady);
        this.context.removeEventListener("accountsChanged", this.onAccountsChanged);
        if (this.context.tileContract) {
            this.context.tileContract.off("TransferSingle", this.fetchTilesCallback);
            this.context.tileContract.off("TransferBatch", this.fetchTilesCallback);
            this.context.patchContract.off("TransferSingle", this.syncOwnersCallback);
            this.context.patchContract.off("TransferBatch", this.syncOwnersCallback);
        }
    }

    onResize() {
        const targetCanvasSize = Math.min(window.innerWidth, window.innerHeight) / 2;
        const tileSize = Math.max(1, Math.round(targetCanvasSize / this.appContext.canvasSize));
        let updateTileSize = false;
        if (!this.appContext.minTileSize || this.appContext.tileSize == this.appContext.minTileSize) {
            updateTileSize = true;
        }
        this.setState((state) => {
            state.screenSize = {
                x: window.innerWidth,
                y: window.innerHeight
            };
            const centerCoords = this.tileFromXY(this.center);
            this.setOffset({
                x: -centerCoords.x + state.screenSize.x / 2,
                y: -centerCoords.y + state.screenSize.y / 2,
            });

            this.appContext.minTileSize = tileSize;
            return state;
        }, () => {
            if (updateTileSize) {
                this.currentSize = tileSize;
                this.appContext.setTileSize(tileSize);
            }
        });
    }

    onWheel(e) {
        const offset = this.getOffset();
        const cursorFocus = this.xyFromTile({
            x: - offset.x + e.clientX,
            y: - offset.y + e.clientY,
        });

        const cursorOffset = {
            x: e.clientX,
            y: e.clientY,
        };

        const adjustOffset = () => {
            const focusCoords = this.tileFromXY(cursorFocus);
            this.setOffset({
                x: -focusCoords.x + cursorOffset.x,
                y: -focusCoords.y + cursorOffset.y,
            });
        }

        if (e.deltaY < 0) {
            this.appContext.zoomIn(adjustOffset);
        } else {
            this.appContext.zoomOut(adjustOffset);
        }
    }

    onExternalResize() {
        this.setState((state) => {
            if (this.appContext.tileSize > this.appContext.minTileSize) {
                state.canvasVariant = "zoomedIn";
            } else {
                state.canvasVariant = "zoomedOut";
            }
            return state;
        }, () => {
            const centerCoords = this.tileFromXY(this.center);
            this.setOffset({
                x: -centerCoords.x + this.state.screenSize.x / 2,
                y: -centerCoords.y + this.state.screenSize.y / 2,
            });
        });
    }

    onDragUpdate() {
        if (this.appContext.tileSize == this.appContext.minTileSize) {
            return;
        }

        const offset = this.getOffset();
        this.center = this.xyFromTile({
            x: - offset.x + this.state.screenSize.x / 2,
            y: - offset.y + this.state.screenSize.y / 2,
        });
    }

    chunkXYFromIJ({ i, j }) {
        const chunkX = j + 1 - this.numChunks / 2;
        const chunkY = this.numChunks / 2 - 1 - i;
        return { chunkX, chunkY };
    }

    chunkIJFromXY({ chunkX, chunkY }) {
        const j = this.numChunks / 2 - 1 + chunkX;
        const i = this.numChunks / 2 - 1 - chunkY;
        return { i, j };
    }

    async onCanvasClick(e) {
        // Ignore all events while dragging.
        if (this.appContext.isDragging) {
            return;
        }

        // Click on zoomed out canvas.
        if (this.appContext.tileSize <= this.appContext.minTileSize) {
            this.setState((state) => {
                state.canvasVariant = "zoomedIn";
                return state;
            }, () => {
                this.currentSize = this.appContext.maxTileSize;
                this.appContext.setTileSize(this.appContext.maxTileSize, this.onExternalResize.bind(this));
            });
            return;
        }

        // Ignore all events in design mode.
        if (this.appContext.flow == "design") {
            return;
        }

        // Get clicked XY.
        const offset = this.getOffset();
        let clicked = this.xyFromTile({
            x: - offset.x + e.clientX,
            y: - offset.y + e.clientY,
        });
        clicked = {
            x: Math.round(clicked.x),
            y: Math.round(clicked.y),
        }

        // Click inside minted area.
        if (compareId(clicked, this.state.nextTile) < 0) {
            const localCoords = localFromXY(clicked);
            const { i, j } = this.chunkIJFromXY(localCoords);
            const ownership = this.props.ownershipData[i][j][this.context.metamaskAccount];
            if (ownership?.includes(localCoords.y * chunkSize + localCoords.x)) {
                // You own this.
                this.appContext.setFlow("design");
                return;
            }
            const tileId = idFromXY(clicked);
            const owner = await this.context.tileContract.getOwningAddress(tileId);

            const updateAsset = async (assetPromise) => {
                if (this.appContext.flow == "mint") {
                    this.appContext.setFlow("buy");
                }
                this.appContext.setSelectedAsset(undefined, async () => {
                    this.appContext.setSelectedAsset(await assetPromise);
                });
            }

            // You do not own this.
            if (owner == ethers.constants.AddressZero) {
                const patchId = await this.context.patchContract.getTilePatch(tileId);
                const patch = await this.context.patchContract.getBounds(patchId);
                this.appContext.setSelectedPatch(
                    patch,
                    () => updateAsset(this.context.fetchPatchAsset(patchId))
                );
            } else {
                this.appContext.setSelectedTile(
                    clicked,
                    () => updateAsset(this.context.fetchTileAsset(tileId))
                );
            }
            return;
        }

        // Click outside minted area.
        this.appContext.setSelectedTile(undefined, () => {
            this.appContext.setSelectedAsset(undefined, () => {
                if (this.appContext.flow == "buy") {
                    this.appContext.setFlow("mint");
                }
            });
        });
    }

    hideLockedNotice() {
        if (this.hideNoticeTimeout) {
            clearTimeout(this.hideNoticeTimeout);
        }
        if (this.showNoticeTimeout) {
            clearTimeout(this.showNoticeTimeout);
        }
        this.hideNoticeTimeout = undefined;
        this.setState((state) => {
            state.lockedNoticeVariant = "hidden";
            return state;
        });
    }

    showLockedNotice(position) {
        if (this.hideNoticeTimeout) {
            clearTimeout(this.hideNoticeTimeout);
        }
        if (this.showNoticeTimeout) {
            clearTimeout(this.showNoticeTimeout);
        }
        this.showNoticeTimeout = undefined;
        if (this.state.lockedNoticeVariant == "visible") {
            this.hideLockedNotice();
            this.showNoticeTimeout = setTimeout(this.showLockedNotice.bind(this, position), 500);
            return;
        }

        this.setState((state) => {
            state.lockedNoticeVariant = "visible";
            state.lockedNoticePosition = position;
            return state;
        }, () => {
            this.hideNoticeTimeout = setTimeout(this.hideLockedNotice.bind(this), 5000);
        });
    }

    xyFromTile({ x, y }) {
        const { canvasSize, tileSize } = this.appContext;
        return {
            x: (x + tileSize / 2) / tileSize - canvasSize / 2,
            y: -((y + tileSize / 2) / tileSize - canvasSize / 2),
        };
    }

    tileFromXY({ x, y }) {
        const { canvasSize, tileSize } = this.appContext;
        return {
            x: (canvasSize / 2 + x) * tileSize - tileSize / 2,
            y: (canvasSize / 2 - y) * tileSize - tileSize / 2
        };
    }

    getSelectionTile(x, y, animation = <></>, id = "selected") {
        const { tileSize } = this.appContext;
        const shadowOffset = tileSize / 32 * 3;

        return [
            <rect key={`${id}Shadow`} x={x} y={y} width={tileSize} height={tileSize} fill="#000000"></rect>,
            <rect key={id} x={x + shadowOffset} y={y - shadowOffset} width={tileSize} height={tileSize} fill="#B2FD4F" stroke="#000000" strokeWidth="1.5">
                {animation}
            </rect>
        ];
    }

    getPulsingTile(x, y, id) {
        const { tileSize } = this.appContext;
        const { isMinting } = this.props;

        let begin = Math.round((Math.floor(x / tileSize) % 5) / 5 * 1060);
        let nextSpeed = "1060ms";
        if (isMinting) {
            nextSpeed = "530ms";
            begin /= 2;
        }
        const animation = <animate begin={`${begin}ms`} attributeName="fill" values="#B2FD4F;#8fcc3f;#B2FD4F" dur={nextSpeed} repeatCount="indefinite" />;
        return this.getSelectionTile(x, y, animation, id);
    }

    render() {
        const {
            canvasVariant,
            tilesLeft,
            nextTile,
            ownedTiles,
            lockedNoticeVariant,
            lockedNoticePosition,
        } = this.state;
        const { mintSize, tileData, ownershipData } = this.props;

        this.appContext = this.props.appContext;
        if (this.currentSize != this.appContext.tileSize) {
            // External resize.
            setTimeout(this.onExternalResize.bind(this), 100);
            this.currentSize = this.appContext.tileSize;
        }
        this.currentSize = this.appContext.tileSize;

        let highlighted = new Set();
        if (this.appContext.flow == "design" && this.appContext.highlightType == "owned") {
            highlighted = ownedTiles;
        }

        const chunks = [];
        this.numChunks = this.appContext.canvasSize / chunkSize;

        const lockedNoticePixelPosition = this.tileFromXY(lockedNoticePosition);

        const selectedTiles = [];
        if (this.appContext.flow == "mint") {
            const start = idFromXY(nextTile);
            const highlights = [];
            for (let i = start; i < start + mintSize; i++) {
                const tile = xyFromId(i);
                const { x, y } = this.tileFromXY(tile);
                const pulsingTile = this.getPulsingTile(x - this.appContext.tileSize / 2, y - this.appContext.tileSize / 2, `selected_${tile.y}_${tile.x}`);
                selectedTiles.push(pulsingTile[0]);
                highlights.push(pulsingTile[1]);
            }
            selectedTiles.push(...highlights);
        } else if (this.appContext.flow == "buy" && this.appContext.selectedTile) {
            const { x, y } = this.tileFromXY(this.appContext.selectedTile);
            selectedTiles.push(...this.getSelectionTile(x - this.appContext.tileSize / 2, y - this.appContext.tileSize / 2));
        } else if (this.appContext.flow == "buy" && this.appContext.selectedPatch) {
            const numBounds = {
                x: parseInt(this.appContext.selectedPatch.x),
                y: parseInt(this.appContext.selectedPatch.y),
                width: parseInt(this.appContext.selectedPatch.width),
                height: parseInt(this.appContext.selectedPatch.height),
            };
            const highlights = [];
            for (let i = numBounds.x; i < numBounds.x + numBounds.width; i++) {
                for (let j = numBounds.y; j < numBounds.y + numBounds.height; j++) {
                    const { x, y } = this.tileFromXY({ x: i, y: j });
                    const tile = this.getSelectionTile(x - this.appContext.tileSize / 2, y - this.appContext.tileSize / 2, <></>, `selected_${j}_${i}`);
                    selectedTiles.push(tile[0]);
                    highlights.push(tile[1]);
                }
            }
            selectedTiles.push(...highlights);
        }

        for (var i = 0; i < this.numChunks; i++) {
            for (var j = 0; j < this.numChunks; j++) {
                const { chunkX, chunkY } = this.chunkXYFromIJ({ i, j });
                chunks.push(<CanvasChunk
                    key={`chunk_${chunkY}_${chunkX}`}
                    appContext={this.appContext}
                    nextTile={nextTile}
                    chunkX={chunkX}
                    chunkY={chunkY}
                    chunkSize={chunkSize}
                    tileData={tileData[i][j]}
                    ownershipData={ownershipData[i][j]}
                    tileSize={this.appContext.tileSize}
                    highlightType={this.appContext.highlightType}
                    metamaskAccount={this.context.metamaskAccount}
                    showLockedNotice={this.showLockedNotice.bind(this)}
                    dragControls={this.dragControls}
                ></CanvasChunk>);
            }
        }

        const canvasPixelSize = this.appContext.canvasSize * this.appContext.tileSize;
        const canvasClasses = [styles.canvas];
        if (this.appContext.tileSize <= this.appContext.minTileSize) {
            canvasClasses.push(styles.zoomedOut);
        }

        return (
            <div
                className={styles.container}
                onWheel={this.onWheel.bind(this)}>
                <motion.div
                    className={styles.draggable}
                    drag
                    dragControls={this.dragControls}
                    dragListener={this.appContext.flow != "design"}
                    style={{ x: this.canvasOffsetX, y: this.canvasOffsetY }}
                    dragConstraints={this.getDragConstraints()}
                    onUpdate={this.onDragUpdate.bind(this)}
                    onDragStart={() => this.appContext.setIsDragging(true)}
                    onDragEnd={() => setTimeout(() => {
                        this.appContext.setIsDragging(false);
                    }, 100)}
                >
                    {this.appContext.tileSize < this.appContext.minTileSize
                        ? <>
                            <div className={styles.batchPreview} style={{
                                "--size": this.appContext.tileSize * 128 + "px",
                                zIndex: -1,
                                "--dark-bg": "#424242",
                                "--light-bg": "#FFFFFF",
                            }}>
                                <span>Batch 1</span>
                            </div>
                            <div className={styles.batchPreview} style={{
                                "--size": this.appContext.tileSize * 192 + "px",
                                zIndex: -2,
                                "--dark-bg": "#292929",
                                "--light-bg": "#F6F6F6",
                            }}>
                                <span>Batch 2</span>
                            </div>
                            <div className={styles.batchPreview} style={{
                                "--size": this.appContext.tileSize * 256 + "px",
                                zIndex: -3,
                                "--dark-bg": "#161616",
                                "--light-bg": "#E9E9E9",
                            }}>
                                <span>Batch 3</span>
                            </div>
                        </>
                        : <></>
                    }
                    <motion.div
                        variants={this.canvasVariants}
                        className={canvasClasses.join(" ")}
                        style={{ width: canvasPixelSize, height: canvasPixelSize }}
                        whileHover={canvasVariant}
                        onClick={this.onCanvasClick.bind(this)}>
                        {chunks}
                        {this.appContext.isDetailView() && this.appContext.flow != "design"
                            ? <svg style={{ width: canvasPixelSize, height: canvasPixelSize, position: 'absolute', top: 0, left: 0 }}>
                                {selectedTiles}
                            </svg>
                            : <></>
                        }
                        <motion.div
                            variants={this.lockedNoticeVariants}
                            initial={this.lockedNoticeVariants.hidden}
                            animate={this.appContext.isDetailView() ? lockedNoticeVariant : "hidden"}
                            transition={{ duration: .5 }}
                            style={{
                                x: lockedNoticePixelPosition.x - 188 / 2,
                                y: lockedNoticePixelPosition.y - 63
                            }}
                            className={styles.lockedNotice}>
                            {this.context.metamaskAccount ? "This tile is locked :(" : "Connect wallet to edit..."}
                        </motion.div>
                    </motion.div>
                    {this.appContext.tileSize >= this.appContext.minTileSize
                        ? <div className={styles.fomoPromo}>{tilesLeft.toLocaleString()} Tiles Remaining</div>
                        : <></>
                    }
                </motion.div>
            </div>
        );
    }
}
InteractiveCanvas.contextType = Web3Context;