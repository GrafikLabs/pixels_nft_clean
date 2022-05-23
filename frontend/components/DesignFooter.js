import styles from '../styles/Footer.module.css'
import React from 'react';
import AppContext from '../context/AppContext';
import FirebaseContext from '../context/FirebaseContext';
import { usersCollection } from '../util/firestore';
import { doc, setDoc } from 'firebase/firestore';
import Wheel from '@uiw/react-color-wheel';
import ShadeSlider from '@uiw/react-color-shade-slider';
import { hexToHsva, hsvaToHex } from '@uiw/color-convert'

export default class DesignFooter extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            wheelVisible: false,
            colorWheelColor: "CCCCCC",
            selectedColor: 6,
        };
    }

    async onLockedModeChanged(firebaseContext, event) {
        const { firestore, user } = firebaseContext;
        const userDocRef = doc(firestore, usersCollection, user.uid);
        const update = {}
        if (event.target.value == "locked") {
            update.locked = true;
        } else if (event.target.value == "unlocked") {
            update.locked = false;
        }
        await setDoc(userDocRef, update, { merge: true });
        const syncOwnersEndpoint = await fetch("api/v1/firebase/syncOwners");
        await syncOwnersEndpoint.json();
    }

    selectColor(colorIndex, color) {
        this.setState((state) => {
            state.selectedColor = colorIndex;
            return state;
        }, () => {
            this.context.setDesignColor(parseInt(color, 16));
        })
    }

    render() {
        const { selectedColor, colorWheelColor, wheelVisible } = this.state;

        const colorChoices = [
            {
                class: [styles.wheel],
                style: {
                    borderColor: `#${colorWheelColor}`
                },
                color: colorWheelColor,
            },
            { style: { background: "#B300C0", borderColor: "#B300C0" } },
            { style: { background: "#E5006A", borderColor: "#E5006A" } },
            { style: { background: "#FF3351", borderColor: "#FF3351" } },
            { style: { background: "#FF8600", borderColor: "#FF8600" } },
            { style: { background: "#FFC940", borderColor: "#FFC940" } },
            { style: { background: "#50C239", borderColor: "#50C239" } },
            { style: { background: "#009BF6", borderColor: "#009BF6" } },
            { style: { background: "#000000", borderColor: "#000000" } },
            {
                class: [styles.white],
                color: "FFFFFF",
            },
        ];

        const cursorColor = '#' + this.context.designColor.toString(16).padStart(6, "0");
        const hsvaColor = hexToHsva(cursorColor);
        return <>
            <div className={[styles.footerDetails, styles.designFooter].join(" ")}>
                <div className={styles.flexFill}>
                    <select
                        value={this.context.highlightType}
                        onChange={(e) => this.context.setHighlightType(e.target.value)}>
                        <option key="highlight_all" value="all">All Tiles</option>
                        <option key="highlight_owned" value="owned">My Tiles</option>
                    </select>
                </div>
                <div className={styles.colorSwatch}>
                    {colorChoices.map((c, i) => {
                        const classes = [styles.colorChoice].concat(...(c.class ?? []));
                        if (i == selectedColor) {
                            classes.push(styles.selected);
                        }
                        return <div
                            key={`colorChoice_${i}`}
                            className={classes.join(" ")}
                            style={c.style}
                            onClick={() => {
                                if (i == 0) {
                                    this.setState((state) => {
                                        state.wheelVisible = !wheelVisible;
                                        return state;
                                    })
                                    return;
                                }

                                const color = colorChoices[i].color ?? colorChoices[i].style.borderColor.substring(1);
                                this.selectColor(i, color);
                            }}>
                            {wheelVisible && i == 0
                                ? <div className={styles.wheelPopup}>
                                    <Wheel color={cursorColor} onChange={(color) => {
                                        const hex = color.hex.substring(1);
                                        this.setState((state) => {
                                            state.selectedColor = 0;
                                            state.colorWheelColor = hex;
                                            return state;
                                        }, () => this.selectColor(0, hex));
                                    }}></Wheel>
                                    <ShadeSlider hsva={hsvaColor} onChange={(newShade) => {
                                        const hex = hsvaToHex({ ...hsvaColor, ...{ v: newShade.v } }).substring(1);
                                        this.setState((state) => {
                                            state.selectedColor = 0;
                                            state.colorWheelColor = hex;
                                            return state;
                                        }, () => this.selectColor(0, hex));
                                    }}></ShadeSlider>
                                </div>
                                : <></>
                            }
                        </div>;
                    })}
                </div>
                <div className={styles.flexFill} style={{ textAlign: "right" }}>
                    {this.context.highlightType == "owned"
                        ? <FirebaseContext.Consumer>
                            {firebaseContext => (
                                <select
                                    value={firebaseContext.userDoc?.locked ? "locked" : "unlocked"}
                                    disabled={!firebaseContext.userDoc}
                                    onChange={this.onLockedModeChanged.bind(this, firebaseContext)}>
                                    <option key="edit_locked" value="locked">Only I can edit</option>
                                    <option key="edit_unlocked" value="unlocked">Anyone can edit</option>
                                </select>
                            )}
                        </FirebaseContext.Consumer>
                        : <></>}
                </div>
            </div >
        </>
    }
}
DesignFooter.contextType = AppContext;