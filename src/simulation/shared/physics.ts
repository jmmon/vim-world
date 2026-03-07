export enum ClientPhysicsMode {
    FULL_PREDICTION, // (default) collision checks on client, movement predictions before ACK (turn on collision and prediction)
    VISUAL_ONLY, // turn off collision checks on client, keep only movement predictions; use server to validate and correct (turn off collision, turn on prediction)
    NONE, // server-controlled, wait for ACK before rendering anything (turn off collision and prediction)
}
export interface PhysicsMode {
    collision: boolean;
    prediction: boolean;
}

type PhysicsGetter = (physicsMode?: ClientPhysicsMode) => PhysicsMode;

export const getClientPhysics: PhysicsGetter = (physicsMode) => ({
    collision: physicsMode === ClientPhysicsMode.FULL_PREDICTION,
    prediction: physicsMode !== ClientPhysicsMode.NONE,
});

export const getServerPhysics: PhysicsGetter = (_) => ({
    collision: true,
    prediction: true,
});

