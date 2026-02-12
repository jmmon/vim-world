import { LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { SPECIAL_KEY_VALUES, SpecialKeyValues } from "~/fsm/transtionTable";

const QUIT_ACTIONS = [
    "q",
    "quit",
    "qa",
    "qall",
    "quita",
    "quitall",
    "wq",
    "wqa",
    "wqall",
    "wa",
    "x",
    "xit",
    "exi",
    "exit",
];
// :q[uit][!], :wq[!], :wa[ll], :conf[irm] q[uit], :x[it], :exi[t], :[w]qa[ll][!], :quita[ll][!]
export function applyCommandAction(
    state: LocalWorldWrapper,
    action: VimAction,
): false {
    if (action.type === "COMMAND_PROMPT") {
        state.client.commandBuffer = ":";
        return false;
    }
    if (action.type === "COMMAND_PARTIAL") {
        // or could parse before dispatching to server to avoid long strings with lots of special sequences
        // unless commands need to do something on the server, then it should parse the list of keystrokes itself!
        const command2 = parseCommand(action.command!);
        state.client.commandBuffer = ":" + command2;
        return false;
    }

    // should these be commands??
    if (action.command === "g?") {
        state.show.help = !state.show.help;
        return false;
    }
    if (action.command === "ctrl+[") {
        // show menu
        state.show.menu = !state.show.menu;
        return false;
    }

    state.client.commandBuffer = "";
    if (
        action.command === "help" ||
        action.command === "h"
    ) {
        state.show.help = !state.show.help;
        return false;
    }

    // allow optional ! at end of strings for quit write etc commands
    if (action.command!.endsWith("!")) {
        action.command = action.command!.slice(0, -1);
    }
    // console.assert("abc!".replace(/!$/, "") === 'abc', 'oops, wrong regex!!', 'abc!'.replace(/!$/, ""));
    // console.assert("abc!!".replace(/!$/, "") === 'abc!', 'oops, wrong regex!!', 'abc!!'.replace(/!$/, ""));
    if (QUIT_ACTIONS.includes(action.command!)) {
        console.log(
            "TODO: quit command: save checkpoint then redirect to homepage",
        );
        return false;
    }
    return false;
}


function parseCommand(input: string): string {
    const tokens = input.match(/<[^>]+>|./g) ?? [];
    const buffer: string[] = [];
    let cursorIndex = 0;


    // TODO: <Del>, <Tab>, <Enter>, <LEFT>, <RIGHT>, <UP>, <DOWN>
    for (const token of tokens) {
        if (SPECIAL_KEY_VALUES.includes(token)) {
            switch(token as SpecialKeyValues) {
                case '<BS>': 
                    cursorIndex = Math.max(0, cursorIndex - 1);
                    buffer.pop(); // remove the previous token
                    break;
                case '<Del>':
                    // TODO: if char on the right of cursorIndex, remove it
                    if (buffer[cursorIndex + 1]) {
                        buffer.splice(cursorIndex + 1, 1);
                    }
                    break;
                case '<LEFT>':
                    // TODO:
                    cursorIndex = Math.max(0, cursorIndex - 1);
                    break;
                case '<RIGHT>':
                    // TODO: check Math.min
                    cursorIndex = Math.min(buffer.length - 1, cursorIndex + 1);
                    break;
                case '<UP>':
                case '<DOWN>':
                case '<Tab>':
                case '<CR>':
                default:
                    // ignore
                    break;
            }

        } else {
            buffer.splice(cursorIndex, 0, token); // insert (token);
            cursorIndex ++;
        }
    }

    return buffer.join('');
}

