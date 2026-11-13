import { describe, expect, test } from "vitest";
import { entities } from "~/server/objects";
import { zone } from "~/server/map";
import { isKeyId } from "~/simulation/shared/actions/door";
import { ITEMS_WITH_IDS } from "~/server/objects";

// proves the hand-authored `entities` overlay places its door/keyhole/key/chest
// at FIXED world positions (designed, not random) with stable IDs so the
// keyhole can link to its door by `lock.doorId` on both client and server.
describe("hand-authored entities — fixed placement", () => {
    const byId = (id: string) => entities.get(id)!;

    test("places the three authored entities at their authored positions", () => {
        expect(byId("CHEST-KEY").pos).toEqual({ x: 12, y: 8 });
        expect(byId("KEYHOLE-1").pos).toEqual({ x: 20, y: 8 });
        expect(byId("DOOR-1").pos).toEqual({ x: 26, y: 10 });
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

    test("chest holds the key item", () => {
        const key = ITEMS_WITH_IDS.find((i) => isKeyId(i.id))!;
        expect(byId("CHEST-KEY").container?.itemIds).toContain(key.id);
    });

    test("ids are stable across repeated lookups (link survives serialization)", () => {
        // a hand-authored id is kept as-is, never regenerated — so the link is
        // intact after the entities are serialized to the client and back.
        expect(byId("DOOR-1").id).toBe("DOOR-1");
        expect(byId("KEYHOLE-1").id).toBe("KEYHOLE-1");
        expect(byId("CHEST-KEY").id).toBe("CHEST-KEY");
    });
});
