import { Player, Vec2 } from "~/components/canvas1/types";
import { computeTargetPos, keyToDirection } from "~/fsm/movement";
import { ClientActionMessage, Direction, GameAction } from "~/fsm/types";
import { ClientData, WORLD } from "../serverState";
import { sendAck, sendCorrection, sendRejection } from "./handlers";
import { ReasonPartial, ValidateMoveCorrection, ValidateMoveResult } from "./types";

function validateActionSequence(player: Player, msg: ClientActionMessage) {
    // basic validation:
    if (msg.seq <= player.lastProcessedSeq) {
        return false; // duplicate or replay
    }

    if (!isFinite(msg.clientTime)) {
        // TODO:
        // disconnect(player);
        // return false;
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
// e.g. if false, return an invalid message:
// sendCorrection(player, {
//     reason: "INVALID_ACTION",
//     authoritativeState: snapshotPlayer(player)
// });

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
    let reason: ReasonPartial | undefined = undefined;
    while (processedCount < steps) {
        const next = computeTargetPos(player.pos, delta);

        if (!WORLD.isWithinBounds(next)) {
            console.error("not within bounds!", player.pos, next);
            reason = "OUT_OF_BOUNDS";
            break; // stop at map edge
        }

        if (!WORLD.isWalkable(next)) {
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


export function basicValidation(player: Player, msg: ClientActionMessage) {
    if (!validateActionSequence(player, msg)) {
        console.log('invalid action sequence! at:', player.lastProcessedSeq, 'msg:', msg.seq);
        return "INVALID_SEQUENCE";
    }

    if (!validateActionSchema(msg.action)) {
        console.log('invalid action schema!', msg.action);
        return "INVALID_ACTION";
    }
    return null;
}

// TODO: more action types: 'INTERACT', 'COMMAND', 'TARGET'
// apply msg.type === 'ACTION'
export function applyAction(client: ClientData, player: Player, msg: ClientActionMessage) {
    const result = validateMove(player, msg.action);
    // cases: result not ok because of invalid key or action (no target, no dir)
    // result not ok because of collision (with target and dir)
    // result not ok because of out of bounds (with target and dir)
    // result ok (with target and dir)

    if (!result.ok) {
        if (result.reason === 'INVALID_KEY' || result.reason === 'INVALID_ACTION') {
            sendRejection(client, {
                reason: result.reason,
                seq: msg.seq,
                // authoritativeState: snapshotPlayer(player) // e.g. previous player state
                authoritativeState: player,
            });
            // dont apply move since it was invalid
            return;
        } 

        console.log('RESULT: expect coords:', result);
        // apply corrected move
        applyMoveToWorld(player, msg, result as ValidateMoveCorrection); // updates player object
        console.log('CORRECTED: updated player: EXPECT new position!', player);
        sendCorrection(client, {
            reason: result.reason,
            seq: msg.seq,
            // authoritativeState: snapshotPlayer(player) // e.g. previous player state
            authoritativeState: player,
        });
        return;
    }
    
    console.log('RESULT: expect coords:', result);

    // apply valid move
    applyMoveToWorld(player, msg, result);
    console.log('VALID: updated player: EXPECT new position!', player);
    sendAck(client, {
        seq: msg.seq,
        authoritativeState: player,
    });
}



