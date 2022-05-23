import React from 'react';

export default class EventfulProvider extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            addEventListener: this.addEventListener.bind(this),
            removeEventListener: this.removeEventListener.bind(this),
        };

        this.eventListeners = {};
    }

    addEventListener(event, callback) {
        if (this.state.isReady && event == 'ready') {
            callback();
        }

        this.eventListeners[event] = this.eventListeners[event] || [];
        this.eventListeners[event].push(callback);
    }

    removeEventListener(event, callback) {
        for (let i = 0; i < this.eventListeners[event]?.length; i++) {
            if (this.eventListeners[event][i] == callback) {
                this.eventListeners[event].splice(i, 1);
                return;
            }
        }
    }

    async triggerEvent(event, ...args) {
        for (const callback of this.eventListeners[event]) {
            await callback(...args);
        }
    }
}