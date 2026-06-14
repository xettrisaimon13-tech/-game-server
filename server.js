const { WebSocketServer } = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Game Server Running');
});

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ server });

let players = {};
let matchmaking_queue = [];
const MATCH_SIZE = 2;

server.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});

wss.on('connection', (ws) => {
    let my_id = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case 'register':
                my_id = msg.player_id;
                players[my_id] = { ws, name: msg.name, player_id: my_id };
                break;
            case 'find_match':
                if (!matchmaking_queue.includes(my_id)) {
                    matchmaking_queue.push(my_id);
                }
                check_match();
                break;
            case 'cancel_match':
                matchmaking_queue = matchmaking_queue.filter(id => id !== my_id);
                break;
            case 'host_room':
                ws.send(JSON.stringify({ type: 'room_created', room_code: my_id }));
                break;
            case 'join_room':
                const host = Object.values(players).find(p => p.player_id === msg.room_code);
                if (host) {
                    ws.send(JSON.stringify({ type: 'join_success' }));
                } else {
                    ws.send(JSON.stringify({ type: 'join_failed', reason: 'Room bhethiyena!' }));
                }
                break;
        }
    });

    ws.on('close', () => {
        if (my_id) {
            delete players[my_id];
            matchmaking_queue = matchmaking_queue.filter(id => id !== my_id);
        }
    });
});

function check_match() {
    if (matchmaking_queue.length >= MATCH_SIZE) {
        const room = matchmaking_queue.splice(0, MATCH_SIZE);
        const room_id = Date.now().toString(36).toUpperCase();
        room.forEach(pid => {
            players[pid]?.ws.send(JSON.stringify({ type: 'match_found', room_id, players: room }));
        });
    }
}
