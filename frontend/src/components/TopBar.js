import React, { useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { solveLoadFlow } from '../engine/loadFlow';
import { solveFault } from '../engine/faultAnalysis';
import { solveStability, solveEconomicDispatch } from '../engine/stability';
import { checkSystemHealth } from '../utils/utils';

export default function TopBar() {
  const {
    buses, lines, generators, baseMVA, mode, viewMode, modelStatus, isRunning, learningMode,
    disturbance, loadFlowResults,
    setMode, setViewMode, setIsRunning, setLearningMode,
    setLoadFlowResults, setFaultResults, setStabilityResults, setDispatchResults,
    addLog, addExplanation, addInsight, setActiveTab, saveSnapshot, resetToDefault,
  } = useGridStore();

  const [faultBusId, setFaultBusId] = useState(1);

  const runLoadFlow = async () => {
    setIsRunning(true);
    addLog('🔄 Starting Newton-Raphson Load Flow...', 'info');
    saveSnapshot();

    await new Promise(r => setTimeout(r, 100));
    try {
      const health = checkSystemHealth(buses, lines);
      health.filter(h => h.severity === 'error').forEach(h => addLog(`❌ ${h.msg}`, 'error'));

      const results = solveLoadFlow(buses, lines, baseMVA, { disturbance });

      if (results.converged) {
        addLog(`✅ Load Flow converged in ${results.iterations} iterations`, 'success');
        addLog(`   Total Loss: ${results.totalLoss?.toFixed(2)} MW`, 'info');
        addLog(`   Slack Gen: P=${results.slackGeneration?.P?.toFixed(2)} MW, Q=${results.slackGeneration?.Q?.toFixed(2)} MVAr`, 'info');
        results.insights?.forEach(ins => addInsight(ins));
        results.explanations?.forEach(exp => addExplanation(exp));
      } else {
        addLog('❌ Load Flow did NOT converge. Check system parameters.', 'error');
      }

      setLoadFlowResults(results);
      setActiveTab('loadflow');
    } catch (e) {
      addLog(`❌ Error: ${e.message}`, 'error');
    }
    setIsRunning(false);
  };

  const runFaultAnalysis = async () => {
    setIsRunning(true);
    addLog(`⚡ Running Fault Analysis at Bus ${faultBusId}...`, 'info');
    await new Promise(r => setTimeout(r, 80));
    try {
      const results = solveFault(buses, lines, faultBusId, baseMVA, {
        faultSeverity: disturbance.faultSeverity > 0 ? disturbance.faultSeverity : 1.0,
        faultType: '3-phase',
      });
      if (results.error) { addLog(`❌ ${results.error}`, 'error'); }
      else {
        addLog(`⚡ Fault at ${results.faultBusName}: I_f = ${results.Ifault_kA} kA`, 'warning');
        results.insights?.forEach(ins => addInsight(ins));
        results.explanations?.forEach(exp => addExplanation(exp));
        setFaultResults(results);
        setActiveTab('fault');
      }
    } catch (e) { addLog(`❌ ${e.message}`, 'error'); }
    setIsRunning(false);
  };

  const runStability = async () => {
    if (!loadFlowResults?.converged) { addLog('⚠️ Run Load Flow first before Stability Analysis.', 'warning'); return; }
    setIsRunning(true);
    addLog('📈 Running Transient Stability Analysis...', 'info');
    await new Promise(r => setTimeout(r, 150));
    try {
      const results = solveStability(buses, lines, generators, loadFlowResults, {
        faultBusId: faultBusId, faultClearingTime: 0.1, simTime: 3.0,
      });
      if (results.error) { addLog(`❌ ${results.error}`, 'error'); }
      else {
        addLog(`📈 Stability: ${results.stable ? '✅ STABLE' : '❌ UNSTABLE'}, Max δ = ${results.maxRotorAngle}°`, results.stable ? 'success' : 'error');
        results.insights?.forEach(ins => addInsight(ins));
        results.explanations?.forEach(exp => addExplanation(exp));
        setStabilityResults(results);
        setActiveTab('stability');
      }
    } catch (e) { addLog(`❌ ${e.message}`, 'error'); }
    setIsRunning(false);
  };

  const runDispatch = async () => {
    setIsRunning(true);
    addLog('💰 Running Economic Dispatch (Lambda Iteration)...', 'info');
    await new Promise(r => setTimeout(r, 80));
    try {
      const totalLoad = buses.reduce((s, b) => s + b.Pd, 0);
      const results = solveEconomicDispatch(generators, totalLoad, baseMVA);
      addLog(`💰 Dispatch: λ* = ${results.lambda} $/MWh, Cost = $${results.totalCost}/hr`, 'success');
      results.insights?.forEach(ins => addInsight(ins));
      results.explanations?.forEach(exp => addExplanation(exp));
      setDispatchResults(results);
      setActiveTab('dispatch');
    } catch (e) { addLog(`❌ ${e.message}`, 'error'); }
    setIsRunning(false);
  };

  const runFullAnalysis = async () => {
    addLog('🚀 Starting Full Analysis Pipeline...', 'info');
    await runLoadFlow();
    await new Promise(r => setTimeout(r, 200));
    await runFaultAnalysis();
    await new Promise(r => setTimeout(r, 200));
    await runStability();
    await new Promise(r => setTimeout(r, 200));
    await runDispatch();
    addLog('✅ Full Analysis Pipeline Complete.', 'success');
  };

  const runDemoMode = async () => {
    addLog('🎮 Demo Mode: Loading IEEE 5-Bus scenario...', 'info');
    resetToDefault();
    await new Promise(r => setTimeout(r, 300));
    await runLoadFlow();
  };

  const statusColors = { valid: '#00ff88', needs_recalc: '#ffaa00', error: '#ff4444' };
  const statusLabels = { valid: 'Model Valid', needs_recalc: '⚠ Needs Recalc', error: '✗ Error' };

  return (
    <div style={{
      height: 56, background: 'linear-gradient(180deg, #0d1520 0%, #0a1018 100%)',
      borderBottom: '1px solid #1a2a3a', display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8, flexShrink: 0, zIndex: 100,
      boxShadow: '0 2px 20px rgba(0,212,255,0.1)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16, flexShrink: 0 }}>
        <span style={{ fontSize: 22 }}>⚡</span>
        <div>
          <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 11, color: '#00d4ff', letterSpacing: 2, fontWeight: 700 }}>GRID TWIN</div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', letterSpacing: 1 }}>DIGITAL TWIN v1.0</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: '#1a2a3a' }} />

      {/* Run buttons */}
      <BtnGroup>
        <RunBtn label="Load Flow" icon="⚡" color="#00d4ff" onClick={runLoadFlow} disabled={isRunning} />
        <RunBtn label="Fault" icon="💥" color="#ff6600" onClick={runFaultAnalysis} disabled={isRunning} />
        <RunBtn label="Stability" icon="📈" color="#aa44ff" onClick={runStability} disabled={isRunning} />
        <RunBtn label="Dispatch" icon="💰" color="#00ff88" onClick={runDispatch} disabled={isRunning} />
      </BtnGroup>

      <div style={{ width: 1, height: 36, background: '#1a2a3a' }} />

      {/* Fault bus selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 9, color: '#446688', fontFamily: 'Share Tech Mono, monospace' }}>FAULT BUS</span>
        <select value={faultBusId} onChange={e => setFaultBusId(Number(e.target.value))}
          style={{ background: '#0d1520', border: '1px solid #1a3050', color: '#00d4ff', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontFamily: 'Share Tech Mono, monospace' }}>
          {buses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div style={{ width: 1, height: 36, background: '#1a2a3a' }} />

      {/* Smart actions */}
      <ActionBtn label="Full Analysis" icon="🚀" onClick={runFullAnalysis} disabled={isRunning} />
      <ActionBtn label="Demo Mode" icon="🎮" onClick={runDemoMode} disabled={isRunning} />
      <ActionBtn label="Reset" icon="↺" onClick={() => { resetToDefault(); addLog('System reset to defaults.', 'info'); }} disabled={isRunning} />

      <div style={{ flex: 1 }} />

      {/* Learning Mode */}
      <ToggleBtn label="📚 Learning" active={learningMode} onClick={() => setLearningMode(!learningMode)} />

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 2, background: '#0d1520', border: '1px solid #1a3050', borderRadius: 6, padding: 3 }}>
        {['2d', '3d'].map(v => (
          <button key={v} onClick={() => setViewMode(v)}
            style={{
              padding: '3px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: viewMode === v ? '#003a5a' : 'transparent',
              color: viewMode === v ? '#00d4ff' : '#446688',
              fontFamily: 'Orbitron, sans-serif', fontSize: 9, fontWeight: 700,
              transition: 'all 0.2s',
            }}>{v.toUpperCase()}</button>
        ))}
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 2, background: '#0d1520', border: '1px solid #1a3050', borderRadius: 6, padding: 3 }}>
        {['beginner', 'advanced', 'research'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: mode === m ? '#1a3050' : 'transparent',
              color: mode === m ? '#00d4ff' : '#446688',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
              transition: 'all 0.2s', textTransform: 'capitalize',
            }}>{m}</button>
        ))}
      </div>

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
        background: '#0d1520', border: `1px solid ${statusColors[modelStatus]}33`,
        borderRadius: 6,
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColors[modelStatus], boxShadow: `0 0 6px ${statusColors[modelStatus]}` }} />
        <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: statusColors[modelStatus] }}>
          {statusLabels[modelStatus]}
        </span>
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff', animation: 'pulse 0.8s infinite' }} />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#00d4ff' }}>COMPUTING...</span>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.4); } }
      `}</style>
    </div>
  );
}

function BtnGroup({ children }) {
  return <div style={{ display: 'flex', gap: 4 }}>{children}</div>;
}

function RunBtn({ label, icon, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
        background: `${color}15`, border: `1px solid ${color}44`, borderRadius: 6,
        color, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 600,
        transition: 'all 0.2s', letterSpacing: 0.5,
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = `${color}30`)}
      onMouseLeave={e => !disabled && (e.currentTarget.style.background = `${color}15`)}
    >
      <span>{icon}</span>{label}
    </button>
  );
}

function ActionBtn({ label, icon, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
        background: '#0d1520', border: '1px solid #1a3050', borderRadius: 6,
        color: '#8899aa', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 500,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.color = '#00d4ff')}
      onMouseLeave={e => !disabled && (e.currentTarget.style.color = '#8899aa')}
    >
      {icon} {label}
    </button>
  );
}

function ToggleBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '4px 9px', background: active ? '#0d2040' : 'transparent',
        border: `1px solid ${active ? '#00d4ff44' : '#1a3050'}`, borderRadius: 6,
        color: active ? '#00d4ff' : '#446688', cursor: 'pointer',
        fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
        transition: 'all 0.2s',
      }}>{label}</button>
  );
}
