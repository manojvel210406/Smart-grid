import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGridStore } from '../store/gridStore';

const COLORS = {
  normal: '#00ff88', warning: '#ffaa00', error: '#ff4444', tripped: '#334455',
  slack: '#00d4ff', pv: '#00ff88', pq: '#ffaa00',
  bg: '#060c14', grid: '#0d1a2a', line: '#1e3a5f',
};

export default function CenterCanvas() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const particlesRef = useRef([]);
  const [tooltip, setTooltip] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [draggingBus, setDraggingBus] = useState(null);

  const { buses, lines, generators, loadFlowResults, faultResults, timelineT, setSelectedElement, updateBus } = useGridStore();

  // Get effective bus states (from results or default)
  const getBusState = useCallback((bus) => {
    if (loadFlowResults?.buses) {
      const rb = loadFlowResults.buses.find(b => b.id === bus.id);
      return rb || bus;
    }
    return bus;
  }, [loadFlowResults]);

  const getLineState = useCallback((line) => {
    if (loadFlowResults?.lineFlows) {
      const rl = loadFlowResults.lineFlows.find(l => l.id === line.id);
      return rl ? { ...line, loading: rl.loading, status: rl.status, flow: rl.Pij } : line;
    }
    return line;
  }, [loadFlowResults]);

  // Initialize particles for power flow animation
  useEffect(() => {
    particlesRef.current = lines.map(line => ({
      lineId: line.id, t: Math.random(), speed: 0.003 + Math.random() * 0.002,
    }));
  }, [lines]);

  // World to canvas transform
  const toCanvas = useCallback((x, y) => ({
    x: x * zoom + pan.x,
    y: y * zoom + pan.y,
  }), [zoom, pan]);

  const toWorld = useCallback((cx, cy) => ({
    x: (cx - pan.x) / zoom,
    y: (cy - pan.y) / zoom,
  }), [zoom, pan]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      frameRef.current++;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      // Grid dots
      ctx.save();
      const gridSize = 40 * zoom;
      const offsetX = pan.x % gridSize;
      const offsetY = pan.y % gridSize;
      for (let x = offsetX; x < w; x += gridSize) {
        for (let y = offsetY; y < h; y += gridSize) {
          ctx.fillStyle = '#0d1a2a';
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Draw lines
      lines.forEach(line => {
        const lineState = getLineState(line);
        const fromBus = buses.find(b => b.id === line.from);
        const toBus = buses.find(b => b.id === line.to);
        if (!fromBus || !toBus) return;

        const from = toCanvas(fromBus.x, fromBus.y);
        const to = toCanvas(toBus.x, toBus.y);

        const color = lineState.status === 'tripped' ? '#222a33'
          : lineState.loading > 100 ? COLORS.error
            : lineState.loading > 80 ? COLORS.warning
              : '#1e4060';

        const lineWidth = Math.max(1.5, Math.min(4, (lineState.loading || 30) / 30)) * zoom;

        // Line shadow/glow
        if (lineState.status !== 'tripped') {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = color + '40';
          ctx.lineWidth = lineWidth * 3;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, lineWidth);
        ctx.setLineDash(lineState.status === 'tripped' ? [6, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // Line label
        if (zoom > 0.7) {
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          ctx.fillStyle = '#334455';
          ctx.font = `${9 * zoom}px Share Tech Mono, monospace`;
          ctx.textAlign = 'center';
          if (lineState.loading > 0) {
            ctx.fillStyle = color;
            ctx.fillText(`${lineState.loading?.toFixed(0)}%`, mx, my - 6);
          }
          ctx.fillText(`L${line.id}`, mx, my + 8);
        }
      });

      // Animate power flow particles
      if (loadFlowResults?.converged) {
        particlesRef.current.forEach(p => {
          const line = lines.find(l => l.id === p.lineId);
          const lineState = getLineState(line);
          if (!line || lineState.status === 'tripped') return;

          const fromBus = buses.find(b => b.id === line.from);
          const toBus = buses.find(b => b.id === line.to);
          if (!fromBus || !toBus) return;

          p.t = (p.t + p.speed) % 1;
          const from = toCanvas(fromBus.x, fromBus.y);
          const to = toCanvas(toBus.x, toBus.y);

          const px = from.x + (to.x - from.x) * p.t;
          const py = from.y + (to.y - from.y) * p.t;

          const color = lineState.loading > 80 ? '#ff8800' : '#00d4ff';
          const r = Math.max(2, 3 * zoom);

          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      // Draw buses
      buses.forEach(bus => {
        const busState = getBusState(bus);
        const pos = toCanvas(bus.x, bus.y);
        const r = 18 * zoom;

        const busColor = busState.status === 'low_voltage' ? '#ff6600'
          : busState.status === 'high_voltage' ? '#ffff00'
            : COLORS[bus.type] || COLORS.pq;

        // Fault pulse
        if (faultResults && faultResults.faultBusId === bus.id) {
          const pulse = 0.5 + 0.5 * Math.sin(frameRef.current * 0.2);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r * (1.5 + pulse), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,68,68,${0.3 * pulse})`;
          ctx.fill();
        }

        // Outer glow
        const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2);
        grad.addColorStop(0, busColor + '30');
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 2, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Bus circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0e1a';
        ctx.strokeStyle = busColor;
        ctx.lineWidth = 2 * zoom;
        ctx.fill();
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = busColor;
        ctx.shadowBlur = 8;
        ctx.shadowColor = busColor;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Generator symbol
        if (generators.some(g => g.busId === bus.id)) {
          const gx = pos.x + r * 0.6;
          const gy = pos.y - r * 0.6;
          ctx.beginPath();
          ctx.arc(gx, gy, 6 * zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.font = `${7 * zoom}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('G', gx, gy + 3 * zoom);
        }

        // Labels
        if (zoom > 0.5) {
          ctx.fillStyle = busColor;
          ctx.font = `bold ${10 * zoom}px Rajdhani, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(bus.name.length > 8 ? `B${bus.id}` : bus.name, pos.x, pos.y + r + 14 * zoom);

          if (loadFlowResults?.buses) {
            const rb = loadFlowResults.buses.find(b => b.id === bus.id);
            if (rb) {
              ctx.fillStyle = '#00d4ff88';
              ctx.font = `${8 * zoom}px Share Tech Mono, monospace`;
              ctx.fillText(`${rb.voltage?.toFixed(3)} pu`, pos.x, pos.y + r + 25 * zoom);
              ctx.fillStyle = '#ffaa0088';
              ctx.fillText(`${rb.angle?.toFixed(1)}°`, pos.x, pos.y + r + 36 * zoom);
            }
          }
        }
      });

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [buses, lines, generators, loadFlowResults, faultResults, zoom, pan, toCanvas, getBusState, getLineState]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas?.parentElement) ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  // Mouse events
  const getHitBus = useCallback((cx, cy) => {
    const wPos = toWorld(cx, cy);
    return buses.find(b => {
      const dx = b.x - wPos.x, dy = b.y - wPos.y;
      return Math.sqrt(dx * dx + dy * dy) < 25;
    });
  }, [buses, toWorld]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const bus = getHitBus(cx, cy);
    if (bus) {
      setDraggingBus(bus.id);
    } else {
      setDragging(true);
      setDragStart({ x: cx - pan.x, y: cy - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;

    if (draggingBus !== null) {
      const wPos = toWorld(cx, cy);
      updateBus(draggingBus, { x: wPos.x, y: wPos.y });
      return;
    }
    if (dragging && dragStart) {
      setPan({ x: cx - dragStart.x, y: cy - dragStart.y });
      return;
    }

    // Tooltip
    const bus = getHitBus(cx, cy);
    if (bus) {
      const busState = getBusState(bus);
      setTooltip({
        x: cx + 10, y: cy + 10,
        content: busState,
      });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseUp = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    if (draggingBus === null) {
      const bus = getHitBus(cx, cy);
      if (bus) {
        setSelectedElement({ type: 'bus', data: getBusState(bus) });
      }
    }
    setDragging(false);
    setDragStart(null);
    setDraggingBus(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.3, Math.min(3, z * factor)));
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: COLORS.bg }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor: draggingBus ? 'grabbing' : dragging ? 'grabbing' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Mini-map */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12, width: 120, height: 80,
        background: '#060c14cc', border: '1px solid #1a2a3a', borderRadius: 6,
        overflow: 'hidden',
      }}>
        <MiniMap buses={buses} lines={lines} zoom={zoom} pan={pan} />
        <div style={{ position: 'absolute', top: 3, left: 5, fontFamily: 'Share Tech Mono, monospace', fontSize: 7, color: '#446688' }}>MINIMAP</div>
      </div>

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {['+', '−', '⟳'].map((sym, i) => (
          <button key={i} onClick={() => {
            if (sym === '+') setZoom(z => Math.min(3, z * 1.2));
            if (sym === '−') setZoom(z => Math.max(0.3, z / 1.2));
            if (sym === '⟳') { setZoom(1); setPan({ x: 0, y: 0 }); }
          }}
            style={{
              width: 28, height: 28, background: '#0d1520', border: '1px solid #1a3050',
              borderRadius: 5, color: '#00d4ff', cursor: 'pointer', fontSize: 14,
              fontFamily: 'Rajdhani, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{sym}</button>
        ))}
        <div style={{ textAlign: 'center', fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>{(zoom * 100).toFixed(0)}%</div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', top: 12, left: 12, background: '#060c14cc', border: '1px solid #1a2a3a',
        borderRadius: 6, padding: '6px 10px',
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 7, color: '#446688', marginBottom: 4 }}>LEGEND</div>
        {[
          { color: '#00d4ff', label: 'Slack Bus' },
          { color: '#00ff88', label: 'PV Bus' },
          { color: '#ffaa00', label: 'PQ Bus' },
          { color: '#ff4444', label: 'Fault/Overload' },
          { color: '#334455', label: 'Tripped' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
            <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 9, color: '#8899aa' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline indicator */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        background: '#060c14cc', border: '1px solid #1a2a3a', borderRadius: 6, padding: '4px 12px',
        fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: '#aa44ff',
      }}>
        {['⚡ NORMAL OPERATION', '💥 FAULT DETECTED', '🔌 BREAKER TRIP', '🔄 RECOVERY'][useGridStore.getState().timelineT] || 'READY'}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <BusTooltip x={tooltip.x} y={tooltip.y} bus={tooltip.content} />
      )}
    </div>
  );
}

function MiniMap({ buses, lines }) {
  if (!buses.length) return null;
  const xs = buses.map(b => b.x), ys = buses.map(b => b.y);
  const minX = Math.min(...xs) - 20, maxX = Math.max(...xs) + 20;
  const minY = Math.min(...ys) - 20, maxY = Math.max(...ys) + 20;
  const scaleX = 110 / (maxX - minX || 1), scaleY = 70 / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);
  const tx = b => (b - minX) * scale + 5;
  const ty = b => (b - minY) * scale + 5;

  return (
    <svg width="120" height="80" style={{ position: 'absolute', top: 0, left: 0 }}>
      {lines.map(l => {
        const from = buses.find(b => b.id === l.from);
        const to = buses.find(b => b.id === l.to);
        if (!from || !to) return null;
        return <line key={l.id} x1={tx(from.x)} y1={ty(from.y)} x2={tx(to.x)} y2={ty(to.y)} stroke={l.status === 'tripped' ? '#222' : '#1e4060'} strokeWidth={1} />;
      })}
      {buses.map(b => (
        <circle key={b.id} cx={tx(b.x)} cy={ty(b.y)} r={3} fill={{ slack: '#00d4ff', pv: '#00ff88', pq: '#ffaa00' }[b.type] || '#ffaa00'} />
      ))}
    </svg>
  );
}

function BusTooltip({ x, y, bus }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 1000,
      background: '#0a1420ee', border: '1px solid #00d4ff44', borderRadius: 6,
      padding: '8px 10px', pointerEvents: 'none', minWidth: 160,
    }}>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 9, color: '#00d4ff', marginBottom: 4 }}>{bus.name}</div>
      {[
        ['Type', bus.type?.toUpperCase()],
        ['Voltage', `${(bus.voltage || 1).toFixed(4)} pu`],
        ['Angle', `${(bus.angle || 0).toFixed(2)}°`],
        ['Load P', `${bus.Pd} MW`],
        ['Load Q', `${bus.Qd} MVAr`],
        ['Status', bus.status || 'normal'],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>{k}:</span>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#8ab4cc' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
