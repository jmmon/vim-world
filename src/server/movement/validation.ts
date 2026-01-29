import { Direction, Player, Vec2 } from "~/components/canvas1/types";
import { computeTargetPos, keyToDirection } from "~/fsm/movement";
import { ClientActionMessage, GameAction } from "~/fsm/types";
import { WORLD_WRAPPER } from "../serverState";
import { ReasonCorrection, ValidateMoveCorrection, ValidateMoveResult } from "./types";
import { ClientData } from "../types";

function validateActionSequence(client: ClientData, player: Player, msg: ClientActionMessage) {
    // basic validation:
    console.log('basic validation:', msg, player);
    if (msg.seq <= player.lastProcessedSeq) {
        console.log('~~basic validation FAILED seq');
        return false; // duplicate or replay
    }

    if (!isFinite(msg.clientTime)) {
        client.disconnect();
        return false;
    }

    return true;
}

// // TODO:
// // tick gating (anti spam - enforce one action per tick)
//
// function tickGate() {
//     const tick = getCurrentTick();
//     // if already running an action for this player for this tick, queue action into the next tick instead
//     if (player.lastActionTick === tick) {
//       queueForNextTick(player, msg); 
//       return;
//     }
// }

// basic schema validation
function validateActionSchema(action: GameAction): boolean {
    switch (action.type) {
        case "MOVE":
            return typeof action.key === "string";
        case "INTERACT":
            return true;
        default:
            return false;
    }
}

export function basicValidation(client: ClientData, player: Player, msg: ClientActionMessage) {
    if (!validateActionSequence(client, player, msg)) {
        console.log('invalid action sequence! at:', player.lastProcessedSeq, 'msg:', msg.seq);
        return "INVALID_SEQUENCE";
    }

    if (!validateActionSchema(msg.action)) {
        console.log('invalid action schema!', msg.action);
        return "INVALID_ACTION";
    }
    return null;
}


function deltaToDirection(delta: Vec2): Direction | undefined {
    // Update facing direction
    switch (true) {
        case delta.x > 0:
            return 'E';
        case delta.x < 0:
            return 'W';
        case delta.y > 0:
            return 'S';
        case delta.y < 0:
            return 'N';
        default:
            return undefined;
    }
}


function validateMove(player: Player, action: GameAction): ValidateMoveResult {
    if (action.type !== 'MOVE') return { ok: false, reason: "INVALID_ACTION" };
    const delta = keyToDirection(action.key);
    if (!delta) return { ok: false, reason: "INVALID_KEY" };

    const dir = deltaToDirection(delta); // new direction
    const steps = action.count ?? 1;
    const target: Vec2 = {
        x: player.pos.x,
        y: player.pos.y,
    }
    // processing multiple counts within one tick:
    let processedCount = 0;
    let reason: ReasonCorrection | undefined = undefined;
    while (processedCount < steps) {
        const next = computeTargetPos(player.pos, delta);

        if (!WORLD_WRAPPER.isWithinBounds(next)) {
            console.error("not within bounds!", player.pos, next);
            reason = "OUT_OF_BOUNDS";
            break; // stop at map edge
        }

        if (!WORLD_WRAPPER.isWalkable(next)) {
            reason = "COLLISION";
            break; // stop at obstacle or player
        }

        target.x = next.x;
        target.y = next.y;
        processedCount++;
    }
    

    // TODO: e.g. if processing only one count per tick, takes 3 ticks to move 3j
    //
    // const target = {
    //     x: player.pos.x + dir.x,
    //     y: player.pos.y + dir.y
    // };
    //
    // if (!WORLD.isWithinBounds(target)) {
    //     return { ok: false, reason: "OUT_OF_BOUNDS" };
    // }
    //
    // if (!WORLD.isWalkable(target)) {
    //     return { ok: false, reason: "COLLISION" };
    // }
    
    if (reason) return { ok: false, reason, target, dir };

    return { ok: true, reason, target, dir };
}

function applyMoveToWorld(player: Player, msg: ClientActionMessage, result: { target: Vec2, dir?: Direction }) {
    player.pos.x = result.target.x;
    player.pos.y = result.target.y;
    if (result.dir) player.dir = result.dir;
    player.lastProcessedSeq = msg.seq;
}


// TODO: more action types: 'INTERACT', 'COMMAND', 'TARGET'
// apply msg.type === 'ACTION'
export function applyAction(player: Player, msg: ClientActionMessage) {
    const result = validateMove(player, msg.action);

    if (!result.ok) {
        if (result.reason === 'INVALID_KEY' || result.reason === 'INVALID_ACTION') {
            return {
                seq: msg.seq,
                reason: result.reason,
            };
        } 

        // console.log('RESULT: expect coords:', result);
        applyMoveToWorld(player, msg, result as ValidateMoveCorrection); // updates player object
        // console.log('CORRECTED: updated player: EXPECT new position!', player);
        return {
            seq: msg.seq,
            reason: result.reason,
        };
    }
    
    // console.log('RESULT: expect coords:', result);

    // apply valid move
    applyMoveToWorld(player, msg, result);
    // console.log('VALID: updated player: EXPECT new position!', player);
    return {
        seq: msg.seq,
        reason: null,
    };
}



