import { LocalWorldWrapper } from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";

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
    // overlayCtx: CanvasRenderingContext2D,
): false {
    if (
        action.command === "help" ||
        action.command === "h" ||
        action.command === "g?"
    ) {
        state.show.help = !state.show.help;
        return false;
    }

    if (action.command === "ctrl+[") {
        // show menu
        state.show.menu = !state.show.menu;
        return false;
    }
    // allow optional ! at end
    if (action.command!.endsWith("!")) {
        action.command = action.command!.slice(0, -1);
    }
    if (QUIT_ACTIONS.includes(action.command!)) {
        console.log(
            "TODO: quit command: save checkpoint then redirect to homepage",
        );
        return false;
    }
    return false;
}
