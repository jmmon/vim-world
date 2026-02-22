import { Direction, Vec2, WorldEntity } from "~/types/worldTypes";

export type ReasonInvalid = 'INVALID_KEY' | 'INVALID_ACTION';
export type ReasonRejected =  ReasonInvalid | 'INVALID_SEQUENCE';
export type ReasonCorrection = 'OUT_OF_BOUNDS' | 'COLLISION'; 
export type ValidateMoveInvalid = { ok: false; reason: ReasonInvalid; };
export type ValidateMoveCorrection = { ok: false; reason: ReasonCorrection; target: Vec2; dir?: Direction; };
export type ValidateMoveValid = { ok: true; reason: undefined; target: Vec2; dir?: Direction; };
export type ValidateMoveResult = 
    | ValidateMoveInvalid 
    | ValidateMoveCorrection 
    | ValidateMoveValid;

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

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
}

interface ValidateYankBase extends ValidateInteractBase {
    targetObj?: WorldEntity;
    lastPosBeforeObject?: Vec2;
}
export interface ValidateYankValid extends ValidateYankBase {
    ok: true;
    reason: undefined;
    targetObj: WorldEntity;
    lastPosBeforeObject: Vec2;
}
export interface ValidateYankError extends ValidateYankBase { 
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    targetObj?: WorldEntity;
    lastPosBeforeObject?: Vec2;
}
export type ValidateYankResult = Expand<ValidateYankValid | ValidateYankError>; 

interface ValidatePasteBase extends ValidateInteractBase {
    obj?: WorldEntity;
    targetPos?: Vec2;
}
export interface ValidatePasteValid extends ValidatePasteBase {
    ok: true;
    reason: undefined;
    obj: WorldEntity;
    targetPos: Vec2;
}
export interface ValidatePasteError extends ValidatePasteBase {
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    obj?: WorldEntity;
    targetPos?: Vec2;
}
export type ValidatePasteResult = Expand<ValidatePasteValid | ValidatePasteError>; 



// export type ValidateInteractResult<T extends OperatorKey> = 'p' extends T ? ValidatePasteResult : ValidateYankResult;
export type ValidateInteractResult = ValidatePasteResult | ValidateYankResult;
// export type ValidateInteractValid<T extends OperatorKey> = 'p' extends T ? ValidatePasteValid : ValidateYankValid;
export type ValidateInteractValid = ValidatePasteValid | ValidateYankValid;

