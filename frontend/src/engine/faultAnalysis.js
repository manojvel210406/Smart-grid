/**
 * Fault Analysis Engine
 * Computes fault currents for 3-phase symmetrical faults using
 * the Z-Bus (impedance matrix) method.
 *
 * I_f = V_pre / Z_kk
 * where Z_kk is the driving point impedance at the fault bus.
 */

import { buildYBus } from './yBus.js';

/**
 * Solve 3-phase fault at a given bus
 */
export function solveFault(buses, lines, faultBusId, baseMVA = 100, opts = {}) {
  const { faultSeverity = 1.0, faultType = '3-phase' } = opts;

  const { Y, G, B, busIndex, N } = buildYBus(buses, lines);
  const explanations = [];

  // Convert Y to Z (matrix inversion)
  const Zbus = invertMatrix(Y.map(row => row.map(c => ({ re: c.re, im: c.im }))), N);

  if (!Zbus) {
    return { error: 'Matrix inversion failed — system may be singular or islanded.' };
  }

  explanations.push({
    step: 'Z-Bus Formation',
    detail: `Inverted ${N}×${N} Y-Bus to get Z-Bus (impedance matrix).`,
    math: 'Z_bus = Y_bus⁻¹',
    substeps: [],
  });

  const faultIdx = busIndex[faultBusId];
  if (faultIdx === undefined) return { error: `Fault bus ID ${faultBusId} not found.` };

  // Pre-fault voltage (assume 1.0 pu for simplicity)
  const Vpref = buses[faultIdx]?.voltage || 1.0;

  // Driving point impedance at fault bus
  const Zkk = Zbus[faultIdx][faultIdx];
  const Zkk_mag = Math.sqrt(Zkk.re ** 2 + Zkk.im ** 2);

  // Fault current (3-phase symmetrical)
  let Ifault_pu = Vpref / Zkk_mag;
  // Apply severity factor
  Ifault_pu *= faultSeverity;

  const Ibase = (baseMVA * 1e6) / (Math.sqrt(3) * 230e3); // Amps base (230 kV)
  const Ifault_kA = (Ifault_pu * Ibase) / 1000;

  explanations.push({
    step: 'Fault Current Calculation',
    detail: `Fault at Bus ${faultBusId}: |Z_kk| = ${Zkk_mag.toFixed(5)} pu`,
    math: `I_f = V_pre / Z_kk = ${Vpref}/${Zkk_mag.toFixed(5)} = ${Ifault_pu.toFixed(3)} pu = ${Ifault_kA.toFixed(3)} kA`,
    substeps: [],
  });

  // Post-fault bus voltages
  const postFaultV = buses.map((bus, i) => {
    const Zik = Zbus[i][faultIdx];
    const dV = {
      re: (Zik.re * Ifault_pu * Zkk.re + Zik.im * Ifault_pu * Zkk.im) / (Zkk_mag ** 2),
      im: (Zik.im * Ifault_pu * Zkk.re - Zik.re * Ifault_pu * Zkk.im) / (Zkk_mag ** 2),
    };
    const Vpost = Math.max(0, (bus.voltage || 1.0) - Math.sqrt(dV.re ** 2 + dV.im ** 2));
    return {
      busId: bus.id,
      busName: bus.name,
      preV: (bus.voltage || 1.0).toFixed(4),
      postV: Vpost.toFixed(4),
      voltageDrop: ((bus.voltage || 1.0) - Vpost).toFixed(4),
      status: Vpost < 0.7 ? 'critical' : Vpost < 0.85 ? 'severe' : 'moderate',
    };
  });

  // Determine fault type description
  const faultTypeDesc = {
    '3-phase': '3-Phase Symmetrical (LLL)',
    'SLG': 'Single Line-to-Ground (SLG)',
    'LL': 'Line-to-Line (LL)',
    'DLG': 'Double Line-to-Ground (DLG)',
  }[faultType] || '3-Phase';

  // AI Insights
  const insights = [];
  if (Ifault_kA > 20) {
    insights.push({ type: 'error', title: 'Extreme Fault Current', msg: `${Ifault_kA.toFixed(2)} kA exceeds typical breaker ratings. Check protection coordination.` });
  } else if (Ifault_kA > 10) {
    insights.push({ type: 'warning', title: 'High Fault Current', msg: `${Ifault_kA.toFixed(2)} kA — verify relay settings and breaker capabilities.` });
  }

  const criticalBuses = postFaultV.filter(b => b.status === 'critical');
  if (criticalBuses.length > 0) {
    insights.push({ type: 'error', title: 'Severe Voltage Collapse', msg: `Buses ${criticalBuses.map(b => b.busName).join(', ')} will drop to near-zero voltage during fault.` });
  }

  return {
    faultBusId,
    faultBusName: buses[faultIdx]?.name,
    faultType: faultTypeDesc,
    severity: faultSeverity,
    Ifault_pu: Ifault_pu.toFixed(4),
    Ifault_kA: Ifault_kA.toFixed(3),
    Zkk_mag: Zkk_mag.toFixed(5),
    postFaultV,
    explanations,
    insights,
    criticalBuses: criticalBuses.length,
    recommendedAction: Ifault_kA > 10
      ? 'Isolate fault immediately. Trip breakers on Lines adjacent to fault bus.'
      : 'Fault is manageable. Standard protection relay response expected.',
  };
}

/**
 * Matrix inversion for complex numbers using Gauss-Jordan
 * A: array of {re, im}
 */
function invertMatrix(A, n) {
  // Build augmented matrix [A | I]
  const M = A.map((row, i) =>
    row.map(c => ({ ...c })).concat(
      Array.from({ length: n }, (_, j) => ({ re: i === j ? 1 : 0, im: 0 }))
    )
  );

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = complexMag(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = complexMag(M[row][col]);
      if (v > maxVal) { maxVal = v; maxRow = row; }
    }
    if (maxVal < 1e-15) return null;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    // Scale pivot row
    const pivot = M[col][col];
    const pivInv = complexInv(pivot);
    for (let k = col; k < 2 * n; k++) {
      M[col][k] = complexMul(M[col][k], pivInv);
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let k = col; k < 2 * n; k++) {
        M[row][k] = complexSub(M[row][k], complexMul(factor, M[col][k]));
      }
    }
  }

  return M.map(row => row.slice(n));
}

function complexMag(c) { return Math.sqrt(c.re ** 2 + c.im ** 2); }
function complexInv(c) {
  const d = c.re ** 2 + c.im ** 2;
  return { re: c.re / d, im: -c.im / d };
}
function complexMul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function complexSub(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}
