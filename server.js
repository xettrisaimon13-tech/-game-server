const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK');
});

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ server });

let players = {};
let queue = [];
const MATCH_SIZE = 2;

server.listen(PORT, () => console.log('Server on port ' + PORT));

wss.on('connection', (ws) => {
    let my_id = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'register') {
            my_id = msg.player_id;
            players[my_id] = { ws, name: msg.name };
            console.log('Joined: ' + msg.name + ' [' + my_id + ']');
        }

        if (msg.type === 'find_match') {
            if (!queue.includes(my_id)) queue.push(my_id);
            console.log('Queue: ' + queue.length + '/' + MATCH_SIZE);
            if (queue.length >= MATCH_SIZE) {
                const room = queue.splice(0, MATCH_SIZE);
                const room_id = Date.now().toString(36).toUpperCase();
                room.forEach(pid => {
                    players[pid]?.ws.send(JSON.stringify({
                        type: 'match_found',
                        room_id: room_id,
                        players: room
                    }));
                });
                console.log('Match found! Room: ' + room_id);
            }
        }
    });

    ws.on('close', () => {
        if (my_id) {
            delete players[my_id];
            queue = queue.filter(id => id !== my_id);
            console.log('Left: ' + my_id);
        }
    });
});
