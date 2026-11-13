import { WorldEntity, Player } from "~/types/worldTypes";
import { ITEMS_WITH_IDS } from "~/server/objects";

/** the only thing the unlock hook needs from a wrapper: the entity map.
 *  shared by client + server so the same code runs in both. */
export type EntityWorld = { world: { entities: Map<string, WorldEntity> } };

/** is this item id a key? */
export function isKeyId(itemId: string): boolean {
    return ITEMS_WITH_IDS.some((i) => i.id === itemId && i.kind === "KEY");
}

/**
 * After a key is pasted into a KEYHOLE (`pi"`), resolve the lock: consume the
 * key, mark the keyhole used, and — if every keyhole linked to the door is now
 * used — open the door (release its collision). Pure state mutation, so it is
 * safe to run on the client (prediction) and the server (authoritative).
 *
 * @returns the entities that changed (keyhole, and the door if it opened) so
 *  the server can broadcast just those — narrow, idempotent merge on the client.
 */
export function maybeUnlockKeyhole(
    ctx: EntityWorld,
    _player: Player,
    keyhole: WorldEntity,
): WorldEntity[] {
    if (keyhole.type !== "KEYHOLE") return [];
    const lock = keyhole.lock;
    if (!lock || !lock.doorId) return [];

    const container = keyhole.container;
    if (!container || container.itemIds.length === 0) return [];

    // only a KEY can unlock; anything else just sits in the slot
    if (!container.itemIds.some(isKeyId)) return [];

    // consume the key (commitment) — the slot empties
    container.itemIds = [];
    lock.used = true;

    const changed: WorldEntity[] = [keyhole];

    const door = ctx.world.entities.get(lock.doorId);
    if (door && door.type === "DOOR") {
        // multiple keyholes can guard one door (deferred 2-key mechanic); Phase 0
        // has one, but the same code serves both. the required set lives on the
        // door; fall back to this keyhole if the door names none.
        const required = door.lock?.requiredKeyholeIds ?? [keyhole.id];
        const allUsed = required.every((keyholeId) => {
            const kh = ctx.world.entities.get(keyholeId);
            return !!kh && kh.type === "KEYHOLE" && kh.lock?.used === true;
        });
        if (allUsed) {
            door.collision = { solid: false };
            door.state = { kind: "DOOR", open: true, locked: false };
            changed.push(door);
        }
    }

    return changed;
}
