type ClientData = {
    ws: any;
    lastMessageTime: number;
    isAfk: boolean;
    playerId: string;
};
export const clients = new Map<string, ClientData>();
