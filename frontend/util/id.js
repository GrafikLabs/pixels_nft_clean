import { chunkSize } from "./firestore";

const zeroPad = (num, places) => String(num).padStart(places, '0');

function xyFromId(tileId) {
    const layer = Math.floor(Math.sqrt(tileId) / 2);
    const current = (layer * 2) ** 2;
    const next = ((layer + 1) * 2) ** 2;
    const layerId = tileId - current;
    const sideSize = (next - current) / 4;
    if (layer == 0) {
        switch (tileId) {
            case 0:
                return { x: 0, y: 0, layer: 0, layerId: 0 };
            case 1:
                return { x: 1, y: 0, layer: 0, layerId: 1 };
            case 2:
                return { x: 1, y: -1, layer: 0, layerId: 2 };
            case 3:
                return { x: 0, y: -1, layer: 0, layerId: 3 };
        }
    }
    if (layerId < sideSize) {
        const offset = layerId;
        return { x: -layer, y: -layer + offset, layer: layer, layerId: layerId };
    } else if (layerId < sideSize * 2) {
        const offset = layerId - sideSize;
        return { x: -layer + offset + 1, y: layer, layer: layer, layerId: layerId };
    } else if (layerId < sideSize * 3) {
        const offset = layerId - sideSize * 2;
        return { x: layer + 1, y: layer - offset - 1, layer: layer, layerId: layerId };
    }

    const offset = layerId - sideSize * 3;
    return { x: layer - offset, y: - layer - 1, layer: layer, layerId: layerId };
}

function idFromXY({ x, y }) {
    const { layer, layerId } = layerDataFromXY({ x, y });
    const base = ((layer) * 2) ** 2;
    return base + layerId;
}

function layerDataFromXY({ x, y }) {
    if (x == 0 & y == 0) {
        return { layer: 0, layerId: 0 };
    }
    if (x == 1 & y == 0) {
        return { layer: 0, layerId: 1 };
    }
    if (x == 1 & y == -1) {
        return { layer: 0, layerId: 2 };
    }
    if (x == 0 & y == -1) {
        return { layer: 0, layerId: 3 };
    }

    const absX = Math.abs(x), absY = Math.abs(y);
    let layer, layerId;
    if (absX > absY || (absX == absY && x < 0)) {
        if (x > 0) {
            layer = x - 1;
            layerId = (layer * 4 + 1) + absX - y - 1;
        } else {
            layer = absX;
            layerId = y - x;
        }
    } else {
        if (y > 0) {
            layer = y;
            layerId = (layer * 2) + absY + x;
        } else {
            layer = absY - 1;
            layerId = (layer * 6 + 1) - x - y + 1;
        }
    }

    return { layer, layerId };
}

function localFromXY({ x, y }) {
    const chunkX = Math.floor((x - 1) / chunkSize) + 1;
    const chunkY = Math.floor(y / chunkSize);
    return { chunkX, x: (((x - 1) % chunkSize) + chunkSize) % chunkSize, chunkY, y: ((y % chunkSize) + chunkSize) % chunkSize };
}

function xyFromLocal({ chunkX, x, chunkY, y }) {
    const point = { x: (chunkX - 1) * chunkSize + x + 1, y: chunkY * chunkSize + y };
    return Object.assign(point, layerDataFromXY(point));
}

function compareId(left, right) {
    if (!left.layer) {
        left = Object.assign(left, layerDataFromXY(left));
    }

    if (!right.layer) {
        right = Object.assign(right, layerDataFromXY(right));
    }

    if (left.layer < right.layer) {
        return -1;
    }
    if (left.layer > right.layer) {
        return 1;
    }

    if (left.layerId < right.layerId) {
        return -1;
    }
    if (left.layerId > right.layerId) {
        return 1;
    }

    return 0;
}

function getPatchLayers({ x, y, maxX, maxY }) {
    const up = layerDataFromXY({ x: 0, y: maxY });
    const down = layerDataFromXY({ x: 0, y });
    const left = layerDataFromXY({ x, y: 0 });
    const right = layerDataFromXY({ x: maxX, y: 0 });

    if (x * maxX < 0) {
        // Spans x = 0
        if (y * maxY <= 0) {
            // Contains (0,0)
            return { minLayer: 0, maxLayer: Math.max(up.layer, down.layer, left.layer, right.layer) };
        }

        return { minLayer: Math.min(up.layer, down.layer), maxLayer: Math.max(up.layer, down.layer) };
    } else if (y * maxY <= 0) {
        // Spans y = 0
        return { minLayer: Math.min(left.layer, right.layer), maxLayer: Math.max(left.layer, right.layer) };
    }
    const lowerLeft = layerDataFromXY({ x, y });
    const lowerRight = layerDataFromXY({ maxX, y });
    const upperLeft = layerDataFromXY({ x, maxY });
    const upperRight = layerDataFromXY({ maxX, maxY });

    if (x < 0 && y < 0) {
        return { minLayer: upperRight.layer, maxLayer: lowerLeft.layer };
    } else if (x < 0 && y > 0) {
        return { minLayer: lowerRight.layer, maxLayer: upperLeft.layer };
    } else if (x > 0 && y > 0) {
        return { minLayer: lowerLeft.layer, maxLayer: upperRight.layer };
    }

    return { minLayer: upperLeft.layer, maxLayer: lowerRight.layer };
}

export { xyFromId, idFromXY, layerDataFromXY, zeroPad, localFromXY, xyFromLocal, compareId, getPatchLayers };