const express = require("express");
const cors = require("cors");
const { AccessToken } = require("livekit-server-sdk");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

app.get("/", (req, res) => {
    res.json({
        status: "Dark Ward LiveKit Token Server Online"
    });
});

app.get("/token", async (req, res) => {
    try {
        const identity = req.query.identity;
        const room = req.query.room;

        if (!identity || !room) {
            return res.status(400).json({
                error: "identity and room are required"
            });
        }

        if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            return res.status(500).json({
                error: "LiveKit credentials are not configured"
            });
        }

        const token = new AccessToken(
            LIVEKIT_API_KEY,
            LIVEKIT_API_SECRET,
            {
                identity: identity,
                ttl: "1h"
            }
        );

        token.addGrant({
            roomJoin: true,
            room: room,
            canPublish: true,
            canSubscribe: true
        });

        const jwt = await token.toJwt();

        res.json({
            token: jwt
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Failed to create LiveKit token"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Dark Ward token server running on port ${PORT}`);
});
