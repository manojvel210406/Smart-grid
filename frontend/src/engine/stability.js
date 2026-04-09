/**
 * Transient Stability Analysis
 * Uses the swing equation to simulate rotor angle dynamics:
 *
 *   d²δ/dt² = (π·f₀/H) · (Pm - Pe)
 *
 * where:
 *   δ  = rotor angle (radians)
 *   H  = inertia constant (MWs/MVA)
 *   f₀ = rated frequency (50/60 Hz)
 *   Pm = mechanical input power (pu)
 *   Pe = electrical output power (pu)
 */

export function solveStability(buses, lines, generators, loadFlowResults, opts = {}) {
  const {
    faultBusId = null, faultClearingTime = 0.1, simTime = 3.0,
    dt = 0.01, H = 5.0, f0 = 60, D = 0.05,
  } = opts;

  const explanations = [];
  const timePoints = [];
  const genData = generators.map(g => ({
    ...g, delta: 0, omega: 0, Pm: (g.Pg / 100),  // pu
  }));

  if (!loadFlowResults?.converged) {
    return { error: 'Stability requires a converged load flow solution.' };
  }

  // Initialize rotor angles from load flow results
  loadFlowResults.buses?.forEach(b => {
    const gen = genData.find(g => g.busId === b.id);
    if (gen) gen.delta = (b.angle || 0) * Math.PI / 180;
  });

  const nSteps = Math.floor(simTime / dt);
  const results = genData.map(g => ({ id: g.id, name: g.name, deltas: [], omegas: [], busId: g.busId }));
  const freqData = [];
  const voltageData = [];

  explanations.push({
    step: 'Swing Equation',
    detail: `Simulating ${genData.length} machine(s) over ${simTime}s with Δt=${dt}s`,
    math: 'M·(dω/dt) = Pm − Pe − D·ω,   dδ/dt = ω,   M = 2H/ω₀',
  });

  let faultActive = false;
  let faultCleared = false;

  for (let step = 0; step <= nSteps; step++) {
    const t = step * dt;
    timePoints.push(parseFloat(t.toFixed(3)));

    // Fault logic
    if (faultBusId && t >= 0.1 && !faultActive) { faultActive = true; }
    if (faultActive && t >= 0.1 + faultClearingTime && !faultCleared) {
      faultActive = false; faultCleared = true;
    }

    genData.forEach((gen, gi) => {
      // Electrical power (simplified - reduced during fault)
      let Pe = gen.Pm;
      if (faultActive) Pe = gen.Pm * 0.1;  // severe reduction during fault
      else if (faultCleared) Pe = gen.Pm * 0.85;  // partial restoration

      // Runge-Kutta 4th order for swing equation
      const M = 2 * H / (2 * Math.PI * f0);

      const dOmega = (gen.Pm - Pe - D * gen.omega) / M;
      const dDelta = gen.omega;

      // RK4 intermediate steps (simplified to Euler for clarity)
      gen.omega += dOmega * dt;
      gen.delta += dDelta * dt;

      results[gi].deltas.push(parseFloat((gen.delta * 180 / Math.PI).toFixed(4)));
      results[gi].omegas.push(parseFloat((gen.omega).toFixed(5)));
    });

    const avgOmega = genData.reduce((s, g) => s + g.omega, 0) / genData.length;
    const freq = f0 + (avgOmega * f0) / (2 * Math.PI);
    freqData.push(parseFloat(freq.toFixed(4)));

    const busV = loadFlowResults.buses?.map(b => ({
      busId: b.id, v: faultActive ? b.voltage * 0.4 : faultCleared ? b.voltage * 0.9 : b.voltage,
    })) || [];
    voltageData.push({ t, buses: busV });
  }

  // Stability assessment
  const maxAngle = Math.max(...results.flatMap(r => r.deltas));
  const isStable = maxAngle < 180;
  const criticalTime = faultClearingTime;

  const insights = [];
  if (!isStable) {
    insights.push({ type: 'error', title: 'System Unstable', msg: `Rotor angle exceeds 180°. System will lose synchronism. Reduce fault clearing time below ${(criticalTime * 0.7).toFixed(2)}s.` });
  } else if (maxAngle > 90) {
    insights.push({ type: 'warning', title: 'Large Angle Swing', msg: `Max rotor angle: ${maxAngle.toFixed(1)}°. System stable but with large oscillations. Consider PSS installation.` });
  } else {
    insights.push({ type: 'success', title: 'System Stable', msg: `Max rotor angle: ${maxAngle.toFixed(1)}°. System remains in synchronism after fault.` });
  }

  explanations.push({
    step: 'Stability Assessment',
    detail: isStable ? `✅ Stable — max angle: ${maxAngle.toFixed(1)}°` : `❌ Unstable — loss of synchronism`,
    math: 'Equal Area Criterion: Aacc < Adec for stability',
  });

  return {
    stable: isStable,
    maxRotorAngle: maxAngle.toFixed(2),
    faultClearingTime,
    timePoints,
    generators: results,
    frequency: freqData,
    voltageTimeSeries: voltageData,
    explanations,
    insights,
    simTime,
    dt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Economic Dispatch
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Optimal Economic Dispatch using Lambda Iteration
 * Minimizes total fuel cost: Σ(a·Pg² + b·Pg + c)
 * Subject to: ΣPg = Pload + Ploss
 */
export function solveEconomicDispatch(generators, totalLoad, baseMVA = 100, opts = {}) {
  const { includeLosses = false } = opts;
  const explanations = [];

  if (generators.length === 0) return { error: 'No generators defined.' };

  const Pload = totalLoad / baseMVA;

  // Lambda iteration
  let lambda = 5.0;
  const lambdaStep = 0.5;
  const tolerance = 1e-6;
  const maxIter = 200;
  const iterLog = [];
  let converged = false;

  const gens = generators.map(g => ({
    ...g,
    a: g.cost_a || 0.02, b: g.cost_b || 2.0, c: g.cost_c || 0,
    Pmax: g.Pmax / baseMVA, Pmin: g.Pmin / baseMVA, Pg: 0,
  }));

  let lLow = 0, lHigh = 20;

  for (let iter = 0; iter < maxIter; iter++) {
    lambda = (lLow + lHigh) / 2;

    // Optimal dispatch for each generator: dC/dPg = lambda → Pg = (lambda - b) / (2a)
    let totalGen = 0;
    gens.forEach(g => {
      let pg = (lambda - g.b) / (2 * g.a);
      pg = Math.max(g.Pmin, Math.min(g.Pmax, pg));
      g.Pg = pg;
      totalGen += pg;
    });

    const mismatch = totalGen - Pload;
    iterLog.push({ iter: iter + 1, lambda: lambda.toFixed(4), totalGen: (totalGen * baseMVA).toFixed(2), mismatch: mismatch.toFixed(6) });

    if (Math.abs(mismatch) < tolerance) { converged = true; break; }
    if (mismatch > 0) lHigh = lambda;
    else lLow = lambda;
  }

  const totalCost = gens.reduce((s, g) => s + g.a * (g.Pg * baseMVA) ** 2 + g.b * (g.Pg * baseMVA) + g.c, 0);
  const totalGenMW = gens.reduce((s, g) => s + g.Pg * baseMVA, 0);

  explanations.push({
    step: 'Economic Dispatch',
    detail: `Lambda iteration: λ* = ${lambda.toFixed(4)} $/MWh`,
    math: 'Minimize Σ C_i(P_i) subject to ΣP_i = P_load. KKT: dC_i/dP_i = λ',
  });

  const insights = [];
  if (converged) {
    insights.push({ type: 'success', title: 'Optimal Dispatch Found', msg: `Optimal λ = ${lambda.toFixed(4)} $/MWh. Total operating cost: $${totalCost.toFixed(2)}/hr.` });
  }

  // Savings vs. equal distribution
  const equalPg = Pload / generators.length;
  const equalCost = generators.reduce((s, g) => s + (g.cost_a || 0.02) * (equalPg * baseMVA) ** 2 + (g.cost_b || 2.0) * (equalPg * baseMVA), 0);
  const savings = equalCost - totalCost;
  if (savings > 0) {
    insights.push({ type: 'info', title: 'Cost Savings', msg: `Economic dispatch saves $${savings.toFixed(2)}/hr compared to equal load sharing.` });
  }

  return {
    converged,
    lambda: lambda.toFixed(4),
    generators: gens.map(g => ({ id: g.id, name: g.name, Pg: (g.Pg * baseMVA).toFixed(2), cost: (g.a * (g.Pg * baseMVA) ** 2 + g.b * (g.Pg * baseMVA) + g.c).toFixed(2) })),
    totalGeneration: totalGenMW.toFixed(2),
    totalLoad: totalLoad.toFixed(2),
    totalCost: totalCost.toFixed(2),
    iterationLog: iterLog.slice(-20),
    explanations,
    insights,
  };
}
