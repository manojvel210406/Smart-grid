// ============================================================
// PROTECTION: Relay & Protection System
// ============================================================

import { BASE_MVA, BASE_KV } from "../engine/powerflow.js";

export const RELAY_SETTINGS = {
  overcurrent:  { pickup: 1.20, delay: 2.0 },   // 120% → trip after 2s
  overloadWarn: 1.00,                              // 100% → alarm only
  underVoltage: 0.88,                              // p.u.
  overVoltage:  1.12,                              // p.u.
  underFreq:    48.5,                              // Hz — UFLS threshold
  overFreq:     51.5,                              // Hz
  rocofLimit:   1.0,                               // Hz/s
};

const FAULT_Z = { LG: 0.8, LL: 0.6, LLG: 0.5, "3PH": 0.3 };

/**
 * Estimate fault current for a given fault type.
 * Returns value in kA.
 */
export function computeFaultCurrent(Vm, faultType) {
  const Zf  = FAULT_Z[faultType] || 0.5;
  const Ipu = (Vm || 1) / Zf;
  return Ipu * BASE_MVA / (Math.sqrt(3) * BASE_KV) * 1000;
}

/**
 * Check all relays and return a list of trip decisions.
 * Only trips when loading genuinely exceeds the overcurrent threshold.
 *
 * @param {Array}  lines          - current line state array
 * @param {Object} lineLoadings   - {lineId: loading%}
 * @param {Array}  Vm             - bus voltage magnitudes (p.u.)
 * @param {number} prevFreq       - previous tick frequency (Hz)
 * @param {number} currFreq       - current tick frequency (Hz)
 * @param {number} dt             - time step (seconds)
 * @param {Map}    tripTimers     - persistent per-line overcurrent timers
 * @returns {Array} trips — [{lineId, relay, reason}]
 */
export function checkRelays(lines, lineLoadings, Vm, prevFreq, currFreq, dt, tripTimers) {
  const trips = [];
  const rocof  = dt > 0 ? (currFreq - prevFreq) / dt : 0;

  lines.forEach(line => {
    if (line.tripped) return;
    const loading = lineLoadings[line.id] || 0;

    // --- Overcurrent relay (IDMT-like with timer) ---
    if (loading > RELAY_SETTINGS.overcurrent.pickup * 100) {
      const excess = loading / (RELAY_SETTINGS.overcurrent.pickup * 100);
      // Inverse-time delay: longer for marginal overloads
      const tripDelay = RELAY_SETTINGS.overcurrent.delay / (excess - 1 + 0.01);
      const accumulated = (tripTimers.get(line.id) || 0) + dt;
      tripTimers.set(line.id, accumulated);

      if (accumulated >= Math.min(tripDelay, 10)) {
        trips.push({
          lineId: line.id,
          relay:  "OC",
          reason: `Overcurrent ${loading.toFixed(0)}% for ${accumulated.toFixed(1)}s`,
        });
        tripTimers.delete(line.id);
      }
    } else {
      // Reset timer if loading drops below pickup
      if (tripTimers.has(line.id)) tripTimers.delete(line.id);
    }
  });

  // --- Under-frequency load shedding relay (system-wide) ---
  if (currFreq < RELAY_SETTINGS.underFreq) {
    trips.push({
      lineId: -1,
      relay:  "UFLS",
      reason: `Under-frequency ${currFreq.toFixed(2)} Hz`,
    });
  }

  // --- RoCoF relay ---
  if (Math.abs(rocof) > RELAY_SETTINGS.rocofLimit) {
    trips.push({
      lineId: -1,
      relay:  "ROCOF",
      reason: `RoCoF ${rocof.toFixed(3)} Hz/s`,
    });
  }

  return trips;
}
