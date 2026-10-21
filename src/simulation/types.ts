import { IsDirty } from "./client/types";
import { ReasonCorrection, ReasonInvalid } from "./server/types";

export type ActionResult = {
    isDirty: ApplyActionDirtyResult
    reason?: ReasonCorrection | ReasonInvalid | undefined | "UNHANDLED";
};
export type ApplyActionDirtyResult = Partial<IsDirty> | boolean;
export type MaybePromise<T> = T | Promise<T>;