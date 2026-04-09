import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useGridStore } from '../store/gridStore';

export default function ThreeScene() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(0);
  const animRef = useRef(null);
  const meshesRef = useRef({ buses: {}, lines: {}, particles: [] });
  const mouseRef = useRef({ x: 0, y: 0 });
  const orbitRef = useRef({ theta: 0.5, phi: 0.8, radius: 600, isDragging: false, lastX: 0, lastY: 0 });

  const { buses, lines, generators, loadFlowResults, faultResults, timelineT } = useGridStore();

  const initScene = useCallback(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060c14);
    scene.fog = new THREE.FogExp2(0x060c14, 0.0015);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 1, 5000);
    camera.position.set(0, 300, 600);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0x112233, 0.8);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x00aaff, 1.5);
    dirLight.position.set(200, 400, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight1 = new THREE.PointLight(0x00d4ff, 2, 1000);
    pointLight1.position.set(0, 200, 0);
    scene.add(pointLight1);

    // Grid floor
    const gridHelper = new THREE.GridHelper(1000, 40, 0x0d2040, 0x0a1520);
    gridHelper.position.y = -80;
    scene.add(gridHelper);

    // Background particles
    const particleGeo = new THREE.BufferGeometry();
    const pCount = 2000;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 2000;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({ color: 0x112244, size: 1.5, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(particleGeo, particleMat));

    buildGrid(scene, buses, lines, generators, loadFlowResults);

    return { scene, renderer, camera };
  }, [buses, lines, generators, loadFlowResults]);

  const buildGrid = (scene, buses, lines, generators, results) => {
    // Clear previous
    Object.values(meshesRef.current.buses).forEach(m => scene.remove(m));
    Object.values(meshesRef.current.lines).forEach(m => scene.remove(m));
    meshesRef.current.particles.forEach(p => scene.remove(p));
    meshesRef.current = { buses: {}, lines: {}, particles: [] };

    // Scale buses to 3D positions
    const scale = 1.2;
    const busPos = {};
    buses.forEach(bus => {
      const x = (bus.x - 400) * scale;
      const z = (bus.y - 230) * scale;
      busPos[bus.id] = new THREE.Vector3(x, 0, z);
    });

    // Draw buses as glowing spheres
    buses.forEach(bus => {
      const rb = results?.buses?.find(b => b.id === bus.id);
      const voltage = rb?.voltage || bus.voltage || 1.0;
      const status = rb?.status || 'normal';

      const colors = { slack: 0x00d4ff, pv: 0x00ff88, pq: 0xffaa00 };
      const baseColor = colors[bus.type] || 0xffaa00;
      const alertColor = status === 'low_voltage' ? 0xff6600 : status === 'high_voltage' ? 0xffff00 : baseColor;

      const geo = new THREE.SphereGeometry(14, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: alertColor, emissive: alertColor, emissiveIntensity: 0.4,
        metalness: 0.3, roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(busPos[bus.id]);
      mesh.position.y = 0;
      mesh.castShadow = true;
      mesh.userData = { type: 'bus', id: bus.id };
      scene.add(mesh);
      meshesRef.current.buses[bus.id] = mesh;

      // Glow halo
      const haloGeo = new THREE.SphereGeometry(20, 16, 16);
      const haloMat = new THREE.MeshBasicMaterial({ color: alertColor, transparent: true, opacity: 0.12, side: THREE.BackSide });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.copy(busPos[bus.id]);
      scene.add(halo);

      // Generator indicator
      if (generators.some(g => g.busId === bus.id)) {
        const genGeo = new THREE.CylinderGeometry(6, 6, 20, 16);
        const genMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.5 });
        const genMesh = new THREE.Mesh(genGeo, genMat);
        genMesh.position.copy(busPos[bus.id]);
        genMesh.position.y = 25;
        scene.add(genMesh);
      }

      // Text label (sprite)
      addLabel(scene, bus.name.length > 8 ? `B${bus.id}` : bus.name, busPos[bus.id].clone().setY(30), alertColor);
      if (rb) {
        addLabel(scene, `${voltage.toFixed(3)}pu`, busPos[bus.id].clone().setY(42), 0x00d4ff, 0.7);
      }
    });

    // Draw lines as tubes
    lines.forEach(line => {
      const fromPos = busPos[line.from];
      const toPos = busPos[line.to];
      if (!fromPos || !toPos) return;

      const rl = results?.lineFlows?.find(l => l.id === line.id);
      const loading = rl?.loading || 0;
      const lineStatus = line.status === 'tripped' ? 'tripped' : rl?.status || 'normal';

      const color = lineStatus === 'tripped' ? 0x222a33
        : loading > 100 ? 0xff4444
          : loading > 80 ? 0xffaa00
            : 0x1e5070;

      const dir = new THREE.Vector3().subVectors(toPos, fromPos);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);

      const tubeRadius = Math.max(1.5, Math.min(4, (loading || 20) / 25));
      const tubeGeo = new THREE.CylinderGeometry(tubeRadius, tubeRadius, len, 8);
      const tubeMat = new THREE.MeshStandardMaterial({
        color, emissive: lineStatus === 'tripped' ? 0x000000 : color, emissiveIntensity: 0.3,
        transparent: lineStatus === 'tripped', opacity: lineStatus === 'tripped' ? 0.3 : 1,
      });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.copy(mid);

      const axis = new THREE.Vector3(0, 1, 0);
      tube.quaternion.setFromUnitVectors(axis, dir.clone().normalize());
      scene.add(tube);
      meshesRef.current.lines[line.id] = tube;

      // Power flow particle emitter
      if (results?.converged && lineStatus !== 'tripped') {
        for (let i = 0; i < 3; i++) {
          const pGeo = new THREE.SphereGeometry(2, 8, 8);
          const pMat = new THREE.MeshBasicMaterial({ color: loading > 80 ? 0xff8800 : 0x00d4ff });
          const p = new THREE.Mesh(pGeo, pMat);
          p.userData = { fromPos: fromPos.clone(), toPos: toPos.clone(), t: i / 3, speed: 0.005 + Math.random() * 0.003 };
          scene.add(p);
          meshesRef.current.particles.push(p);
        }
      }
    });
  };

  const addLabel = (scene, text, pos, color, scale = 1) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, 128, 32);
    ctx.font = `bold ${11 * scale}px Rajdhani, sans-serif`;
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 20);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.scale.set(60 * scale, 15 * scale, 1);
    scene.add(sprite);
  };

  useEffect(() => {
    const { scene, renderer, camera } = initScene() || {};
    if (!scene || !renderer || !camera) return;

    // Animation loop
    const animate = () => {
      frameRef.current++;
      const t = frameRef.current;

      // Orbit camera auto-rotation (gentle)
      const orbit = orbitRef.current;
      if (!orbit.isDragging) {
        orbit.theta += 0.001;
      }
      camera.position.x = orbit.radius * Math.sin(orbit.theta) * Math.sin(orbit.phi);
      camera.position.y = orbit.radius * Math.cos(orbit.phi);
      camera.position.z = orbit.radius * Math.cos(orbit.theta) * Math.sin(orbit.phi);
      camera.lookAt(0, 0, 0);

      // Animate bus spheres (pulsing)
      Object.entries(meshesRef.current.buses).forEach(([id, mesh]) => {
        const pulse = 1 + 0.06 * Math.sin(t * 0.05 + parseInt(id));
        mesh.scale.setScalar(pulse);

        // Fault animation
        if (faultResults?.faultBusId === parseInt(id)) {
          const faultPulse = 1 + 0.5 * Math.abs(Math.sin(t * 0.2));
          mesh.scale.setScalar(faultPulse);
          mesh.material.emissiveIntensity = 0.8 + 0.5 * Math.sin(t * 0.3);
          mesh.material.color.setHex(0xff4444);
          mesh.material.emissive.setHex(0xff4444);
        }
      });

      // Animate generators (rotate)
      if (generators.length > 0) {
        // Rotate generator cylinders
        scene.children.forEach(child => {
          if (child.geometry instanceof THREE.CylinderGeometry && child.material?.emissive?.getHex() === 0x00ff88) {
            child.rotation.y += 0.03;
          }
        });
      }

      // Animate power flow particles
      meshesRef.current.particles.forEach(p => {
        p.userData.t = (p.userData.t + p.userData.speed) % 1;
        const from = p.userData.fromPos;
        const to = p.userData.toPos;
        p.position.lerpVectors(from, to, p.userData.t);

        // Glow effect
        p.material.opacity = 0.5 + 0.5 * Math.sin(t * 0.1 + p.userData.t * 10);
      });

      // Timeline scenario effects
      if (timelineT === 1) {
        // Fault — flash red
        scene.fog = new THREE.FogExp2(0x1a0505, 0.002);
      } else if (timelineT === 2) {
        // Breaker trip — dim
        scene.fog = new THREE.FogExp2(0x050a10, 0.002);
      } else {
        scene.fog = new THREE.FogExp2(0x060c14, 0.0015);
      }

      renderer.render(scene, camera);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    // Mouse orbit controls
    const onMouseDown = (e) => {
      orbitRef.current.isDragging = true;
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };
    const onMouseMove = (e) => {
      if (!orbitRef.current.isDragging) return;
      const dx = e.clientX - orbitRef.current.lastX;
      const dy = e.clientY - orbitRef.current.lastY;
      orbitRef.current.theta -= dx * 0.005;
      orbitRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbitRef.current.phi + dy * 0.005));
      orbitRef.current.lastX = e.clientX;
      orbitRef.current.lastY = e.clientY;
    };
    const onMouseUp = () => { orbitRef.current.isDragging = false; };
    const onWheel = (e) => {
      orbitRef.current.radius = Math.max(100, Math.min(1500, orbitRef.current.radius + e.deltaY * 0.5));
    };

    const mount = mountRef.current;
    mount.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    mount.addEventListener('wheel', onWheel);

    // Resize
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      mount.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      mount.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [initScene, faultResults, timelineT, generators]);

  // Rebuild grid when data changes
  useEffect(() => {
    if (sceneRef.current) {
      buildGrid(sceneRef.current, buses, lines, generators, loadFlowResults);
    }
  }, [buses, lines, generators, loadFlowResults]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* 3D overlay UI */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: '#060c14cc', border: '1px solid #1a2a3a', borderRadius: 6,
        padding: '8px 12px', pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, color: '#00d4ff', marginBottom: 4 }}>3D DIGITAL TWIN</div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#446688' }}>Drag to rotate | Scroll to zoom</div>
        {loadFlowResults?.converged && (
          <div style={{ marginTop: 4, fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: '#00ff88' }}>
            ✅ Live data — {buses.length} buses | {lines.length} lines
          </div>
        )}
      </div>

      {/* Scenario label */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#060c14cc', border: `1px solid ${timelineT === 1 ? '#ff444488' : '#1a2a3a'}`,
        borderRadius: 20, padding: '5px 16px',
        fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
        color: timelineT === 1 ? '#ff4444' : timelineT === 2 ? '#ffaa00' : '#00ff88',
      }}>
        {['⚡ NORMAL OPERATION', '💥 FAULT ACTIVE', '🔌 BREAKER TRIPPED', '🔄 RECOVERY'][timelineT]}
      </div>
    </div>
  );
}
