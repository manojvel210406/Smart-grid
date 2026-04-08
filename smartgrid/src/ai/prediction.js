// ============================================================
// AI ENGINE: Blackout Risk Prediction
// Sigmoid-based probabilistic model with calibrated weights
// ============================================================

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Predict blackout probability from current grid state.
 * Calibrated so that:
 *   - Normal operation  → prob < 0.15  (LOW)
 *   - Moderate stress   → 0.15–0.50    (MEDIUM)
 *   - Severe conditions → > 0.50       (HIGH)
 *
 * @param {Object} state
 * @returns {Object} { prob, level, color, actions, factors }
 */
export function predictBlackoutProbability(state) {
  const {
    lineLoadings = {},
    Vm = [],
    frequency = 50,
    imbalance = 0,
    totalGen = 1,
    rocof = 0,
    trippedCount = 0,
  } = state;

  const loadings = Object.values(lineLoadings);

  // ---- Feature extraction ----
  // Max loading: only contributes meaningfully above 85%
  const maxLoadRaw = Math.max(...loadings, 0) / 100;
  const maxLoad    = Math.max(0, maxLoadRaw - 0.85) / 0.35;   // 0 at 85%, 1 at 120%

  // Average loading above normal
  const avgLoad = loadings.length
    ? Math.max(0, loadings.reduce((a, b) => a + b, 0) / (loadings.length * 100) - 0.60) / 0.40
    : 0;

  // Frequency deviation (normalised, only penalise when outside 49–51 Hz)
  const freqDev  = Math.max(0, Math.abs(frequency - 50) - 0.5) / 2.0;

  // Power imbalance as fraction of total generation
  const mismatch = Math.abs(imbalance) / Math.max(totalGen, 1);
  const mismatchF = Math.max(0, mismatch - 0.05) / 0.25;   // 0 at 5%, 1 at 30%

  // Voltage stress: average deviation from 1.0 p.u.
  const voltStress = Vm.length
    ? Math.max(0, Vm.reduce((acc, v) => acc + Math.abs(1 - v), 0) / Vm.length - 0.02) / 0.10
    : 0;

  // RoCoF (normalised to 0–1 over 0–1 Hz/s range)
  const rocofF   = Math.min(Math.abs(rocof) / 1.0, 1.0);

  // Tripped lines penalty
  const tripPen  = Math.min(trippedCount / 8, 1.0);

  // ---- Weighted linear combination ----
  // Bias of -3.5 ensures low probability under normal conditions
  const z = 0
    + 3.0 * maxLoad       // overloaded lines — most critical
    + 1.5 * avgLoad       // overall congestion
    + 2.5 * freqDev       // frequency excursion
    + 2.0 * mismatchF     // generation-load mismatch
    + 1.5 * voltStress    // voltage collapse indicator
    + 1.8 * rocofF        // rate of change of frequency
    + 2.0 * tripPen       // cascade indicator
    - 3.8;                // bias — calibrates baseline to ~5%

  const prob  = sigmoid(z);
  const level = prob < 0.20 ? "LOW" : prob < 0.50 ? "MEDIUM" : "HIGH";
  const color = prob < 0.20 ? "#00ff9d" : prob < 0.50 ? "#ffcc00" : "#ff4444";

  // ---- Recommended control actions ----
  const actions = [];
  if (maxLoadRaw > 0.90) actions.push({ type: "ISOLATE",  desc: "Isolate overloaded transmission line" });
  if (freqDev    > 0.2)  actions.push({ type: "SHED",     desc: `Initiate load shedding ~${Math.round(mismatch * totalGen * 0.15)} MW` });
  if (mismatch   > 0.08) actions.push({ type: "RAMP",     desc: "Ramp up slack generator output" });
  if (voltStress > 0.04) actions.push({ type: "REACTIVE", desc: "Inject reactive power via SVC/capacitor banks" });
  if (trippedCount >= 3) actions.push({ type: "RESTORE",  desc: "Evaluate line restoration sequence" });

  return {
    prob,
    level,
    color,
    actions,
    factors: { maxLoad: maxLoadRaw, freqDev, mismatch, voltStress, rocofF, tripPen },
  };
}
