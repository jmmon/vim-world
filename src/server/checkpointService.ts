// e.g. player checkpoints saved in memory 
//
// in future, this would be the DASH platform interface

import { getRandomHSLColor } from "~/utils/color";
import { Direction, Player, SessionAggregate } from "~/types/worldTypes";
import { isHandAuthoredZone, zone } from "~/server/map";

export type PlayerCheckpoint = {
    level: number;
    itemIds?: string[]; // inventory
    carryingObjId?: string; // picked up object
    playerId: string;
    name: string;
    zone: string;
    x: number;
    y: number;
    dir: Direction;

    // inventory: string[];
    // hp: number;
    // maxHp?: number;
    lastSeenAt: number;
}
// & SessionAggregate;

// The SPAWN entity (the `S` cell) is the single source of truth for where the
// player starts: its world position and facing direction. `zone.entities` is
// built from the authored map, so editing the map moves the spawn — no magic
// numbers here. Falls back to the designed center if the entity is ever absent.
const SPAWN = isHandAuthoredZone(zone)
    ? zone.entities?.find((e) => e.type === "SPAWN")
    : undefined;

export const DEFAULT_CHECKPOINT: PlayerCheckpoint = {
    level: 1,
    playerId: '',
    name: '',
    zone: 'default',
    // room 0 (the open room, x2..6 / y8..12) center — the player spawns here
    // facing the gap to the east, and the camera centers on them
    // (see centerCameraOnPlayer in useState.ts). Chosen from the forced-GRASS
    // overlay so the spawn can never land on procedural WATER/CLIFF.
    x: SPAWN?.x ?? 4,
    y: SPAWN?.y ?? 10,
    dir: (SPAWN?.dir as Direction) ?? 'E',
    // inventory,
    // hp,
    // maxHp,
    lastSeenAt: Date.now()
};

const checkpointCache = new Map<string, PlayerCheckpoint>();

function _loadCheckpoint(playerId: string): PlayerCheckpoint | undefined {
    console.log('loading checkpoint...', playerId);
    return checkpointCache.get(playerId);
}
function _createDefaultCheckpoint(playerId: string, name?: string | null): PlayerCheckpoint {
    console.log('loading default checkpoint...');
    return {
        ...DEFAULT_CHECKPOINT,
        playerId: playerId ?? DEFAULT_CHECKPOINT.playerId,
        name: name ?? playerId ?? DEFAULT_CHECKPOINT.name,
    };
}
export type CheckpointOrDefault = {
    checkpoint: PlayerCheckpoint,
    isNew: boolean
};
function loadOrDefault(playerId: string, name?: string | null): CheckpointOrDefault {
    const response = {
        checkpoint: _loadCheckpoint(playerId),
        isNew: false,
    };
    if (!response.checkpoint) {
        console.warn('no checkpoint found for playerId:', playerId);
        const defaultCheckpoint = _createDefaultCheckpoint(playerId, name);
        checkpointCache.set(playerId, defaultCheckpoint);
        response.isNew = true;
        response.checkpoint = defaultCheckpoint;
    }
    return response as CheckpointOrDefault;
}

function update(checkpointData: PlayerCheckpoint): PlayerCheckpoint | false {
    // console.log('saving checkpoint...', checkpointData.playerId);
    try {
        checkpointCache.set(checkpointData.playerId, checkpointData);
        return checkpointData;
    } catch(err) {
        console.error(err);
        return false;
    }
}

function toPlayer(data: PlayerCheckpoint, lastProcessedSeq: number = -1) {
    const player: Player = {
        level: data.level,
        name: data.name,
        id: data.playerId,
        pos: {
            x: data.x,
            y: data.y
        },
        dir: data.dir,
        color: getRandomHSLColor(data.playerId),
        zone: data.zone,
        lastProcessedSeq,
        session: newPlayerSession(),
    };
    return player;
}

function fromPlayer(p: Player, lastSeenAt: number) {
    const checkpoint: PlayerCheckpoint = {
        level: p.level,
        name: p.name,
        playerId: p.id,
        x: p.pos.x,
        y: p.pos.y,
        dir: p.dir,
        lastSeenAt: lastSeenAt,
        zone: p.zone,
    };
    return checkpoint;
}

function toCheckpoint(data: Player) {
    const checkpoint: PlayerCheckpoint = {
        level: data.level,
        lastSeenAt: Date.now(),
        name: data.name,
        playerId: data.id,
        x: data.pos.x,
        y: data.pos.y,
        dir: data.dir,
        zone: data.zone,
    };
    return checkpoint;
}

function newPlayerSession(): SessionAggregate {
    return {
        xpGained: 0,
        goldGained: 0,
        itemsAdded: [],
        itemsRemoved: [],
        achievementsUnlocked: [],
    }
}

const checkpointService = {
    loadOrDefault,
    _loadCheckpoint,
    _loadDefaultCheckpoint: _createDefaultCheckpoint,
    update: update,
    toPlayer,
    fromPlayer,
    toCheckpoint,
};

export default checkpointService;


