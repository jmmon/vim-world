import { SPECIAL_KEY_VALUES, SpecialKeyValues } from "~/fsm/transtionTable";
import { VimAction } from "~/fsm/types";
import { CommandLineState, ServerPlayer } from "~/types/worldTypes";

export function applyCommandToPlayerCommandState(_: any, player: ServerPlayer, action: VimAction) {
    switch(action.type) {
        case "COMMAND_PROMPT":
            player.commandLineState.reset();
            break;
        case "COMMAND_PARTIAL":
        case "COMMAND":
            player.commandLineState.handleKey(action.command!);
            break;
    }
    return undefined;
}

export function initCommandLineState() {
    return {
        buffer: '',
        bufferRaw: '',
        cursor: 0,
        /* e.g. takes single keypress such as <LEFT> or <BACKSPACE> or a,b,c etc
         */
        handleKey: function (this: CommandLineState, command: string) {
            console.log('handleKey:', {bufferRaw: this.bufferRaw, buffer: this.buffer, cursor: this.cursor, incomingCommand: command});
            this.bufferRaw = command;
            parseCommand(this);
            console.log('after handleKey::', {bufferRaw: this.bufferRaw, buffer: this.buffer, cursor: this.cursor});
        },
        prompt: function (this: CommandLineState) {
            this.buffer = this.bufferRaw = ":";
            this.cursor = 1;
        },
        reset: function(this: CommandLineState) {
            this.buffer = this.bufferRaw = "";
            this.cursor = 0;
        },
    }
}

function parseCommand(commandLineState: CommandLineState) {
    const tokens = commandLineState.bufferRaw.match(/<[^>]+>|./g) ?? [];
    const buffer: string[] = [];

    // TODO: <Del>, <Tab>, <Enter>, <LEFT>, <RIGHT>, <UP>, <DOWN>
    for (const token of tokens) {
        if (SPECIAL_KEY_VALUES.includes(token)) {
            switch (token as SpecialKeyValues) {
                case "<BS>":
                    commandLineState.cursor = Math.max(0, commandLineState.cursor - 1);
                    buffer.pop(); // remove the previous token
                    break;
                case "<Del>":
                    // TODO: if char on the right of cursorIndex, remove it
                    if (buffer[commandLineState.cursor + 1]) {
                        buffer.splice(commandLineState.cursor + 1, 1);
                    }
                    break;
                case "<LEFT>":
                    // TODO:
                    commandLineState.cursor = Math.max(0, commandLineState.cursor - 1);
                    break;
                case "<RIGHT>":
                    // TODO: check Math.min
                    commandLineState.cursor = Math.min(buffer.length - 1, commandLineState.cursor + 1);
                    break;
                case " ":
                    buffer.splice(commandLineState.cursor, 0, token);
                    commandLineState.cursor++;
                    break;

                case "<UP>":
                case "<DOWN>":
                case "<Tab>":
                case "<CR>":
                default:
                    // ignore
                    break;
            }
        } else {
            buffer.splice(commandLineState.cursor, 0, token); // insert (token);
            commandLineState.cursor++;
        }
    }

    commandLineState.buffer = buffer.join("");
}


