import { describe, expect, test } from "vitest";
import { parseIntroMap, type IntroMapSource } from "~/server/mapParser";
import { isKeyId } from "~/simulation/shared/actions/door";
import { ITEMS_WITH_IDS } from "~/server/objects";

// Proves the hand-authored entity pipeline (`parseIntroMap`) places the
// door/keyhole/key/chest at FIXED world positions (designed, not random) with
// stable IDs, and wires the keyhole to its door by `lock.doorId` so the link
// survives serialization to the client and back.
//
// Tested against a self-contained source rather than the live intro map so it
// stays valid as the map is rebuilt room-by-room. The chest/keyhole/door return
// in Rooms 3–4, but the wiring contract is locked here.
const source: IntroMapSource = {
    origin: [0, 0],
    seed: 12345678,
    baseRuleset: "forest-v1",
    grid: [" "],
    defs: {
        "12,8": {
            id: "CHEST-KEY",
            type: "CHEST",
            collision: { solid: true },
            container: { capacity: 1, itemIds: ["789"], behavior: "PERSIST" },
            interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
        },
        "17,5": {
            id: "KEYHOLE-1",
            type: "KEYHOLE",
            link: "a",
            collision: { solid: true },
            container: { capacity: 1, itemIds: [], behavior: "PERSIST" },
            interactable: { selectors: ['"'], actions: [{ type: "PICK_UP" }] },
        },
        "31,8": {
            id: "DOOR-1",
            type: "DOOR",
            link: "a",
            collision: { solid: true },
            state: { kind: "DOOR", open: false, locked: true },
        },
    },
    zones: [],
};

const entities = parseIntroMap(source).entities ?? [];
const byId = (id: string) => entities.find((e) => e.id === id)!;

describe("hand-authored entities — fixed placement", () => {
    test("places the three authored entities at their authored positions", () => {
        expect({ x: byId("CHEST-KEY").x, y: byId("CHEST-KEY").y }).toEqual({ x: 12, y: 8 });
        expect({ x: byId("KEYHOLE-1").x, y: byId("KEYHOLE-1").y }).toEqual({ x: 17, y: 5 });
        expect({ x: byId("DOOR-1").x, y: byId("DOOR-1").y }).toEqual({ x: 31, y: 8 });
    });

    test("keyhole links to its door by id (both directions of the link)", () => {
        const keyhole = byId("KEYHOLE-1");
        const door = byId("DOOR-1");
        expect(keyhole.lock?.doorId).toBe("DOOR-1");
        expect(door.lock?.requiredKeyholeIds).toContain("KEYHOLE-1");
    });

    test("door starts solid + locked; keyhole starts with an empty slot", () => {
        expect(byId("DOOR-1").collision).toEqual({ solid: true });
        expect(byId("DOOR-1").state).toEqual({ kind: "DOOR", open: false, locked: true });
        expect(byId("KEYHOLE-1").container?.itemIds).toEqual([]);
    });

    test("chest carries the key item (by its authored prevId)", () => {
        const key = ITEMS_WITH_IDS.find((i) => isKeyId(i.id))!;
        // parseIntroMap preserves the authored container verbatim; objects.ts
        // maps this prevId to the generated key id at build time.
        expect(byId("CHEST-KEY").container?.itemIds).toContain(key.prevId);
    });

    test("ids are stable across repeated parses (link survives serialization)", () => {
        expect(byId("DOOR-1").id).toBe("DOOR-1");
        expect(byId("KEYHOLE-1").id).toBe("KEYHOLE-1");
        expect(byId("CHEST-KEY").id).toBe("CHEST-KEY");
    });
});
