import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { broadcaster } from "./lib/broadcaster";
import { getRaceBrain, initRaceBrain } from "./lib/race-brain";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 8080);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: "*" },
  });

  broadcaster.setIo(io);
  initRaceBrain();

  io.on("connection", (socket) => {
    console.log("[socket.io] client connected", socket.id);
    const { nextListener } = getRaceBrain();
    socket.emit("connection:next", {
      nextConnected: nextListener?.isConnected() ?? false,
    });
    socket.on("disconnect", () => {
      console.log("[socket.io] client disconnected", socket.id);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`[gatestage] ready on http://${hostname}:${port}`);
  });
});
