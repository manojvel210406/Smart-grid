import { create } from 'zustand';

// ─── Default IEEE 5-Bus System ───────────────────────────────────────────────
const defaultBuses = [
  { id: 1, name: 'Bus-1 (Slack)', type: 'slack', voltage: 1.06, angle: 0,   P: 0,   Q: 0,   Pd: 0,    Qd: 0,    x: 200, y: 180, status: 'normal' },
  { id: 2, name: 'Bus-2 (PV)',    type: 'pv',    voltage: 1.045,angle: 0,   P: 40,  Q: 0,   Pd: 20,   Qd: 10,   x: 420, y: 100, status: 'normal' },
  { id: 3, name: 'Bus-3 (PQ)',    type: 'pq',    voltage: 1.0,  angle: 0,   P: 0,   Q: 0,   Pd: 45,   Qd: 15,   x: 620, y: 180, status: 'normal' },
  { id: 4, name: 'Bus-4 (PQ)',    type: 'pq',    voltage: 1.0,  angle: 0,   P: 0,   Q: 0,   Pd: 40,   Qd: 5,    x: 420, y: 300, status: 'normal' },
  { id: 5, name: 'Bus-5 (PQ)',    type: 'pq',    voltage: 1.0,  angle: 0,   P: 0,   Q: 0,   Pd: 60,   Qd: 10,   x: 620, y: 300, status: 'normal' },
];

const defaultLines = [
  { id: 1, from: 1, to: 2, R: 0.02,  X: 0.06,  B: 0.030, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 2, from: 1, to: 3, R: 0.08,  X: 0.24,  B: 0.025, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 3, from: 2, to: 3, R: 0.06,  X: 0.18,  B: 0.020, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 4, from: 2, to: 4, R: 0.06,  X: 0.18,  B: 0.020, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 5, from: 2, to: 5, R: 0.04,  X: 0.12,  B: 0.015, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 6, from: 3, to: 4, R: 0.01,  X: 0.03,  B: 0.010, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
  { id: 7, from: 4, to: 5, R: 0.08,  X: 0.24,  B: 0.025, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
];

const defaultGenerators = [
  { id: 1, busId: 1, name: 'Gen-1 (Slack)', Pg: 0,   Qg: 0,  Pmax: 250, Pmin: 10, cost_a: 0.02, cost_b: 2.0, cost_c: 0, type: 'thermal' },
  { id: 2, busId: 2, name: 'Gen-2 (PV)',    Pg: 40,  Qg: 0,  Pmax: 100, Pmin: 10, cost_a: 0.025,cost_b: 1.8, cost_c: 0, type: 'thermal' },
];

export const useGridStore = create((set, get) => ({
  // ── System Data ─────────────────────────────────────────────────────────────
  buses: defaultBuses,
  lines: defaultLines,
  generators: defaultGenerators,
  baseMVA: 100,
  baseKV: 230,

  // ── UI State ─────────────────────────────────────────────────────────────────
  mode: 'advanced',           // beginner | advanced | research
  viewMode: '2d',             // 2d | 3d
  activeTab: 'loadflow',      // right panel tab
  selectedElement: null,
  modelStatus: 'valid',       // valid | needs_recalc | error
  isRunning: false,
  demoMode: false,
  learningMode: false,

  // ── Results ──────────────────────────────────────────────────────────────────
  loadFlowResults: null,
  faultResults: null,
  stabilityResults: null,
  dispatchResults: null,

  // ── Logs & Explanations ───────────────────────────────────────────────────────
  logs: [
    { time: new Date().toISOString(), level: 'info', msg: '⚡ Smart Grid Digital Twin initialized.' },
    { time: new Date().toISOString(), level: 'info', msg: '📊 IEEE 5-Bus test system loaded.' },
    { time: new Date().toISOString(), level: 'info', msg: '🔧 Select Run Load Flow to begin analysis.' },
  ],
  explanations: [],
  insights: [],

  // ── Timeline ─────────────────────────────────────────────────────────────────
  timelineT: 0,
  timelineScenarios: ['normal', 'fault', 'breaker_trip', 'recovery'],

  // ── Disturbance ───────────────────────────────────────────────────────────────
  disturbance: { loadScale: 1.0, faultSeverity: 0, generatorOutage: null, renewableScale: 0 },

  // ── Version History ──────────────────────────────────────────────────────────
  history: [],
  historyIndex: -1,

  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  setBuses: (buses) => set({ buses, modelStatus: 'needs_recalc' }),
  setLines: (lines) => set({ lines, modelStatus: 'needs_recalc' }),
  setGenerators: (generators) => set({ generators, modelStatus: 'needs_recalc' }),
  setMode: (mode) => set({ mode }),
  setViewMode: (viewMode) => set({ viewMode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedElement: (el) => set({ selectedElement: el }),
  setLearningMode: (v) => set({ learningMode: v }),

  addLog: (msg, level = 'info') => set(s => ({
    logs: [...s.logs.slice(-199), { time: new Date().toISOString(), level, msg }]
  })),
  addExplanation: (exp) => set(s => ({ explanations: [...s.explanations.slice(-49), exp] })),
  addInsight: (ins) => set(s => ({ insights: [...s.insights.slice(-19), ins] })),
  clearLogs: () => set({ logs: [], explanations: [], insights: [] }),

  setLoadFlowResults: (r) => set({ loadFlowResults: r, modelStatus: 'valid' }),
  setFaultResults: (r) => set({ faultResults: r }),
  setStabilityResults: (r) => set({ stabilityResults: r }),
  setDispatchResults: (r) => set({ dispatchResults: r }),
  setIsRunning: (v) => set({ isRunning: v }),
  setDisturbance: (d) => set(s => ({ disturbance: { ...s.disturbance, ...d }, modelStatus: 'needs_recalc' })),
  setTimelineT: (t) => set({ timelineT: t }),

  addBus: () => set(s => {
    const id = Math.max(...s.buses.map(b => b.id), 0) + 1;
    const newBus = {
      id, name: `Bus-${id}`, type: 'pq', voltage: 1.0, angle: 0,
      P: 0, Q: 0, Pd: 10, Qd: 5,
      x: 200 + Math.random() * 300, y: 150 + Math.random() * 200, status: 'normal'
    };
    return { buses: [...s.buses, newBus], modelStatus: 'needs_recalc' };
  }),

  addLine: (from, to) => set(s => {
    const id = Math.max(...s.lines.map(l => l.id), 0) + 1;
    return {
      lines: [...s.lines, { id, from, to, R: 0.05, X: 0.15, B: 0.02, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 }],
      modelStatus: 'needs_recalc'
    };
  }),

  updateBus: (id, updates) => set(s => ({
    buses: s.buses.map(b => b.id === id ? { ...b, ...updates } : b),
    modelStatus: 'needs_recalc'
  })),

  updateLine: (id, updates) => set(s => ({
    lines: s.lines.map(l => l.id === id ? { ...l, ...updates } : l),
    modelStatus: 'needs_recalc'
  })),

  tripLine: (id) => set(s => ({
    lines: s.lines.map(l => l.id === id ? { ...l, status: 'tripped' } : l),
  })),

  restoreAll: () => set(s => ({
    lines: s.lines.map(l => ({ ...l, status: 'normal' })),
    buses: s.buses.map(b => ({ ...b, status: 'normal' })),
  })),

  saveSnapshot: () => set(s => {
    const snapshot = { buses: s.buses, lines: s.lines, generators: s.generators, ts: Date.now() };
    const h = [...s.history.slice(0, s.historyIndex + 1), snapshot];
    return { history: h.slice(-20), historyIndex: h.length - 1 };
  }),

  undo: () => set(s => {
    const idx = s.historyIndex - 1;
    if (idx < 0) return s;
    const snap = s.history[idx];
    return { ...snap, historyIndex: idx, history: s.history };
  }),

  redo: () => set(s => {
    const idx = s.historyIndex + 1;
    if (idx >= s.history.length) return s;
    const snap = s.history[idx];
    return { ...snap, historyIndex: idx, history: s.history };
  }),

  loadSystem: (systemName) => {
    const sys = PREBUILT_SYSTEMS[systemName];
    if (sys) set({ ...sys, modelStatus: 'needs_recalc', loadFlowResults: null });
  },

  resetToDefault: () => set({
    buses: defaultBuses, lines: defaultLines, generators: defaultGenerators,
    loadFlowResults: null, faultResults: null, stabilityResults: null,
    modelStatus: 'needs_recalc', logs: [],
  }),
}));

// ─── Prebuilt Systems ──────────────────────────────────────────────────────────
const PREBUILT_SYSTEMS = {
  'IEEE 5-Bus': { buses: defaultBuses, lines: defaultLines, generators: defaultGenerators },
  'Simple 3-Bus': {
    buses: [
      { id: 1, name: 'Bus-1 (Slack)', type: 'slack', voltage: 1.0, angle: 0, P: 0, Q: 0, Pd: 0, Qd: 0, x: 200, y: 200, status: 'normal' },
      { id: 2, name: 'Bus-2 (PV)',   type: 'pv',    voltage: 1.0, angle: 0, P: 20, Q: 0, Pd: 10, Qd: 5, x: 420, y: 120, status: 'normal' },
      { id: 3, name: 'Bus-3 (PQ)',   type: 'pq',    voltage: 1.0, angle: 0, P: 0, Q: 0, Pd: 30, Qd: 10, x: 420, y: 280, status: 'normal' },
    ],
    lines: [
      { id: 1, from: 1, to: 2, R: 0.05, X: 0.15, B: 0.02, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
      { id: 2, from: 1, to: 3, R: 0.10, X: 0.30, B: 0.03, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
      { id: 3, from: 2, to: 3, R: 0.08, X: 0.24, B: 0.02, ratingMVA: 100, loading: 0, status: 'normal', flow: 0 },
    ],
    generators: [
      { id: 1, busId: 1, name: 'Gen-1', Pg: 0, Qg: 0, Pmax: 150, Pmin: 10, cost_a: 0.02, cost_b: 2, cost_c: 0, type: 'thermal' },
    ],
  },
};
export { PREBUILT_SYSTEMS };
