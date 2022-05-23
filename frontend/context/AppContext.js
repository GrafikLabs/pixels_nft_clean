import React from 'react';

const AppContext = React.createContext({
    mintSize: undefined,
    tileSize: undefined,
    canvasSize: undefined,
    flow: undefined,
    theme: undefined,
    setMintSize: undefined,
    setTileSize: undefined,
    setCanvasSize: undefined,
    setFlow: undefined,
    setTheme: undefined,
    isDetailView: undefined,
});
export default AppContext;