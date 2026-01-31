import { QRL } from "@builder.io/qwik";
import { VimAction } from "~/fsm/types";
import { ServerWorld } from "~/server/types";
import { Player, Vec2 } from "~/types/worldTypes";

export interface Prediction {
    seq: number;
    action: VimAction;
    snapshotBefore: Player;
}

export type ClientData = {
    player?: Player; // not really needed??? but might be better to look up once only
    username?: string;
    usernameHash?: string; // needed??
    lastProcessedSeq?: number;
};
export type InitializeClientData = {
    player: Player;
    username: string;
    usernameHash: string;
};
export type InterfaceData = {
    show: {
        help: boolean;
        menu: boolean;
        afk: boolean;
    };
};
export type LocalWorldWrapper = {
    world: ServerWorld & {
        lastScale: number;
    };
    client: ClientData;
    isWithinBounds: QRL<(target: Vec2) => boolean>;
    isWalkable: QRL<(target: Vec2) => boolean>;
    addPlayer: QRL<(player: Player) => boolean>;
    initClientData: QRL<(data: InitializeClientData) => boolean>;
    getScaledTileSize: QRL<
        (desiredScale: number) => { actualScale: number; tileSize: number }
    >;
    rerender: QRL<() => void>;
} & InterfaceData;


