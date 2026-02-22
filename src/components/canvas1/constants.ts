import { ItemQualityId, TileType, WorldEntity } from "~/types/worldTypes";

export const TILE_COLOR_MAP: Record<TileType, string> = {
    GRASS: "#4CAF50",
    WATER: "#2196F3",
    DIRT: "#795548",
    CLIFF: "#9E9E9E",
};

export const OBJECT_COLOR_MAP: Record<WorldEntity["type"], string> = {
    ITEM_ENTITY: "#CCCCCC",
    TREE: "#2E7D32",
    BOX: "#8D6E63",
    DOOR: "#7D4E53",
    CHEST: "#FFD700",
    STONE: "#BDBDBD",
    CLIFF: "#616161",
    // PLAYER: '',
    // NPC: '',
};
export const ITEM_COLOR_MAP: Record<ItemQualityId, string> = {
    COMMON: "#777777",
    UNCOMMON: "#2E7D32",
    RARE: "#2131ee",
    EPIC: "#aD3Eff",
    LEGENDARY: "#dda700",
};

export const HOT_PINK = "#ff69b4";

