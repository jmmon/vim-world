import { describe, expect, test, vi } from "vitest";
import basicValidation from "./basic";
import { ClientSession } from "~/server/types";
import { Player } from "~/types/worldTypes";
import { ExpandedVimAction, VimActionType } from "~/fsm/types";

const client = () =>
    ({ disconnect: vi.fn() } as unknown as ClientSession);

const player = (lastProcessedSeq = -1) =>
    ({ lastProcessedSeq } as unknown as Player);

const action = (
    type: VimActionType,
    command?: string,
    seq = 1,
): ExpandedVimAction =>
    ({
        type,
        command,
        seq,
        remaining: 0,
        clientTime: 1000,
    } as unknown as ExpandedVimAction);

describe("basicValidation", () => {
    test("accepts every command line action", () => {
        const types: VimActionType[] = [
            "COMMAND",
            "COMMAND_PROMPT",
            "COMMAND_PARTIAL",
            "COMMAND_LINE",
        ];
        for (const type of types) {
            expect(
                basicValidation(client(), player(), action(type, "wq")),
            ).toBe(null);
        }
    });

    test("rejects a command action without a string", () => {
        expect(
            basicValidation(
                client(),
                player(),
                action("COMMAND_PARTIAL", undefined),
            ),
        ).toBe("INVALID_ACTION");
    });

    test("rejects a stale sequence", () => {
        expect(
            basicValidation(client(), player(3), action("COMMAND_PARTIAL", "w")),
        ).toBe("INVALID_SEQUENCE");
    });
});
