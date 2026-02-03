import { Direction, MapObject, Vec2 } from "~/types/worldTypes";

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


export type ValidateYankValid = {
    ok: true;
    reason: undefined;
    targetObj: MapObject;
    lastPosBeforeObject: Vec2;
}
export type ValidateYankError = {
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    targetObj?: MapObject;
    lastPosBeforeObject?: Vec2;
}
export type ValidateYankResult = Expand<ValidateYankValid | ValidateYankError>; 


export type ValidatePasteValid = {
    ok: true;
    reason: undefined;
    obj: MapObject;
    targetPos: Vec2;
}
export type ValidatePasteError = {
    ok: false;
    reason: ReasonCorrection | ReasonInvalid;
    obj?: MapObject;
    targetPos?: Vec2;
}
export type ValidatePasteResult = Expand<ValidatePasteValid | ValidatePasteError>; 


export type ValidateInteractResult = ValidatePasteResult | ValidateYankResult;
export type ValidateInteractValid = ValidatePasteValid | ValidateYankValid;

