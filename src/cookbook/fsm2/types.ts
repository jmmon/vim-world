// for 2
export type InputType =
    | "digit"
    | "move"
    | "operator"
    | "motion"
    | "scope"
    // | "delimiter"
    | "repeat"
    | "commandStart"
    | "enter"
    | "char"
    | "unknown";

// for 2
export type Input =
    | { kind: "digit"; value: number }
    | { kind: "move"; key: string }
    | { kind: "operator"; key: "y" | "d" | "c" }
    | { kind: "motion"; key: "f" | "F" }
    | { kind: "scope"; key: "a" | "i" | "(" | `"` }
    // | { kind: "delimiter"; key: "(" | `"` }
    | { kind: "repeat" } // .
    | { kind: "commandStart" } // :
    | { kind: "enter" }
    | { kind: "char"; key: string }
    | { kind: "unknown" };
