import { percentToEsphome } from "@/lib/brightness";
import { getDefaultBrightnessPercent } from "@/lib/config/store";
import {
  EFFECT_BY_ID,
  type EffectParamDef,
  mergeEffectParams,
} from "@/lib/effects";
import { logger } from "@/lib/logger";

/** ESPHome light entity name — fixed across all gates */
export const DEFAULT_LIGHT_ENTITY = "Gate LEDs";

export type EsphomeCommand =
  | {
      kind: "effect";
      effectId: string;
      params?: Record<string, number | boolean>;
      brightnessPercent?: number;
      r?: number;
      g?: number;
      b?: number;
    }
  | {
      kind: "rgb";
      r: number;
      g: number;
      b: number;
      brightnessPercent?: number;
    }
  | { kind: "off" };

function resolveEsphomeBrightness(brightnessPercent?: number): number {
  const percent = brightnessPercent ?? getDefaultBrightnessPercent();
  return percentToEsphome(percent);
}

function entityPath(entity: string) {
  return encodeURIComponent(entity);
}

function hostBase(host: string) {
  return host.startsWith("http") ? host : `http://${host}`;
}

function commandTimeoutMs() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_TIMEOUT_MS ?? 800);
}

function commandRetries() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_RETRIES ?? 2);
}

function commandRetryDelayMs() {
  return Number(process.env.GATESTAGE_GATE_COMMAND_RETRY_DELAY_MS ?? 150);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

function describeFetchTarget(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function esphomeFetch(
  url: string,
  init: RequestInit = {},
  options: { retries?: number } = {},
): Promise<Response> {
  const timeoutMs = commandTimeoutMs();
  const retries = options.retries ?? commandRetries();
  const delayMs = commandRetryDelayMs();
  const attempts = retries + 1;
  const target = describeFetchTarget(url);

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok || !isRetryableStatus(res.status) || attempt === attempts) {
        return res;
      }
      logger.warn(
        "esphome",
        `HTTP ${res.status} ${target} attempt ${attempt}/${attempts}, retrying`,
      );
    } catch (err) {
      lastError = err;
      if (attempt === attempts) throw err;
      logger.warn(
        "esphome",
        `${errorMessage(err)} ${target} attempt ${attempt}/${attempts}, retrying`,
      );
    }
    if (attempt < attempts && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("ESPHome request failed");
}

function paramValueForEntity(
  param: EffectParamDef,
  value: number | boolean,
): number {
  if (param.type === "bool") return value ? 1 : 0;
  return typeof value === "number" ? value : 0;
}

async function setEffectParamEntity(
  base: string,
  param: EffectParamDef,
  value: number | boolean,
  options: { retries?: number } = {},
): Promise<void> {
  if (!param.entityName || param.yamlOnly) return;

  if (param.type === "bool") {
    const action = value ? "turn_on" : "turn_off";
    const url = `${base}/switch/${entityPath(param.entityName)}/${action}`;
    await esphomeFetch(url, { method: "POST" }, options);
    return;
  }

  const url = `${base}/number/${entityPath(param.entityName)}/set?value=${paramValueForEntity(param, value)}`;
  await esphomeFetch(url, { method: "POST" }, options);
}

export async function sendEsphomeCommand(
  host: string,
  command: EsphomeCommand,
): Promise<Response> {
  const base = hostBase(host);
  const entitySeg = entityPath(DEFAULT_LIGHT_ENTITY);

  if (command.kind === "off") {
    const url = `${base}/light/${entitySeg}/turn_off`;
    return esphomeFetch(url, {
      method: "POST",
      headers: { "Content-Length": "0" },
    });
  }

  if (command.kind === "effect") {
    const effect = EFFECT_BY_ID.get(command.effectId);
    if (!effect) {
      throw new Error(`Unknown effect: ${command.effectId}`);
    }

    const params = mergeEffectParams(command.effectId, command.params);
    const startDelayKey = "start_delay_ms";
    await Promise.all(
      effect.params
        .filter((param) => param.key !== startDelayKey)
        .map((param) => {
          const value = params[param.key];
          if (value === undefined) return Promise.resolve();
          return setEffectParamEntity(base, param, value);
        }),
    );
    const startDelayParam = effect.params.find(
      (param) => param.key === startDelayKey,
    );
    if (startDelayParam && params[startDelayKey] !== undefined) {
      await setEffectParamEntity(base, startDelayParam, params[startDelayKey], {
        retries: 0,
      });
    }

    const q = new URLSearchParams({
      effect: effect.name,
      brightness: String(resolveEsphomeBrightness(command.brightnessPercent)),
      transition: "0",
    });
    if (command.r !== undefined) {
      q.set("color_mode", "rgb");
      q.set("r", String(command.r));
      q.set("g", String(command.g));
      q.set("b", String(command.b));
    }

    const url = `${base}/light/${entitySeg}/turn_on?${q}`;
    return esphomeFetch(url, {
      method: "POST",
      headers: { "Content-Length": "0" },
    });
  }

  const q = new URLSearchParams({
    effect: "None",
    color_mode: "rgb",
    r: String(command.r),
    g: String(command.g),
    b: String(command.b),
    brightness: String(resolveEsphomeBrightness(command.brightnessPercent)),
    transition: "0",
  });
  const url = `${base}/light/${entitySeg}/turn_on?${q}`;
  return esphomeFetch(url, {
    method: "POST",
    headers: { "Content-Length": "0" },
  });
}

export async function pingGate(host: string): Promise<boolean> {
  const base = hostBase(host);
  const timeoutMs = Number(process.env.GATESTAGE_GATE_PING_TIMEOUT_MS ?? 800);
  const lightPath = `/light/${entityPath(DEFAULT_LIGHT_ENTITY)}`;
  for (const path of [lightPath, "/health", "/"]) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return true;
    } catch {
      // try next path
    }
  }
  return false;
}
