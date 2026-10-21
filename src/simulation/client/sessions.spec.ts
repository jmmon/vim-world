import { describe, expect, test } from "vitest";
import { isStaleDisconnect, recordSession, SessionMap } from "./sessions";

const empty = (): SessionMap => ({});

describe("recordSession", () => {
    test("reports a player seen for the first time", () => {
        const sessions = empty();
        expect(recordSession(sessions, "p1", "s1")).toBe(true);
    });

    test("reports an update when the same player reconnects elsewhere", () => {
        const sessions = empty();
        recordSession(sessions, "p1", "s1");
        expect(recordSession(sessions, "p1", "s2")).toBe(false);
        expect(sessions.p1).toBe("s2");
    });
});

describe("isStaleDisconnect", () => {
    test("accepts a disconnect for the session we hold", () => {
        const sessions = empty();
        recordSession(sessions, "p1", "s1");
        expect(isStaleDisconnect(sessions, "p1", "s1")).toBe(false);
    });

    test("ignores a disconnect from the session the player already left", () => {
        const sessions = empty();
        recordSession(sessions, "p1", "s1");
        recordSession(sessions, "p1", "s2");
        expect(isStaleDisconnect(sessions, "p1", "s1")).toBe(true);
    });

    test("the reconnect race: connect arrives before the old disconnect", () => {
        const sessions = empty();
        recordSession(sessions, "p1", "s1");
        // new session connects first
        recordSession(sessions, "p1", "s2");
        // the old session's disconnect then arrives and must be ignored
        expect(isStaleDisconnect(sessions, "p1", "s1")).toBe(true);
        expect(sessions.p1).toBe("s2");
    });

    test("ignores a disconnect for a player we never saw", () => {
        const sessions = empty();
        expect(isStaleDisconnect(sessions, "ghost", "s1")).toBe(false);
    });

    test("normal ordering: connect then its own disconnect is not stale", () => {
        const sessions = empty();
        recordSession(sessions, "p1", "s1");
        expect(isStaleDisconnect(sessions, "p1", "s1")).toBe(false);
    });
});