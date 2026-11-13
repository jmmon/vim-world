import { describe, expect, test } from "vitest";
import { maybeUnlockKeyhole, EntityWorld } from "./door";
import { WorldEntity, Player } from "~/types/worldTypes";
import { ITEMS_WITH_IDS } from "~/server/objects";

// proves the lock resolution that turns "paste key into keyhole" into "door
// opens": consume the key, mark the keyhole used, release the door collision.
// same function runs on client (prediction) and server (authoritative), so it
// must be pure state mutation with no I/O.

const KEY_ID = ITEMS_WITH_IDS.find((i) => i.kind === "KEY")!.id;
const NON_KEY_ID = ITEMS_WITH_IDS.find((i) => i.kind !== "KEY")!.id;

function makeKeyhole(id: string, doorId: string, itemIds: string[]): WorldEntity {
    return {
        id,
        type: "KEYHOLE",
        pos: { x: 20, y: 8 },
        collision: { solid: true },
        container: { capacity: 1, itemIds, behavior: "PERSIST" },
        lock: { doorId, used: false },
    };
}

function makeDoor(id: string, requiredKeyholeIds: string[]): WorldEntity {
    return {
        id,
        type: "DOOR",
        pos: { x: 26, y: 10 },
        collision: { solid: true },
        state: { kind: "DOOR", open: false, locked: true },
        lock: { requiredKeyholeIds },
    };
}

function wrapper(...entities: WorldEntity[]): EntityWorld {
    return { world: { entities: new Map(entities.map((e) => [e.id, e])) } };
}

describe("maybeUnlockKeyhole", () => {
    test("opens the linked door when a key is pasted into its keyhole", () => {
        const keyhole = makeKeyhole("KEYHOLE-1", "DOOR-1", [KEY_ID]);
        const door = makeDoor("DOOR-1", ["KEYHOLE-1"]);
        const ctx = wrapper(keyhole, door);
        const player = {} as Player;

        const changed = maybeUnlockKeyhole(ctx, player, keyhole);

        // key consumed (commitment)
        expect(keyhole.container!.itemIds).toEqual([]);
        expect(keyhole.lock!.used).toBe(true);
        // door opened + collision released so movement is no longer gated
        expect(door.collision).toEqual({ solid: false });
        expect(door.state).toEqual({ kind: "DOOR", open: true, locked: false });
        // returns the entities that changed for a narrow broadcast
        expect(changed.map((e) => e.id).sort()).toEqual(["DOOR-1", "KEYHOLE-1"]);
    });

    test("ignores a non-key item placed in the keyhole", () => {
        const keyhole = makeKeyhole("KEYHOLE-1", "DOOR-1", [NON_KEY_ID]);
        const door = makeDoor("DOOR-1", ["KEYHOLE-1"]);
        const ctx = wrapper(keyhole, door);

        const changed = maybeUnlockKeyhole(ctx, {} as Player, keyhole);

        expect(keyhole.container!.itemIds).toEqual([NON_KEY_ID]); // untouched
        expect(keyhole.lock!.used).toBe(false);
        expect(door.collision).toEqual({ solid: true }); // still blocked
        expect(changed).toEqual([]);
    });

    test("empties the keyhole even when no door is linked", () => {
        const keyhole = makeKeyhole("KEYHOLE-X", "DOOR-MISSING", [KEY_ID]);
        const ctx = wrapper(keyhole);

        const changed = maybeUnlockKeyhole(ctx, {} as Player, keyhole);

        expect(keyhole.container!.itemIds).toEqual([]);
        expect(keyhole.lock!.used).toBe(true);
        expect(changed).toEqual([keyhole]); // just the keyhole, no door
    });

    test("is idempotent: a second paste into an already-used keyhole is a no-op", () => {
        const keyhole = makeKeyhole("KEYHOLE-1", "DOOR-1", []); // already emptied
        const door = makeDoor("DOOR-1", ["KEYHOLE-1"]);
        door.collision = { solid: false };
        door.state = { kind: "DOOR", open: true, locked: false };
        keyhole.lock!.used = true;
        const ctx = wrapper(keyhole, door);

        const changed = maybeUnlockKeyhole(ctx, {} as Player, keyhole);

        expect(changed).toEqual([]);
    });

    test("opens the door only when every linked keyhole has been used", () => {
        const khA = makeKeyhole("KH-A", "DOOR-1", [KEY_ID]);
        const khB = makeKeyhole("KH-B", "DOOR-1", []);
        khB.lock!.used = true; // already used
        const door = makeDoor("DOOR-1", ["KH-A", "KH-B"]);
        const ctx = wrapper(khA, khB, door);

        const changed = maybeUnlockKeyhole(ctx, {} as Player, khA);

        expect(door.collision).toEqual({ solid: false }); // second keyhole finished it
        expect(changed.map((e) => e.id)).toContain("DOOR-1");
    });

    test("does NOT open the door while a required keyhole is still unused", () => {
        const khA = makeKeyhole("KH-A", "DOOR-1", [KEY_ID]);
        const khB = makeKeyhole("KH-B", "DOOR-1", []); // never used
        const door = makeDoor("DOOR-1", ["KH-A", "KH-B"]);
        const ctx = wrapper(khA, khB, door);

        const changed = maybeUnlockKeyhole(ctx, {} as Player, khA);

        expect(door.collision).toEqual({ solid: true }); // still locked
        expect(changed.map((e) => e.id)).toEqual(["KH-A"]); // keyhole used, door not
    });
});
