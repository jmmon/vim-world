export enum ClientPhysicsMode {
  FULL_PREDICTION, // (default) collision checks on client, movement predictions before ACK (turn on collision and prediction)
  VISUAL_ONLY, // turn off collision checks on client, keep only movement predictions; use server to validate and correct (turn off collision, turn on prediction)
  NONE, // server-controlled, wait for ACK before rendering anything (turn off collision and prediction)
};
export interface PhysicsMode {
    collision: boolean;
    prediction: boolean;
}
export interface ServerPhysicsMode extends PhysicsMode {
    collision: true,
    prediction: true,
}

const clientPhysicsMode: ClientPhysicsMode = ClientPhysicsMode.NONE;

export const CLIENT_PHYSICS: PhysicsMode = {
    collision: clientPhysicsMode as ClientPhysicsMode === ClientPhysicsMode.FULL_PREDICTION,
    prediction: clientPhysicsMode as ClientPhysicsMode !== ClientPhysicsMode.NONE,
};
export const SERVER_PHYSICS: ServerPhysicsMode = {
    collision: true,
    prediction: true,
};

