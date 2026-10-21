import { describe, expect, test, vi } from "vitest";
import { handlers } from "./useState";
import {
    ClientPhysicsMode,
    getClientPhysics,
} from "~/simulation/shared/physics";
import { LocalWorldWrapper } from "~/simulation/client/types";
import { ServerAckMessage, SubtypeServerAck } from "~/types/wss/server";
import { VimAction } from "~/fsm/types";
import { Player } from "~/types/worldTypes";

const snapshot = {} as Player;

const makeCtx = (mode: ClientPhysicsMode) => {
    const logout = vi.fn();
    const ctx = {
        physics: getClientPhysics(mode),
        client: {
            commandLineDisplay: "",
            inputBuffer: [] as {
                seq: number;
                action: VimAction;
                snapshotBefore: Player;
            }[],
            isDirty: {
                overlay: false,
                players: false,
                objects: false,
                map: false,
            },
        },
        dispatch: { logout },
    } as unknown as LocalWorldWrapper;
    return { ctx, logout };
};

const commandAck = (subtype: "COMMAND" | "COMMAND_PARTIAL", buffer: string) =>
    ({
        type: "ACK",
        subtype,
        seq: 3,
        tick: 10,
        accepted: false,
        reason: undefined,
        authoritativeState: {
            commandLineState: { buffer, bufferRaw: buffer, cursor: buffer.length },
        },
    }) as unknown as ServerAckMessage<"COMMAND" | "COMMAND_PARTIAL">;

const rejectionAck = (seq: number) =>
    ({
        type: "ACK",
        subtype: "REJECTION",
        seq,
        tick: 10,
        accepted: false,
        reason: "INVALID_ACTION",
    }) as unknown as ServerAckMessage<SubtypeServerAck>;

describe("command line in server-ack mode", () => {
    test("the echo paints the command line", () => {
        const { ctx } = makeCtx(ClientPhysicsMode.NONE);
        handlers.handleAckSubtype(ctx, commandAck("COMMAND_PARTIAL", "wq"));
        expect(ctx.client.commandLineDisplay).toBe(":wq");
    });

    test("the echo of the prompt paints an empty command line", () => {
        const { ctx } = makeCtx(ClientPhysicsMode.NONE);
        handlers.handleAckSubtype(ctx, commandAck("COMMAND_PARTIAL", ""));
        expect(ctx.client.commandLineDisplay).toBe(":");
    });

    test("the command ack runs the command and clears the line", () => {
        const { ctx, logout } = makeCtx(ClientPhysicsMode.NONE);
        ctx.client.commandLineDisplay = ":wq";
        handlers.handleAckSubtype(ctx, commandAck("COMMAND", "wq"));
        expect(ctx.client.commandLineDisplay).toBe("");
        expect(logout).toHaveBeenCalled();
    });

    test("an empty command is a cancel: the line clears, nothing runs", () => {
        const { ctx, logout } = makeCtx(ClientPhysicsMode.NONE);
        ctx.client.commandLineDisplay = ":wq";
        handlers.handleAckSubtype(ctx, commandAck("COMMAND", ""));
        expect(ctx.client.commandLineDisplay).toBe("");
        expect(logout).not.toHaveBeenCalled();
    });
});

describe("command line in prediction mode", () => {
    test("the echo leaves the line to the local prediction", () => {
        const { ctx } = makeCtx(ClientPhysicsMode.FULL_PREDICTION);
        handlers.handleAckSubtype(ctx, commandAck("COMMAND_PARTIAL", "wq"));
        expect(ctx.client.commandLineDisplay).toBe("");
    });

    test("the command ack does not run the command a second time", () => {
        const { ctx, logout } = makeCtx(ClientPhysicsMode.FULL_PREDICTION);
        handlers.handleAckSubtype(ctx, commandAck("COMMAND", "wq"));
        expect(logout).not.toHaveBeenCalled();
    });
});

describe("rejected command actions", () => {
    test("a rejected command clears the optimistic command line", () => {
        const { ctx } = makeCtx(ClientPhysicsMode.FULL_PREDICTION);
        ctx.client.commandLineDisplay = ":wq";
        ctx.client.inputBuffer = [
            {
                seq: 3,
                action: { type: "COMMAND_LINE", command: "wq" },
                snapshotBefore: snapshot,
            },
        ];
        const handled = handlers.handleAckSubtype(ctx, rejectionAck(3));
        expect(handled).toBe(false);
        expect(ctx.client.commandLineDisplay).toBe("");
    });

    test("a rejected movement leaves the command line alone", () => {
        const { ctx } = makeCtx(ClientPhysicsMode.FULL_PREDICTION);
        ctx.client.commandLineDisplay = ":wq";
        ctx.client.inputBuffer = [
            {
                seq: 3,
                action: { type: "MOVE", key: "j" },
                snapshotBefore: snapshot,
            },
        ];
        handlers.handleAckSubtype(ctx, rejectionAck(3));
        expect(ctx.client.commandLineDisplay).toBe(":wq");
    });
});
