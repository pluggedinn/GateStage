import { createServer } from "node:http";
import path from "node:path";
import { parse } from "node:url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { broadcaster } from "./lib/broadcaster";
import { getLogFilePath, initLogger, logger } from "./lib/logger";
import {
  getRaceBrain,
  initRaceBrain,
  shutdownRaceBrain,
} from "./lib/race-brain";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 8080);
/** App root for Next (standalone dir when packaged). */
const dir = process.env.GATESTAGE_APP_DIR
  ? path.resolve(process.env.GATESTAGE_APP_DIR)
  : process.cwd();

const app = next({ dev, hostname, port, dir });
const handle = app.getRequestHandler();

initLogger();
logger.info("gatestage", "starting", {
  hostname,
  port,
  dir,
  logPath: getLogFilePath(),
});

app
  .prepare()
  .then(() => {
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
      logger.info("socket.io", `client connected ${socket.id}`);
      const { raceManagerListener } = getRaceBrain();
      socket.emit(
        "connection:raceManager",
        raceManagerListener?.getConnectionState() ?? {
          provider: "next",
          connected: false,
          status: "available",
        },
      );
      broadcaster.replayRecent(socket);
      socket.on("disconnect", () => {
        logger.info("socket.io", `client disconnected ${socket.id}`);
      });
    });

    httpServer.listen(port, hostname, () => {
      logger.info("gatestage", `ready on http://${hostname}:${port}`);
      logger.info("gatestage", `app dir ${dir}`);
    });

    const shutdown = () => {
      logger.info("gatestage", "shutting down");
      shutdownRaceBrain();
      io.close();
      httpServer.close(() => {
        process.exit(0);
      });
      // Force-exit if close hangs (open keep-alive sockets).
      setTimeout(() => process.exit(0), 2_000).unref();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  })
  .catch((err: unknown) => {
    logger.error("gatestage", "failed to start", err);
    process.exit(1);
  });
