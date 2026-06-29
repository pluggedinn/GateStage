"use client";

import { cn } from "@/lib/utils";
import type { EffectPreviewType } from "@/lib/effect-preview";
import styles from "./light-effect-preview.module.css";

const STRIP_TYPES = new Set<EffectPreviewType>(["rainbow", "color-wipe"]);
const PIXEL_COUNT = 20;

type LightEffectPreviewProps = {
  type: EffectPreviewType;
  label: string;
  className?: string;
};

export function LightEffectPreview({
  type,
  label,
  className,
}: LightEffectPreviewProps) {
  const isStrip = STRIP_TYPES.has(type);
  const typeClass =
    type === "color-wipe"
      ? styles.colorWipe
      : type === "rainbow"
        ? styles.rainbow
        : type === "strobe"
          ? styles.strobe
          : styles.pulse;

  return (
    <span
      className={cn(styles.preview, typeClass, className)}
      role="img"
      aria-label={label}
    >
      {isStrip ? (
        <span className={styles.strip}>
          {Array.from({ length: PIXEL_COUNT }, (_, i) => (
            <span key={i} className={styles.pixel} />
          ))}
        </span>
      ) : (
        <span className={styles.bulb} />
      )}
    </span>
  );
}
