// e.g. player checkpoints saved in memory (future in a db)
// in memory, should be able to log out and then log back in to the same position hopefully
// would need some consistent clientId (make something up for testing)


export type PlayerCheckpoint = {
    playerId: string;
    zoneId: string;
    x: number;
    y: number;
    dir: 'N' | 'E' | 'S' | 'W';
    // inventory: string[];
    // hp: number;
    // maxHp?: number;
    lastSeenAt: number;
};

const DEFAULT_CHECKPOINT: PlayerCheckpoint = {
    playerId: 'abc', // test id
    zoneId: 'test',
    x: 0,
    y: 0,
    dir: 'S', // or 's'??
    // inventory,
    // hp,
    // maxHp,
    lastSeenAt: Date.now()
};

const playerCache = new Map<string, PlayerCheckpoint>();

function loadCheckpoint(playerId: string): PlayerCheckpoint {
    console.log('loading checkpoint...', playerId);
    if (playerCache.has(playerId)) {
        return playerCache.get(playerId)!;
    }
    return DEFAULT_CHECKPOINT;
}

function saveCheckpoint(checkpointData: PlayerCheckpoint): boolean {
    console.log('saving checkpoint...', checkpointData.playerId);
    try {
        playerCache.set(checkpointData.playerId, checkpointData);
        return true
    } catch(err) {
        console.error(err);
        return false;
    }
}

const checkpoint = {
    load: loadCheckpoint,
    save: saveCheckpoint,
};

export default checkpoint;
