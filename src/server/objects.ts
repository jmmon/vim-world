import { MAP } from "~/server/map";
import { Item, Vec2, WorldEntity, TileType } from "~/types/worldTypes";

export const items: Item[] = [
    { id: "123", quality: "rare", kind: "SWORD", meta: {name: "Sword", description: "description"} },
    { id: "456", quality: "common", kind: "POTION", meta: {name: "Potion", description: "Drink me"} },
    { id: "789", quality: "epic", kind: "KEY", meta: {name: "Key", description: "description3"} },
];

const entitiesList: WorldEntity[] = [
    {
        id: "abc",
        type: "TREE",
        pos: {
            x: 0,
            y: 0
        },
        collision: { solid: true },
    },

    {
        id: "def",
        type: "BOX",
        pos: {
            x: 0,
            y: 0
        },
        collision: { solid: true },
        liftable: {
            weight: 8,
            canCarry: true,
        },
        container: {
            capacity: 10,
            itemIds: ["789"],
            behavior: "PERSIST",
        },
        interactable: {
            selectors: ["[", "]"],
            actions: [
                { type: "OPEN" },
                { type: "PICK_UP"},
            ],
        },
    },

    {
        id: "ghi",
        type: "CHEST",
        pos: {
            x: 0,
            y: 0
        },
        collision: { solid: true },
        liftable: {
            weight: 8,
            canCarry: true,
        },
        container: {
            capacity: 10,
            itemIds: ["123"],
            behavior: "PERSIST"
        },
        interactable: {
            selectors: ["[", "]"],
            actions: [
                { type: "OPEN" },
                { type: "PICK_UP" },
            ]
        },
    },

    {
        id: "jkl",
        type: "ITEM_ENTITY",
        pos: {
            x: 0,
            y: 0
        },
        collision: { solid: false },
        liftable: {
            weight: 1,
            canCarry: true,
        },
        container: {
            capacity: 1,
            itemIds: ["456"],
            behavior: "PERSIST"
        },
        interactable: {
            selectors: ["[", "]"],
            actions: [
                { type: "OPEN" },
                { type: "PICK_UP" }
            ]
        },

    },
];

export const WALKABLE: TileType[] = ["grass", "dirt"];
// const WALKABLE_MAP_TILES = map.
// want to get a list of all coordinates that are walkable:
const WALKABLE_MAP_TILES_VEC2_ARRAY = MAP.reduce<Vec2[]>(
    (accum, row, y) => {
        row.forEach((tile, x) => {
            if (WALKABLE.includes(tile)) {
                accum.push({ x, y });
            }
        });
        return accum;
    },
    [],
);

// randomizing positions
const objects = entitiesList.map((entity) => {
    const random = Math.floor(Math.random() * WALKABLE_MAP_TILES_VEC2_ARRAY.length);
    const { x, y } = WALKABLE_MAP_TILES_VEC2_ARRAY[random];
    console.assert(
        !!WALKABLE_MAP_TILES_VEC2_ARRAY[random],
        "error indexing walkable map tiles!",
    );
    WALKABLE_MAP_TILES_VEC2_ARRAY.splice(random, 1);
    const positionedEntity = {
        ...entity,
        pos: {
            x,
            y,
        },
    };
    return positionedEntity;
});

export const entities = new Map<string, WorldEntity>(objects.map((o) => [o.id, o]));


