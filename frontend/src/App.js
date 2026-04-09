import React, { useEffect } from 'react';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import CenterCanvas from './components/CenterCanvas';
import ThreeScene from './components/ThreeScene';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';
import { useGridStore } from './store/gridStore';

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { width: 100%; height: 100%; background: #060c14; overflow: hidden; }
  
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #060c14; }
  ::-webkit-scrollbar-thumb { background: #1a3050; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: #00d4ff44; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
  @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }

  details summary::-webkit-details-marker { display: none; }
  details > summary { list-style: none; }

  input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
  input[type=range]::-webkit-slider-runnable-track { background: #1a3050; height: 4px; border-radius: 2px; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; margin-top: -4px; cursor: pointer; }

  button { user-select: none; }
`;

function SelectedElementPanel() {
  const { selectedElement, setSelectedElement } = useGridStore();
  if (!selectedElement) return null;
  const { type, data } = selectedElement;
  return (
    <div style={{
      position: 'fixed', bottom: 210, right: 310, zIndex: 1000,
      background: '#0a1420ee', border: '1px solid #00d4ff44', borderRadius: 8,
      padding: '10px 14px', minWidth: 200, maxWidth: 260,
      animation: 'slideUp 0.2s ease',
      boxShadow: '0 4px 24px rgba(0,212,255,0.15)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00d4ff' }}>{type.toUpperCase()} DETAILS</span>
        <button onClick={() => setSelectedElement(null)} style={{ background: 'none', border: 'none', color: '#446688', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      {Object.entries(data || {}).filter(([k]) => !['x', 'y', 'id'].includes(k)).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>{k}:</span>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#8ab4cc' }}>
            {typeof v === 'number' ? v.toFixed ? v.toFixed(4) : v : String(v).slice(0, 20)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScanlineOverlay() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none', zIndex: 9999,
      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
    }} />
  );
}

export default function App() {
  const viewMode = useGridStore(s => s.viewMode);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKey = (e) => {
      if (e.ctrlKey && e.key === 'z') useGridStore.getState().undo();
      if (e.ctrlKey && e.key === 'y') useGridStore.getState().redo();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      <style>{styles}</style>
      <ScanlineOverlay />
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column',
        background: '#060c14',
        fontFamily: 'Rajdhani, sans-serif',
      }}>
        {/* TOP BAR */}
        <TopBar />

        {/* MAIN AREA */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* LEFT PANEL */}
          <LeftPanel />

          {/* CENTER CANVAS / 3D */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {viewMode === '2d' ? <CenterCanvas /> : <ThreeScene />}
            </div>
            {/* BOTTOM PANEL */}
            <BottomPanel />
          </div>

          {/* RIGHT PANEL */}
          <RightPanel />
        </div>

        {/* Selected element popup */}
        <SelectedElementPanel />
      </div>
    </>
  );
}
