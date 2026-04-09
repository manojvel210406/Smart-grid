import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, Legend
} from 'recharts';
import { useGridStore } from '../store/gridStore';

export default function RightPanel() {
  const { activeTab, setActiveTab, loadFlowResults, faultResults, stabilityResults, dispatchResults, buses, lines } = useGridStore();

  const tabs = [
    { id: 'loadflow', label: '⚡ Flow', color: '#00d4ff' },
    { id: 'fault', label: '💥 Fault', color: '#ff6600' },
    { id: 'stability', label: '📈 Stab', color: '#aa44ff' },
    { id: 'dispatch', label: '💰 Econ', color: '#00ff88' },
    { id: 'analytics', label: '📊 Analytics', color: '#ffaa00' },
  ];

  return (
    <div style={{
      width: 300, background: '#0a0e1a', borderLeft: '1px solid #1a2a3a',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2a3a', flexShrink: 0, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer', minWidth: 52,
              background: activeTab === t.id ? '#0d1a2a' : 'transparent',
              color: activeTab === t.id ? t.color : '#446688',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 9, fontWeight: 600,
              borderBottom: activeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}>{t.label}</button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>

        {activeTab === 'loadflow' && <LoadFlowTab results={loadFlowResults} buses={buses} lines={lines} />}
        {activeTab === 'fault' && <FaultTab results={faultResults} />}
        {activeTab === 'stability' && <StabilityTab results={stabilityResults} />}
        {activeTab === 'dispatch' && <DispatchTab results={dispatchResults} />}
        {activeTab === 'analytics' && <AnalyticsTab results={loadFlowResults} buses={buses} lines={lines} />}
      </div>
    </div>
  );
}

// ── Load Flow Tab ──────────────────────────────────────────────────────────────
function LoadFlowTab({ results, buses, lines }) {
  if (!results) return <NoData msg="Run Load Flow to see results" />;

  const voltageData = results.buses?.map(b => ({
    name: `B${b.id}`, voltage: parseFloat(b.voltage?.toFixed(4)),
    P: parseFloat((b.P || 0).toFixed(1)), Q: parseFloat((b.Q || 0).toFixed(1)),
  })) || [];

  return (
    <div>
      <SectionHeader title={results.converged ? '✅ CONVERGED' : '❌ DIVERGED'}
        subtitle={`${results.iterations} iterations`}
        color={results.converged ? '#00ff88' : '#ff4444'} />

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        <StatBox label="Total Loss" value={`${results.totalLoss?.toFixed(2)} MW`} color="#ff6600" />
        <StatBox label="Slack Gen P" value={`${results.slackGeneration?.P?.toFixed(1)} MW`} color="#00d4ff" />
        <StatBox label="Slack Gen Q" value={`${results.slackGeneration?.Q?.toFixed(1)} MVAr`} color="#aa44ff" />
        <StatBox label="Buses" value={results.buses?.length} color="#00ff88" />
      </div>

      {/* Voltage Profile Chart */}
      <ChartHeader>Voltage Profile (pu)</ChartHeader>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={voltageData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <YAxis domain={[0.9, 1.1]} tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={0.95} stroke="#ff4444" strokeDasharray="3 3" />
          <ReferenceLine y={1.05} stroke="#ff4444" strokeDasharray="3 3" />
          <Bar dataKey="voltage" fill="#00d4ff" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Bus Table */}
      <ChartHeader>Bus Results</ChartHeader>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
          <thead>
            <tr>{['Bus', 'V (pu)', 'θ (°)', 'P (MW)', 'Q (MVAr)'].map(h => (
              <th key={h} style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color: '#446688', borderBottom: '1px solid #1a2a3a', textAlign: 'right', fontWeight: 400 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {results.buses?.map(b => {
              const color = b.status === 'low_voltage' ? '#ff6600' : b.status === 'high_voltage' ? '#ffff00' : '#8ab4cc';
              return (
                <tr key={b.id} style={{ borderBottom: '1px solid #0d1a2a' }}>
                  <td style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color: '#00d4ff', fontSize: 8 }}>{b.name?.split(' ')[0]}</td>
                  <td style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color, textAlign: 'right', fontSize: 8 }}>{b.voltage?.toFixed(4)}</td>
                  <td style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color: '#8ab4cc', textAlign: 'right', fontSize: 8 }}>{b.angle?.toFixed(2)}</td>
                  <td style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color: '#8ab4cc', textAlign: 'right', fontSize: 8 }}>{b.P?.toFixed(1)}</td>
                  <td style={{ padding: '3px 4px', fontFamily: 'Share Tech Mono, monospace', color: '#8ab4cc', textAlign: 'right', fontSize: 8 }}>{b.Q?.toFixed(1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Line Flows */}
      <ChartHeader>Line Loadings (%)</ChartHeader>
      <div style={{ marginTop: 4 }}>
        {results.lineFlows?.map(l => (
          <div key={l.id} style={{ marginBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>Line {l.id}</span>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: l.loading > 100 ? '#ff4444' : l.loading > 80 ? '#ffaa00' : '#00ff88' }}>
                {l.loading?.toFixed(1)}%
              </span>
            </div>
            <div style={{ background: '#0d1520', borderRadius: 3, height: 5, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, transition: 'width 0.5s',
                width: `${Math.min(100, l.loading || 0)}%`,
                background: l.loading > 100 ? '#ff4444' : l.loading > 80 ? '#ffaa00' : '#00d4ff',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Fault Tab ──────────────────────────────────────────────────────────────────
function FaultTab({ results }) {
  if (!results) return <NoData msg="Run Fault Analysis to see results" />;
  if (results.error) return <ErrorMsg msg={results.error} />;

  return (
    <div>
      <SectionHeader title="⚡ FAULT ANALYSIS" subtitle={results.faultType} color="#ff6600" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        <StatBox label="Fault Current" value={`${results.Ifault_kA} kA`} color="#ff4444" big />
        <StatBox label="Fault Current (pu)" value={`${results.Ifault_pu} pu`} color="#ff6600" />
        <StatBox label="Z_fault" value={`${results.Zkk_mag} pu`} color="#aa44ff" />
        <StatBox label="Critical Buses" value={results.criticalBuses} color="#ffaa00" />
      </div>

      <ChartHeader>Post-Fault Bus Voltages</ChartHeader>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={results.postFaultV?.map(b => ({ name: `B${b.busId}`, preV: parseFloat(b.preV), postV: parseFloat(b.postV) }))} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <YAxis domain={[0, 1.2]} tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="preV" fill="#00d4ff55" name="Pre-Fault V" />
          <Bar dataKey="postV" fill="#ff6600" name="Post-Fault V" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <ChartHeader>Bus Voltage Drop</ChartHeader>
      {results.postFaultV?.map(b => (
        <div key={b.busId} style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>{b.busName?.split(' ')[0]}</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: b.status === 'critical' ? '#ff4444' : b.status === 'severe' ? '#ff8800' : '#ffaa00' }}>
              {b.postV} pu ({b.status})
            </span>
          </div>
          <div style={{ background: '#0d1520', borderRadius: 3, height: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${parseFloat(b.postV) * 100}%`, background: b.status === 'critical' ? '#ff4444' : '#ff8800', transition: 'width 0.5s' }} />
          </div>
        </div>
      ))}

      <InsightBox insights={results.insights} />
      <RecommendBox msg={results.recommendedAction} />
    </div>
  );
}

// ── Stability Tab ──────────────────────────────────────────────────────────────
function StabilityTab({ results }) {
  if (!results) return <NoData msg="Run Stability Analysis to see results" />;
  if (results.error) return <ErrorMsg msg={results.error} />;

  const rotor = results.generators?.[0];
  const chartData = results.timePoints?.map((t, i) => ({
    t,
    angle: rotor?.deltas?.[i] || 0,
    freq: results.frequency?.[i] || 60,
  })) || [];

  // Sample every 5th point for performance
  const sampled = chartData.filter((_, i) => i % 5 === 0);

  return (
    <div>
      <SectionHeader
        title={results.stable ? '✅ STABLE' : '❌ UNSTABLE'}
        subtitle={`Max δ = ${results.maxRotorAngle}°`}
        color={results.stable ? '#00ff88' : '#ff4444'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        <StatBox label="Max Rotor Angle" value={`${results.maxRotorAngle}°`} color={results.stable ? '#00ff88' : '#ff4444'} />
        <StatBox label="Fault Clear Time" value={`${results.faultClearingTime}s`} color="#ffaa00" />
        <StatBox label="Sim Time" value={`${results.simTime}s`} color="#00d4ff" />
        <StatBox label="Time Step" value={`${results.dt}s`} color="#aa44ff" />
      </div>

      <ChartHeader>Rotor Angle (°)</ChartHeader>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={sampled} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="t" tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} tickFormatter={v => `${v.toFixed(1)}s`} />
          <YAxis tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v.toFixed(2)}°`, 'Rotor Angle']} labelFormatter={v => `t=${v}s`} />
          <ReferenceLine y={180} stroke="#ff4444" strokeDasharray="4 4" label={{ value: '180° limit', fontSize: 7, fill: '#ff4444' }} />
          <Area type="monotone" dataKey="angle" stroke="#aa44ff" fill="#aa44ff20" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <ChartHeader>System Frequency (Hz)</ChartHeader>
      <ResponsiveContainer width="100%" height={90}>
        <LineChart data={sampled} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="t" tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} tickFormatter={v => `${v.toFixed(1)}s`} />
          <YAxis domain={[58, 62]} tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v.toFixed(3)} Hz`, 'Freq']} />
          <ReferenceLine y={60} stroke="#00d4ff55" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="freq" stroke="#00d4ff" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <InsightBox insights={results.insights} />
    </div>
  );
}

// ── Dispatch Tab ───────────────────────────────────────────────────────────────
function DispatchTab({ results }) {
  if (!results) return <NoData msg="Run Economic Dispatch to see results" />;
  if (results.error) return <ErrorMsg msg={results.error} />;

  const chartData = results.generators?.map(g => ({
    name: g.name, Pg: parseFloat(g.Pg), cost: parseFloat(g.cost),
  })) || [];

  return (
    <div>
      <SectionHeader title="💰 ECONOMIC DISPATCH" subtitle={`λ* = ${results.lambda} $/MWh`} color="#00ff88" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        <StatBox label="Total Cost" value={`$${results.totalCost}/hr`} color="#ffaa00" big />
        <StatBox label="λ (LMP)" value={`${results.lambda} $/MWh`} color="#00ff88" />
        <StatBox label="Total Gen" value={`${results.totalGeneration} MW`} color="#00d4ff" />
        <StatBox label="Load" value={`${results.totalLoad} MW`} color="#ff6600" />
      </div>

      <ChartHeader>Dispatch Schedule (MW)</ChartHeader>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <YAxis tick={{ fontSize: 7, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="Pg" fill="#00ff88" name="Pg (MW)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {results.generators?.map(g => (
        <div key={g.id} style={{ background: '#0d1520', border: '1px solid #1a2a3a', borderRadius: 5, padding: '6px 8px', marginBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#00ff88', fontWeight: 600 }}>{g.name}</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#ffaa00' }}>${g.cost}/hr</span>
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#8ab4cc' }}>{g.Pg} MW dispatched</div>
        </div>
      ))}

      {/* Lambda iteration log (last 5) */}
      <ChartHeader>λ Iteration Convergence</ChartHeader>
      <div style={{ maxHeight: 80, overflowY: 'auto' }}>
        {results.iterationLog?.slice(-8).map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: '1px solid #0d1520' }}>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#446688', minWidth: 20 }}>#{it.iter}</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#aa44ff' }}>λ={it.lambda}</span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#ffaa00' }}>ΔP={it.mismatch}</span>
          </div>
        ))}
      </div>

      <InsightBox insights={results.insights} />
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab({ results, buses, lines }) {
  if (!results?.converged) return <NoData msg="Run Load Flow to see analytics" />;

  const lossData = results.lineFlows?.map(l => ({
    name: `L${l.id}`, loss: Math.abs(l.loss || 0).toFixed(2), loading: l.loading?.toFixed(1),
  })) || [];

  const totalLoad = buses.reduce((s, b) => s + b.Pd, 0);
  const lossPct = ((results.totalLoss / (totalLoad || 1)) * 100).toFixed(1);

  return (
    <div>
      <SectionHeader title="📊 ANALYTICS" subtitle="System Performance" color="#ffaa00" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
        <StatBox label="Total Loss" value={`${results.totalLoss?.toFixed(2)} MW`} color="#ff6600" />
        <StatBox label="Loss %" value={`${lossPct}%`} color="#ffaa00" />
        <StatBox label="Total Load" value={`${totalLoad} MW`} color="#00d4ff" />
        <StatBox label="Total Gen" value={`${results.totalGeneration?.toFixed(1)} MW`} color="#00ff88" />
      </div>

      <ChartHeader>Line Losses (MW)</ChartHeader>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={lossData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <YAxis tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="loss" fill="#ff6600" name="Loss (MW)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Voltage deviation summary */}
      <ChartHeader>Voltage Deviation from 1.0 pu</ChartHeader>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart
          data={results.buses?.map(b => ({ name: `B${b.id}`, dev: parseFloat((b.voltage - 1.0).toFixed(4)) }))}
          margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#1a2a3a" />
          <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <YAxis tick={{ fontSize: 8, fill: '#446688', fontFamily: 'Share Tech Mono, monospace' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={0} stroke="#446688" />
          <ReferenceLine y={0.05} stroke="#ff4444" strokeDasharray="3 3" />
          <ReferenceLine y={-0.05} stroke="#ff4444" strokeDasharray="3 3" />
          <Bar dataKey="dev" name="ΔV (pu)" radius={[2, 2, 0, 0]}
            fill="#00d4ff"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Shared Sub-components ─────────────────────────────────────────────────────
function NoData({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#334455' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11 }}>{msg}</div>
    </div>
  );
}

function ErrorMsg({ msg }) {
  return (
    <div style={{ padding: '10px', background: '#1a0505', border: '1px solid #ff444433', borderRadius: 6, color: '#ff4444', fontFamily: 'Share Tech Mono, monospace', fontSize: 9 }}>
      ❌ {msg}
    </div>
  );
}

function SectionHeader({ title, subtitle, color }) {
  return (
    <div style={{ marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${color}33` }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color, letterSpacing: 1 }}>{title}</div>
      {subtitle && <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function StatBox({ label, value, color, big }) {
  return (
    <div style={{ background: '#0d1520', border: `1px solid ${color}22`, borderRadius: 5, padding: '5px 7px' }}>
      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#446688' }}>{label}</div>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: big ? 11 : 10, color, marginTop: 2, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ChartHeader({ children }) {
  return (
    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', marginTop: 10, marginBottom: 4, paddingBottom: 3, borderBottom: '1px solid #1a2a3a', letterSpacing: 1 }}>
      {children}
    </div>
  );
}

function InsightBox({ insights }) {
  if (!insights?.length) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <ChartHeader>AI INSIGHTS</ChartHeader>
      {insights.map((ins, i) => (
        <div key={i} style={{
          background: ins.type === 'error' ? '#1a050533' : ins.type === 'warning' ? '#1a100533' : '#051a0a33',
          border: `1px solid ${ins.type === 'error' ? '#ff444433' : ins.type === 'warning' ? '#ffaa0033' : '#00ff8833'}`,
          borderRadius: 5, padding: '6px 8px', marginBottom: 4,
        }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600, color: ins.type === 'error' ? '#ff4444' : ins.type === 'warning' ? '#ffaa00' : '#00ff88', marginBottom: 2 }}>
            {ins.title}
          </div>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, color: '#8899aa', lineHeight: 1.4 }}>{ins.msg}</div>
        </div>
      ))}
    </div>
  );
}

function RecommendBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop: 8, background: '#0d1a2a', border: '1px solid #00d4ff22', borderRadius: 5, padding: '6px 8px' }}>
      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#446688', marginBottom: 3 }}>RECOMMENDED ACTION</div>
      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, color: '#8ab4cc', lineHeight: 1.5 }}>{msg}</div>
    </div>
  );
}

const tooltipStyle = {
  background: '#0a1420', border: '1px solid #1a3050', borderRadius: 5,
  fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#8ab4cc',
};
