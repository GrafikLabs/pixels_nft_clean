import React from 'react';
import FirebaseContext from '../context/FirebaseContext';
import styles from '../styles/Canvas.module.css';
import { setDoc, doc, onSnapshot } from "firebase/firestore";
import { chunkDocId, chunksCollection, tileProperty, formatChunkData, ownersCollection, formatOwnershipData } from '../util/firestore';
import { compareId, idFromXY, xyFromLocal } from '../util/id';
import { toast } from 'react-toastify';

export default class CanvasChunk extends React.PureComponent {
    static whyDidYouRender = true

    constructor(props) {
        super(props);

        this.appContext = this.props.appContext;

        const ownershipData = {};
        for (const key in this.props.ownershipData) {
            ownershipData[key] = new Set(this.props.ownershipData[key]);
        }
        this.state = {
            tileData: this.props.tileData,
            ownershipData: ownershipData,
        };
        this.dragger = this.onCanvasMove.bind(this);
        this.dragTerminator = this.onCanvasUp.bind(this);
    }

    symmetricDifference(setA, setB) {
        let _difference = new Set(setA)
        for (let elem of setB) {
            if (_difference.has(elem)) {
                _difference.delete(elem)
            } else {
                _difference.add(elem)
            }
        }
        return _difference
    }

    componentDidMount() {
        this.contextReady = async () => {
            const { chunkX, chunkY } = this.props;
            const docId = chunkDocId({ x: chunkX, y: chunkY });
            onSnapshot(doc(this.context.firestore, chunksCollection, docId), (doc) => {
                const newTileData = formatChunkData(doc.data());
                for (let row = 0; row < newTileData.length; row++) {
                    for (let col = 0; col < newTileData[row].length; col++) {
                        if (this.state.tileData[row][col] != newTileData[row][col]) {
                            this.setState((state) => {
                                state.tileData = newTileData;
                                return state;
                            })
                            return;
                        }
                    }
                }
            });
            onSnapshot(doc(this.context.firestore, ownersCollection, docId), (doc) => {
                const newOwnershipData = formatOwnershipData(doc.data());
                const ownershipData = {};
                let different = Object.keys(ownershipData).length != Object.keys(this.state.ownershipData).length;
                for (const key in newOwnershipData) {
                    ownershipData[key] = new Set(newOwnershipData[key]);
                    if (!different) {
                        if (ownershipData[key].size != this.state.ownershipData?.[key]?.size) {
                            different = true;
                            continue;
                        }
                        for (const item of ownershipData[key]) {
                            if (!this.state.ownershipData?.[key].has(item)) {
                                different = true;
                                break;
                            }
                        }
                    }
                }
                if (different) {
                    this.setState((state) => {
                        state.ownershipData = ownershipData;
                        return state;
                    })
                }
            });
        };

        this.context.addEventListener("ready", this.contextReady);
    }

    componentWillUnmount() {
        window.removeEventListener('pointermove', this.dragger);
        window.removeEventListener('pointerup', this.dragTerminator);
    }

    tileIsMinted(tile) {
        const { nextTile } = this.props;
        return compareId(tile, nextTile) < 0;
    }

    async tryColorTile(tile) {
        const { ownershipData } = this.state;
        const { chunkX, chunkY, chunkSize, showLockedNotice } = this.props;
        const { designColor, highlightType, setHighlightType } = this.appContext;
        const { user, firestore } = this.context;

        const docId = chunkDocId({ x: chunkX, y: chunkY });

        const update = {};
        update[tileProperty(tile)] = designColor;
        const isOwn = ownershipData[user?.uid]?.has(tile.y * chunkSize + tile.x);
        if (!isOwn && highlightType == 'owned') {
            setHighlightType('all');
        }
        try {
            await setDoc(doc(firestore, chunksCollection, docId), update, { merge: true });
        } catch (e) {
            showLockedNotice(xyFromLocal({ chunkX, chunkY, x: tile.x, y: tile.y }));
        }
    }

    isEmphasizedTile(tile) {
        const { ownershipData } = this.state;
        const { chunkX, chunkY, chunkSize } = this.props;
        const { highlightType } = this.appContext;
        const { user } = this.context;

        const isMinted = this.tileIsMinted(xyFromLocal({ chunkX, chunkY, x: tile.x, y: tile.y }));
        if (!isMinted) {
            return false;
        }

        const isOwn = ownershipData[user?.uid]?.has(tile.y * chunkSize + tile.x);
        if (highlightType == 'owned') {
            return isOwn;
        }

        const isUnlocked = ownershipData["anyone"]?.has(tile.y * chunkSize + tile.x);
        return isOwn || isUnlocked;
    }

    async onCanvasDown(e) {
        const { flow } = this.appContext;
        if (flow != "design") {
            return;
        }

        this.startE = { x: e.clientX, y: e.clientY };
        window.addEventListener('pointermove', this.dragger);
        window.addEventListener('pointerup', this.dragTerminator);
    }

    async onCanvasMove(e) {
        const { tileSize, dragControls } = this.props;
        if (this.dragging) {
            return;
        }

        const bounds = e.target.getBoundingClientRect();
        const originalTile = {
            x: Math.floor((this.startE.x - bounds.left) / tileSize),
            y: Math.floor((bounds.bottom - this.startE.y) / tileSize),
        }
        if (this.dragging === undefined && (Math.abs(e.clientX - this.startE.x) > 5 || Math.abs(e.clientY - this.startE.y) > 5)) {
            if (!this.isEmphasizedTile(originalTile)) {
                dragControls.start(e);
                this.dragging = true;
                return;
            } else {
                this.dragging = false;
                this.tryColorTile(originalTile);
            }
        }

        if (this.dragging === false) {
            const tile = {
                x: Math.floor((e.clientX - bounds.left) / tileSize),
                y: Math.floor((bounds.bottom - e.clientY) / tileSize),
            }
            if (this.isEmphasizedTile(tile)) {
                this.tryColorTile(tile);
            }
        }
    }

    async onCanvasUp(e) {
        const { tileSize } = this.props;
        const { flow } = this.appContext;
        if (flow != "design") {
            return;
        }

        if (Math.abs(e.clientX - this.startE.x) < 5 && Math.abs(e.clientY - this.startE.y) < 5) {
            const bounds = e.target.getBoundingClientRect();
            const tile = {
                x: Math.floor((e.clientX - bounds.left) / tileSize),
                y: Math.floor((bounds.bottom - e.clientY) / tileSize),
            }
            this.tryColorTile(tile);
        }

        this.startE = undefined;
        this.dragging = undefined;
        window.removeEventListener('pointermove', this.dragger);
        window.removeEventListener('pointerup', this.dragTerminator);
    }

    shouldHighlight = ({ x, y }) => {
        const { chunkSize, highlightType, metamaskAccount } = this.props;
        const { ownershipData } = this.state;
        const { isDetailView, flow } = this.appContext;
        const { user } = this.context;

        if (!isDetailView()) {
            return true;
        }

        if (flow == "mint") {
            return true;
        }

        if (flow == "buy") {
            return !ownershipData[metamaskAccount]?.has(y * chunkSize + x);
        }

        if (highlightType == "owned") {
            return ownershipData[user?.uid]?.has(y * chunkSize + x);
        }

        return ownershipData[user?.uid]?.has(y * chunkSize + x) ||
            ownershipData["anyone"]?.has(y * chunkSize + x);
    }

    drawChunk = (ref) => {
        if (!ref) {
            return;
        }
        const { tileSize, chunkX, chunkY, chunkSize } = this.props;
        const { tileData } = this.state;
        const { isDetailView } = this.appContext;

        const pixelSize = chunkSize * tileSize;
        const ctx = ref.getContext('2d');
        ctx.clearRect(0, 0, pixelSize, pixelSize);

        if (isDetailView()) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "#f0f0f0";

            ctx.beginPath();
            ctx.rect(0, 0, pixelSize, pixelSize);
            for (let i = 1; i < chunkSize; i++) {
                ctx.moveTo(tileSize * i, 0);
                ctx.lineTo(tileSize * i, pixelSize);
                ctx.moveTo(0, tileSize * i);
                ctx.lineTo(pixelSize, tileSize * i);
            }
            ctx.stroke();
        }

        for (let r = 0; r < tileData.length; r++) {
            for (let c = 0; c < tileData[r].length; c++) {
                const globalXY = xyFromLocal({ chunkX, x: c, chunkY, y: r });
                if (!this.tileIsMinted(globalXY)) {
                    continue;
                }

                const color = tileData[r][c];
                if (!this.shouldHighlight({ x: c, y: r })) {
                    color += "33";
                }
                const x = c * tileSize;
                const y = (chunkSize - 1 - r) * tileSize;
                ctx.fillStyle = color;
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
    }

    render() {
        const { tileSize, chunkX, chunkY, chunkSize } = this.props;

        this.appContext = this.props.appContext;

        const docId = chunkDocId({ x: chunkX, y: chunkY });
        return (
            <canvas
                width={chunkSize * tileSize}
                height={chunkSize * tileSize}
                ref={this.drawChunk.bind(this)}
                className={styles.chunk}
                onPointerDown={this.onCanvasDown.bind(this)}>
            </canvas>
        );
    }
}
CanvasChunk.contextType = FirebaseContext;
CanvasChunk.whyDidYouRender = true;