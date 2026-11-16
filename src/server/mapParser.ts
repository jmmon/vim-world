import { TileType, WorldEntity } from "~/types/worldTypes";
import type { HandAuthoredZone, AuthoredEntity } from "~/server/map";

/**
 * Parser for the Phase 0 intro map ASCII source (`INTRO_MAP`).
 *
 * The source is a compact, hand-editable grid plus a `defs` object of
 * hand-placed entities, all in world coordinates. This module turns it into the
 * `HandAuthoredZone` shape the engine already expects (procedural forest base +
 * forced-tile overlay + entities) so nothing downstream changes.
 *
 * `source` is passed in (rather than imported from `map.ts`) so this module has
 * no runtime dependency on `map.ts` — keeping the import graph acyclic.
 *
 * See docs/agents/map-ascii-plan.md for the full model.
 */

// tile character → TileType. Space (and any unknown char) means "leave to the
// seed-dependent procedural base".
const TILE_CHARS: Record<string, TileType> = {
    ".": "GRASS",
    "~": "WATER",
    ",": "DIRT",
    "#": "CLIFF",
};

/** a hand-placed entity def from the ASCII source. */
interface Def {
    id: string;
    type: string;
    key?: string;
    link?: string | string[];
    collision?: WorldEntity["collision"];
    container?: WorldEntity["container"];
    interactable?: WorldEntity["interactable"];
    lock?: WorldEntity["lock"];
    state?: WorldEntity["state"];
    dir?: WorldEntity["dir"];
}

/** the ASCII intro map source, authored in `map.ts`. */
export interface IntroMapSource {
    origin: number[];
    seed: number;
    baseRuleset: "forest-v1" | "dungeon-v1";
    grid: string[];
    defs: Record<string, Def>;
    zones: Array<{
        id: string;
        xRange: [number, number];
        verb: string;
        solved?: { takeKey: string } | { openDoor: string };
    }>;
}

/**
 * Expand the compact ASCII grid into a full grid in world coordinates. ASCII
 * cell `(row r, col c)` maps to world `(origin.x + c, origin.y + r)`; every
 * uncovered cell stays undefined so it falls through to the procedural base.
 */
function parseGrid(source: IntroMapSource): {
    grid: Array<Array<TileType | undefined>>;
    ox: number;
    oy: number;
    rows: number;
    cols: number;
} {
    const { grid: rows, origin } = source;
    const [ox, oy] = origin;
    const out: Array<Array<TileType | undefined>> = Array.from(
        { length: rows.length },
        () => Array.from({ length: Math.max(...rows.map((r) => r.length)) }, (): TileType | undefined => undefined),
    );
    rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            const type = TILE_CHARS[row[c]];
            if (!type) continue; // space / unknown → leave to procedural base
            out[r][c] = type;
        }
    });
    return { grid: out, ox, oy, rows: rows.length, cols: out[0].length };
}

/**
 * Build the parsed entities from `defs`.
 *   1. place every entity at its world position (from its `defs` key),
 *   2. wire each KEYHOLE to its DOOR via the shared `link` id — set
 *      `keyhole.doorId` and append the keyhole to `door.requiredKeyholeIds`.
 *
 * The chest's `container.itemIds` is left untouched here: it carries the item's
 * legacy prevId (`"789"`), which `objects.ts`'s `resolveContainer` maps to the
 * concrete generated key id. One resolution path, no key id needed here.
 */
function parseEntities(defs: Record<string, Def>): AuthoredEntity[] {
    const entities: AuthoredEntity[] = [];
    const byLink = new Map<string, AuthoredEntity[]>();

    for (const coord of Object.keys(defs)) {
        const d = defs[coord];
        const [x, y] = coord.split(",").map(Number);
        const entity = { ...d, x, y } as AuthoredEntity;
        entities.push(entity);
        const rawLink = d.link;
        const links = rawLink ? (Array.isArray(rawLink) ? rawLink : [rawLink]) : [];
        for (const link of links) {
            const group = byLink.get(link) ?? [];
            group.push(entity);
            byLink.set(link, group);
        }
    }

    for (const entity of entities) {
        if (entity.type !== "KEYHOLE" || !("link" in entity)) continue;
        const group = byLink.get(String((entity as Def).link)) ?? [];
        const door = group.find((e) => e.type === "DOOR");
        if (!door) continue;
        entity.lock = { ...entity.lock, doorId: door.id! };
        door.lock = {
            ...door.lock,
            requiredKeyholeIds: [
                ...(door.lock?.requiredKeyholeIds ?? []),
                entity.id!,
            ],
        };
    }

    return entities;
}

/** parse the ASCII source into the `HandAuthoredZone` shape the engine expects. */
export function parseIntroMap(source: IntroMapSource): HandAuthoredZone {
    const { grid, ox, oy } = parseGrid(source);
    const entities = parseEntities(source.defs);
    return {
        seed: source.seed,
        ruleset: "hand-authored",
        origin: [ox, oy],
        baseRuleset: source.baseRuleset,
        grid,
        entities,
    };
}
