/**
 * Y-Bus (Admittance Matrix) Formation
 * Used as the foundation for all power flow calculations.
 */

/**
 * Build Y-Bus matrix from network topology.
 * Returns object with:
 *   - G: real part (conductance) matrix
 *   - B: imaginary part (susceptance) matrix
 *   - Y: complex admittance matrix
 */
export function buildYBus(buses, lines) {
  const n = buses.size !== undefined ? buses.size : buses.length;
  const N = n;
  
  // Create bus index map
  const busIndex = {};
  const busArray = Array.isArray(buses) ? buses : [...buses];
  busArray.forEach((bus, idx) => { busIndex[bus.id] = idx; });

  // Initialize Y matrix as arrays of complex numbers {re, im}
  const Y = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => ({ re: 0, im: 0 }))
  );

  const steps = [];

  lines.forEach(line => {
    if (line.status === 'tripped') return;

    const i = busIndex[line.from];
    const j = busIndex[line.to];
    if (i === undefined || j === undefined) return;

    // Series admittance: y_series = 1 / (R + jX)
    const denom = line.R ** 2 + line.X ** 2;
    const g = line.R / denom;
    const b = -line.X / denom;

    // Shunt susceptance (charging)
    const bsh = line.B / 2;

    // Diagonal elements
    Y[i][i].re += g;
    Y[i][i].im += (b + bsh);
    Y[j][j].re += g;
    Y[j][j].im += (b + bsh);

    // Off-diagonal elements
    Y[i][j].re -= g;
    Y[i][j].im -= b;
    Y[j][i].re -= g;
    Y[j][i].im -= b;

    steps.push({
      line: `Line ${line.from}→${line.to}`,
      g: g.toFixed(4), b: b.toFixed(4), bsh: bsh.toFixed(4),
      desc: `y_series = ${g.toFixed(4)} - j${Math.abs(b).toFixed(4)}, B_shunt/2 = ${bsh.toFixed(4)}`
    });
  });

  return {
    Y,
    G: Y.map(row => row.map(c => c.re)),
    B: Y.map(row => row.map(c => c.im)),
    busIndex,
    N,
    formationSteps: steps,
  };
}

/**
 * Compute injected powers at each bus
 */
export function computeInjections(buses) {
  return buses.map(bus => ({
    id: bus.id,
    Pinj: (bus.P - bus.Pd) / 100,   // per unit (base 100 MVA)
    Qinj: (bus.Q - bus.Qd) / 100,
  }));
}

/**
 * Format Y-Bus for display
 */
export function formatYBus(yBus, buses) {
  const busNames = Array.isArray(buses) ? buses.map(b => b.name) : [];
  const rows = yBus.Y.map((row, i) => ({
    bus: busNames[i] || `Bus ${i + 1}`,
    elements: row.map(c => `${c.re.toFixed(3)}${c.im >= 0 ? '+' : ''}j${c.im.toFixed(3)}`),
  }));
  return rows;
}
