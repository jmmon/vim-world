import { Player } from "~/types/worldTypes";
import { ClientSession } from "~/server/types";
import { ExpandedVimAction, VimAction } from "~/fsm/types";

function validateActionSequence(client: ClientSession, player: Player, action: ExpandedVimAction) {
    // basic validation:
    console.log('basic validation:', action, player);
    if (action.seq <= player.lastProcessedSeq) {
        return false; // duplicate or replay
    }

    if (!isFinite(action.clientTime ?? 0)) {
        client.disconnect();
        return false;
    }

    return true;
}

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

export default function basicValidation(client: ClientSession, player: Player, action: ExpandedVimAction) {
    if (!validateActionSequence(client, player, action)) {
        console.log('invalid action sequence! at:', player.lastProcessedSeq, 'msg:', action.seq);
        return "INVALID_SEQUENCE";
    }

    if (!validateActionSchema(action)) {
        console.log('invalid action schema!', action);
        return "INVALID_ACTION";
    }
    return null;
}

