import {
    VimSettings,
    LocalWorldWrapper,
    ApplyActionDirtyResult,
    MaybePromise,
} from "~/components/canvas1/types";
import { VimAction } from "../../fsm/types";
import { SPECIAL_KEY_VALUES, SpecialKeyValues } from "~/fsm/transtionTable";
import { ClientPhysicsMode, getClientPhysics } from "../shared/physics";

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
): MaybePromise<ApplyActionDirtyResult> {
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
    state.client.commandBuffer = "";

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

    if (action.command === "help" || action.command === "h") {
        state.show.help = !state.show.help;
        return false;
    }

    if (action.command!.startsWith("set ")) {
        return updateSetting(state, action.command!.slice(4));
    }

    // allow optional ! at end of strings for quit write etc commands
    if (action.command!.endsWith("!")) {
        action.command = action.command!.slice(0, -1);
    }
    if (QUIT_ACTIONS.includes(action.command!)) {
        if (!state.client.player) return false;
        state.dispatch.logout(state.client.player!);
        return false;
    }
    return false;
}

const SETTINGS_ABRIEV_MAP: Record<string, keyof VimSettings | 'physics'> = {
    so: "scrolloff",
    siso: "sidescrolloff",
    co: "columns",
};
const limits = {
    scrolloff: {
        min(_: LocalWorldWrapper) {
            return 0;
        },
        max(state: LocalWorldWrapper) {
            return state.client.viewport.height / state.world.config.tileSize;
        },
    },
    sidescrolloff: {
        min(_: LocalWorldWrapper) {
            return 0;
        },
        max(state: LocalWorldWrapper) {
            return state.client.viewport.width / state.world.config.tileSize;
        },
    },
    lines: {
        min(state: LocalWorldWrapper) {
            return Math.max(10, state.client.settings.scrolloff + 1);
        },
        max(_: LocalWorldWrapper) {
            return 100;
        },
    },
    columns: {
        min(state: LocalWorldWrapper) {
            return Math.max(10, state.client.settings.sidescrolloff + 1);
        },
        max(_: LocalWorldWrapper) {
            return 100;
        },
    },
};

function clamp(min: number, max: number, value: number) {
    return Math.min(Math.max(min, value), max);
}

const PHYSICS_MAP: Record<string, ClientPhysicsMode> = {
    full_prediction: ClientPhysicsMode.FULL_PREDICTION,
    visual_only: ClientPhysicsMode.VISUAL_ONLY,
    none: ClientPhysicsMode.NONE,
};
const PHYSICS_ABRIEV: Record<string, keyof typeof PHYSICS_MAP> = {
    f: 'full_prediction',
    full: 'full_prediction',
    full_prediction: 'full_prediction',

    v: 'visual_only',
    visual: 'visual_only',
    visual_only: 'visual_only',

    n: 'none',
    none: 'none',
}

function setClientSetting(
    state: LocalWorldWrapper,
    key: keyof VimSettings,
    valueString: string,
): boolean {
    const prev = state.client.settings[key];
    const value = parseInt(valueString);
    const LIMITS = limits[key];

    const min = LIMITS.min(state);
    const max = LIMITS.max(state);

    const valueClamped = clamp(min, max, value);
    state.client.settings[key] = valueClamped;

    console.log(`successful setting ${key} to:`, state.client.settings[key]);

    const hasChanged = prev !== state.client.settings[key];
    return hasChanged;
}

async function updateSetting(state: LocalWorldWrapper, command: string) {
    const [setting, _value] = command.split("=");
    console.log(`attempting to update ${setting} to ${_value}...`);
    const key = SETTINGS_ABRIEV_MAP[setting] ?? setting;
    if (key in state.client.settings === false && key !== 'physics') {
        console.warn("~~ unknown setting::", { key, _value });
        return false;
    }

    if (key === 'physics') {
        const target = PHYSICS_ABRIEV[_value.toLowerCase()];
        const prop = PHYSICS_MAP[target];
        if (prop === undefined) {
            console.warn("~~ unknown setting::", { key, _value, prop, ...(target && { target }) });
            return false;
        }
        state.physics = getClientPhysics(prop);
        console.log("~~ updated physics to::", { value: prop });
        return false;
    }

    const isDirty = setClientSetting(state, key, _value);
    if (key === "columns" || key === "lines") {
        return await state.updateViewportDimensions();
    }
    return isDirty;
}

function parseCommand(input: string): string {
    const tokens = input.match(/<[^>]+>|./g) ?? [];
    const buffer: string[] = [];
    let cursorIndex = 0;

    // TODO: <Del>, <Tab>, <Enter>, <LEFT>, <RIGHT>, <UP>, <DOWN>
    for (const token of tokens) {
        if (SPECIAL_KEY_VALUES.includes(token)) {
            switch (token as SpecialKeyValues) {
                case "<BS>":
                    cursorIndex = Math.max(0, cursorIndex - 1);
                    buffer.pop(); // remove the previous token
                    break;
                case "<Del>":
                    // TODO: if char on the right of cursorIndex, remove it
                    if (buffer[cursorIndex + 1]) {
                        buffer.splice(cursorIndex + 1, 1);
                    }
                    break;
                case "<LEFT>":
                    // TODO:
                    cursorIndex = Math.max(0, cursorIndex - 1);
                    break;
                case "<RIGHT>":
                    // TODO: check Math.min
                    cursorIndex = Math.min(buffer.length - 1, cursorIndex + 1);
                    break;
                case " ":
                    buffer.splice(cursorIndex, 0, token);
                    cursorIndex++;
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
            buffer.splice(cursorIndex, 0, token); // insert (token);
            cursorIndex++;
        }
    }

    return buffer.join("");
}
