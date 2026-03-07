export enum ClientPhysicsMode {
     /** (testing) not asking server to verify actions, only client logic */
    CLIENT_ONLY,
     /** (default) collision checks on client, movement predictions before ACK
      * (turn on collision and prediction) */
    FULL_PREDICTION,
    /** turn off collision checks on client, keep only movement predictions;
     * use server to validate and correct (turn off collision, turn on prediction) */
    VISUAL_ONLY, 
    /** server-controlled, wait for ACK before rendering anything
     * (turn off collision and prediction) */
    NONE, 
}

export interface PhysicsMode {
    /** enables or disables client collision
     * @example if false, no corrections happen on the client,
     *  only after receiving an error from the server ACK message
     * */
    collision: boolean;
    /** enables or disables client prediction
     * @example if false, actions don't apply until after receiving ack from server
     * */
    prediction: boolean;
    /** enables or disables dispatching actions from client to server for verification
     * @example if false, actions don't get verified by the server (for testing)
     *  - affects only the client
     * */
    serverAck: boolean;
}

type PhysicsGetter = (physicsMode?: ClientPhysicsMode) => PhysicsMode;

export const getClientPhysics: PhysicsGetter = (physicsMode) => ({
    collision:
        physicsMode === ClientPhysicsMode.FULL_PREDICTION ||
        physicsMode === ClientPhysicsMode.CLIENT_ONLY,
    prediction: physicsMode !== ClientPhysicsMode.NONE, // 3
    serverAck: physicsMode !== ClientPhysicsMode.CLIENT_ONLY, // 0 // turn off ack when full_client
});

export const getServerPhysics: PhysicsGetter = (_) => ({
    collision: true,
    prediction: true,
    serverAck: true,
});
