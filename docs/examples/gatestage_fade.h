#pragma once

#include "esphome/components/light/addressable_light.h"
#include "esphome/core/color.h"
#include "esphome/core/hal.h"

namespace gs {

static constexpr int kFadeLeds = 400;

inline esphome::Color *fade_from() {
  static esphome::Color from[kFadeLeds];
  return from;
}

inline uint32_t &fade_start_ms() {
  static uint32_t start = 0;
  return start;
}

// Snapshot the strip on the first frame of an effect. Later frames blend
// toward whatever the effect just painted.
inline void fade_begin(esphome::light::AddressableLight &it, bool initial_run) {
  if (!initial_run) return;
  const int32_t n = it.size() < kFadeLeds ? it.size() : kFadeLeds;
  esphome::Color *from = fade_from();
  for (int32_t i = 0; i < n; i++) from[i] = it[i].get();
  fade_start_ms() = esphome::millis();
}

inline void fade_apply(esphome::light::AddressableLight &it, uint32_t fade_ms) {
  if (fade_ms == 0) return;
  const uint32_t elapsed = esphome::millis() - fade_start_ms();
  if (elapsed >= fade_ms) return;
  const uint8_t t = static_cast<uint8_t>((elapsed * 255u) / fade_ms);
  const int32_t n = it.size() < kFadeLeds ? it.size() : kFadeLeds;
  esphome::Color *from = fade_from();
  for (int32_t i = 0; i < n; i++) {
    it[i] = from[i].gradient(it[i].get(), t);
  }
}

}  // namespace gs
