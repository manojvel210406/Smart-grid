// ============================================================
// ENGINE: Newton-Raphson Load Flow Solver
// IEEE 14-Bus System
// ============================================================

export const BASE_MVA = 100;
export const BASE_KV  = 500;

export class Complex {
  constructor(re, im = 0) { this.re = re; this.im = im; }
  add(o) { return new Complex(this.re + o.re, this.im + o.im); }
  sub(o) { return new Complex(this.re - o.re, this.im - o.im); }
  mul(o) { return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re); }
  conj()  { return new Complex(this.re, -this.im); }
  mag()   { return Math.sqrt(this.re * this.re + this.im * this.im); }
  static fromPolar(mag, ang) { return new Complex(mag * Math.cos(ang), mag * Math.sin(ang)); }
}

function buildYbus(buses, lines, trippedSet) {
  const n = buses.length;
  const Y = Array.from({ length: n }, () => Array.from({ length: n }, () => new Complex(0)));

  lines.forEach(line => {
    if (trippedSet.has(line.id)) return;
    const { from: i, to: j, R, X, B, tap } = line;
    const zmag2 = R * R + X * X;
    if (zmag2 < 1e-12) return;
    const yr = R / zmag2, yi = -X / zmag2;
    const y  = new Complex(yr, yi);
    const ys = new Complex(0, (B || 0) / 2);
    const t  = tap || 1;

    Y[i][i] = Y[i][i].add(new Complex(y.re / (t * t), y.im / (t * t))).add(ys);
    Y[j][j] = Y[j][j].add(y).add(ys);
    Y[i][j] = Y[i][j].sub(new Complex(y.re / t, y.im / t));
    Y[j][i] = Y[j][i].sub(new Complex(y.re / t, y.im / t));
  });
  return Y;
}

function gaussElim(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col, maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row; }
    }
    if (maxVal < 1e-12) return null;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let c = col; c <= n; c++) M[row][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

export function runNewtonRaphson(busData, lines, trippedSet, maxIter = 25, tol = 1e-5) {
  const n  = busData.length;
  const Y  = buildYbus(busData, lines, trippedSet);
  const G  = Y.map(row => row.map(y => y.re));
  const B  = Y.map(row => row.map(y => y.im));

  let Vm = busData.map(b => b.Vm || 1.0);
  let Va = busData.map(b => b.Va || 0.0);

  const slackIdx = busData.findIndex(b => b.type === "slack");
  const pvIdx    = busData.filter(b => b.type === "pv").map(b => b.id);
  const pqIdx    = busData.filter(b => b.type === "pq").map(b => b.id);

  let converged = false;
  let iters = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    const P = new Array(n).fill(0);
    const Q = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dA = Va[i] - Va[j];
        P[i] += Vm[i] * Vm[j] * (G[i][j] * Math.cos(dA) + B[i][j] * Math.sin(dA));
        Q[i] += Vm[i] * Vm[j] * (G[i][j] * Math.sin(dA) - B[i][j] * Math.cos(dA));
      }
    }

    const Psch = busData.map(b => (b.Pg || 0) - (b.Pd || 0));
    const Qsch = busData.map(b => (b.Qg || 0) - (b.Qd || 0));

    const pBuses = [...pvIdx, ...pqIdx].sort((a, b) => a - b);
    const qBuses = [...pqIdx].sort((a, b) => a - b);

    const dP = pBuses.map(i => Psch[i] - P[i]);
    const dQ = qBuses.map(i => Qsch[i] - Q[i]);
    const mismatch = [...dP, ...dQ];
    const maxMis = Math.max(...mismatch.map(Math.abs));

    if (maxMis < tol) { converged = true; iters = iter; break; }

    const dim = pBuses.length + qBuses.length;
    const J = Array.from({ length: dim }, () => new Array(dim).fill(0));

    pBuses.forEach((i, ri) => {
      pBuses.forEach((j, ci) => {
        if (i === j) J[ri][ci] = -Q[i] - B[i][i] * Vm[i] * Vm[i];
        else J[ri][ci] = Vm[i] * Vm[j] * (G[i][j] * Math.sin(Va[i] - Va[j]) - B[i][j] * Math.cos(Va[i] - Va[j]));
      });
      qBuses.forEach((j, ci) => {
        if (i === j) J[ri][pBuses.length + ci] = P[i] / Vm[i] + G[i][i] * Vm[i];
        else J[ri][pBuses.length + ci] = Vm[i] * (G[i][j] * Math.cos(Va[i] - Va[j]) + B[i][j] * Math.sin(Va[i] - Va[j]));
      });
    });
    qBuses.forEach((i, ri) => {
      pBuses.forEach((j, ci) => {
        if (i === j) J[pBuses.length + ri][ci] = P[i] - G[i][i] * Vm[i] * Vm[i];
        else J[pBuses.length + ri][ci] = -Vm[i] * Vm[j] * (G[i][j] * Math.cos(Va[i] - Va[j]) + B[i][j] * Math.sin(Va[i] - Va[j]));
      });
      qBuses.forEach((j, ci) => {
        if (i === j) J[pBuses.length + ri][pBuses.length + ci] = Q[i] / Vm[i] - B[i][i] * Vm[i];
        else J[pBuses.length + ri][pBuses.length + ci] = Vm[i] * (G[i][j] * Math.sin(Va[i] - Va[j]) - B[i][j] * Math.cos(Va[i] - Va[j]));
      });
    });

    const dx = gaussElim(J, mismatch);
    if (!dx) break;

    pBuses.forEach((i, ri) => { Va[i] += dx[ri]; });
    qBuses.forEach((i, ri) => { Vm[i] = Math.max(0.7, Math.min(1.3, Vm[i] + dx[pBuses.length + ri] * Vm[i])); });
    iters = iter;
  }

  // Compute line flows
  const lineFlows    = {};
  const lineLoadings = {};
  lines.forEach(line => {
    if (trippedSet.has(line.id)) { lineFlows[line.id] = 0; lineLoadings[line.id] = 0; return; }
    const { from: i, to: j, R, X, B: Bsh, tap, cap } = line;
    const t2 = tap || 1;
    const zmag2 = R * R + X * X;
    if (zmag2 < 1e-12) { lineFlows[line.id] = 0; lineLoadings[line.id] = 0; return; }
    const yr = R / zmag2, yi = -X / zmag2;
    const Vi = Complex.fromPolar(Vm[i], Va[i]);
    const Vj = Complex.fromPolar(Vm[j], Va[j]);
    const y  = new Complex(yr, yi);
    const Iij = y.mul(new Complex(Vi.re / t2 - Vj.re, Vi.im / t2 - Vj.im));
    const Sij = Vi.mul(Iij.conj());
    const Smag = Math.sqrt(Sij.re * Sij.re + Sij.im * Sij.im) * BASE_MVA;
    lineFlows[line.id]    = Smag;
    lineLoadings[line.id] = cap > 0 ? (Smag / (cap * BASE_MVA)) * 100 : 0;
  });

  // Bus power injections
  const busP = new Array(n).fill(0);
  const busQ = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dA = Va[i] - Va[j];
      busP[i] += Vm[i] * Vm[j] * (G[i][j] * Math.cos(dA) + B[i][j] * Math.sin(dA));
      busQ[i] += Vm[i] * Vm[j] * (G[i][j] * Math.sin(dA) - B[i][j] * Math.cos(dA));
    }
    busP[i] *= BASE_MVA;
    busQ[i] *= BASE_MVA;
  }

  return { Vm, Va, lineFlows, lineLoadings, converged, iters, busP, busQ };
}
