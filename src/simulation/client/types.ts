import { NoSerialize } from "@builder.io/qwik";
import { VimFSM } from "~/fsm/fsm";
import { ExpandedVimAction, VimAction } from "~/fsm/types";
import { PlayerCheckpoint } from "~/server/checkpointService";
import { World } from "~/server/types";
import { PhysicsMode } from "~/simulation/shared/physics";
import { SessionMap } from "./sessions";
import { CommandLineState, Player, Vec2 } from "~/types/worldTypes";

export interface Prediction {
    seq: number;
    action: VimAction;
    snapshotBefore: Player;
}
export type IsDirty = {
    overlay: boolean,
    players: boolean,
    objects: boolean,
    map: boolean,
};

export type Viewport = {
    origin: Vec2,
    width: number; // px
    height: number; // px
};
export type VimSettings = {
    sidescrolloff: number,
    scrolloff: number,
    lines: number,
    columns: number,
};

export type ClientData = {
    fsm: NoSerialize<VimFSM>;
    isReady: boolean;
    settings: VimSettings;
    player?: Player;
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
    afkStartTime: number;
    idleStartTime: number;
    timeSinceLastCheckpoint: number;
    isDirty: IsDirty;
    inputBuffer: Prediction[];
    actionQueue: ExpandedVimAction[];
    tick: number;
    commandLineDisplay: string;
    commandLineState?: CommandLineState;
    lastSnapshot?: Player;
    lastAckCheckpoint?: PlayerCheckpoint;
    viewport: Viewport;
    /** server session each other player is attached to, keyed by playerId */
    otherPlayerSessions: SessionMap;
};
export type InitializeClientData = {
    player: Player;
    username: string;
    usernameHash: string;
};
export type InterfaceData = {
    show: {
        help: boolean;
        helpHint: boolean;
        menu: boolean;
        afk: boolean;
        devStats: boolean;
    };
};

/** outbound messages, declared here so the world type does not depend on the hook */
export type Dispatch = {
    init: (playerId: string) => void;
    action: (seq: number, action: VimAction) => void;
    checkpoint: (player: Player, isClosing?: boolean) => void;
    logout: () => void | Promise<void>;
};

export type LocalWorldWrapper = InterfaceData & {
    world: World<'Client'>;
    client: ClientData;
    physics: PhysicsMode;
    dispatch: Dispatch;
};