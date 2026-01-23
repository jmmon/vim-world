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

export const HOT_PINK = "#ff69b4";

export enum ClientPhysicsMode {
  FULL_PREDICTION, // (default) collision checks on client, movement predictions before ACK (turn on collision and prediction)
  VISUAL_ONLY, // turn off collision checks on client, keep only movement predictions; use server to validate and correct (turn off collision, turn on prediction)
  NONE, // server-controlled, wait for ACK before rendering anything (turn off collision and prediction)
};

export const clientPhysicsMode: ClientPhysicsMode = ClientPhysicsMode.NONE;

export const API_PORT = import.meta.env.PROD 

    ? 3000 
    : import.meta.env.DEV 
        ? 5173 
        : 4173;

