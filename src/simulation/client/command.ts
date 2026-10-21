import {
    VimSettings,
    LocalWorldWrapper,
    ActionResult,
} from "~/components/canvas1/types";
import { CommandVimAction } from "../../fsm/types";
import {
    ClientPhysicsMode,
    PhysicsMode,
    getClientPhysics,
} from "../shared/physics";
import viewport from "./viewport";
import { applyCommandToPlayerCommandState } from "../shared/actions/command";

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
const modalMap: Record<string, keyof LocalWorldWrapper['show']> = {
    "g?": 'help',
    "help": "help",
    "h": "help",
    "ctrl+[": 'menu',
}
// :q[uit][!], :wq[!], :wa[ll], :conf[irm] q[uit], :x[it], :exi[t], :[w]qa[ll][!], :quita[ll][!]
export function applyCommandAction(
    ctx: LocalWorldWrapper,
    action: CommandVimAction,
): ActionResult {
    console.log("applyCommandAction::", action);
    const result = { reason: undefined, isDirty: false };

    if (action.type === "COMMAND_PROMPT" || action.type === "COMMAND_PARTIAL" || action.type === "COMMAND_LINE") {
        applyCommandToPlayerCommandState(ctx, ctx.client, action);
        ctx.client.commandLineDisplay = ":" + ctx.client.commandLineState!.buffer;
        if (action.type !== "COMMAND_LINE") return result;
    }

    ctx.client.commandLineDisplay = "";

    const modalTarget = modalMap[action.command];
    if (modalTarget) {
        ctx.show[modalTarget] = !ctx.show[modalTarget];
        return result;
    }

    if (action.command.startsWith("set ")) {
        return updateSetting(ctx, action.command.slice(4));
    }

    // allow optional ! at end of strings for quit write etc commands
    if (action.command.endsWith("!")) {
        action.command = action.command.slice(0, -1);
    }
    if (QUIT_ACTIONS.includes(action.command)) {
        ctx.dispatch.logout.call(ctx);
        return result;
    }
    return result;
}

const LIMITS_MAP = {
    scrolloff: (state: LocalWorldWrapper) => ({
        min: 0,
        max: state.client.viewport.height / state.world.config.tileSize,
    }),
    sidescrolloff: (state: LocalWorldWrapper) => ({
        min: 0,
        max: state.client.viewport.width / state.world.config.tileSize,
    }),
    lines: (state: LocalWorldWrapper) => ({
        min: Math.max(10, state.client.settings.scrolloff + 1),
        max: 100,
    }),
    columns: (state: LocalWorldWrapper) => ({
        min: Math.max(10, state.client.settings.sidescrolloff + 1),
        max: 100,
    }),
};

type SettingsProps = "prediction" | "collision" | "serverAck";
type SettingsKeysAddl = "physics" | SettingsProps;
const SETTINGS_ABRIEV_MAP: Record<
    string,
    keyof VimSettings | SettingsKeysAddl
> = {
    so: "scrolloff",
    siso: "sidescrolloff",
    co: "columns",
};

function clamp(min: number, max: number, value: number) {
    return Math.min(Math.max(min, value), max);
}

const PHYSICS_MAP: Record<string, ClientPhysicsMode> = {
    client_only: ClientPhysicsMode.CLIENT_ONLY,
    full_prediction: ClientPhysicsMode.FULL_PREDICTION,
    visual_only: ClientPhysicsMode.VISUAL_ONLY,
    none: ClientPhysicsMode.NONE,
};
const PHYSICS_ABRIEV: Record<string, keyof typeof PHYSICS_MAP> = {
    c: "client_only",
    client: "client_only",
    client_only: "client_only",

    f: "full_prediction",
    full: "full_prediction",
    full_prediction: "full_prediction",

    v: "visual_only",
    visual: "visual_only",
    visual_only: "visual_only",

    n: "none",
    none: "none",
};

const BOOLEAN_MAP: Record<string, boolean> = {
    off: false,
    false: false,
    "0": false,
    on: true,
    true: true,
    "1": true,
};

function getNewPhysicsMode(
    key: SettingsProps,
    val: boolean,
    prev: PhysicsMode,
): ClientPhysicsMode {
    switch (key) {
        case "prediction":
            if (!val) {
                return ClientPhysicsMode.NONE;
            } else if (prev.collision) {
                return ClientPhysicsMode.FULL_PREDICTION;
            } else {
                return ClientPhysicsMode.VISUAL_ONLY;
            }

        case "collision":
            if (val) {
                return ClientPhysicsMode.FULL_PREDICTION;
            } else if (prev.prediction) {
                return ClientPhysicsMode.VISUAL_ONLY;
            } else {
                return ClientPhysicsMode.NONE;
            }

        case "serverAck":
            if (val) {
                // default to full prediction (standard)
                return ClientPhysicsMode.FULL_PREDICTION;
            } else {
                // false: disabling dispatch to server
                return ClientPhysicsMode.CLIENT_ONLY;
            }
    }
}

function setClientSetting(
    state: LocalWorldWrapper,
    key: keyof VimSettings,
    valueString: string,
): boolean {
    const prev = state.client.settings[key];
    const value = parseInt(valueString);
    const { min, max } = LIMITS_MAP[key](state);

    const valueClamped = clamp(min, max, value);
    state.client.settings[key] = valueClamped;

    console.log(`successful setting ${key} to:`, state.client.settings[key]);

    const hasChanged = prev !== state.client.settings[key];
    return hasChanged;
}

function updateSetting(
    ctx: LocalWorldWrapper,
    command: string,
): ActionResult {
    const result = { reason: undefined, isDirty: false };
    const [setting, _value] = command.split("=");
    console.log(`attempting to update ${setting} to ${_value}...`);
    const key = SETTINGS_ABRIEV_MAP[setting] ?? setting;
    if (key in ctx.client.settings === false && key !== "physics") {
        console.warn("~~ unknown setting::", { key, _value });
        return { reason: "INVALID_ACTION", isDirty: false };
    }

    if (key === "physics") {
        const target = PHYSICS_ABRIEV[_value.toLowerCase()];
        const newPhysicsMode = PHYSICS_MAP[target];
        if (newPhysicsMode === undefined) {
            console.warn("~~ unknown setting::", {
                key,
                _value,
                prop: newPhysicsMode,
                ...(target && { target }),
            });
            return result;
        }
        ctx.physics = getClientPhysics(newPhysicsMode);
        console.log("~~ updated physics to::", { value: newPhysicsMode });
        return result;
    }

    if (key === "prediction" || key === "collision" || key === "serverAck") {
        const target = BOOLEAN_MAP[_value.toLowerCase()];
        const newPhysicsMode = getNewPhysicsMode(key, target, ctx.physics);
        ctx.physics = getClientPhysics(newPhysicsMode);
        console.log("~~ updated physics to::", {
            physics: { ...ctx.physics },
            newPhysicsMode,
        });
        return result;
    }

    let isDirty = setClientSetting(ctx, key, _value);
    if (key === "columns" || key === "lines") {
        isDirty = viewport.updateDimensions(ctx);
    }
    return { reason: undefined, isDirty };
}
