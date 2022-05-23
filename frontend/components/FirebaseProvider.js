import React from 'react';
import { firebaseConfig } from '../util/network.config';
import FirebaseContext from '../context/FirebaseContext';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { initializeFirestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, onSnapshot, doc } from "firebase/firestore";
import EventfulProvider from './EventfulProvider';
import { usersCollection } from '../util/firestore';

export default class FirebaseProvider extends EventfulProvider {
    constructor(props) {
        super(props);

        this.state = Object.assign(this.state, {
            user: undefined,
            userDoc: undefined,
            firestore: undefined,
            setToken: this.setToken.bind(this),
            isAuthenticated: this.isAuthenticated.bind(this)
        });
    }

    async setToken(token) {
        const auth = getAuth();
        signInWithCustomToken(auth, token).then((credentials) => {
            this.setState((state) => {
                state.user = credentials.user;
                return state;
            });
        })
    }

    isAuthenticated(wallet) {
        return getAuth().currentUser && getAuth().currentUser.uid == wallet;
    }

    async componentDidMount() {
        const app = initializeApp(firebaseConfig);
        const db = initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });

        onAuthStateChanged(getAuth(), (user) => {
            if (!user) {
                return;
            }

            this.setState((state) => {
                state.user = user;
                return state;
            }, () => {
                if (this.state.unsubscribeSnapshotListener) {
                    this.state.unsubscribeSnapshotListener();
                }
                const snapshotListener = onSnapshot(doc(this.state.firestore, usersCollection, user.uid), (doc) => {
                    this.setState((state) => {
                        state.userDoc = doc.data();
                        state.unsubscribeSnapshotListener = snapshotListener;
                        return state;
                    })
                });
            });
        });
        this.setState((state) => {
            state.firestore = db;
            return state;
        }, async () => {
            await this.triggerEvent("ready");
        });
    }

    render() {
        const { children } = this.props;
        return <FirebaseContext.Provider value={this.state}>
            {children}
        </FirebaseContext.Provider>;
    }
}