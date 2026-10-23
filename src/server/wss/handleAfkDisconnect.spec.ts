import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import WebSocket from "ws";
import {
    configureAfkTimings,
    markAfkPlayer,
    startCloseAfkPlayer,
    terminateAfkPlayer,
} from "./handleAfkDisconnect";
import { clients } from "../serverState";
import { ClientSession } from "../types";

type FakeWs = {
    readyState: number;
    sent: string[];
    send: (data: string) => void;
    close: () => void;
    terminate: () => void;
};

const fakeWs = (): FakeWs => {
    const sent: string[] = [];
    return {
        readyState: WebSocket.OPEN,
        sent,
        send: (data: string) => {
            sent.push(data);
        },
        close: vi.fn(),
        terminate: vi.fn(),
    };
};

type TestClient = Omit<ClientSession, "ws"> & { ws: FakeWs };

const makeClient = (clientId: string, playerId?: string): TestClient => ({
    clientId,
    ws: fakeWs(),
    lastMessageTime: now,
    isAfk: false,
    reset: function () {
        this.lastMessageTime = now;
        this.isAfk = false;
    },
    disconnect: function () {
        this.ws.terminate();
        clients.delete(this.clientId);
    },
    playerId,
});

let now = 1_000_000;
let resetTimings: () => void;

beforeEach(() => {
    now = 1_000_000;
    clients.clear();
    resetTimings = configureAfkTimings({
        afkMs: 1_000,
        disconnectMs: 2_000,
        terminateMs: 500,
        now: () => now,
    });
});

afterEach(() => {
    clients.clear();
    resetTimings();
});

describe("afk ladder", () => {
    test("warns only after the afk threshold", () => {
        const client = makeClient("c1", "p1");
        clients.set("c1", client);

        now += 900;
        markAfkPlayer("c1");
        expect(client.ws.sent).toHaveLength(0);
        expect(client.isAfk).toBe(false);

        now += 200;
        markAfkPlayer("c1");
        expect(JSON.parse(client.ws.sent[0])).toEqual({ type: "AFK" });
        expect(client.isAfk).toBe(true);
    });

    test("asks for a checkpoint after the disconnect threshold", () => {
        const client = makeClient("c1", "p1");
        clients.set("c1", client);

        now += 1_500;
        startCloseAfkPlayer("c1");
        expect(client.ws.sent).toHaveLength(0);

        now += 1_000;
        startCloseAfkPlayer("c1");
        expect(JSON.parse(client.ws.sent[0])).toEqual({
            type: "CLOSE",
            subtype: "START",
        });
    });

    test("terminate does nothing before the grace period ends", () => {
        const client = makeClient("c1", "p1");
        clients.set("c1", client);

        now += 2_400;
        terminateAfkPlayer("c1");

        expect(client.ws.terminate).not.toHaveBeenCalled();
        expect(client.ws.sent).toHaveLength(0);
        expect(clients.has("c1")).toBe(true);
    });

    test("terminate closes the socket and drops the client", () => {
        const client = makeClient("c1", "p1");
        clients.set("c1", client);

        now += 2_600;
        terminateAfkPlayer("c1");

        expect(JSON.parse(client.ws.sent[0])).toEqual({
            type: "CLOSE",
            subtype: "END",
        });
        expect(client.ws.terminate).toHaveBeenCalled();
        expect(clients.has("c1")).toBe(false);
    });

    test("terminate tells the other clients the player left", () => {
        const afk = makeClient("c-afk", "p1");
        const watcher = makeClient("c-watch", "p2");
        clients.set("c-afk", afk);
        clients.set("c-watch", watcher);

        now += 2_600;
        terminateAfkPlayer("c-afk");

        const messages = watcher.ws.sent.map((raw) => JSON.parse(raw));
        const disconnect = messages.find((m) => m.type === "PLAYER");
        expect(disconnect).toEqual({
            type: "PLAYER",
            subtype: "DISCONNECT",
            sessionId: "c-afk",
            playerId: "p1",
        });
        // the afk client is not told about its own departure
        expect(
            afk.ws.sent.some((raw) => JSON.parse(raw).subtype === "DISCONNECT"),
        ).toBe(false);
    });

    test("terminate ignores a client that is already gone", () => {
        expect(() => terminateAfkPlayer("missing")).not.toThrow();
    });

    test("terminate leaves an already closed socket alone", () => {
        const client = makeClient("c1", "p1");
        client.ws.readyState = WebSocket.CLOSED;
        clients.set("c1", client);

        now += 2_600;
        terminateAfkPlayer("c1");

        expect(client.ws.terminate).not.toHaveBeenCalled();
        expect(clients.has("c1")).toBe(true);
    });
});

describe("spectator sockets", () => {
    test("a socket that never identified is not put on the afk ladder", () => {
        const client = makeClient("c1");
        clients.set("c1", client);

        now += 10_000;
        markAfkPlayer("c1");
        startCloseAfkPlayer("c1");
        terminateAfkPlayer("c1");

        expect(client.ws.sent).toHaveLength(0);
        expect(client.isAfk).toBe(false);
        expect(client.ws.terminate).not.toHaveBeenCalled();
        expect(clients.has("c1")).toBe(true);
    });
});
