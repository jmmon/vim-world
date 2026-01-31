import { Direction, Vec2 } from "~/types/worldTypes";

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


