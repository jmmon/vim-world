// e.g. player checkpoints saved in memory 
//
// in future, this would be the DASH platform interface

import { getRandomHSLColor } from "~/components/canvas1/utils";
import { Direction, Player, SessionAggregate } from "~/types/worldTypes";

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

export const DEFAULT_CHECKPOINT: PlayerCheckpoint = {
    level: 1,
    playerId: '',
    name: '',
    zone: 'default',
    x: 0,
    y: 0,
    dir: 'S',
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
function _getDefaultCheckpoint({ name, id }: Partial<Pick<Player, 'name' | 'id'>>): PlayerCheckpoint {
    console.log('loading default checkpoint...');
    return {
        ...DEFAULT_CHECKPOINT,
        playerId: id ?? DEFAULT_CHECKPOINT.playerId,
        name: name ?? id ?? DEFAULT_CHECKPOINT.name,
    };
}
export type CheckpointOrDefault = {
    checkpoint: PlayerCheckpoint,
    isNew: boolean
};
function loadOrDefault(playerId: string): CheckpointOrDefault {
    const response = {
        checkpoint: _loadCheckpoint(playerId),
        isNew: false,
    };
    if (!response.checkpoint) {
        console.warn('no checkpoint found for playerId:', playerId);
        const defaultCheckpoint = _getDefaultCheckpoint({ id: playerId });
        checkpointCache.set(playerId, defaultCheckpoint);
        response.isNew = true;
        response.checkpoint = defaultCheckpoint;
    }
    return response as CheckpointOrDefault;
}

function update(checkpointData: PlayerCheckpoint): boolean {
    // console.log('saving checkpoint...', checkpointData.playerId);
    try {
        checkpointCache.set(checkpointData.playerId, checkpointData);
        return true
    } catch(err) {
        console.error(err);
        return false;
    }
}

function toPlayer(data: PlayerCheckpoint) {
    const player: Player = {
        level: 1,
        name: data.name,
        id: data.playerId,
        pos: {
            x: data.x,
            y: data.y
        },
        dir: data.dir,
        color: getRandomHSLColor(data.playerId),
        zone: data.zone,
        lastProcessedSeq: -1,
        session: newPlayerSession(),
    };
    return player;
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
    _loadDefaultCheckpoint: _getDefaultCheckpoint,
    update: update,
    toPlayer,
    toCheckpoint,
};

export default checkpointService;


