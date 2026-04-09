/**
 * Newton-Raphson Load Flow Solver
 * Solves the nonlinear power flow equations iteratively.
 *
 * Power Balance Equations:
 *   P_i = V_i * sum_k [ V_k * (G_ik * cos(θ_i - θ_k) + B_ik * sin(θ_i - θ_k)) ]
 *   Q_i = V_i * sum_k [ V_k * (G_ik * sin(θ_i - θ_k) - B_ik * cos(θ_i - θ_k)) ]
 *
 * The Jacobian matrix J:
 *   [ ΔP ]   [ H  N ] [ Δθ    ]
 *   [ ΔQ ] = [ J  L ] [ ΔV/V  ]
 */

import { buildYBus } from './yBus.js';

const DEG = Math.PI / 180;

/**
 * Solve load flow using Newton-Raphson method.
 * @param {Array} buses  - bus data array
 * @param {Array} lines  - line data array
 * @param {number} baseMVA
 * @param {object} opts  - { maxIter, tolerance, disturbance }
 */
export function solveLoadFlow(buses, lines, baseMVA = 100, opts = {}) {
  const { maxIter = 50, tolerance = 1e-6, disturbance = {} } = opts;
  const { loadScale = 1.0 } = disturbance;

  const iterationLog = [];
  const explanations = [];

  // Apply load scaling disturbance
  const scaledBuses = buses.map(b => ({
    ...b,
    Pd: b.Pd * loadScale,
    Qd: b.Qd * loadScale,
  }));

  // Build Y-Bus
  const { Y, G, B, busIndex, N, formationSteps } = buildYBus(scaledBuses, lines);

  explanations.push({
    step: 'Y-Bus Formation',
    detail: `Built ${N}×${N} Y-Bus admittance matrix from ${lines.filter(l => l.status !== 'tripped').length} active lines.`,
    math: 'Y_ij = −y_ij (off-diag),  Y_ii = Σy_ij + jb_sh (diagonal)',
    substeps: formationSteps,
  });

  // State vector: θ (angles in radians), V (voltages in pu)
  const theta = new Array(N).fill(0);
  const V = scaledBuses.map(b => b.voltage);
  const busArr = scaledBuses;

  // Identify slack, PV, PQ buses
  const slackIdx = busArr.findIndex(b => b.type === 'slack');
  const pvIdx = busArr.map((b, i) => b.type === 'pv' ? i : -1).filter(i => i >= 0);
  const pqIdx = busArr.map((b, i) => b.type === 'pq' ? i : -1).filter(i => i >= 0);

  // Scheduled net injections (pu)
  const Psch = busArr.map(b => (b.P - b.Pd) / baseMVA);
  const Qsch = busArr.map(b => (b.Q - b.Qd) / baseMVA);

  explanations.push({
    step: 'Bus Classification',
    detail: `Slack: Bus ${busArr[slackIdx]?.id}  |  PV buses: ${pvIdx.map(i => busArr[i]?.id).join(', ') || 'none'}  |  PQ buses: ${pqIdx.map(i => busArr[i]?.id).join(', ')}`,
    math: 'Slack: V,θ known | PV: P,V specified | PQ: P,Q specified',
    substeps: [],
  });

  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations++;

    // ── Compute calculated P and Q ─────────────────────────────────────────
    const Pcalc = new Array(N).fill(0);
    const Qcalc = new Array(N).fill(0);

    for (let i = 0; i < N; i++) {
      for (let k = 0; k < N; k++) {
        const angle = theta[i] - theta[k];
        Pcalc[i] += V[i] * V[k] * (G[i][k] * Math.cos(angle) + B[i][k] * Math.sin(angle));
        Qcalc[i] += V[i] * V[k] * (G[i][k] * Math.sin(angle) - B[i][k] * Math.cos(angle));
      }
    }

    // ── Compute mismatch ΔP, ΔQ ───────────────────────────────────────────
    const dP = [];
    const dQ = [];
    for (const i of [...pvIdx, ...pqIdx]) {
      dP.push(Psch[i] - Pcalc[i]);
    }
    for (const i of pqIdx) {
      dQ.push(Qsch[i] - Qcalc[i]);
    }

    const mismatch = [...dP, ...dQ];
    const maxMismatch = Math.max(...mismatch.map(Math.abs));

    iterationLog.push({
      iter: iter + 1,
      maxMismatch: maxMismatch.toExponential(4),
      voltages: V.map(v => v.toFixed(4)),
      angles: theta.map(t => (t / DEG).toFixed(3)),
      converged: maxMismatch < tolerance,
    });

    if (maxMismatch < tolerance) {
      converged = true;
      break;
    }

    // ── Build Jacobian ─────────────────────────────────────────────────────
    const pqpv = [...pvIdx, ...pqIdx];   // indices for ΔP rows
    const np = pqpv.length;
    const nq = pqIdx.length;
    const sz = np + nq;

    const J = Array.from({ length: sz }, () => new Array(sz).fill(0));

    // H sub-matrix: ∂P/∂θ
    for (let ri = 0; ri < np; ri++) {
      const i = pqpv[ri];
      for (let ci = 0; ci < np; ci++) {
        const k = pqpv[ci];
        if (i === k) {
          J[ri][ci] = -Qcalc[i] - B[i][i] * V[i] ** 2;
        } else {
          const angle = theta[i] - theta[k];
          J[ri][ci] = V[i] * V[k] * (G[i][k] * Math.sin(angle) - B[i][k] * Math.cos(angle));
        }
      }
    }

    // N sub-matrix: ∂P/∂V * V
    for (let ri = 0; ri < np; ri++) {
      const i = pqpv[ri];
      for (let ci = 0; ci < nq; ci++) {
        const k = pqIdx[ci];
        if (i === k) {
          J[ri][np + ci] = Pcalc[i] + G[i][i] * V[i] ** 2;
        } else {
          const angle = theta[i] - theta[k];
          J[ri][np + ci] = V[i] * V[k] * (G[i][k] * Math.cos(angle) + B[i][k] * Math.sin(angle));
        }
      }
    }

    // J sub-matrix: ∂Q/∂θ
    for (let ri = 0; ri < nq; ri++) {
      const i = pqIdx[ri];
      for (let ci = 0; ci < np; ci++) {
        const k = pqpv[ci];
        if (i === k) {
          J[np + ri][ci] = Pcalc[i] - G[i][i] * V[i] ** 2;
        } else {
          const angle = theta[i] - theta[k];
          J[np + ri][ci] = -V[i] * V[k] * (G[i][k] * Math.cos(angle) + B[i][k] * Math.sin(angle));
        }
      }
    }

    // L sub-matrix: ∂Q/∂V * V
    for (let ri = 0; ri < nq; ri++) {
      const i = pqIdx[ri];
      for (let ci = 0; ci < nq; ci++) {
        const k = pqIdx[ci];
        if (i === k) {
          J[np + ri][np + ci] = Qcalc[i] - B[i][i] * V[i] ** 2;
        } else {
          const angle = theta[i] - theta[k];
          J[np + ri][np + ci] = V[i] * V[k] * (G[i][k] * Math.sin(angle) - B[i][k] * Math.cos(angle));
        }
      }
    }

    // ── Solve J * Δx = mismatch (Gaussian elimination) ────────────────────
    const dx = gaussianElimination(J, mismatch);
    if (!dx) break;

    // ── Update state ──────────────────────────────────────────────────────
    for (let ri = 0; ri < np; ri++) {
      theta[pqpv[ri]] += dx[ri];
    }
    for (let ri = 0; ri < nq; ri++) {
      V[pqIdx[ri]] += dx[np + ri] * V[pqIdx[ri]];
    }
  }

  // ── Compute final P, Q, line flows ────────────────────────────────────────
  const Pcalc = new Array(N).fill(0);
  const Qcalc = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      const angle = theta[i] - theta[k];
      Pcalc[i] += V[i] * V[k] * (G[i][k] * Math.cos(angle) + B[i][k] * Math.sin(angle));
      Qcalc[i] += V[i] * V[k] * (G[i][k] * Math.sin(angle) - B[i][k] * Math.cos(angle));
    }
  }

  // Update slack bus generation
  const slackP = Pcalc[slackIdx] + scaledBuses[slackIdx].Pd / baseMVA;
  const slackQ = Qcalc[slackIdx] + scaledBuses[slackIdx].Qd / baseMVA;

  // ── Line power flows ───────────────────────────────────────────────────────
  const lineFlows = lines.map(line => {
    if (line.status === 'tripped') return { id: line.id, Pij: 0, Qij: 0, Pji: 0, Qji: 0, loss: 0, loading: 0 };
    const i = busIndex[line.from];
    const j = busIndex[line.to];
    if (i === undefined || j === undefined) return null;

    const Vi = V[i], Vj = V[j];
    const ti = theta[i], tj = theta[j];
    const denom = line.R ** 2 + line.X ** 2;
    const g = line.R / denom, b = -line.X / denom;
    const bsh = line.B / 2;

    const Pij = Vi ** 2 * g - Vi * Vj * (g * Math.cos(ti - tj) + b * Math.sin(ti - tj));
    const Qij = -Vi ** 2 * (b + bsh) - Vi * Vj * (g * Math.sin(ti - tj) - b * Math.cos(ti - tj));
    const Pji = Vj ** 2 * g - Vi * Vj * (g * Math.cos(tj - ti) + b * Math.sin(tj - ti));
    const Qji = -Vj ** 2 * (b + bsh) - Vi * Vj * (g * Math.sin(tj - ti) - b * Math.cos(tj - ti));
    const loss = (Pij + Pji) * baseMVA;
    const Smag = Math.sqrt(Pij ** 2 + Qij ** 2) * baseMVA;
    const loading = (Smag / line.ratingMVA) * 100;

    return { id: line.id, Pij: Pij * baseMVA, Qij: Qij * baseMVA, Pji: Pji * baseMVA, Qji: Qji * baseMVA, loss, loading, status: loading > 100 ? 'overload' : loading > 80 ? 'warning' : 'normal' };
  }).filter(Boolean);

  // ── Generate AI Insights ──────────────────────────────────────────────────
  const aiInsights = generateLoadFlowInsights(V, theta, lineFlows, busArr, converged);

  explanations.push({
    step: 'Newton-Raphson Convergence',
    detail: converged
      ? `✅ Converged in ${iterations} iterations (tolerance: ${tolerance})`
      : `❌ Did NOT converge after ${iterations} iterations`,
    math: 'Update rule: [Δθ, ΔV/V]ᵀ = J⁻¹ × [ΔP, ΔQ]ᵀ',
    substeps: [],
  });

  return {
    converged,
    iterations,
    buses: busArr.map((b, i) => ({
      ...b,
      voltage: V[i],
      angle: theta[i] / DEG,
      P: Pcalc[i] * baseMVA,
      Q: Qcalc[i] * baseMVA,
      status: V[i] < 0.95 ? 'low_voltage' : V[i] > 1.05 ? 'high_voltage' : 'normal',
    })),
    slackGeneration: { P: slackP * baseMVA, Q: slackQ * baseMVA },
    lineFlows,
    totalLoss: lineFlows.reduce((s, l) => s + (l.loss || 0), 0),
    totalGeneration: (slackP + busArr.filter(b => b.type === 'pv').reduce((s, b) => s + b.P, 0) / baseMVA) * baseMVA,
    iterationLog,
    explanations,
    insights: aiInsights,
    yBusFormation: formationSteps,
  };
}

/** Simple Gaussian elimination to solve Ax = b */
function gaussianElimination(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-15) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let k = i + 1; k < n; k++) x[i] -= M[i][k] * x[k];
    x[i] /= M[i][i];
  }
  return x;
}

function generateLoadFlowInsights(V, theta, lineFlows, buses, converged) {
  const insights = [];

  if (!converged) {
    insights.push({ type: 'error', title: 'Convergence Failure', msg: 'Newton-Raphson failed to converge. Check for islanded buses or infeasible loading conditions.' });
    return insights;
  }

  // Voltage violations
  const lowV = V.map((v, i) => ({ v, bus: buses[i] })).filter(x => x.v < 0.95);
  const highV = V.map((v, i) => ({ v, bus: buses[i] })).filter(x => x.v > 1.05);
  if (lowV.length > 0) {
    insights.push({ type: 'warning', title: 'Low Voltage', msg: `${lowV.map(x => x.bus.name).join(', ')} — below 0.95 pu. Add reactive compensation (capacitor banks).` });
  }
  if (highV.length > 0) {
    insights.push({ type: 'warning', title: 'High Voltage', msg: `${highV.map(x => x.bus.name).join(', ')} — above 1.05 pu. Reduce generation or add reactor.` });
  }

  // Overloaded lines
  const overloaded = lineFlows.filter(l => l.loading > 100);
  const warning = lineFlows.filter(l => l.loading > 80 && l.loading <= 100);
  if (overloaded.length > 0) {
    insights.push({ type: 'error', title: 'Line Overload', msg: `Lines ${overloaded.map(l => l.id).join(', ')} are overloaded. Consider load shedding or adding parallel circuits.` });
  }
  if (warning.length > 0) {
    insights.push({ type: 'warning', title: 'High Loading', msg: `Lines ${warning.map(l => l.id).join(', ')} are above 80% capacity. Monitor closely.` });
  }

  if (insights.length === 0) {
    insights.push({ type: 'success', title: 'System Healthy', msg: 'All bus voltages and line loadings within normal operating limits.' });
  }

  return insights;
}
