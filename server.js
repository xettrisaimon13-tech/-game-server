const http = require("http");
const { AccessToken } = require("livekit-server-sdk");

const PORT = process.env.PORT || 3000;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "APIGiBWgPVPk83s";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "PzAp9nDJODsgi5MehfqBaLwjhyYaotJYeomslGvRDdOB";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://night-ward-tz4q970d.livekit.cloud";

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/livekit-token" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const { room, identity, name } = JSON.parse(body);
        if (!room || !identity) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "room and identity required" }));
          return;
        }
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity: String(identity),
          name: name || String(identity),
          ttl: 86400,
        });
        at.addGrant({
          roomJoin: true,
          room: String(room),
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        });
        const token = await at.toJwt();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: token, url: LIVEKIT_URL }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "token generation failed" }));
      }
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "LiveKit Token Server Online" }));
});

server.listen(PORT, () => {
  console.log("LiveKit Token Server on port " + PORT);
});
