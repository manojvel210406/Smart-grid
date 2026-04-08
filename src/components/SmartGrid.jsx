// ============================================================
// SMART GRID DIGITAL TWIN — Main Component
// IEEE 14-Bus System | NR Load Flow | AGC | AI Prediction
// ============================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { runNewtonRaphson, BASE_MVA } from "../engine/powerflow.js";
import { computeSystemDynamics } from "../engine/dynamics.js";
import { checkRelays, computeFaultCurrent, RELAY_SETTINGS } from "../protection/relay.js";
import { predictBlackoutProbability } from "../ai/prediction.js";
import "../styles/main.css";

// ============================================================
// GRID TOPOLOGY — IEEE 14-Bus
// ============================================================
const BUS_DATA = [
  { id: 0,  name: "B1",  type: "slack", x: 0.13, y: 0.15, Vm: 1.06, Va: 0, Pg: 2.32, Qg: -0.17, Pd: 0,     Qd: 0,     voltage: "500kV", label: "Slack/G1"  },
  { id: 1,  name: "B2",  type: "pv",   x: 0.38, y: 0.10, Vm: 1.045,Va: 0, Pg: 0.40, Qg: 0,     Pd: 0.217, Qd: 0.127, voltage: "500kV", label: "Solar G2"  },
  { id: 2,  name: "B3",  type: "pq",   x: 0.70, y: 0.12, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.942, Qd: 0.19,  voltage: "500kV", label: "Load"      },
  { id: 3,  name: "B4",  type: "pv",   x: 0.90, y: 0.28, Vm: 1.01, Va: 0, Pg: 0.20, Qg: 0,     Pd: 0.478, Qd: -0.039,voltage: "500kV", label: "G3"        },
  { id: 4,  name: "B5",  type: "pq",   x: 0.90, y: 0.55, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.076, Qd: 0.016, voltage: "220kV", label: "Load"      },
  { id: 5,  name: "B6",  type: "pv",   x: 0.68, y: 0.42, Vm: 1.07, Va: 0, Pg: 0.24, Qg: 0,     Pd: 0.112, Qd: 0.075, voltage: "220kV", label: "G4/SVC"    },
  { id: 6,  name: "B7",  type: "pq",   x: 0.50, y: 0.38, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0,     Qd: 0,     voltage: "220kV", label: "Trans"     },
  { id: 7,  name: "B8",  type: "pv",   x: 0.28, y: 0.42, Vm: 1.09, Va: 0, Pg: 0.35, Qg: 0,     Pd: 0,     Qd: 0,     voltage: "220kV", label: "Wind G5"   },
  { id: 8,  name: "B9",  type: "pq",   x: 0.50, y: 0.60, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.295, Qd: 0.166, voltage: "220kV", label: "Load"      },
  { id: 9,  name: "B10", type: "pq",   x: 0.68, y: 0.72, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.090, Qd: 0.058, voltage: "110kV", label: "Load"      },
  { id: 10, name: "B11", type: "pq",   x: 0.50, y: 0.80, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.035, Qd: 0.018, voltage: "110kV", label: "Load"      },
  { id: 11, name: "B12", type: "pq",   x: 0.28, y: 0.75, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.061, Qd: 0.016, voltage: "110kV", label: "Load"      },
  { id: 12, name: "B13", type: "pq",   x: 0.13, y: 0.68, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.135, Qd: 0.058, voltage: "110kV", label: "Load"      },
  { id: 13, name: "B14", type: "pq",   x: 0.13, y: 0.88, Vm: 1.0,  Va: 0, Pg: 0,    Qg: 0,     Pd: 0.149, Qd: 0.050, voltage: "110kV", label: "Load"      },
];

const LINE_DATA = [
  { id: 0,  from: 0,  to: 1,  R: 0.01938, X: 0.05917, B: 0.0528, tap: 1,     cap: 3.50, name: "L1-2",   type: "tx"   },
  { id: 1,  from: 0,  to: 4,  R: 0.05403, X: 0.22304, B: 0.0492, tap: 1,     cap: 2.50, name: "L1-5",   type: "tx"   },
  { id: 2,  from: 1,  to: 2,  R: 0.04699, X: 0.19797, B: 0.0438, tap: 1,     cap: 2.20, name: "L2-3",   type: "tx"   },
  { id: 3,  from: 1,  to: 3,  R: 0.05811, X: 0.17632, B: 0.0374, tap: 1,     cap: 2.00, name: "L2-4",   type: "tx"   },
  { id: 4,  from: 1,  to: 4,  R: 0.05695, X: 0.17388, B: 0.0340, tap: 1,     cap: 2.00, name: "L2-5",   type: "tx"   },
  { id: 5,  from: 2,  to: 3,  R: 0.06701, X: 0.17103, B: 0.0346, tap: 1,     cap: 1.80, name: "L3-4",   type: "tx"   },
  { id: 6,  from: 3,  to: 4,  R: 0.01335, X: 0.04211, B: 0,      tap: 0.978, cap: 1.80, name: "T4-5",   type: "xfmr" },
  { id: 7,  from: 0,  to: 5,  R: 0,       X: 0.25202, B: 0,      tap: 0.932, cap: 1.50, name: "T1-6",   type: "xfmr" },
  { id: 8,  from: 7,  to: 5,  R: 0,       X: 0.17615, B: 0,      tap: 1.0,   cap: 1.40, name: "T8-6",   type: "xfmr" },
  { id: 9,  from: 6,  to: 5,  R: 0,       X: 0.11001, B: 0,      tap: 1.0,   cap: 1.40, name: "T7-6",   type: "xfmr" },
  { id: 10, from: 6,  to: 8,  R: 0.09498, X: 0.19890, B: 0,      tap: 1,     cap: 1.20, name: "L7-9",   type: "dist" },
  { id: 11, from: 6,  to: 7,  R: 0.12291, X: 0.25581, B: 0,      tap: 1,     cap: 1.20, name: "L7-8",   type: "dist" },
  { id: 12, from: 8,  to: 9,  R: 0.06615, X: 0.13027, B: 0,      tap: 1,     cap: 1.00, name: "L9-10",  type: "dist" },
  { id: 13, from: 8,  to: 13, R: 0.22092, X: 0.19988, B: 0,      tap: 1,     cap: 0.80, name: "L9-14",  type: "dist" },
  { id: 14, from: 9,  to: 10, R: 0.22092, X: 0.19988, B: 0,      tap: 1,     cap: 0.80, name: "L10-11", type: "dist" },
  { id: 15, from: 9,  to: 13, R: 0.17093, X: 0.34802, B: 0,      tap: 1,     cap: 0.80, name: "L10-14", type: "dist" },
  { id: 16, from: 10, to: 11, R: 0.08450, X: 0.20912, B: 0,      tap: 1,     cap: 0.70, name: "L11-12", type: "dist" },
  { id: 17, from: 11, to: 12, R: 0.09919, X: 0.19797, B: 0,      tap: 1,     cap: 0.70, name: "L12-13", type: "dist" },
  { id: 18, from: 12, to: 13, R: 0.12291, X: 0.25581, B: 0,      tap: 1,     cap: 0.60, name: "L13-14", type: "dist" },
];

const INITIAL_LINES = LINE_DATA.map(l => ({ ...l, tripped: false, faultTime: null, sparkAt: null }));

const TABS = [
  { id: "grid",     label: "GRID",     icon: "⚡" },
  { id: "analytics",label: "ANALYTICS",icon: "📊" },
  { id: "alarms",   label: "ALARMS",   icon: "🚨" },
  { id: "ai",       label: "AI ENGINE",icon: "🧠" },
  { id: "control",  label: "CONTROL",  icon: "🎛"  },
];

const FAULT_TYPES = ["LG", "LL", "LLG", "3PH"];

// ============================================================
// MICRO-COMPONENTS
// ============================================================
function Pill({ label, value, color, blink }) {
  return (
    <div className="pill" style={{
      borderColor: `${color}44`,
      background: `${color}0d`,
      animation: blink ? "blink 0.7s step-end infinite" : "none",
    }}>
      <div className="pill-label">{label}</div>
      <div className="pill-value" style={{ color }}>{value}</div>
    </div>
  );
}

function HudStat({ label, value, color }) {
  return (
    <div className="hud-stat">
      <div className="hud-stat-label">{label}</div>
      <div className="hud-stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

function SectionHeader({ children, style }) {
  return <div className="section-header" style={style}>{children}</div>;
}

function MetricCard({ label, value, color }) {
  return (
    <div className="metric-card" style={{ borderLeft: `3px solid ${color}`, borderColor: `transparent transparent transparent ${color}`, borderLeftColor: color }}>
      <div className="metric-card-label">{label.toUpperCase()}</div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, color = "#c8d8e8" }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value" style={{ color }}>{value}</span>
    </div>
  );
}

function ScadaBtn({ onClick, color = "#00ff9d", label }) {
  return (
    <button onClick={onClick} className="scada-btn" style={{
      borderColor: `${color}44`, color, background: `${color}0a`,
    }}>{label}</button>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SmartGrid() {
  const canvasRef    = useRef(null);
  const chartFreqRef = useRef(null);
  const chartProbRef = useRef(null);
  const chartLoadRef = useRef(null);
  const simTimeRef   = useRef(0);
  const prevFreqRef  = useRef(50);
  const tripTimers   = useRef(new Map());  // persistent OC relay timers
  const blackoutShownRef = useRef(false);

  // Simulation state
  const [isPaused,    setIsPaused]    = useState(false);
  const [simTime,     setSimTime]     = useState(0);
  const [activeTab,   setActiveTab]   = useState("grid");
  const [scenario,    setScenario]    = useState("normal");
  const [faultEvent,  setFaultEvent]  = useState(null);

  // Grid topology
  const [lines,  setLines]  = useState(INITIAL_LINES);
  const [buses]             = useState(BUS_DATA);

  // Computed results
  const [flowResult,  setFlowResult]  = useState(null);
  const [dynState,    setDynState]    = useState(null);
  const [aiResult,    setAiResult]    = useState({ prob: 0.04, level: "LOW", color: "#00ff9d", actions: [], factors: {} });
  const [alarms,      setAlarms]      = useState([]);
  const [blackout,    setBlackout]    = useState(null);
  const [showModal,   setShowModal]   = useState(false);
  const [modalData,   setModalData]   = useState(null);
  const [history,     setHistory]     = useState({ freq: [], load: [], gen: [], prob: [], time: [] });

  // UI state
  const [ackAlarms,   setAckAlarms]   = useState(new Set());
  const [selectedBus, setSelectedBus] = useState(null);
  const [faultModal,  setFaultModal]  = useState(false);
  const [pendingFault,setPendingFault]= useState(null);
  const [loadShed,    setLoadShed]    = useState(0);
  const [genBoost,    setGenBoost]    = useState(0);
  const [viewOffset,  setViewOffset]  = useState({ x: 0, y: 0 });
  const [viewScale,   setViewScale]   = useState(1);
  const touchStartRef = useRef(null);
  const lastPinchRef  = useRef(null);

  const trippedSet = useMemo(() => new Set(lines.filter(l => l.tripped).map(l => l.id)), [lines]);

  // ============================================================
  // MAIN SIMULATION LOOP
  // ============================================================
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      simTimeRef.current += 1;
      const t = simTimeRef.current;
      setSimTime(t);

      setLines(currentLines => {
        const ts = new Set(currentLines.filter(l => l.tripped).map(l => l.id));

        // --- Dynamics (AGC + load model) ---
        const dyn = computeSystemDynamics(
          buses, currentLines, t, scenario, faultEvent,
          loadShed, genBoost, prevFreqRef.current
        );

        const rocof = dyn.frequency - prevFreqRef.current;
        prevFreqRef.current = dyn.frequency;

        // --- Newton-Raphson Load Flow ---
        let nrResult;
        try {
          nrResult = runNewtonRaphson(dyn.dynBuses, LINE_DATA, ts);
        } catch {
          nrResult = {
            Vm: buses.map(() => 1), Va: buses.map(() => 0),
            lineFlows: {}, lineLoadings: {}, converged: false, iters: 0, busP: [], busQ: [],
          };
        }

        setDynState(dyn);
        setFlowResult(nrResult);

        // --- Protection relay check (with persistent timers) ---
        const trips = checkRelays(
          currentLines, nrResult.lineLoadings,
          nrResult.Vm, prevFreqRef.current, dyn.frequency, 1,
          tripTimers.current
        );

        // --- Apply trips ---
        let newLines = [...currentLines];
        trips.forEach(trip => {
          if (trip.lineId >= 0 && !currentLines[trip.lineId]?.tripped) {
            newLines = newLines.map(l =>
              l.id === trip.lineId ? { ...l, tripped: true, faultTime: t, sparkAt: Date.now() } : l
            );
            addAlarm("CRIT", `${trip.relay}: ${LINE_DATA[trip.lineId]?.name} tripped — ${trip.reason}`, "trip");
          }
        });

        // --- Overload alarms (warn only, no trip) ---
        Object.entries(nrResult.lineLoadings || {}).forEach(([id, loading]) => {
          const lid = parseInt(id);
          if (loading > 100 && !currentLines[lid]?.tripped) {
            addAlarm("HIGH", `${LINE_DATA[lid]?.name} overloaded ${loading.toFixed(0)}%`, "overload");
          }
        });

        // --- Voltage alarms ---
        (nrResult.Vm || []).forEach((v, i) => {
          if (v < RELAY_SETTINGS.underVoltage) {
            addAlarm("HIGH", `${buses[i]?.name} under-voltage ${(v * 100).toFixed(1)}%`, "voltage");
          }
        });

        // --- Frequency alarms ---
        if (dyn.frequency < 49.5) {
          const pri = dyn.frequency < 48.5 ? "CRIT" : "HIGH";
          addAlarm(pri, `LOW FREQ ${dyn.frequency.toFixed(3)} Hz  RoCoF ${rocof.toFixed(3)} Hz/s`, "freq");
        }

        // --- AI Blackout Prediction ---
        const trippedCount = newLines.filter(l => l.tripped).length;
        const aig = predictBlackoutProbability({
          lineLoadings: nrResult.lineLoadings,
          Vm: nrResult.Vm,
          frequency: dyn.frequency,
          imbalance: dyn.imbalance,
          totalGen: dyn.totalGen,
          rocof,
          trippedCount,
        });
        setAiResult(aig);

        // --- Blackout detection ---
        let bout = null;
        if (dyn.frequency < 47.5) {
          bout = { type: "FULL", reason: `Frequency collapse ${dyn.frequency.toFixed(2)} Hz` };
        } else if (trippedCount >= 8) {
          bout = { type: "FULL", reason: `Cascade: ${trippedCount} lines tripped` };
        } else if (dyn.frequency < 48.5 && trippedCount >= 4) {
          bout = { type: "PARTIAL", reason: `Partial isolation f=${dyn.frequency.toFixed(2)} Hz` };
        }

        setBlackout(bout);
        if (bout && !blackoutShownRef.current) {
          blackoutShownRef.current = true;
          setModalData({ ...bout, t, freq: dyn.frequency, totalGen: dyn.totalGen, totalLoad: dyn.totalLoad });
          setShowModal(true);
        }
        if (!bout) blackoutShownRef.current = false;

        // --- History for charts ---
        setHistory(h => {
          const MAX = 90;
          return {
            freq: [...h.freq, dyn.frequency].slice(-MAX),
            load: [...h.load, dyn.totalLoad].slice(-MAX),
            gen:  [...h.gen,  dyn.totalGen ].slice(-MAX),
            prob: [...h.prob, aig.prob      ].slice(-MAX),
            time: [...h.time, t             ].slice(-MAX),
          };
        });

        return newLines;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, buses, scenario, faultEvent, loadShed, genBoost]);

  // throttle alarms (dedup by type prefix)
  const addAlarm = useCallback((priority, text, type) => {
    setAlarms(a => {
      if (a[0]?.text?.startsWith(text.slice(0, 20))) return a;
      return [{ id: Date.now(), priority, time: new Date().toLocaleTimeString(), text, acked: false, type }, ...a].slice(0, 100);
    });
  }, []);

  // ============================================================
  // CANVAS RENDER (2D SCADA diagram)
  // ============================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeTab !== "grid") return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);
    ctx.scale(viewScale, viewScale);

    const bx = b => b.x * W;
    const by = b => b.y * H;

    // Background grid
    ctx.strokeStyle = "rgba(0,255,157,0.03)";
    ctx.lineWidth = 0.8;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Draw lines
    lines.forEach(line => {
      const from = buses[line.from], to = buses[line.to];
      if (!from || !to) return;
      const loading = flowResult?.lineLoadings?.[line.id] || 0;
      const spark   = line.sparkAt && Date.now() - line.sparkAt < 2500;

      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      if (line.tripped) {
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = spark ? "#ff3333" : "rgba(255,50,50,0.22)";
        ctx.lineWidth = 1.5;
      } else {
        ctx.lineWidth = line.type === "tx" ? 3.5 : line.type === "xfmr" ? 3 : 2;
        if      (loading > 120) { ctx.strokeStyle = "#ff1111"; ctx.shadowColor = "#ff1111"; ctx.shadowBlur = 10; }
        else if (loading > 100) { ctx.strokeStyle = "#ff4444"; ctx.shadowColor = "#ff4444"; ctx.shadowBlur = 7;  }
        else if (loading > 85)  { ctx.strokeStyle = "#ff8800"; ctx.shadowColor = "#ff8800"; ctx.shadowBlur = 5;  }
        else if (loading > 65)  { ctx.strokeStyle = "#ffcc00"; }
        else { ctx.strokeStyle = line.type === "tx" ? "#00ccff" : line.type === "xfmr" ? "#ff9900" : "#00ff9d"; }
      }

      ctx.beginPath();
      ctx.moveTo(bx(from), by(from));
      ctx.lineTo(bx(to),   by(to));
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.setLineDash([]);

      // Animated flow particles
      if (!line.tripped && loading > 5 && viewScale > 0.5) {
        const tp = (Date.now() / 1200 + line.id * 0.37) % 1;
        const px = bx(from) + tp * (bx(to) - bx(from));
        const py = by(from) + tp * (by(to) - by(from));
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = loading > 100 ? "#ff4444" : loading > 85 ? "#ff9900" : "rgba(255,255,200,0.85)";
        ctx.fill();
      }

      // Fault sparks
      if (spark) {
        for (let i = 0; i < 4; i++) {
          const ts = Math.random();
          ctx.beginPath();
          ctx.arc(
            bx(from) + ts * (bx(to) - bx(from)) + (Math.random() - 0.5) * 14,
            by(from) + ts * (by(to) - by(from)) + (Math.random() - 0.5) * 14,
            1.5 + Math.random() * 2, 0, Math.PI * 2
          );
          ctx.fillStyle = "#fff8aa"; ctx.fill();
        }
      }

      // Loading label
      if (!line.tripped && viewScale > 0.7) {
        const mx = (bx(from) + bx(to)) / 2, my = (by(from) + by(to)) / 2;
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = loading > 100 ? "#ff6666" : loading > 85 ? "#ff9900" : "rgba(255,255,255,0.3)";
        ctx.textAlign = "center";
        ctx.fillText(`${loading.toFixed(0)}%`, mx, my - 5);
        ctx.textAlign = "left";
      }
    });

    // Draw buses
    buses.forEach(bus => {
      const x = bx(bus), y = by(bus);
      const Vm       = flowResult?.Vm?.[bus.id] || 1.0;
      const isBlacked = blackout?.type === "FULL";
      const isSelected = selectedBus === bus.id;

      const baseColor = bus.type === "slack" ? "#0088ff" : bus.type === "pv" ? "#00ccff" : "#00ff9d";
      const voltColor = Vm < 0.90 ? "#ff2222" : Vm < 0.95 ? "#ff8800" : Vm > 1.10 ? "#ff44ff" : Vm > 1.05 ? "#ffaa00" : baseColor;
      const drawColor = isBlacked ? "#222" : voltColor;
      const r = bus.type === "slack" ? 14 : bus.type === "pv" ? 12 : 9;

      ctx.shadowColor = isSelected ? "#ffffff" : drawColor;
      ctx.shadowBlur  = isSelected ? 20 : 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isBlacked ? "#111" : bus.type === "slack" ? "#00112a" : bus.type === "pv" ? "#001122" : "#001811";
      ctx.fill();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth   = isSelected ? 3 : 2;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Voltage ring
      if (!isBlacked && viewScale > 0.5) {
        const voltPct = Math.max(0, Math.min(1, (Vm - 0.85) / 0.30));
        ctx.beginPath();
        ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + voltPct * 2 * Math.PI);
        ctx.strokeStyle = `${voltColor}99`;
        ctx.lineWidth   = 2;
        ctx.stroke();
      }

      // Bus icon
      ctx.font      = `bold ${Math.max(7, 8 / viewScale)}px Arial`;
      ctx.fillStyle = isBlacked ? "#444" : drawColor;
      ctx.textAlign = "center";
      ctx.fillText(bus.type === "slack" ? "S" : bus.type === "pv" ? "G" : "L", x, y + 3);
      ctx.textAlign = "left";

      if (viewScale > 0.6) {
        ctx.font      = "8px monospace";
        ctx.fillStyle = isBlacked ? "#333" : "rgba(180,210,230,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(bus.name, x, y + r + 10);
        if (viewScale > 0.8) {
          ctx.font      = "7px monospace";
          ctx.fillStyle = `${voltColor}cc`;
          ctx.fillText(`${(Vm * 100).toFixed(1)}%`, x, y + r + 18);
        }
        ctx.textAlign = "left";
      }
    });

    // Blackout overlay
    if (blackout?.type) {
      const grad = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6);
      grad.addColorStop(0, blackout.type === "FULL" ? "rgba(40,0,0,0.5)" : "rgba(60,30,0,0.4)");
      grad.addColorStop(1, blackout.type === "FULL" ? "rgba(10,0,0,0.82)" : "rgba(20,10,0,0.55)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }, [lines, buses, flowResult, blackout, selectedBus, activeTab, viewOffset, viewScale]);

  // ============================================================
  // CHART RENDERING (analytics tab)
  // ============================================================
  useEffect(() => {
    if (activeTab !== "analytics") return;

    const drawChart = (ref, data, label, color, min, max, unit, dangerLine) => {
      const canvas = ref?.current;
      if (!canvas || data.length < 2) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#030810"; ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = H * 0.1 + H * 0.8 * (i / 4);
        ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(W - 5, y); ctx.stroke();
        const v = max - (max - min) * (i / 4);
        ctx.font = "8px monospace"; ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillText(v.toFixed(1), 2, y + 3);
      }

      // Danger line
      if (dangerLine !== undefined) {
        const dy = H * 0.9 - ((dangerLine - min) / (max - min)) * H * 0.8;
        ctx.beginPath(); ctx.moveTo(32, dy); ctx.lineTo(W - 5, dy);
        ctx.strokeStyle = "rgba(255,50,50,0.3)"; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.stroke(); ctx.setLineDash([]);
      }

      // Area fill
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = 32 + (i / (data.length - 1)) * (W - 37);
        const y = H * 0.9 - ((v - min) / (max - min)) * H * 0.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(32 + (W - 37), H); ctx.lineTo(32, H); ctx.closePath();
      ctx.fillStyle = `${color}18`; ctx.fill();

      // Line
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = 32 + (i / (data.length - 1)) * (W - 37);
        const y = H * 0.9 - ((v - min) / (max - min)) * H * 0.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 5;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Label
      ctx.font = "bold 10px monospace"; ctx.fillStyle = color;
      ctx.fillText(`${label}: ${data[data.length - 1]?.toFixed(3)} ${unit}`, 34, 15);
    };

    drawChart(chartFreqRef, history.freq, "FREQ",      "#00ff9d", 47.5, 51.5, "Hz",  49.0);
    drawChart(chartProbRef, history.prob.map(p => p * 100), "P(BLACKOUT)", "#ff4444", 0, 100, "%", 50);
    drawChart(chartLoadRef, history.load, "LOAD",      "#00aaff", 200, 1400, "MW");
  }, [history, activeTab]);

  // ============================================================
  // TOUCH / CLICK HANDLERS
  // ============================================================
  const handleTouchStart = useCallback(e => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, offset: { ...viewOffset } };
      lastPinchRef.current  = null;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), scale: viewScale };
    }
  }, [viewOffset, viewScale]);

  const handleTouchMove = useCallback(e => {
    e.preventDefault();
    if (e.touches.length === 2 && lastPinchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setViewScale(Math.min(3, Math.max(0.4, lastPinchRef.current.scale * (dist / lastPinchRef.current.dist))));
    } else if (e.touches.length === 1 && touchStartRef.current) {
      setViewOffset({
        x: touchStartRef.current.offset.x + (e.touches[0].clientX - touchStartRef.current.x),
        y: touchStartRef.current.offset.y + (e.touches[0].clientY - touchStartRef.current.y),
      });
    }
  }, []);

  const handleTouchEnd = useCallback(e => {
    if (e.changedTouches.length === 1 && touchStartRef.current) {
      const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
      if (dx < 12 && dy < 12) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const rawX = (e.changedTouches[0].clientX - rect.left) * (canvas.width / rect.width);
        const rawY = (e.changedTouches[0].clientY - rect.top)  * (canvas.height / rect.height);
        handleCanvasClick((rawX - viewOffset.x) / viewScale, (rawY - viewOffset.y) / viewScale, canvas.width, canvas.height);
      }
    }
    touchStartRef.current = null;
  }, [viewOffset, viewScale]);

  const handleCanvasClick = useCallback((mx, my, W, H) => {
    let hitBus = null, minBusDist = Infinity;
    buses.forEach(b => {
      const d = Math.sqrt((mx - b.x * W) ** 2 + (my - b.y * H) ** 2);
      if (d < 22 && d < minBusDist) { minBusDist = d; hitBus = b.id; }
    });
    if (hitBus !== null) {
      setSelectedBus(b => b === hitBus ? null : hitBus);
      return;
    }

    // Line click → fault injection
    let hitLine = null, minDist = Infinity;
    lines.forEach(line => {
      if (line.tripped) return;
      const from = buses[line.from], to = buses[line.to];
      if (!from || !to) return;
      const fx = from.x * W, fy = from.y * H, tx = to.x * W, ty = to.y * H;
      const ddx = tx - fx, ddy = ty - fy, len2 = ddx * ddx + ddy * ddy;
      const t0 = Math.max(0, Math.min(1, ((mx - fx) * ddx + (my - fy) * ddy) / len2));
      const d = Math.sqrt((mx - fx - t0 * ddx) ** 2 + (my - fy - t0 * ddy) ** 2);
      if (d < 18 && d < minDist) { minDist = d; hitLine = line.id; }
    });
    if (hitLine !== null) {
      setPendingFault(hitLine);
      setFaultModal(true);
      setSelectedBus(null);
    }
  }, [buses, lines]);

  const handleMouseClick = useCallback(e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const my = (e.clientY - rect.top)  * (canvas.height / rect.height);
    handleCanvasClick((mx - viewOffset.x) / viewScale, (my - viewOffset.y) / viewScale, canvas.width, canvas.height);
  }, [viewOffset, viewScale, handleCanvasClick]);

  const injectFault = useCallback((lineId, faultType) => {
    const Vm   = flowResult?.Vm?.[lines[lineId]?.from] || 1;
    const Ifc  = computeFaultCurrent(Vm, faultType);
    setLines(l => l.map(li => li.id === lineId ? { ...li, tripped: true, faultTime: simTimeRef.current, sparkAt: Date.now() } : li));
    addAlarm("CRIT", `FAULT ${faultType} on ${LINE_DATA[lineId]?.name} — Ifc=${Ifc.toFixed(2)} kA`, "fault");
    setFaultModal(false);
  }, [flowResult, lines, addAlarm]);

  const resetSystem = useCallback(() => {
    setLines(INITIAL_LINES);
    setBlackout(null); setShowModal(false); blackoutShownRef.current = false;
    setAlarms([{ id: Date.now(), priority: "INFO", time: new Date().toLocaleTimeString(), text: "System reset — all lines restored", acked: false, type: "info" }]);
    setHistory({ freq: [], load: [], gen: [], prob: [], time: [] });
    simTimeRef.current = 0; setSimTime(0);
    setViewOffset({ x: 0, y: 0 }); setViewScale(1);
    setLoadShed(0); setGenBoost(0); setFaultEvent(null);
    prevFreqRef.current = 50;
    tripTimers.current.clear();
  }, []);

  // ============================================================
  // DERIVED VALUES
  // ============================================================
  const freq       = dynState?.frequency || 50;
  const totalGen   = dynState?.totalGen  || 0;
  const totalLoad  = dynState?.totalLoad || 0;
  const trippedCt  = lines.filter(l => l.tripped).length;
  const maxLoad    = Math.max(...Object.values(flowResult?.lineLoadings || {}), 0);
  const unackedCt  = alarms.filter(a => !ackAlarms.has(a.id) && a.priority === "CRIT").length;
  const freqColor  = freq < 48.5 ? "#ff1111" : freq < 49.2 ? "#ff4444" : freq < 49.8 ? "#ffcc00" : "#00ff9d";
  const sysStatus  = blackout?.type === "FULL"    ? "BLACKOUT" :
                     blackout?.type === "PARTIAL" ? "PARTIAL"  :
                     trippedCt > 2                ? "WARNING"  :
                     trippedCt > 0                ? "ALERT"    : "NOMINAL";
  const statusClr  = { BLACKOUT: "#ff1111", PARTIAL: "#ff6600", WARNING: "#ffcc00", ALERT: "#ff9900", NOMINAL: "#00ff9d" }[sysStatus];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="app-root">

      {/* ===== TOP SCADA BAR ===== */}
      <div className="top-bar">
        <div>
          <div className="top-bar-logo">
            <span style={{ color: "#00ff9d" }}>⚡</span> GRID<span style={{ color: "#00ff9d" }}>TWIN</span>
          </div>
          <div className="top-bar-subtitle">14-BUS DIGITAL TWIN • t={simTime}s</div>
        </div>

        <div className="status-strip">
          <Pill label="FREQ"   value={`${freq.toFixed(3)}Hz`}         color={freqColor} />
          <Pill label="STATUS" value={sysStatus}                       color={statusClr} blink={sysStatus === "BLACKOUT"} />
          <Pill label="GEN"    value={`${(totalGen / 1000).toFixed(2)}GW`}  color="#00aaff" />
          <Pill label="LOAD"   value={`${(totalLoad / 1000).toFixed(2)}GW`} color="#ffaa00" />
          <Pill label="P(BO)"  value={`${(aiResult.prob * 100).toFixed(0)}%`} color={aiResult.color} />
        </div>

        <div className="top-bar-actions">
          <ScadaBtn onClick={() => setIsPaused(p => !p)} color="#00ff9d" label={isPaused ? "▶ RUN" : "⏸ PAUSE"} />
          <ScadaBtn onClick={resetSystem}                 color="#ff4444" label="↺ RESET" />
        </div>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="content-area">

        {/* ---- GRID TAB ---- */}
        {activeTab === "grid" && (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <canvas
              ref={canvasRef} width={960} height={760}
              className="grid-canvas"
              onClick={handleMouseClick}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ width: "100%", height: "100%" }}
            />

            {/* HUD */}
            <div className="hud">
              <HudStat label="ΔP"    value={`${(dynState?.imbalance || 0).toFixed(0)}MW`} color={Math.abs(dynState?.imbalance || 0) > 80 ? "#ff8800" : "#00ff9d"} />
              <div className="divider-v" />
              <HudStat label="TRIPS" value={trippedCt}                      color={trippedCt > 0 ? "#ff4444" : "#00ff9d"} />
              <div className="divider-v" />
              <HudStat label="MAX%"  value={`${maxLoad.toFixed(0)}%`}       color={maxLoad > 100 ? "#ff4444" : maxLoad > 85 ? "#ffcc00" : "#00ff9d"} />
              <div className="divider-v" />
              <HudStat label="CONV"  value={flowResult?.converged ? "✓" : "✗"} color={flowResult?.converged ? "#00ff9d" : "#ff4444"} />
            </div>

            {/* Hint */}
            <div className="hint-bar">TAP LINE → FAULT INJECTION  •  TAP BUS → DETAILS  •  PINCH → ZOOM</div>

            {/* Blackout banner */}
            {blackout?.type && (
              <div className="blackout-banner" style={{
                background: blackout.type === "FULL" ? "#1a000088" : "#1a050088",
                border: `1px solid ${statusClr}66`, color: statusClr,
              }}>
                <span>⚠ {blackout.type} BLACKOUT</span>
                <span style={{ fontSize: 9 }}>{blackout.reason}</span>
              </div>
            )}

            {/* Scenario bar */}
            <div className="scenario-bar">
              {["normal", "peak", "renewable", "n1", "storm"].map(sc => (
                <button key={sc} onClick={() => setScenario(sc)}
                  className={`sc-btn${scenario === sc ? " active" : ""}`}>
                  {sc.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Selected bus info */}
            {selectedBus !== null && (
              <div className="bus-info-panel">
                <div style={{ fontSize: 11, color: "#00ff9d", fontWeight: "bold", marginBottom: 6 }}>
                  {buses[selectedBus]?.name} — {buses[selectedBus]?.label}
                </div>
                <InfoRow label="Type"    value={buses[selectedBus]?.type?.toUpperCase()} />
                <InfoRow label="Vm (pu)" value={`${(flowResult?.Vm?.[selectedBus] || 1).toFixed(4)}`}
                  color={(flowResult?.Vm?.[selectedBus] || 1) < 0.95 ? "#ff4444" : "#00ff9d"} />
                <InfoRow label="Va (°)"  value={`${((flowResult?.Va?.[selectedBus] || 0) * 180 / Math.PI).toFixed(2)}°`} />
                <InfoRow label="P inj"   value={`${(flowResult?.busP?.[selectedBus] || 0).toFixed(1)} MW`} />
                <InfoRow label="Voltage" value={buses[selectedBus]?.voltage} />
                <button onClick={() => setSelectedBus(null)} style={{
                  position: "absolute", top: 6, right: 8,
                  background: "transparent", border: "none", color: "#445", fontSize: 12, cursor: "pointer",
                }}>✕</button>
              </div>
            )}
          </div>
        )}

        {/* ---- ANALYTICS TAB ---- */}
        {activeTab === "analytics" && (
          <div className="scroll-pane">
            <SectionHeader>SYSTEM METRICS</SectionHeader>
            <div className="metrics-grid">
              {[
                { label: "Total Generation",  value: `${totalGen.toFixed(0)} MW`,          color: "#00aaff" },
                { label: "Total Load",         value: `${totalLoad.toFixed(0)} MW`,         color: "#ffaa00" },
                { label: "Frequency",          value: `${freq.toFixed(4)} Hz`,              color: freqColor },
                { label: "Power Imbalance",    value: `${(dynState?.imbalance || 0).toFixed(0)} MW`, color: Math.abs(dynState?.imbalance || 0) > 80 ? "#ff8800" : "#00ff9d" },
                { label: "Lines Tripped",      value: `${trippedCt}/${lines.length}`,       color: trippedCt > 0 ? "#ff4444" : "#00ff9d" },
                { label: "Max Line Loading",   value: `${maxLoad.toFixed(1)}%`,             color: maxLoad > 100 ? "#ff4444" : maxLoad > 80 ? "#ffcc00" : "#00ff9d" },
                { label: "NR Converged",       value: flowResult?.converged ? "YES" : "NO", color: flowResult?.converged ? "#00ff9d" : "#ff4444" },
                { label: "Solar Factor",       value: `${((dynState?.solarFactor || 0) * 100).toFixed(0)}%`, color: "#ffee00" },
                { label: "Wind Factor",        value: `${((dynState?.windFactor  || 0) * 100).toFixed(0)}%`, color: "#88eeff" },
              ].map((m, i) => <MetricCard key={i} {...m} />)}
            </div>

            <SectionHeader style={{ marginTop: 16 }}>BUS VOLTAGE PROFILE (pu)</SectionHeader>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
              {buses.map((bus, i) => {
                const v = flowResult?.Vm?.[i] || 1;
                const c = v < 0.90 ? "#ff2222" : v < 0.95 ? "#ff8800" : v > 1.10 ? "#ff44ff" : v > 1.05 ? "#ffaa00" : "#00ff9d";
                return (
                  <div key={i} style={{ background: `${c}10`, border: `1px solid ${c}44`, borderRadius: 5, padding: "5px 8px", minWidth: 60 }}>
                    <div style={{ fontSize: 8, color: "#445" }}>{bus.name}</div>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: c }}>{v.toFixed(4)}</div>
                    <div style={{ fontSize: 7, color: "#334" }}>{((flowResult?.Va?.[i] || 0) * 180 / Math.PI).toFixed(1)}°</div>
                  </div>
                );
              })}
            </div>

            <SectionHeader>TREND CHARTS</SectionHeader>
            {[
              { ref: chartFreqRef, label: "Frequency (Hz)" },
              { ref: chartProbRef, label: "Blackout Probability (%)" },
              { ref: chartLoadRef, label: "Total Load (MW)" },
            ].map(({ ref, label }, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 8, color: "#334", marginBottom: 4 }}>{label}</div>
                <canvas ref={ref} width={600} height={110} className="chart-canvas" />
              </div>
            ))}

            <SectionHeader style={{ marginTop: 14 }}>LINE STATUS</SectionHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 14 }}>
              {lines.map(line => {
                const ld = flowResult?.lineLoadings?.[line.id] || 0;
                const c  = line.tripped ? "#ff4444" : ld > 120 ? "#ff1100" : ld > 100 ? "#ff4444" : ld > 85 ? "#ff8800" : ld > 60 ? "#ffcc00" : "#00ff9d";
                return (
                  <div key={line.id} style={{ background: `${c}0a`, border: `1px solid ${c}33`, borderRadius: 5, padding: "5px 7px" }}>
                    <div style={{ fontSize: 9, fontWeight: "bold", color: c }}>{line.name}</div>
                    <div style={{ fontSize: 8, color: "#445" }}>{line.tripped ? "TRIPPED" : `${ld.toFixed(0)}%`}</div>
                    <div style={{ fontSize: 7, color: "#334" }}>{line.type.toUpperCase()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- ALARMS TAB ---- */}
        {activeTab === "alarms" && (
          <div className="scroll-pane">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <SectionHeader style={{ margin: 0 }}>ALARM LOG ({alarms.length})</SectionHeader>
              <button onClick={() => setAckAlarms(new Set(alarms.map(a => a.id)))}
                className="scada-btn" style={{ borderColor: "#ffcc0044", color: "#ffcc00", background: "#ffcc0008" }}>
                ACK ALL
              </button>
            </div>
            {alarms.length === 0 && (
              <div style={{ color: "#334", fontSize: 11, textAlign: "center", marginTop: 40 }}>
                No active alarms
              </div>
            )}
            {alarms.map(alarm => {
              const c = alarm.priority === "CRIT" ? "#ff4444" : alarm.priority === "HIGH" ? "#ff8800" : alarm.priority === "INFO" ? "#00ff9d" : "#ffcc00";
              const acked = ackAlarms.has(alarm.id);
              return (
                <div key={alarm.id} className="alarm-item" style={{
                  borderLeftColor: c,
                  background: `${c}08`,
                  opacity: acked ? 0.45 : 1,
                }}>
                  <div style={{ color: c, fontSize: 9, fontWeight: "bold", whiteSpace: "nowrap" }}>{alarm.priority}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#c8d8e8" }}>{alarm.text}</div>
                    <div style={{ color: "#334", fontSize: 8, marginTop: 2 }}>{alarm.time}</div>
                  </div>
                  {!acked && (
                    <button onClick={() => setAckAlarms(s => new Set([...s, alarm.id]))}
                      style={{ background: "transparent", border: `1px solid ${c}44`, color: c, borderRadius: 4, fontSize: 8, cursor: "pointer", padding: "2px 6px" }}>
                      ACK
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ---- AI ENGINE TAB ---- */}
        {activeTab === "ai" && (
          <div className="scroll-pane">
            <SectionHeader>AI BLACKOUT RISK ENGINE</SectionHeader>

            {/* Risk gauge */}
            <div style={{ textAlign: "center", padding: "20px 0 14px", borderBottom: "1px solid #112", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#334", letterSpacing: 2, marginBottom: 6 }}>BLACKOUT PROBABILITY</div>
              <div style={{ fontSize: 52, fontWeight: "bold", color: aiResult.color, lineHeight: 1, animation: aiResult.level === "HIGH" ? "blink 0.8s step-end infinite" : "none" }}>
                {(aiResult.prob * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 14, color: aiResult.color, letterSpacing: 4, marginTop: 8 }}>
                {aiResult.level} RISK
              </div>
              {/* Bar */}
              <div style={{ height: 8, background: "#112", borderRadius: 4, margin: "14px auto", maxWidth: 280, position: "relative" }}>
                <div style={{ height: "100%", width: `${aiResult.prob * 100}%`, background: aiResult.color, borderRadius: 4, transition: "width 0.5s" }} />
                <div style={{ position: "absolute", left: "20%", top: 0, width: 1, height: "100%", background: "#00ff9d44" }} />
                <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "#ffcc0044" }} />
              </div>
              <div style={{ fontSize: 8, color: "#334", display: "flex", justifyContent: "space-between", maxWidth: 280, margin: "0 auto" }}>
                <span>LOW</span><span>MEDIUM</span><span>HIGH</span>
              </div>
            </div>

            <SectionHeader>RISK FACTORS</SectionHeader>
            {Object.entries(aiResult.factors || {}).map(([key, val]) => {
              const pct = Math.min(100, val * 100);
              const c   = pct > 60 ? "#ff4444" : pct > 30 ? "#ffcc00" : "#00ff9d";
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3 }}>
                    <span style={{ color: "#c8d8e8", textTransform: "uppercase", letterSpacing: 1 }}>{key.replace(/([A-Z])/g, " $1")}</span>
                    <span style={{ color: c }}>{(val * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: "#112", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: c, borderRadius: 2, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}

            {aiResult.actions?.length > 0 && (
              <>
                <SectionHeader style={{ marginTop: 18 }}>RECOMMENDED ACTIONS</SectionHeader>
                {aiResult.actions.map((act, i) => (
                  <div key={i} style={{
                    background: "#070e1a", border: "1px solid #ffcc0022",
                    borderLeft: "3px solid #ffcc00", borderRadius: 6, padding: "8px 12px", marginBottom: 7,
                  }}>
                    <div style={{ fontSize: 9, color: "#ffcc00", fontWeight: "bold", letterSpacing: 1 }}>{act.type}</div>
                    <div style={{ fontSize: 10, color: "#c8d8e8", marginTop: 3 }}>{act.desc}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ---- CONTROL TAB ---- */}
        {activeTab === "control" && (
          <div className="scroll-pane">
            <SectionHeader>OPERATOR CONTROLS</SectionHeader>

            <div className="ctrl-card">
              <div style={{ fontSize: 10, color: "#00ff9d", marginBottom: 10 }}>LOAD SHEDDING</div>
              <InfoRow label="Active shedding" value={`${loadShed}%`} color={loadShed > 0 ? "#ff8800" : "#00ff9d"} />
              <input type="range" min={0} max={40} value={loadShed} onChange={e => setLoadShed(+e.target.value)} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {[0, 10, 20, 30].map(v => (
                  <button key={v} onClick={() => setLoadShed(v)} className="fault-btn" style={{ fontSize: 8 }}>{v}%</button>
                ))}
              </div>
            </div>

            <div className="ctrl-card">
              <div style={{ fontSize: 10, color: "#00aaff", marginBottom: 10 }}>GENERATION BOOST (SLACK)</div>
              <InfoRow label="Boost" value={`+${genBoost}%`} color={genBoost > 0 ? "#00aaff" : "#334"} />
              <input type="range" min={0} max={50} value={genBoost} onChange={e => setGenBoost(+e.target.value)} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {[0, 10, 25, 50].map(v => (
                  <button key={v} onClick={() => setGenBoost(v)} className="fault-btn" style={{ fontSize: 8, color: "#00aaff", borderColor: "#00aaff44" }}>{v}%</button>
                ))}
              </div>
            </div>

            <div className="ctrl-card">
              <div style={{ fontSize: 10, color: "#ffcc00", marginBottom: 10 }}>LINE RESTORATION</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {lines.filter(l => l.tripped).map(line => (
                  <button key={line.id} onClick={() => {
                    setLines(ls => ls.map(l => l.id === line.id ? { ...l, tripped: false, faultTime: null, sparkAt: null } : l));
                    addAlarm("INFO", `Line ${line.name} restored`, "restore");
                  }} className="fault-btn" style={{ color: "#ffcc00", borderColor: "#ffcc0044" }}>
                    RESTORE {line.name}
                  </button>
                ))}
                {lines.filter(l => l.tripped).length === 0 && (
                  <div style={{ color: "#334", fontSize: 10 }}>No tripped lines</div>
                )}
              </div>
            </div>

            <div className="ctrl-card">
              <div style={{ fontSize: 10, color: "#ff4444", marginBottom: 10 }}>MANUAL FAULT INJECTION</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {lines.filter(l => !l.tripped).slice(0, 8).map(line => (
                  <button key={line.id} onClick={() => {
                    setLines(ls => ls.map(l => l.id === line.id ? { ...l, tripped: true, sparkAt: Date.now() } : l));
                    addAlarm("CRIT", `Manual trip: ${line.name}`, "fault");
                  }} className="fault-btn">
                    TRIP {line.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ===== BOTTOM NAV ===== */}
      <div className="bottom-nav">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`nav-btn${activeTab === tab.id ? " active" : ""}`}>
            {tab.id === "alarms" && unackedCt > 0 && (
              <div className="nav-badge">{unackedCt}</div>
            )}
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===== FAULT INJECTION MODAL ===== */}
      {faultModal && pendingFault !== null && (
        <div className="overlay" onClick={() => setFaultModal(false)}>
          <div className="modal" style={{ border: "2px solid #ff880055" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 12, color: "#ff8800", fontWeight: "bold", letterSpacing: 2, marginBottom: 14 }}>
              ⚡ FAULT INJECTION — {LINE_DATA[pendingFault]?.name}
            </div>
            <InfoRow label="Line"     value={LINE_DATA[pendingFault]?.name} />
            <InfoRow label="Type"     value={LINE_DATA[pendingFault]?.type?.toUpperCase()} />
            <InfoRow label="Capacity" value={`${LINE_DATA[pendingFault]?.cap * BASE_MVA} MVA`} />
            <div style={{ fontSize: 10, color: "#334", marginTop: 12, marginBottom: 8 }}>SELECT FAULT TYPE:</div>
            <div style={{ display: "flex", gap: 8 }}>
              {FAULT_TYPES.map(ft => (
                <button key={ft} onClick={() => injectFault(pendingFault, ft)} className="fault-btn">{ft}</button>
              ))}
            </div>
            <button onClick={() => setFaultModal(false)} style={{
              marginTop: 16, width: "100%", background: "transparent", border: "1px solid #334",
              color: "#445", borderRadius: 6, padding: "8px", cursor: "pointer", fontFamily: "monospace", fontSize: 9,
            }}>CANCEL</button>
          </div>
        </div>
      )}

      {/* ===== BLACKOUT MODAL ===== */}
      {showModal && modalData && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ border: `2px solid ${modalData.type === "FULL" ? "#ff111155" : "#ff660055"}` }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, color: modalData.type === "FULL" ? "#ff4444" : "#ff6600", fontWeight: "bold", letterSpacing: 2, marginBottom: 16, animation: "blink 0.8s step-end infinite" }}>
              {modalData.type === "FULL" ? "⚠ FULL SYSTEM BLACKOUT" : "⚠ PARTIAL BLACKOUT"}
            </div>
            <InfoRow label="Reason"    value={modalData.reason}                color={modalData.type === "FULL" ? "#ff4444" : "#ff8800"} />
            <InfoRow label="Time"      value={`t = ${modalData.t}s`} />
            <InfoRow label="Frequency" value={`${modalData.freq?.toFixed(3)} Hz`}  color="#ff4444" />
            <InfoRow label="Gen / Load" value={`${modalData.totalGen?.toFixed(0)} / ${modalData.totalLoad?.toFixed(0)} MW`} />
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={resetSystem} className="fault-btn" style={{ flex: 1, color: "#00ff9d", borderColor: "#00ff9d44" }}>
                ↺ RESET GRID
              </button>
              <button onClick={() => setShowModal(false)} className="fault-btn" style={{ flex: 1 }}>
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
