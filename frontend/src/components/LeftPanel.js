import React, { useState } from 'react';
import { useGridStore } from '../store/gridStore';
import { validateBus, validateLine } from '../utils/utils';

export default function LeftPanel() {
  const { buses, lines, generators, addBus, addLine, updateBus, updateLine, setDisturbance, disturbance, mode } = useGridStore();
  const [tab, setTab] = useState('buses');
  const [editBus, setEditBus] = useState(null);
  const [editLine, setEditLine] = useState(null);
  const [newLine, setNewLine] = useState({ from: 1, to: 2 });
  const [errors, setErrors] = useState({});

  const handleBusEdit = (bus) => setEditBus({ ...bus });
  const handleLineSave = () => {
    const errs = validateLine(editLine, buses);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    updateLine(editLine.id, editLine);
    setEditLine(null); setErrors({});
  };
  const handleBusSave = () => {
    const errs = validateBus(editBus);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    updateBus(editBus.id, editBus);
    setEditBus(null); setErrors({});
  };

  const busTypeColor = { slack: '#00d4ff', pv: '#00ff88', pq: '#ffaa00' };

  return (
    <div style={{
      width: 260, background: '#0a0e1a', borderRight: '1px solid #1a2a3a',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #1a2a3a' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#00d4ff', letterSpacing: 2 }}>GRID BUILDER</div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2a3a' }}>
        {['buses', 'lines', 'gens', 'disturb'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '7px 2px', border: 'none', cursor: 'pointer',
              background: tab === t ? '#0d1a2a' : 'transparent',
              color: tab === t ? '#00d4ff' : '#446688',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
              borderBottom: tab === t ? '2px solid #00d4ff' : '2px solid transparent',
              transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>

        {/* ── BUSES TAB ───────────────────────────────────────────────────── */}
        {tab === 'buses' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#446688' }}>
                {buses.length} BUSES
              </span>
              <SmallBtn label="+ Add Bus" onClick={() => useGridStore.getState().addBus()} />
            </div>

            {buses.map(bus => (
              <div key={bus.id} style={{
                background: '#0d1520', border: `1px solid ${editBus?.id === bus.id ? '#00d4ff44' : '#1a2a3a'}`,
                borderRadius: 6, padding: '7px 10px', marginBottom: 6, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
                onClick={() => handleBusEdit(bus)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, color: '#ccd6e0', fontWeight: 600 }}>{bus.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: `${busTypeColor[bus.type]}20`, color: busTypeColor[bus.type],
                    fontFamily: 'Share Tech Mono, monospace',
                  }}>{bus.type.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <DataBit label="V" value={`${bus.voltage?.toFixed(3)} pu`} />
                  <DataBit label="Pd" value={`${bus.Pd} MW`} />
                  <DataBit label="Qd" value={`${bus.Qd} MVAr`} />
                </div>
              </div>
            ))}

            {/* Edit Form */}
            {editBus && (
              <BusEditForm bus={editBus} onChange={setEditBus} onSave={handleBusSave} onCancel={() => { setEditBus(null); setErrors({}); }} errors={errors} mode={mode} />
            )}
          </div>
        )}

        {/* ── LINES TAB ───────────────────────────────────────────────────── */}
        {tab === 'lines' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#446688' }}>
                {lines.length} LINES
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={newLine.from} onChange={e => setNewLine(p => ({ ...p, from: Number(e.target.value) }))}
                  style={selectStyle}>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                </select>
                <span style={{ color: '#446688', fontSize: 10 }}>→</span>
                <select value={newLine.to} onChange={e => setNewLine(p => ({ ...p, to: Number(e.target.value) }))}
                  style={selectStyle}>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.id}</option>)}
                </select>
                <SmallBtn label="+" onClick={() => useGridStore.getState().addLine(newLine.from, newLine.to)} />
              </div>
            </div>

            {lines.map(line => (
              <div key={line.id} onClick={() => setEditLine({ ...line })} style={{
                background: '#0d1520', border: `1px solid ${line.status === 'tripped' ? '#44444444' : '#1a2a3a'}`,
                borderRadius: 6, padding: '7px 10px', marginBottom: 5, cursor: 'pointer',
                opacity: line.status === 'tripped' ? 0.5 : 1, transition: 'all 0.2s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: '#8899aa' }}>
                    L{line.id}: Bus{line.from}→Bus{line.to}
                  </span>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3,
                    background: line.status === 'tripped' ? '#33333320' : '#00ff8820',
                    color: line.status === 'tripped' ? '#555' : '#00ff88',
                    fontFamily: 'Share Tech Mono, monospace',
                  }}>{line.status?.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  <DataBit label="R" value={`${line.R} pu`} />
                  <DataBit label="X" value={`${line.X} pu`} />
                  {line.loading > 0 && <DataBit label="Load" value={`${line.loading?.toFixed(1)}%`} />}
                </div>
              </div>
            ))}

            {editLine && (
              <LineEditForm line={editLine} onChange={setEditLine} onSave={handleLineSave} onCancel={() => { setEditLine(null); setErrors({}); }} errors={errors} />
            )}
          </div>
        )}

        {/* ── GENERATORS TAB ──────────────────────────────────────────────── */}
        {tab === 'gens' && (
          <div>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#446688' }}>{generators.length} GENERATORS</span>
            {generators.map(gen => (
              <div key={gen.id} style={{
                background: '#0d1520', border: '1px solid #1a2a3a', borderRadius: 6,
                padding: '8px 10px', marginTop: 6,
              }}>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 12, color: '#00ff88', fontWeight: 600 }}>{gen.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
                  <DataBit label="Bus" value={gen.busId} />
                  <DataBit label="Pg" value={`${gen.Pg} MW`} />
                  <DataBit label="Pmax" value={`${gen.Pmax} MW`} />
                  <DataBit label="Cost b" value={`$${gen.cost_b}/MWh`} />
                </div>
                {mode !== 'beginner' && (
                  <div style={{ marginTop: 4, padding: '4px 6px', background: '#00ff8808', borderRadius: 4, border: '1px solid #00ff8820' }}>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#00ff8888' }}>
                      Cost = {gen.cost_a}·P² + {gen.cost_b}·P + {gen.cost_c}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {/* Renewable toggles */}
            <div style={{ marginTop: 12, padding: '8px', background: '#0d1520', border: '1px solid #1a2a3a', borderRadius: 6 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#446688', marginBottom: 6 }}>MODERN GRID</div>
              <SliderInput label="☀️ Solar/Wind %" value={Math.round(useGridStore.getState().disturbance.renewableScale * 100)} min={0} max={100} onChange={v => setDisturbance({ renewableScale: v / 100 })} color="#ffdd00" />
              <SliderInput label="🚗 EV Load %" value={Math.round(useGridStore.getState().disturbance.evLoad * 100 || 0)} min={0} max={50} onChange={v => setDisturbance({ evLoad: v / 100 })} color="#00aaff" />
            </div>
          </div>
        )}

        {/* ── DISTURBANCE TAB ──────────────────────────────────────────────── */}
        {tab === 'disturb' && (
          <div>
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#446688', marginBottom: 8 }}>DISTURBANCE CONTROLS</div>
            <SliderInput label="⚡ Load Scale" value={Math.round(disturbance.loadScale * 100)} min={50} max={200} onChange={v => setDisturbance({ loadScale: v / 100 })} color="#00d4ff" unit="%" />
            <SliderInput label="💥 Fault Severity" value={Math.round(disturbance.faultSeverity * 100)} min={0} max={100} onChange={v => setDisturbance({ faultSeverity: v / 100 })} color="#ff4444" unit="%" />

            {/* Timeline */}
            <div style={{ marginTop: 12, padding: '8px', background: '#0d1520', border: '1px solid #1a2a3a', borderRadius: 6 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#aa44ff', marginBottom: 6 }}>SCENARIO TIMELINE</div>
              <SliderInput label="🕐 Time (t)" value={useGridStore.getState().timelineT} min={0} max={3} onChange={v => useGridStore.getState().setTimelineT(v)} color="#aa44ff" unit="s" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {['t=0 Normal', 't=1 Fault', 't=2 Trip', 't=3 Recovery'].map((s, i) => (
                  <div key={i} onClick={() => useGridStore.getState().setTimelineT(i)}
                    style={{ cursor: 'pointer', textAlign: 'center', fontSize: 7, color: '#446688', fontFamily: 'Share Tech Mono, monospace', padding: '2px 3px', borderRadius: 3, background: useGridStore.getState().timelineT === i ? '#aa44ff20' : 'transparent' }}>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#446688', marginBottom: 6 }}>QUICK ACTIONS</div>
              {[
                { label: '🔌 Trip Line 1', action: () => useGridStore.getState().tripLine(1) },
                { label: '🔄 Restore All', action: () => useGridStore.getState().restoreAll() },
                { label: '📉 High Load (+50%)', action: () => setDisturbance({ loadScale: 1.5 }) },
                { label: '📊 Normal Load', action: () => setDisturbance({ loadScale: 1.0 }) },
              ].map((item, i) => (
                <button key={i} onClick={item.action}
                  style={{
                    width: '100%', marginBottom: 4, padding: '5px 10px', background: '#0d1520',
                    border: '1px solid #1a3050', borderRadius: 5, color: '#8899aa',
                    fontFamily: 'Rajdhani, sans-serif', fontSize: 11, cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00d4ff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#8899aa'}
                >{item.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DataBit({ label, value }) {
  return (
    <span style={{ fontSize: 9, color: '#556677', fontFamily: 'Share Tech Mono, monospace' }}>
      <span style={{ color: '#334455' }}>{label}:</span> <span style={{ color: '#8899aa' }}>{value}</span>
    </span>
  );
}

function SmallBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '3px 8px', background: '#003a5a', border: '1px solid #00d4ff44', borderRadius: 4,
        color: '#00d4ff', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
      }}>{label}</button>
  );
}

function SliderInput({ label, value, min, max, onChange, color = '#00d4ff', unit = '' }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#8899aa' }}>{label}</span>
        <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color, height: 4 }} />
    </div>
  );
}

const selectStyle = {
  background: '#0d1520', border: '1px solid #1a3050', color: '#00d4ff',
  borderRadius: 4, padding: '2px 4px', fontSize: 10, fontFamily: 'Share Tech Mono, monospace',
};

function BusEditForm({ bus, onChange, onSave, onCancel, errors, mode }) {
  const F = ({ label, field, type = 'number', opts }) => (
    <div style={{ marginBottom: 6 }}>
      <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', display: 'block', marginBottom: 2 }}>{label}</label>
      {opts ? (
        <select value={bus[field]} onChange={e => onChange(b => ({ ...b, [field]: e.target.value }))} style={{ ...inputStyle, width: '100%' }}>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={bus[field] || ''} onChange={e => onChange(b => ({ ...b, [field]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
          style={{ ...inputStyle, width: '100%', border: `1px solid ${errors[field] ? '#ff4444' : '#1a3050'}` }} />
      )}
      {errors[field] && <span style={{ fontSize: 8, color: '#ff4444' }}>{errors[field]}</span>}
    </div>
  );

  return (
    <div style={{ background: '#0d1a2a', border: '1px solid #00d4ff33', borderRadius: 6, padding: 10, marginTop: 8 }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00d4ff', marginBottom: 8 }}>EDIT {bus.name}</div>
      <F label="NAME" field="name" type="text" />
      <F label="TYPE" field="type" opts={['slack', 'pv', 'pq']} />
      <F label="VOLTAGE (pu)" field="voltage" />
      <F label="LOAD P (MW)" field="Pd" />
      <F label="LOAD Q (MVAr)" field="Qd" />
      {bus.type === 'pv' && <F label="GEN P (MW)" field="P" />}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={onSave} style={{ flex: 1, ...btnStyle, background: '#003a5a', color: '#00d4ff', border: '1px solid #00d4ff44' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, ...btnStyle, background: '#1a0a0a', color: '#ff4444', border: '1px solid #ff444444' }}>Cancel</button>
      </div>
    </div>
  );
}

function LineEditForm({ line, onChange, onSave, onCancel, errors }) {
  const F = ({ label, field }) => (
    <div style={{ marginBottom: 5 }}>
      <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', display: 'block', marginBottom: 2 }}>{label}</label>
      <input type="number" value={line[field] || ''} onChange={e => onChange(l => ({ ...l, [field]: parseFloat(e.target.value) || 0 }))}
        style={{ ...inputStyle, width: '100%', border: `1px solid ${errors[field] ? '#ff4444' : '#1a3050'}` }} />
    </div>
  );
  return (
    <div style={{ background: '#0d1a2a', border: '1px solid #00d4ff33', borderRadius: 6, padding: 10, marginTop: 8 }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00d4ff', marginBottom: 8 }}>EDIT LINE {line.id}</div>
      <F label="R (pu)" field="R" />
      <F label="X (pu)" field="X" />
      <F label="B (pu)" field="B" />
      <F label="RATING (MVA)" field="ratingMVA" />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={onSave} style={{ flex: 1, ...btnStyle, background: '#003a5a', color: '#00d4ff', border: '1px solid #00d4ff44' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, ...btnStyle, background: '#1a0a0a', color: '#ff4444', border: '1px solid #ff444444' }}>Cancel</button>
      </div>
    </div>
  );
}

const inputStyle = {
  background: '#060c14', border: '1px solid #1a3050', color: '#8ab4cc',
  borderRadius: 4, padding: '4px 6px', fontSize: 11, fontFamily: 'Share Tech Mono, monospace',
};
const btnStyle = {
  padding: '5px', borderRadius: 5, cursor: 'pointer',
  fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
};
