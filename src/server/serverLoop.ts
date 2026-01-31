import { clients } from "./serverState";
import { markAfkPlayer, startCloseAfkPlayer, terminateAfkPlayer } from "./wss/handleAfkDisconnect";

export default function serverLoop() {
    console.log('started serverLoop');
    let ticks = 0;

    setInterval(() => {
        ticks++;
        // TODO: some other loop to process actions...
        // // e.g. process one move action per tick from the player's action queue


        // every 5 seconds
        if (ticks % 100 === 0) {
            Array.from(clients.entries()).forEach(([key, { isAfk }]) => {
                if (!isAfk) {
                    markAfkPlayer(key);
                } else {
                    startCloseAfkPlayer(key);
                    terminateAfkPlayer(key);
                }
            });
        }
    }, 50);
}


