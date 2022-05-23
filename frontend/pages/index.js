import { ethers } from "ethers";
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { ToastContainer } from 'react-toastify';
import React from 'react';
import { Tile, rpcUrl, firebaseConfig, openSeaProfileLink } from '../util/network.config';
import { getCanvasProps } from "../util/contract";
import { motion } from "framer-motion";
import Web3Context from "../context/Web3Context";
import InteractiveCanvas from "../components/InteractiveCanvas";
import MintFooter from "../components/MintFooter";
import AppContext from "../context/AppContext";
import FirebaseContext from "../context/FirebaseContext";
import DesignFooter from "../components/DesignFooter";
import { getChunks, checkSize } from "../util/firestore";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import jazzicon from '@metamask/jazzicon';
import BuyFooter from "../components/BuyFooter";

export default class Home extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mouseLeft: 0,
            mouseTop: 0,
            sellBubbleVisible: false,
        };

        this.initialFooterProps = { height: 0 };
        this.targetFooterPropsOpen = { height: 140 };
        this.targetFooterPropsClose = { scaleY: 0 };
    }

    async onFlowChange(appContext, selectedFlow) {
        appContext.setFlow(selectedFlow);
        if (!appContext.isDetailView()) {
            appContext.setTileSize(appContext.maxTileSize);
        }
    }

    async onThemeChange(appContext, isLightActive) {
        let theme = isLightActive ? "light" : "dark";
        appContext.setTheme(theme);
    }

    onZoomControlPress(appContext, direction) {
        if (direction > 0) {
            appContext.zoomIn();
        } else {
            appContext.zoomOut();
        }
    }

    componentDidMount() {
        document.addEventListener('mousemove', (e) => {
            this.setState({ mouseLeft: e.pageX - 5, mouseTop: e.pageY - 5 });
        });
    }

    render() {
        const {
            targetCanvasSize,
            canvasSize,
            tileData,
            ownershipData,
            tilesLeft,
            nextTile,
            screenSize,
        } = this.props;

        const { mouseLeft, mouseTop, sellBubbleVisible } = this.state;

        let getFlowClass = (appContext) => {
            if (!appContext.isDetailView()) {
                return "";
            }

            switch (appContext.flow) {
                case "mint":
                    return styles.flowMint;
                case "buy":
                    return styles.flowBuy;
                case "design":
                    return styles.flowDesign;
            }
        }
        let getThemeClass = (appContext) => {
            if (!appContext.theme) {
                return "";
            }

            let theme = appContext.theme;
            return "theme" + theme.charAt(0).toUpperCase() + theme.slice(1);
        }

        const getControlClasses = (appContext) => {
            const canvasControlStyles = [styles.canvasControls];
            const canvasTileSize = appContext.canvasSize * appContext.tileSize;
            if (canvasTileSize > screenSize.x - (22 + 42) * 2) {
                canvasControlStyles.push(styles.outlined);
            }

            return canvasControlStyles.join(" ");
        }

        const setJazzicon = (ref) => {
            if (!ref) {
                return;
            }
            ref.textContent = '';
            const addressInt = parseInt(this.context.metamaskAccount?.slice(2, 10), 16);
            ref.appendChild(jazzicon(20, addressInt));
        }

        let getCursorStyle = (appContext) => {
            if (!appContext.isDetailView() || appContext.flow != "design") {
                return {};
            }

            return { background: appContext.hexColor };
        }

        return (<>
            <Head>
                <title>The Wall</title>
                <meta name="description" content="Make tiles" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <AppContext.Consumer>
                {appContext => (
                    <>
                        <div className={`${styles.container} ${getFlowClass(appContext)} ${getThemeClass(appContext)}`}>
                            <InteractiveCanvas
                                appContext={appContext}
                                screenSize={screenSize}
                                targetCanvasSize={targetCanvasSize}
                                canvasSize={canvasSize}
                                tilesLeft={tilesLeft}
                                tileData={tileData}
                                ownershipData={ownershipData}
                                nextTile={nextTile}
                                mintSize={appContext.mintSize}
                                isMinting={appContext.isMinting}
                            />
                            <header className={`${styles.header} ${appContext.isDetailView() ? styles.detailHeader : ''}`}>
                                <div className={styles.headerLeft}>
                                    <ul>
                                        <hr />
                                        <li><a onClick={() => this.onFlowChange(appContext, "mint")}>Mint</a></li>
                                        <li><a onClick={() => this.onFlowChange(appContext, "buy")}>Buy</a></li>
                                        <li onClick={() => {
                                            this.setState((state) => {
                                                state.sellBubbleVisible = !sellBubbleVisible;
                                                return state;
                                            });
                                        }}>
                                            <a>Sell</a>
                                            <motion.div
                                                className={styles.sellBubble}
                                                initial={{
                                                    opacity: 0,
                                                    display: "none"
                                                }}
                                                animate={{
                                                    opacity: sellBubbleVisible ? 1 : 0,
                                                    display: "flex",
                                                    transitionEnd: {
                                                        display: sellBubbleVisible ? "flex" : "none"
                                                    }
                                                }}>
                                                <p>You can manage all your tiles on OpenSea</p>
                                                <p><a
                                                    href={openSeaProfileLink}
                                                    target="_blank"
                                                    rel="noreferrer noopener">
                                                    View Tiles
                                                </a></p>
                                            </motion.div>
                                        </li>
                                        <li><a onClick={() => this.onFlowChange(appContext, "design")}>Design</a></li>
                                    </ul>
                                </div>
                                <div className={styles.headerMid}>
                                    <span>THE WALL</span>
                                </div>
                                <div className={styles.headerRight}>
                                    <ul>
                                        <li><a>About</a></li>
                                        <li><a onClick={() => this.context.requestLink()}>
                                            {this.context.metamaskAccount
                                                ? <>
                                                    <div className={styles.jazzicon}>
                                                        <div ref={setJazzicon} />
                                                        <FirebaseContext.Consumer>
                                                            {firebaseContext =>
                                                                firebaseContext.isAuthenticated(this.context.metamaskAccount)
                                                                    ? <div className={styles.checkmark} />
                                                                    : <></>
                                                            }
                                                        </FirebaseContext.Consumer>
                                                    </div>
                                                    Connected
                                                </>
                                                : "Connect Wallet"
                                            }
                                        </a></li>
                                    </ul>
                                </div>
                            </header>
                            <footer className={styles.footer}>
                                {!appContext.isDetailView()
                                    ? <div className={styles.themeToggle}>
                                        <input type="checkbox" id="theme-toggle" checked={appContext.theme == "light"} onChange={(e) => this.onThemeChange(appContext, e.target.checked)} />
                                        <label htmlFor="theme-toggle"></label>
                                    </div>
                                    : <></>
                                }
                                <div className={styles.ui}>
                                    <div className={getControlClasses(appContext)}>
                                        <div className={styles.zoomIn} onClick={() => this.onZoomControlPress(appContext, 1)}>
                                            <a>+</a>
                                        </div>
                                        <div className={styles.zoomOut} onClick={() => this.onZoomControlPress(appContext, -1)}>
                                            <a>-</a>
                                        </div>
                                    </div>
                                </div>
                                <ToastContainer position="bottom-center" />
                                <motion.div initial={this.initialFooterProps} animate={appContext.isDetailView() && appContext.flow == "mint" ? this.targetFooterPropsOpen : this.targetFooterPropsClose} className={styles.canvasFooter}>
                                    {appContext.isDetailView() && appContext.flow == "mint" && !this.context.metamaskAccount
                                        ? this.context.requestLink() && <></>
                                        : <></>
                                    }
                                    <MintFooter
                                        mintSize={appContext.mintSize}
                                        isMinting={appContext.isMinting}
                                        setMintSize={appContext.setMintSize}
                                        setIsMinting={appContext.setIsMinting}
                                    />
                                </motion.div>
                                <motion.div initial={this.initialFooterProps} animate={appContext.isDetailView() && appContext.flow == "buy" ? this.targetFooterPropsOpen : this.targetFooterPropsClose} className={styles.canvasFooter}>
                                    {appContext.isDetailView() && appContext.flow == "buy" && !this.context.metamaskAccount
                                        ? this.context.requestLink() && <></>
                                        : <></>
                                    }
                                    <Web3Context.Consumer>
                                        {web3Context => (
                                            <BuyFooter web3Context={web3Context} />
                                        )}
                                    </Web3Context.Consumer>
                                </motion.div>
                                <motion.div
                                    initial={this.initialFooterProps}
                                    animate={
                                        appContext.isDetailView() && appContext.flow == "design"
                                            ? {
                                                height: 140,
                                                transitionEnd: {
                                                    overflow: "visible",
                                                },
                                            }
                                            : {
                                                scaleY: 0,
                                                overflow: "hidden"
                                            }
                                    }
                                    className={styles.canvasFooter}>
                                    <FirebaseContext.Consumer>
                                        {firebaseContext => {
                                            appContext.isDetailView() && appContext.flow == "design" && !firebaseContext.isAuthenticated(this.context.metamaskAccount)
                                                ? this.context.requestSign((token) => firebaseContext.setToken(token)) && <></>
                                                : <></>
                                        }}
                                    </FirebaseContext.Consumer>
                                    <DesignFooter />
                                </motion.div>
                            </footer>
                        </div>
                        <motion.div
                            className={styles.cursorFloat + " " + getThemeClass(appContext)}
                            style={getCursorStyle(appContext)}
                            animate={{ left: mouseLeft, top: mouseTop }}>
                        </motion.div>
                    </>
                )}
            </AppContext.Consumer>
        </>
        );
    }
}
Home.contextType = Web3Context;
Home.whyDidYouRender = true;

export async function getServerSideProps() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const tileContract = new ethers.Contract(Tile.address, Tile.abi, provider);
    const props = await getCanvasProps(tileContract);
    props.screenSize = { x: 1670, y: 977 };
    props.targetCanvasSize = 977 / 2;
    await checkSize(db, props.canvasSize);
    const { chunks, owners } = await getChunks(db, props.canvasSize);
    props.tileData = chunks;
    props.ownershipData = owners;

    return {
        props: props
    };
}