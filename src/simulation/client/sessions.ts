/**
 * Tracks which server session owns each other player, so a late arriving
 * disconnect cannot remove a player who has already reconnected.
 *
 * When a player reloads, the new session's CONNECT can arrive before the
 * old session's DISCONNECT. Both carry a sessionId; the client only drops
 * a player when the disconnect belongs to the session it currently holds.
 */
export type SessionMap = Record<string, string>;

export function recordSession(
    sessions: SessionMap,
    playerId: string,
    sessionId: string,
): boolean {
    const isNewPlayer = sessions[playerId] === undefined;
    sessions[playerId] = sessionId;
    return isNewPlayer;
}

/** true when the disconnect refers to a session the player no longer holds */
export function isStaleDisconnect(
    sessions: SessionMap,
    playerId: string,
    sessionId: string,
): boolean {
    const held = sessions[playerId];
    return held !== undefined && held !== sessionId;
}