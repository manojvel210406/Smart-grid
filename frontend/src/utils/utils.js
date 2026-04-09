/**
 * Power System Utility Functions
 * Per-unit conversion, validation, and formatting
 */

// ─── Per-Unit Conversions ──────────────────────────────────────────────────────
export const perUnit = {
  /** Convert MW to per-unit given base MVA */
  MW: (mw, baseMVA = 100) => mw / baseMVA,

  /** Convert kV to per-unit given base kV */
  kV: (kv, baseKV = 230) => kv / baseKV,

  /** Convert Ohms to per-unit impedance */
  ohms: (z, baseKV = 230, baseMVA = 100) => z / ((baseKV ** 2) / baseMVA),

  /** Convert per-unit voltage back to kV */
  toKV: (vpu, baseKV = 230) => vpu * baseKV,

  /** Convert per-unit power back to MW */
  toMW: (ppu, baseMVA = 100) => ppu * baseMVA,
};

// ─── Input Validation ──────────────────────────────────────────────────────────
export function validateBus(bus) {
  const errors = {};
  if (!bus.name || bus.name.trim() === '') errors.name = 'Bus name is required';
  if (bus.voltage < 0.5 || bus.voltage > 1.5) errors.voltage = 'Voltage should be 0.5–1.5 pu';
  if (bus.Pd < 0) errors.Pd = 'Load P cannot be negative';
  if (bus.Qd < -500 || bus.Qd > 500) errors.Qd = 'Qd out of range';
  return errors;
}

export function validateLine(line, buses) {
  const errors = {};
  const busIds = buses.map(b => b.id);
  if (!busIds.includes(line.from)) errors.from = 'Invalid from-bus';
  if (!busIds.includes(line.to)) errors.to = 'Invalid to-bus';
  if (line.from === line.to) errors.loop = 'Self-loop not allowed';
  if (line.R < 0) errors.R = 'Resistance must be ≥ 0';
  if (line.X <= 0) errors.X = 'Reactance must be > 0';
  if (line.B < 0) errors.B = 'Susceptance must be ≥ 0';
  return errors;
}

// ─── System Health Check ───────────────────────────────────────────────────────
export function checkSystemHealth(buses, lines) {
  const issues = [];

  // Check slack bus
  const slackBuses = buses.filter(b => b.type === 'slack');
  if (slackBuses.length === 0) issues.push({ severity: 'error', msg: 'No slack bus defined. Add at least one slack bus.' });
  if (slackBuses.length > 1) issues.push({ severity: 'warning', msg: 'Multiple slack buses defined.' });

  // Check connectivity
  const activeLines = lines.filter(l => l.status !== 'tripped');
  const busIds = new Set(buses.map(b => b.id));
  const connected = new Set([buses[0]?.id]);
  let changed = true;
  while (changed) {
    changed = false;
    activeLines.forEach(l => {
      if (connected.has(l.from) && !connected.has(l.to)) { connected.add(l.to); changed = true; }
      if (connected.has(l.to) && !connected.has(l.from)) { connected.add(l.from); changed = true; }
    });
  }
  const unconnected = [...busIds].filter(id => !connected.has(id));
  if (unconnected.length > 0) {
    issues.push({ severity: 'error', msg: `Islanded buses: ${unconnected.join(', ')}. These cannot be solved.` });
  }

  // Check for zero impedance lines
  lines.forEach(l => {
    if (l.X === 0) issues.push({ severity: 'warning', msg: `Line ${l.id}: Zero reactance — may cause numerical issues.` });
  });

  return issues;
}

// ─── Formatting Helpers ────────────────────────────────────────────────────────
export const fmt = {
  pu: (v, decimals = 4) => `${parseFloat(v).toFixed(decimals)} pu`,
  MW: (v, decimals = 2) => `${parseFloat(v).toFixed(decimals)} MW`,
  MVar: (v, decimals = 2) => `${parseFloat(v).toFixed(decimals)} MVAr`,
  deg: (v, decimals = 2) => `${parseFloat(v).toFixed(decimals)}°`,
  kA: (v, decimals = 3) => `${parseFloat(v).toFixed(decimals)} kA`,
  pct: (v, decimals = 1) => `${parseFloat(v).toFixed(decimals)}%`,
};

// ─── Status Color ──────────────────────────────────────────────────────────────
export function statusColor(status) {
  const map = {
    normal: '#00ff88',
    warning: '#ffaa00',
    error: '#ff4444',
    overload: '#ff2020',
    tripped: '#666666',
    low_voltage: '#ff8800',
    high_voltage: '#ffff00',
    critical: '#ff0000',
    success: '#00ff88',
    info: '#00d4ff',
  };
  return map[status] || '#aaaaaa';
}

// ─── Voltage Status ────────────────────────────────────────────────────────────
export function voltageStatus(v) {
  if (v < 0.90) return 'error';
  if (v < 0.95) return 'warning';
  if (v > 1.10) return 'error';
  if (v > 1.05) return 'warning';
  return 'normal';
}

// ─── Loading Status ────────────────────────────────────────────────────────────
export function loadingStatus(loading) {
  if (loading > 100) return 'overload';
  if (loading > 80) return 'warning';
  return 'normal';
}
