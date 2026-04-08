// ============================================================
// ENGINE: System Dynamics — AGC, Frequency, Load Model
// ============================================================

import { BASE_MVA } from "./powerflow.js";

// Swing equation constants
const H = 5.0;   // inertia constant (seconds)
const D = 0.05;  // damping coefficient (pu MW / Hz)
const K_FREQ = 1.2; // frequency sensitivity (Hz per pu imbalance)

// Generator capacity limits (pu on BASE_MVA)
const GEN_LIMITS = {
  0: { min: 0.5,  max: 3.2 },  // Slack / coal
  1: { min: 0.0,  max: 0.8 },  // Solar
  7: { min: 0.0,  max: 0.6 },  // Wind
};

/**
 * Realistic daily load curve using a 2-peak sinusoidal model.
 * Returns a per-unit multiplier for the given hour.
 */
function dailyLoadFactor(hour) {
  // Morning peak ~8h, evening peak ~19h, night trough ~3h
  const morning = 0.55 + 0.35 * Math.exp(-0.5 * ((hour - 8) / 2.5) ** 2);
  const evening = 0.60 + 0.40 * Math.exp(-0.5 * ((hour - 19) / 2.0) ** 2);
  const night   = 0.45 + 0.10 * Math.exp(-0.5 * ((hour - 3)  / 2.0) ** 2);
  return Math.max(0.45, Math.min(1.15, morning + evening + night - 0.60));
}

/**
 * Apply Automatic Generation Control (AGC):
 * The slack generator picks up the mismatch to balance load,
 * within its physical limits.
 */
function applyAGC(dynBuses, totalLoad) {
  // Sum up non-slack generation
  let nonSlackGen = 0;
  dynBuses.forEach((b, i) => {
    if (i !== 0) nonSlackGen += (b.Pg || 0);
  });

  // Required slack output to balance
  const requiredSlack = totalLoad / BASE_MVA - nonSlackGen;
  const lim = GEN_LIMITS[0];
  const clampedSlack = Math.max(lim.min, Math.min(lim.max, requiredSlack));

  return dynBuses.map((b, i) => {
    if (i === 0) return { ...b, Pg: clampedSlack };
    return b;
  });
}

/**
 * Main dynamics computation for each simulation tick.
 * Returns all relevant grid state quantities.
 */
export function computeSystemDynamics(
  busData, linesState, t, scenario, faultEvent,
  loadShed = 0, genBoost = 0, prevFreq = 50
) {
  const hour = (t / 3600) % 24;

  // ---- Base load factor from realistic daily curve ----
  let baseLoadFactor = dailyLoadFactor(hour);

  // ---- Renewable generation (bounded, smooth) ----
  // Solar: zero at night, peak at noon
  const solarFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  // Wind: slow sinusoidal variation, never zero
  const windFactor  = 0.45 + 0.35 * Math.sin(t / 900 + 1.2) + 0.15 * Math.sin(t / 400 + 2.7);

  // ---- Scenario modifiers ----
  let loadFactor = baseLoadFactor;
  let solarMod   = solarFactor;
  let windMod    = Math.max(0.1, windFactor);

  switch (scenario) {
    case "peak":
      loadFactor = Math.min(1.20, baseLoadFactor * 1.15);
      windMod    = Math.max(0.1, windFactor * 0.5);
      break;
    case "renewable":
      solarMod = Math.min(1.0, solarFactor * 1.5 + 0.1);
      windMod  = Math.min(1.0, Math.abs(Math.sin(t / 120 + 0.5)) * 0.8 + 0.2);
      break;
    case "storm":
      windMod    = Math.min(1.0, 0.7 + 0.3 * Math.sin(t / 60));
      loadFactor = baseLoadFactor * 0.88;
      break;
    case "n1":
      // N-1 contingency: no extra generation mod, handled via line tripping
      break;
    default:
      break;
  }

  // ---- Build dynamic bus data ----
  let dynBuses = busData.map((b, i) => {
    let Pg = b.Pg || 0;
    let Pd = (b.Pd || 0) * loadFactor * (1 - loadShed * 0.01);

    if (i === 1) Pg = (b.Pg || 0) * (0.3 + 0.7 * solarMod);        // Solar PV
    if (i === 7) Pg = (b.Pg || 0) * windMod;                         // Wind
    if (i === 0) Pg = (b.Pg || 0) * (1 + genBoost * 0.01);          // Slack boost

    return { ...b, Pg, Pd };
  });

  // ---- Fault injection: increase load at faulted bus ----
  if (faultEvent?.active) {
    const fi = faultEvent.busId;
    if (fi >= 0 && fi < dynBuses.length) {
      dynBuses = dynBuses.map((b, i) =>
        i === fi ? { ...b, Pd: b.Pd * 1.6 } : b
      );
    }
  }

  // ---- Calculate totals before AGC ----
  const totalLoad = dynBuses.reduce((s, b) => s + (b.Pd || 0), 0) * BASE_MVA;

  // ---- Apply AGC: slack generator balances load ----
  dynBuses = applyAGC(dynBuses, totalLoad);

  const totalGen  = dynBuses.reduce((s, b) => s + (b.Pg || 0), 0) * BASE_MVA;
  const imbalance = totalGen - totalLoad;

  // ---- Realistic frequency calculation ----
  // Swing equation: 2H * df/dt = ΔP_pu - D*(f-50)
  // In steady state: f = 50 + K * ΔP_pu
  // Add smooth damping so frequency stays in 49–51 Hz range
  const imbalancePU = imbalance / Math.max(totalGen, 1);
  const freqSteady  = 50 + K_FREQ * imbalancePU;
  // Damped approach toward steady state (time constant ~5s)
  const alpha       = 0.15; // smoothing per tick
  const frequency   = prevFreq + alpha * (freqSteady - prevFreq);
  // Hard clamp to realistic UFLS/OFGS bounds
  const freqClamped = Math.max(47.5, Math.min(51.5, frequency));

  return {
    dynBuses,
    totalGen,
    totalLoad,
    imbalance,
    frequency: freqClamped,
    solarFactor: solarMod,
    windFactor: windMod,
    loadFactor,
  };
}
