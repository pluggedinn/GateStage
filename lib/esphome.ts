import { percentToEsphome } from "@/lib/brightness";
import { getDefaultBrightnessPercent } from "@/lib/config/store";
import {
  EFFECT_BY_ID,
  mergeEffectParams,
  type EffectParamDef,
} from "@/lib/effects";

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
): Promise<void> {
  if (!param.entityName || param.yamlOnly) return;

  if (param.type === "bool") {
    const action = value ? "turn_on" : "turn_off";
    const url = `${base}/switch/${entityPath(param.entityName)}/${action}`;
    await fetch(url, { method: "POST" });
    return;
  }

  const url = `${base}/number/${entityPath(param.entityName)}/set?value=${paramValueForEntity(param, value)}`;
  await fetch(url, { method: "POST" });
}

export async function sendEsphomeCommand(
  host: string,
  command: EsphomeCommand,
): Promise<Response> {
  const base = hostBase(host);
  const entitySeg = entityPath(DEFAULT_LIGHT_ENTITY);

  if (command.kind === "off") {
    const url = `${base}/light/${entitySeg}/turn_off`;
    return fetch(url, {
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
    await Promise.all(
      effect.params.map((param) => {
        const value = params[param.key];
        if (value === undefined) return Promise.resolve();
        return setEffectParamEntity(base, param, value);
      }),
    );

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
    return fetch(url, {
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
  return fetch(url, {
    method: "POST",
    headers: { "Content-Length": "0" },
  });
}

export async function pingGate(host: string): Promise<boolean> {
  const base = hostBase(host);
  const timeoutMs = Number(process.env.GATESTAGE_GATE_PING_TIMEOUT_MS ?? 5000);
  for (const path of ["/health", "/"]) {
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
