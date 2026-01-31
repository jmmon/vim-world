import { VimAction, VimFSMState, VimMode } from "../../fsm/types";
import { InputType } from "./types";
export interface Transition {
    next: VimMode;
    effect?: (ctx: VimFSMState, key: string) => VimAction | void;
}


export function classifyInput(key: string): InputType {
    if (/[1-9]/.test(key)) return "digit";
    if (["h", "j", "k", "l", "w", "b"].includes(key)) return "move";
    if (["y", "d", "c"].includes(key)) return "operator";
    if (["f", "F"].includes(key)) return "motion";
    // if (["(", `"`].includes(key))  return "delimiter";
    if (key === ".") return "repeat";
    if (key === ":") return "commandStart";
    if (key === "Enter") return "enter";
    if (["a", "i", "(", '"'].includes(key)) return "scope";
    if (key.length === 1) return "char";
    return "unknown";
}

export const transitionTable: Record<
  VimMode,
    Partial<Record<InputType, Transition>>
> = {
  normal: {
    digit: {
      next: "normal",
      effect: (ctx, key) => {
        ctx.count = (ctx.count || 0) * 10 + Number(key);
      },
    },

    move: {
      next: "normal",
      effect: (ctx, key) => {
        const count = ctx.count || 1;
        ctx.count = 0;

        const action: VimAction = {
          type: "MOVE",
          key,
          count,
        };

        ctx.lastAction = action;
        return action;
      },
    },

    operator: {
      next: "operator",
      effect: (ctx, key) => {
        ctx.operator = key as any;
        ctx.buffer = [];
      },
    },

    motion: {
      next: "awaitingChar",
      effect: (ctx, key) => {
        ctx.motion = key as any;
      },
    },

    repeat: {
      next: "normal",
      effect: (ctx) => ctx.lastAction,
    },

    commandStart: {
      next: "command",
      effect: (ctx) => {
        ctx.buffer = [];
      },
    },
  },

  operator: {
    scope: {
      next: "operator",
      effect: (ctx, key) => {
        ctx.buffer.push(key);
      },
    },

    char: {
      next: "normal",
      effect: (ctx, key) => {
        const cmd = `${ctx.operator}${ctx.buffer.join("")}${key}`;
        const action: VimAction = {
          type: "INTERACT",
          command: cmd,
        };
        ctx.lastAction = action;
        return action;
      },
    },
  },

  awaitingChar: {
    char: {
      next: "normal",
      effect: (ctx, key) => {
        const action: VimAction = {
          type: "TARGET",
          command: `${ctx.motion}${key}`,
        };
        ctx.lastAction = action;
        return action;
      },
    },
  },

  command: {
    char: {
      next: "command",
      effect: (ctx, key) => {ctx.buffer.push(key);},
    },

    enter: {
      next: "normal",
      effect: (ctx) => ({
        type: "COMMAND",
        command: ctx.buffer.join(""),
      }),
    },
  },
};


