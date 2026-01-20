import { MapObject, TileType } from "./types";


const MAP_WIDTH = 36;
const MAP_HEIGHT = 36;
const TILE_SIZE = 32;
export const DIMENSIONS = {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileSize: TILE_SIZE,
    canvasWidth: MAP_WIDTH * TILE_SIZE,
    canvasHeight: MAP_HEIGHT * TILE_SIZE,
}

export const TILE_COLOR_MAP: Record<TileType, string> = {
    grass: "#4CAF50",
    water: "#2196F3",
    dirt: "#795548",
    cliff: "#9E9E9E",
};

export const OBJECT_COLOR_MAP: Record<MapObject["type"], string> = {
    tree: "#2E7D32",
    box: "#8D6E63",
    chest: "#FFD700",
    stone: "#BDBDBD",
    cliff: "#616161",
};


export const getRandomHexColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    const LIMIT = 4;
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * (16 - LIMIT)) + LIMIT];
    }
    return color;
};
export const HOT_PINK = "#ff69b4";
