import { ItemQuality, MapDimensions, TileType, WorldEntity } from "~/types/worldTypes";

const TILE_SIZE = 32;
const MAP_WIDTH = 32;
const MAP_HEIGHT = 32;
const SCALE_DEFAULT = 1;
export const getScaledTileSize = (scaleDecimal: number) => {
    const tileSize = Math.round(TILE_SIZE * scaleDecimal);
    const actualScale = tileSize / TILE_SIZE;

    return { tileSize, actualScale };
}
export const CHUNK_SIZE = MAP_WIDTH;

export const DIMENSIONS: MapDimensions = {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileSize: TILE_SIZE,
    canvasWidth: MAP_WIDTH * TILE_SIZE,
    canvasHeight: MAP_HEIGHT * TILE_SIZE,
    scale: SCALE_DEFAULT,
}

export const TILE_COLOR_MAP: Record<TileType, string> = {
    grass: "#4CAF50",
    water: "#2196F3",
    dirt: "#795548",
    cliff: "#9E9E9E",
};

export const OBJECT_COLOR_MAP: Record<WorldEntity["type"], string> = {
    ITEM_ENTITY: "#CCCCCC",
    TREE: "#2E7D32",
    BOX: "#8D6E63",
    CHEST: "#FFD700",
    STONE: "#BDBDBD",
    CLIFF: "#616161",
    PLAYER: '',
    NPC: '',
};
export const ITEM_COLOR_MAP: Record<ItemQuality, string> = {
    common: "#777777",
    uncommon: "#2E7D32",
    rare: "#2131ee",
    epic: "#aD3Eff",
    legendary: "#dda700",
};

export const HOT_PINK = "#ff69b4";

export enum ClientPhysicsMode {
  FULL_PREDICTION, // (default) collision checks on client, movement predictions before ACK (turn on collision and prediction)
  VISUAL_ONLY, // turn off collision checks on client, keep only movement predictions; use server to validate and correct (turn off collision, turn on prediction)
  NONE, // server-controlled, wait for ACK before rendering anything (turn off collision and prediction)
};

export const clientPhysicsMode: ClientPhysicsMode = ClientPhysicsMode.VISUAL_ONLY;

export const API_PORT = import.meta.env.PROD 
    ? 3000 
    : import.meta.env.DEV 
        ? 5173 
        : 4173;


