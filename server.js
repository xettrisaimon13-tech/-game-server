const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 7002;

function log(tag, msg) {
    const t = new Date().toISOString().slice(11, 19);
    console.log('[' + t + '] [' + tag + '] ' + msg);
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/status') {
        let totalPlayers = 0;
        let totalRooms = 0;
        rooms.forEach((room) => {
            totalPlayers += room.players.length;
            totalRooms++;
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'OK',
            server: 'DARK WARD Voice Relay',
            totalRooms: totalRooms,
            totalPlayers: totalPlayers
        }, null, 2));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DARK WARD Voice Server\n/status');
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();
const players = new Map();
let nextPlayerId = 1;

function broadcastToRoom(roomName, message, excludeWs) {
    const room = rooms.get(roomName);
    if (!room) return;
    const data = JSON.stringify(message);
    room.players.forEach(p => {
        if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(data);
        }
    });
}

function sendTo(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

wss.on('connection', (ws) => {
    const playerId = nextPlayerId++;
    const player = {
        ws, id: playerId,
        name: 'Player' + playerId,
        roomName: null,
        identity: '',
        micOn: false
    };
    players.set(playerId, player);
    log('CONNECT', 'Player connected -> id=' + playerId + ' total=' + players.size);
    sendTo(ws, { type: 'welcome', player_id: playerId });

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
        const p = players.get(playerId);
        if (!p) return;

        switch (msg.type) {

            case 'join': {
                const roomName = msg.room || 'default';
                const identity = msg.identity || ('player_' + playerId);

                if (p.roomName) {
                    const oldRoom = rooms.get(p.roomName);
                    if (oldRoom) {
                        oldRoom.players = oldRoom.players.filter(pl => pl.id !== playerId);
                        broadcastToRoom(p.roomName, { type: 'player_left', player_id: playerId });
                        log('LEAVE', p.name + ' left voice room "' + p.roomName + '"');
                        if (oldRoom.players.length === 0) {
                            rooms.delete(p.roomName);
                            log('ROOM', 'Voice room "' + p.roomName + '" destroyed (empty)');
                        }
                    }
                }

                p.roomName = roomName;
                p.identity = identity;
                p.name = identity;

                if (!rooms.has(roomName)) {
                    rooms.set(roomName, { name: roomName, players: [] });
                    log('ROOM', 'Voice room "' + roomName + '" created');
                }

                const room = rooms.get(roomName);
                room.players.push(p);

                sendTo(ws, {
                    type: 'joined',
                    player_id: playerId,
                    room: roomName,
                    players: room.players.map(pl => ({ id: pl.id, name: pl.name }))
                });

                broadcastToRoom(roomName, {
                    type: 'player_joined',
                    player_id: playerId,
                    name: p.name
                }, ws);

                log('JOIN', '*** ' + p.name + ' (id=' + playerId + ') joined voice room "' + roomName + '" [' + room.players.length + ' players] ***');
                break;
            }

            case 'audio_data': {
                if (!p.roomName) break;
                broadcastToRoom(p.roomName, {
                    type: 'audio_data',
                    player_id: playerId,
                    data: msg.data
                }, ws);
                break;
            }

            case 'mic_state': {
                if (!p.roomName) break;
                p.micOn = msg.on;
                const state = msg.on ? 'ON' : 'OFF';
                log('MIC', '*** ' + p.name + ' (id=' + playerId + ') mic ' + state + ' in room "' + p.roomName + '" ***');
                broadcastToRoom(p.roomName, {
                    type: 'mic_state',
                    player_id: playerId,
                    on: msg.on
                }, ws);
                break;
            }

            case 'ping': {
                sendTo(ws, { type: 'pong', time: msg.time });
                break;
            }
        }
    });

    ws.on('close', () => {
        const p = players.get(playerId);
        if (p) {
            if (p.roomName) {
                const room = rooms.get(p.roomName);
                if (room) {
                    room.players = room.players.filter(pl => pl.id !== playerId);
                    broadcastToRoom(p.roomName, { type: 'player_left', player_id: playerId });
                    log('LEAVE', p.name + ' disconnected from voice room "' + p.roomName + '" [' + room.players.length + ' remaining]');
                    if (room.players.length === 0) {
                        rooms.delete(p.roomName);
                        log('ROOM', 'Voice room "' + p.roomName + '" destroyed (empty)');
                    }
                }
            }
            log('DISCONNECT', p.name + ' (id=' + playerId + ') disconnected total=' + (players.size - 1));
            players.delete(playerId);
        }
    });

    ws.on('error', (err) => {
        log('ERROR', 'Voice WS error id=' + playerId + ': ' + err.message);
        const p = players.get(playerId);
        if (p) {
            if (p.roomName) {
                const room = rooms.get(p.roomName);
                if (room) {
                    room.players = room.players.filter(pl => pl.id !== playerId);
                    broadcastToRoom(p.roomName, { type: 'player_left', player_id: playerId });
                    if (room.players.length === 0) rooms.delete(p.roomName);
                }
            }
            players.delete(playerId);
        }
    });
});

server.listen(PORT, () => {
    log('VOICE', '=========================================');
    log('VOICE', 'DARK WARD Voice Server running');
    log('VOICE', 'Port: ' + PORT);
    log('VOICE', 'WS: ws://0.0.0.0:' + PORT);
    log('VOICE', 'Status: http://0.0.0.0:' + PORT + '/status');
    log('VOICE', '=========================================');
});
