import { CHUNK_SIZE } from "~/components/canvas1/constants";
import { MAP_CONFIG, Zone, getChunkSlot, mulberry32, zone } from "~/server/map";
import chunkService from "~/services/chunk";
import { Item, Vec2, WorldEntity } from "~/types/worldTypes";
import { base58 } from "./base58";

const ITEMS: Item[] = [
    { id: "123", quality: "RARE", kind: "SWORD", meta: {name: "Sword", description: "description"} },
    { id: "456", quality: "COMMON", kind: "POTION", meta: {name: "Potion", description: "Drink me"} },
    { id: "789", quality: "EPIC", kind: "KEY", meta: {name: "Key", description: "description3"} },
];

const entitiesList: WorldEntity[] = [
    // {
    //     id: "abc",
    //     type: "DOOR",
    //     pos: {
    //         x: 0,
    //         y: 0
    //     },
    //     collision: { solid: true },
    //     interactable: {
    //         selectors: ["[", "]"],
    //         actions: [
    //             {
    //                 type: 'TOGGLE',
    //                 conditions: ["NOT_LOCKED"]
    //             },
    //             {
    //                  type: 'UNLOCK',
    //                  conditions: ["LOCKED", "HAS_ITEM:KEY-123"] ///???
    //             }
    //         ]
    //     }
    // },
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


function buildId(rng: () => number) {
    const decimal = rng();
    const number17 = BigInt(decimal.toString().substring(2).padEnd(17, '0'));
    return base58(number17).padEnd(11, '0'); // NOTE: 0 is not valid base58 but this will keep all ids at 11. Probably not needed but just in case
}

let _items: Array<Item & { prevId: string }>;

function buildItems(zone: Zone) {
    if (_items) return _items;

    const rng = mulberry32(zone.seed);
    _items = ITEMS.map((i) => ({
        ...i,
        id: `${i.kind}-${buildId(rng)}`,
        prevId: i.id,
    }));
    return _items;
}

export const items = buildItems(zone);



function buildEntities(zone: Zone) {
    const rng = mulberry32(zone.seed);
    const itemPrevToIdMap = items.reduce<Record<string, string>>((acc, i) => ({ ...acc, [i.prevId]: i.id }), {});
    // use seeded IDs; replace items with correct seeded ids
    const entities = entitiesList.map((e) => ({
        ...e,
        id: `${e.type}-${buildId(rng)}`,
        container: e.container 
            ? {
                ...e.container,
                itemIds: e.container.itemIds.map((i) => itemPrevToIdMap[i]),
            } : undefined,
    }));

    // find walkable spots
    const CHUNKS = chunkService.getMap(zone, MAP_CONFIG);
    const WALKABLE_MAP_TILES_VEC2_ARRAY = CHUNKS.reduce<Vec2[]>(
        (accum, row, y) => {
            row.forEach((chunk, x) => {
                chunk.tiles.forEach((row, cy) => {
                    row.forEach((tile, cx) => {
                        if (!tile.collision?.solid) {
                            accum.push({
                                x: x * CHUNK_SIZE + cx,
                                y: y * CHUNK_SIZE + cy
                            });
                        }
                    });
                })
            });
            return accum;
        },
        [],
    );

    // randomizing positions
    const entitiesPositioned = entities.map((entity) => {
        const random = Math.floor(rng() * WALKABLE_MAP_TILES_VEC2_ARRAY.length);
        const { x, y } = WALKABLE_MAP_TILES_VEC2_ARRAY[random];
        console.assert(
            !!WALKABLE_MAP_TILES_VEC2_ARRAY[random],
            "error indexing walkable map tiles!",
        );
        // remove that position from available positions to avoid stacked placement
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

    return new Map<string, WorldEntity>(entitiesPositioned.map((o) => [o.id, o]));
}

let _entities: Map<string, WorldEntity>;

function entityFactory(zone: Zone) {
    if (_entities) return _entities;
    _entities = buildEntities(zone);
    return _entities;
}


export const entities = entityFactory(zone);

console.log(
    'entities:: expect positions within world 0-127::',
    Array.from(entities.values()).map(
        (e) => ({ ...e, chunkCoords: getChunkSlot(e.pos!)})
    )
);


// console.log('EXPECT first entity/item IDs to be stable across builds::', JSON.stringify(Array.from(entities.values()), null, 2));
// id: 'TREE-0.6074679309967905'
/**
 *
EXPECT first entity/item IDs to be stable across builds:: {
  id: 'BOX-0.19144689152017236',
  type: 'BOX',
  pos: { x: 5, y: 17 },
  collision: { solid: true },
  liftable: { weight: 8, canCarry: true },
  container: {
    capacity: 10,
    itemIds: [ 'KEY-0.43751312675885856' ],
    behavior: 'PERSIST'
  },
  interactable: { selectors: [ '[', ']' ], actions: [ [Object], [Object] ] }
}
 *
 * */

