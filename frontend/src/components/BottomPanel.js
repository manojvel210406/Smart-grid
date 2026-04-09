import React, { useRef, useEffect, useState } from 'react';
import { useGridStore } from '../store/gridStore';

export default function BottomPanel() {
  const { logs, explanations, insights, learningMode, clearLogs, mode } = useGridStore();
  const [tab, setTab] = useState('logs');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    if (tab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, tab]);

  const logColor = { info: '#446688', success: '#00ff88', warning: '#ffaa00', error: '#ff4444' };

  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const resp = await fetch('/api/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery, context: { buses: useGridStore.getState().buses.length, loadFlow: !!useGridStore.getState().loadFlowResults } }),
      });
      const data = await resp.json();
      setAiResponse(data.explanation || 'No response from AI engine.');
    } catch (e) {
      setAiResponse('AI engine unavailable — ensure backend is running on port 5000.');
    }
    setAiLoading(false);
  };

  const tabs = [
    { id: 'logs', label: '📋 Logs' },
    { id: 'explain', label: '🧮 Derivations' },
    { id: 'insights', label: `💡 Insights ${insights.length > 0 ? `(${insights.length})` : ''}` },
    { id: 'ai', label: '🤖 AI Assistant' },
  ];

  return (
    <div style={{
      height: 200, background: '#060c14', borderTop: '1px solid #1a2a3a',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a2a3a', flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px', border: 'none', cursor: 'pointer',
              background: tab === t.id ? '#0d1520' : 'transparent',
              color: tab === t.id ? '#00d4ff' : '#446688',
              fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
              borderBottom: tab === t.id ? '2px solid #00d4ff' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>{t.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={clearLogs}
          style={{ padding: '4px 10px', background: 'transparent', border: 'none', color: '#334455', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 9 }}>
          CLEAR
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>

        {/* ── LOGS ──────────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div>
            {logs.map((log, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', borderBottom: '1px solid #0d1a2a' }}>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#334455', flexShrink: 0 }}>
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: logColor[log.level] || '#446688', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {log.msg}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div style={{ color: '#334455', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, padding: '10px 0' }}>
                No logs yet. Run a simulation to see output.
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* ── DERIVATIONS ───────────────────────────────────────────────── */}
        {tab === 'explain' && (
          <div>
            {explanations.length === 0 && (
              <div style={{ color: '#334455', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, padding: '10px 0' }}>
                Run a simulation to see step-by-step derivations.
              </div>
            )}
            {explanations.map((exp, i) => (
              <ExplanationCard key={i} exp={exp} mode={mode} />
            ))}
          </div>
        )}

        {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
        {tab === 'insights' && (
          <div>
            {insights.length === 0 && (
              <div style={{ color: '#334455', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, padding: '10px 0' }}>
                Insights will appear after running simulations.
              </div>
            )}
            {insights.map((ins, i) => (
              <div key={i} style={{
                marginBottom: 6, padding: '7px 10px', borderRadius: 5,
                background: ins.type === 'error' ? '#1a050533' : ins.type === 'warning' ? '#1a100533' : ins.type === 'success' ? '#051a0a33' : '#0a1a2a33',
                border: `1px solid ${ins.type === 'error' ? '#ff444433' : ins.type === 'warning' ? '#ffaa0033' : ins.type === 'success' ? '#00ff8833' : '#00d4ff33'}`,
              }}>
                <div style={{
                  fontFamily: 'Rajdhani, sans-serif', fontSize: 11, fontWeight: 700, marginBottom: 3,
                  color: ins.type === 'error' ? '#ff4444' : ins.type === 'warning' ? '#ffaa00' : ins.type === 'success' ? '#00ff88' : '#00d4ff',
                }}>
                  {ins.type === 'error' ? '❌' : ins.type === 'warning' ? '⚠️' : ins.type === 'success' ? '✅' : 'ℹ️'} {ins.title}
                </div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#8ab4cc', lineHeight: 1.5 }}>{ins.msg}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI ASSISTANT ──────────────────────────────────────────────── */}
        {tab === 'ai' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI()}
                placeholder="Ask the AI about your power system..."
                style={{
                  flex: 1, background: '#0d1520', border: '1px solid #1a3050', borderRadius: 5,
                  color: '#8ab4cc', padding: '5px 8px', fontFamily: 'Rajdhani, sans-serif', fontSize: 11,
                  outline: 'none',
                }}
              />
              <button onClick={askAI} disabled={aiLoading}
                style={{
                  padding: '5px 12px', background: '#003a5a', border: '1px solid #00d4ff44', borderRadius: 5,
                  color: '#00d4ff', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 10, fontWeight: 600,
                  opacity: aiLoading ? 0.6 : 1,
                }}>{aiLoading ? '...' : 'Ask'}</button>
            </div>

            {/* Quick prompts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {[
                'Why is voltage low at bus 3?',
                'How do I fix overloaded lines?',
                'Explain Newton-Raphson method',
                'What is Y-Bus matrix?',
                'Why did stability fail?',
              ].map((q, i) => (
                <button key={i} onClick={() => { setAiQuery(q); }}
                  style={{
                    padding: '2px 7px', background: '#0d1520', border: '1px solid #1a3050', borderRadius: 10,
                    color: '#446688', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: 9,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#00d4ff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#446688'}
                >{q}</button>
              ))}
            </div>

            {aiResponse && (
              <div style={{
                background: '#0d1a2a', border: '1px solid #00d4ff22', borderRadius: 6,
                padding: '8px 10px',
              }}>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688', marginBottom: 4 }}>AI RESPONSE</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 11, color: '#8ab4cc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {aiResponse}
                </div>
              </div>
            )}

            {/* Static knowledge base when backend unavailable */}
            <div style={{ marginTop: 8, padding: '6px 8px', background: '#0a1020', border: '1px solid #1a2a3a', borderRadius: 5 }}>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#334455', marginBottom: 4 }}>KNOWLEDGE BASE</div>
              {[
                { q: 'What is load flow?', a: 'Load flow (power flow) finds the steady-state voltages, angles, and power flows in a power system. Newton-Raphson iteratively solves the nonlinear power balance equations.' },
                { q: 'What is a slack bus?', a: 'The slack (swing) bus sets the angle reference (θ=0) and supplies the balance power. It absorbs system losses and compensates for load uncertainty.' },
                { q: 'What causes voltage collapse?', a: 'Heavy reactive power demand, long transmission lines, and insufficient reactive support cause voltage to drop below acceptable limits (0.95 pu).' },
              ].map((item, i) => (
                <details key={i} style={{ marginBottom: 4 }}>
                  <summary style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#446688', cursor: 'pointer' }}>{item.q}</summary>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, color: '#8ab4cc', padding: '4px 8px', lineHeight: 1.5 }}>{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplanationCard({ exp, mode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 8, background: '#0d1520', border: '1px solid #1a2a3a', borderRadius: 6, overflow: 'hidden' }}>
      <div onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', cursor: 'pointer', userSelect: 'none' }}>
        <div>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00d4ff' }}>STEP: </span>
          <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#8ab4cc', fontWeight: 600 }}>{exp.step}</span>
        </div>
        <span style={{ color: '#446688', fontSize: 10 }}>{open ? '▼' : '▶'}</span>
      </div>

      {open && (
        <div style={{ padding: '0 10px 8px' }}>
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 10, color: '#8ab4cc', marginBottom: 4, lineHeight: 1.5 }}>{exp.detail}</div>

          {exp.math && (
            <div style={{ background: '#060c14', border: '1px solid #1a3050', borderRadius: 4, padding: '5px 8px', marginBottom: 4 }}>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#aa44ff', lineHeight: 1.6 }}>{exp.math}</div>
            </div>
          )}

          {mode !== 'beginner' && exp.substeps?.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {exp.substeps.slice(0, 4).map((s, i) => (
                <div key={i} style={{ padding: '2px 0', borderTop: '1px solid #0d1520' }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#334455' }}>{s.line}: </span>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>{s.desc}</span>
                </div>
              ))}
              {exp.substeps.length > 4 && (
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#334455' }}>
                  ...{exp.substeps.length - 4} more steps
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
