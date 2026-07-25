const http = require('http');
const crypto = require('crypto');

// ============================================================
// CONFIG - Change these to your LiveKit values
// ============================================================
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://your-livekit-server.com';

const PORT = process.env.PORT || 7001;

// ============================================================
// JWT Token Generator (no external deps needed)
// ============================================================
function base64url(data) {
    return Buffer.from(data).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createToken(identity, roomName, ttl) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: LIVEKIT_API_KEY,
        sub: identity,
        iat: now,
        nbf: now,
        exp: now + (ttl || 86400),
        name: identity,
        video: {
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true
        }
    };
    const headerB64 = base64url(JSON.stringify(header));
    const payloadB64 = base64url(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', LIVEKIT_API_SECRET)
        .update(headerB64 + '.' + payloadB64)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return headerB64 + '.' + payloadB64 + '.' + signature;
}

// ============================================================
// HTTP Server
// ============================================================
const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'DARK WARD Voice' }));
        return;
    }

    // Token endpoint
    if (req.url === '/token' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const identity = data.identity || ('player_' + Math.random().toString(36).substr(2, 6));
                const room = data.room || 'dark-ward-default';
                const ttl = data.ttl || 86400;
                const token = createToken(identity, room, ttl);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    token: token,
                    url: LIVEKIT_URL,
                    identity: identity,
                    room: room
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
        return;
    }

    // GET token (simpler, for testing)
    if (req.url && req.url.startsWith('/token')) {
        const url = new URL(req.url, 'http://localhost');
        const identity = url.searchParams.get('identity') || ('player_' + Math.random().toString(36).substr(2, 6));
        const room = url.searchParams.get('room') || 'dark-ward-default';
        const token = createToken(identity, room);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            token: token,
            url: LIVEKIT_URL,
            identity: identity,
            room: room
        }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DARK WARD Voice Server\nGET /token?identity=player1&room=game1\nPOST /token {identity, room}');
});

server.listen(PORT, () => {
    console.log('DARK WARD Voice Server running on port ' + PORT);
    console.log('LiveKit URL: ' + LIVEKIT_URL);
    console.log('Token endpoint: http://localhost:' + PORT + '/token');
});
