import { Direction, Vec2, WorldEntity } from "~/types/worldTypes";

export type ReasonInvalid = 'INVALID_KEY' | 'INVALID_ACTION';
export type ReasonRejected =  ReasonInvalid | 'INVALID_SEQUENCE';
export type ReasonCorrection = 'OUT_OF_BOUNDS' | 'COLLISION'; 
export type ValidateMoveInvalid = {
    ok: false;
    reason: ReasonInvalid;
    processedCount?: number;
};
export type ValidateMoveCorrection = {
    ok: false;
    reason: ReasonCorrection;
    target: Vec2;
    dir?: Direction;
    processedCount: number;
};
export type ValidateMoveValid = {
    ok: true;
    reason: undefined;
    target: Vec2;
    dir?: Direction;
    processedCount?: number;
};
export type ValidateMoveResult = 
    | ValidateMoveInvalid 
    | ValidateMoveCorrection 
    | ValidateMoveValid;

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type ApplyInteractResult = {
    seq: number;
    reason: ReasonInvalid | ReasonCorrection | undefined;
};
export type ApplyMoveResult = {
    seq: number;
    reason?: ReasonInvalid | ReasonCorrection;
}
export type ApplyActionResult = Expand<ApplyMoveResult | ApplyInteractResult>;

interface ValidateInteractBase {
    ok: boolean;
    reason: ReasonCorrection | ReasonInvalid | undefined;
    obj?: WorldEntity;
    pos?: Vec2;
}

export interface ValidateYankValid extends ValidateInteractBase {
    ok: true;
    reason: undefined;
    obj: WorldEntity;
    pos: Vec2;
}
export interface ValidateYankError extends ValidateInteractBase { 
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    obj?: WorldEntity;
    pos?: Vec2;
}
export type ValidateYankResult = Expand<ValidateYankValid | ValidateYankError>; 



export interface ValidatePasteValid extends ValidateInteractBase {
    ok: true;
    reason: undefined;
    obj: WorldEntity;
    pos: Vec2;
}
export interface ValidatePasteError extends ValidateInteractBase {
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    obj?: WorldEntity;
    pos?: Vec2;
}
export type ValidatePasteResult = Expand<ValidatePasteValid | ValidatePasteError>; 



// export type ValidateInteractResult<T extends OperatorKey> = 'p' extends T ? ValidatePasteResult : ValidateYankResult;
export type ValidateInteractResult = ValidatePasteResult | ValidateYankResult;
// export type ValidateInteractValid<T extends OperatorKey> = 'p' extends T ? ValidatePasteValid : ValidateYankValid;
export type ValidateInteractValid = ValidatePasteValid | ValidateYankValid;

