"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LevelFilter = "all" | "info" | "warn" | "error";

type ParsedLine = {
  raw: string;
  ts?: string;
  level?: LogLevel;
  component?: string;
  message?: string;
};

const LINE_RE = /^(\S+)\s+(DEBUG|INFO|WARN|ERROR)\s+\[([^\]]+)\]\s+(.*)$/;

const FILTERS: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "info", label: "Info+" },
  { id: "warn", label: "Warn+" },
  { id: "error", label: "Error" },
];

const LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const FILTER_MIN: Record<LevelFilter, number> = {
  all: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function parseLine(raw: string): ParsedLine {
  const match = LINE_RE.exec(raw);
  if (!match) return { raw };
  return {
    raw,
    ts: match[1],
    level: match[2] as LogLevel,
    component: match[3],
    message: match[4],
  };
}

function levelClass(level?: LogLevel) {
  if (level === "ERROR") return "text-status-error";
  if (level === "WARN") return "text-status-warn";
  if (level === "DEBUG") return "text-status-muted";
  return "text-foreground";
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function passesFilter(line: ParsedLine, filter: LevelFilter) {
  if (filter === "all") return true;
  if (!line.level) return true;
  return LEVEL_RANK[line.level] >= FILTER_MIN[filter];
}

export default function LogsPage() {
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<LevelFilter>("all");
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/logs");
      if (!res.ok) {
        setError("Could not read log file.");
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as { path: string; content: string };
      setPath(data.path);
      setContent(data.content);
      setError(null);
      setLoaded(true);
    } catch {
      setError("Could not read log file.");
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2000);
    return () => clearInterval(id);
  }, [load]);

  const lines = content
    .split("\n")
    .filter((line) => line.length > 0)
    .map(parseLine)
    .filter((line) => passesFilter(line, filter));

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-pin scroll when log content grows
  useEffect(() => {
    if (!follow) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [follow, content]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    setFollow(atBottom);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">Logs</h1>
          <p className="text-base text-muted-foreground">
            Append-only file that survives restarts. Last 256 KB of the current
            file.
          </p>
          {path ? (
            <p className="mt-2 truncate font-mono text-sm text-muted-foreground">
              {path}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              follow ? "bg-status-ok" : "bg-status-muted",
            )}
            aria-hidden
          />
          <span className="text-sm text-muted-foreground">
            {follow ? "Following" : "Paused"}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Event log</CardTitle>
            <CardDescription>
              {error
                ? error
                : !loaded
                  ? "Loading…"
                  : `${lines.length} line${lines.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <Button
                  key={item.id}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            className="h-[min(70vh,40rem)] overflow-auto rounded-lg border border-border bg-muted/30 p-3"
          >
            {!loaded ? (
              <p className="text-base text-muted-foreground">Loading log…</p>
            ) : lines.length === 0 ? (
              <p className="text-base text-muted-foreground">
                No log lines yet. Use the app — discovery, manual lighting, and
                race events will show up here.
              </p>
            ) : (
              <ol className="space-y-0.5 font-mono text-sm leading-relaxed">
                {lines.map((line, index) => (
                  <li
                    key={`${line.raw}-${index}`}
                    className="flex flex-wrap gap-x-3 gap-y-0.5"
                  >
                    {line.level ? (
                      <>
                        <span className="tabular-nums text-muted-foreground">
                          {formatTime(line.ts)}
                        </span>
                        <span
                          className={cn(
                            "w-12 shrink-0 font-medium",
                            levelClass(line.level),
                          )}
                        >
                          {line.level}
                        </span>
                        <span className="w-44 shrink-0 text-muted-foreground">
                          {line.component}
                        </span>
                        <span className="min-w-0 break-all text-foreground">
                          {line.message}
                        </span>
                      </>
                    ) : (
                      <span className="break-all text-muted-foreground">
                        {line.raw}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
