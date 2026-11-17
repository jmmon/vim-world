import { describe, expect, test } from "vitest";
import interact from "./interact";
import { EntityWorld } from "./door";
import { Player, WorldEntity } from "~/types/worldTypes";
import { ITEMS_WITH_IDS } from "~/server/objects";
import { ValidateYankValid, ValidateInteractValid } from "~/simulation/server/types";

// proves the yank/paste actions report the entities that changed so the server
// can broadcast a narrow world sync. matters most in physics modes WITHOUT
// prediction (client default NONE): the client never applies `yi"` locally, so
// the ONLY thing that empties a chest / fills a container / drops a carried
// object is this broadcast. without it, the drawn ellipse lingers forever.

// the real generated key id — isKeyId() only trusts this, so a paste that
// unlocks a door must carry it
const KEY_ID = ITEMS_WITH_IDS.find((i) => i.kind === "KEY")!.id;

function container(id: string, itemIds: string[]): WorldEntity {
    return {
        id,
        type: "CHEST",
        pos: { x: 12, y: 8 },
        collision: { solid: true },
        container: { capacity: 1, itemIds, behavior: "PERSIST" },
        interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
    };
}

function yankResult(obj: WorldEntity): ValidateYankValid {
    return {
        ok: true,
        reason: undefined,
        obj,
        pos: { x: obj.pos!.x, y: obj.pos!.y },
    } as ValidateYankValid;
}

function pasteResult(obj: WorldEntity): ValidateInteractValid {
    return {
        ok: true,
        reason: undefined,
        obj,
        pos: { x: obj.pos!.x, y: obj.pos!.y },
    } as ValidateInteractValid;
}

function ctx(...entities: WorldEntity[]): EntityWorld {
    return { world: { entities: new Map(entities.map((e) => [e.id, e])) } };
}

const player = { pos: { x: 12, y: 8 } } as Player;

describe("interact.y — reports container changes for broadcast", () => {
    test("yi\" empties the container and returns the object to broadcast", () => {
        const chest = container("CHEST-1", [KEY_ID]);
        const changed = interact.y(
            ctx(chest),
            player,
            { type: "MOVE", command: "yi" } as never,
            yankResult(chest),
        );

        // item left the chest
        expect(chest.container!.itemIds).toEqual([]);
        // the object is returned so the server broadcasts it; the client merges
        // the emptied container (via onWorldState) and the ellipse disappears —
        // regardless of prediction mode
        expect(changed.map((e) => e.id)).toEqual(["CHEST-1"]);
    });

    test("yi\" with an empty container is a no-op and broadcasts nothing", () => {
        const chest = container("CHEST-1", []);
        const changed = interact.y(
            ctx(chest),
            player,
            { type: "MOVE", command: "yi" } as never,
            yankResult(chest),
        );

        expect(chest.container!.itemIds).toEqual([]);
        expect(changed).toEqual([]);
    });

    test("ya\" on a liftable object returns it (now off the board)", () => {
        const box = {
            id: "BOX-1",
            type: "BOX",
            pos: { x: 12, y: 8 },
            collision: { solid: true },
            liftable: { weight: 8, canCarry: true },
            container: { capacity: 1, itemIds: [], behavior: "PERSIST" },
        } as WorldEntity;
        const changed = interact.y(
            ctx(box),
            player,
            { type: "MOVE", command: "ya" } as never,
            yankResult(box),
        );

        expect(box.pos).toBeUndefined(); // lifted off the board
        expect(player.carryingObjId).toBe("BOX-1");
        expect(changed.map((e) => e.id)).toEqual(["BOX-1"]);
    });

    test("ya\" on a non-liftable object broadcasts nothing", () => {
        const chest = container("CHEST-1", [KEY_ID]);
        const changed = interact.y(
            ctx(chest),
            player,
            { type: "MOVE", command: "ya" } as never,
            yankResult(chest),
        );

        expect(changed).toEqual([]);
        expect(chest.pos).toBeDefined(); // not lifted
    });
});

describe("interact.p — reports container changes for broadcast", () => {
    test("vi\" into a plain container returns the container to broadcast", () => {
        const chest = container("CHEST-1", []);
        const p = { ...player, itemIds: [KEY_ID] } as Player;
        const changed = interact.p(
            ctx(chest),
            p,
            { type: "MOVE", command: "vi" } as never,
            pasteResult(chest),
        );

        expect(chest.container!.itemIds).toEqual([KEY_ID]); // item landed
        expect(changed.map((e) => e.id)).toEqual(["CHEST-1"]);
    });

    test("vi\" into a keyhole returns the keyhole AND the opened door (deduped)", () => {
        const keyhole = {
            id: "KEYHOLE-1",
            type: "KEYHOLE",
            pos: { x: 17, y: 5 },
            collision: { solid: true },
            container: { capacity: 1, itemIds: [], behavior: "PERSIST" },
            lock: { doorId: "DOOR-1", used: false },
        } as WorldEntity;
        const door = {
            id: "DOOR-1",
            type: "DOOR",
            pos: { x: 31, y: 8 },
            collision: { solid: true },
            state: { kind: "DOOR", open: false, locked: true },
            lock: { requiredKeyholeIds: ["KEYHOLE-1"] },
        } as WorldEntity;
        const p = { ...player, itemIds: [KEY_ID] } as Player;
        const changed = interact.p(
            ctx(keyhole, door),
            p,
            { type: "MOVE", command: "vi" } as never,
            pasteResult(keyhole),
        );

        // key consumed, keyhole emptied, door opened
        expect(keyhole.container!.itemIds).toEqual([]);
        expect(keyhole.lock!.used).toBe(true);
        expect(door.collision).toEqual({ solid: false });
        // the keyhole appears once (returned both as the changed container and
        // via the unlock) and the door too
        expect(changed.map((e) => e.id).sort()).toEqual(["DOOR-1", "KEYHOLE-1"]);
    });
});
