// server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let players = {};
let nextId = 1;

console.log("================================");
console.log("Dark Ward Server Started");
console.log("Port:", PORT);
console.log("================================");

function broadcast(data, except = null) {
    const msg = JSON.stringify(data);

    wss.clients.forEach(client => {
        if (
            client.readyState === WebSocket.OPEN &&
            client !== except
        ) {
            client.send(msg);
        }
    });
}

wss.on("connection", (ws) => {

    const id = nextId++;

    players[id] = {
        id: id,
        x: 0,
        y: 0,
        z: 0,
        rot: 0,
        anim: "Idle"
    };

    console.log("Player Connected:", id);

    ws.send(JSON.stringify({
        type: "welcome",
        id: id,
        players: players
    }));

    broadcast({
        type: "player_join",
        player: players[id]
    }, ws);

    ws.on("message", (message) => {

        let data;

        try {
            data = JSON.parse(message);
        } catch {
            return;
        }

        switch (data.type) {

            case "move":

                if (!players[id]) return;

                players[id].x = data.x;
                players[id].y = data.y;
                players[id].z = data.z;
                players[id].rot = data.rot;
                players[id].anim = data.anim;

                broadcast({
                    type: "move",
                    id: id,
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    rot: data.rot,
                    anim: data.anim
                }, ws);

                break;

        }

    });

    ws.on("close", () => {

        console.log("Player Left:", id);

        delete players[id];

        broadcast({
            type: "player_leave",
            id: id
        });

    });

});
