import fs from "node:fs";
import path from "node:path";

const MAX_LOG_BYTES = 10 * 1024 * 1024;
const DEFAULT_TAIL_BYTES = 256 * 1024;

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

function resolveLogFilePath(): string {
  if (process.env.GATESTAGE_LOG_PATH) {
    return path.resolve(process.env.GATESTAGE_LOG_PATH);
  }

  const configPath =
    process.env.GATESTAGE_CONFIG_PATH ??
    path.join(/* turbopackIgnore: true */ process.cwd(), "data", "config.json");
  return path.join(path.dirname(path.resolve(configPath)), "gatestage.log");
}

function serializeDetails(details: unknown): string | undefined {
  if (details === undefined) return undefined;
  if (details instanceof Error) {
    return JSON.stringify({
      name: details.name,
      message: details.message,
      stack: details.stack,
    });
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function formatLine(
  level: LogLevel,
  component: string,
  message: string,
  details?: unknown,
): string {
  const ts = new Date().toISOString();
  const padded = level.padEnd(5);
  let line = `${ts} ${padded} [${component}] ${message}`;
  const serialized = serializeDetails(details);
  if (serialized) line += ` | ${serialized}`;
  return line;
}

function echo(level: LogLevel, line: string) {
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else if (level === "DEBUG") console.debug(line);
  else console.log(line);
}

function rotateIfNeeded(filePath: string) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size < MAX_LOG_BYTES) return;
    const rotated = `${filePath}.1`;
    if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
    fs.renameSync(filePath, rotated);
  } catch {
    // never throw from the logger
  }
}

function appendLine(line: string) {
  const filePath = resolveLogFilePath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${line}\n`, "utf8");
  } catch {
    // file I/O failure → console only
  }
}

function write(
  level: LogLevel,
  component: string,
  message: string,
  details?: unknown,
) {
  const line = formatLine(level, component, message, details);
  echo(level, line);
  appendLine(line);
}

export const logger = {
  debug(component: string, message: string, details?: unknown) {
    write("DEBUG", component, message, details);
  },
  info(component: string, message: string, details?: unknown) {
    write("INFO", component, message, details);
  },
  warn(component: string, message: string, details?: unknown) {
    write("WARN", component, message, details);
  },
  error(component: string, message: string, details?: unknown) {
    write("ERROR", component, message, details);
  },
};

export function getLogFilePath(): string {
  return resolveLogFilePath();
}

export function initLogger() {
  logger.info("gatestage", `logging to ${getLogFilePath()}`);
}

export function readLogTail(maxBytes = DEFAULT_TAIL_BYTES): {
  path: string;
  content: string;
} {
  const filePath = resolveLogFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return { path: filePath, content: "" };
    }

    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - maxBytes);
    const length = stat.size - start;
    const fd = fs.openSync(filePath, "r");
    try {
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, start);
      let content = buf.toString("utf8");
      if (start > 0) {
        const nl = content.indexOf("\n");
        if (nl !== -1) content = content.slice(nl + 1);
      }
      return { path: filePath, content };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { path: filePath, content: "" };
  }
}
