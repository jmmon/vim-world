import { Player } from "~/types/worldTypes";
import { ClientData } from "~/server/types";
import { ClientActionMessage } from "~/types/messageTypes";
import { VimAction } from "~/fsm/types";

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
function validateActionSchema(action: VimAction): boolean {
    switch (action.type) {
        case "MOVE":
            return typeof action.key === "string";
        case "INTERACT":
            return true;
        case "TARGET":
            return true;
        case "COMMAND":
            return typeof action.command === "string";
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

