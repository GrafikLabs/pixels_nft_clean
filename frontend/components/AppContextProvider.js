import React from 'react';
import AppContext from '../context/AppContext';
import { toast } from 'react-toastify';

export default class AppContextProvider extends React.Component {
    constructor(props) {
        super(props);

        const tileSize = Math.max(1, Math.round(this.props.targetCanvasSize / this.props.canvasSize));

        this.state = {
            mintSize: 8,
            isMinting: false,
            isDragging: false,
            tileSize: tileSize,
            minTileSize: tileSize,
            maxTileSize: 32,
            canvasSize: this.props.canvasSize,
            flow: "mint",
            theme: "dark",
            designColor: 5292601,
            hexColor: "#50C239",
            highlightType: "owned",
            selectedTile: undefined,
            selectedPatch: undefined,
            selectedAsset: undefined,
            setMintSize: this.setMintSize.bind(this),
            setIsMinting: this.setIsMinting.bind(this),
            setIsDragging: this.setIsDragging.bind(this),
            setTileSize: this.setTileSize.bind(this),
            zoomIn: this.zoomIn.bind(this),
            zoomOut: this.zoomOut.bind(this),
            setCanvasSize: this.setCanvasSize.bind(this),
            setFlow: this.setFlow.bind(this),
            setTheme: this.setTheme.bind(this),
            setDesignColor: this.setDesignColor.bind(this),
            setHighlightType: this.setHighlightType.bind(this),
            setSelectedTile: this.setSelectedTile.bind(this),
            setSelectedPatch: this.setSelectedPatch.bind(this),
            setSelectedAsset: this.setSelectedAsset.bind(this),
            isDetailView: this.isDetailView.bind(this),
        };

        this.mintingResolve = undefined;
    }

    setMintSize(mintSize, callback) {
        this.setState((state) => {
            state.mintSize = mintSize;
            return state;
        }, callback);
    }

    setIsMinting(isMinting, callback) {
        this.setState((state) => {
            state.isMinting = isMinting;
            return state;
        }, async () => {
            if (isMinting && !this.mintingResolve) {
                const mintingPromise = new Promise((resolve) => {
                    this.mintingResolve = resolve;
                })
                toast.promise(
                    mintingPromise,
                    {
                        pending: "Minting on blockchain...",
                        error: "Failed!",
                        success: "Done!",
                    }
                );
            } else if (!isMinting && this.mintingResolve) {
                this.mintingResolve();
                this.mintingResolve = undefined;
            }
            if (callback) {
                await callback();
            }
        });
    }

    setIsDragging(isDragging, callback) {
        this.setState((state) => {
            state.isDragging = isDragging;
            return state;
        }, callback);
    }

    setTileSize(tileSize, callback) {
        this.setState((state) => {
            state.tileSize = tileSize;
            return state;
        }, callback);
    }

    zoomIn(callback) {
        if (this.state.tileSize >= this.state.maxTileSize) {
            return;
        }

        let newSize = this.state.tileSize;
        if (this.state.tileSize < this.state.minTileSize) {
            newSize = this.state.minTileSize;
        } else {
            newSize *= 2;
        }

        this.setTileSize(newSize, callback);
    }

    zoomOut(callback) {
        if (this.state.tileSize < this.state.minTileSize) {
            return;
        }

        let newSize = this.state.tileSize;
        if (this.state.tileSize == this.state.minTileSize) {
            const targetCanvasSize = Math.min(window.innerWidth, window.innerHeight) - 200;
            newSize = targetCanvasSize / 256;
            if (newSize > 1) {
                newSize = Math.round(newSize);
            }
        } else {
            newSize /= 2;
        }

        this.setTileSize(newSize, callback);
    }

    setCanvasSize(canvasSize, callback) {
        this.setState((state) => {
            state.canvasSize = canvasSize;
            return state;
        }, callback);
    }

    setFlow(flow, callback) {
        this.setState((state) => {
            state.flow = flow;
            return state;
        }, callback);
    }

    setTheme(theme, callback) {
        this.setState((state) => {
            state.theme = theme;
            return state;
        }, callback);
    }

    setDesignColor(designColor, callback) {
        this.setState((state) => {
            state.designColor = designColor;
            state.hexColor = '#' + designColor.toString(16).padStart(6, "0");
            return state;
        }, callback);
    }

    setHighlightType(highlightType, callback) {
        this.setState((state) => {
            state.highlightType = highlightType;
            return state;
        }, callback);
    }

    setSelectedTile(selectedTile, callback) {
        this.setState((state) => {
            state.selectedTile = selectedTile;
            state.selectedPatch = undefined;
            return state;
        }, callback);
    }

    setSelectedPatch(selectedPatch, callback) {
        this.setState((state) => {
            state.selectedTile = undefined;
            state.selectedPatch = selectedPatch;
            return state;
        }, callback);
    }

    setSelectedAsset(selectedAsset, callback) {
        this.setState((state) => {
            state.selectedAsset = selectedAsset;
            return state;
        }, callback);
    }

    isDetailView() {
        if (typeof window === 'undefined') {
            return false;
        }
        return this.state.canvasSize * this.state.tileSize > window.innerHeight - 120;
    }

    render() {
        const { children } = this.props;
        return <AppContext.Provider value={this.state}>
            {children}
        </AppContext.Provider>;
    }
}