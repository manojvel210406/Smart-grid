# ⚡ Smart Grid Digital Twin Simulator

A professional-grade, interactive power systems simulation platform combining:
- **Newton-Raphson Load Flow** analysis
- **Fault Analysis** (Z-Bus method)
- **Transient Stability** simulation (swing equation)
- **Economic Dispatch** (lambda iteration)
- **2D Interactive Canvas** digital twin
- **3D Three.js** visualization
- **AI-powered** explanations & insights

---

## 🖥️ UI Layout

```
┌─────────────────── TOP BAR ───────────────────────┐
│ Run LF │ Fault │ Stability │ Dispatch │ 2D/3D │ Mode│
├──────────┬────────────────────────┬────────────────┤
│  LEFT    │   CENTER CANVAS / 3D   │  RIGHT PANEL   │
│  PANEL   │   (Interactive Twin)   │  (Results Tabs)│
│  Buses   │                        │  Load Flow     │
│  Lines   │   Drag & Drop Buses    │  Fault Results │
│  Gens    │   Power Flow Arrows    │  Stability     │
│  Disturb │   Real-time Updates    │  Dispatch      │
├──────────┴────────────────────────┴────────────────┤
│         BOTTOM PANEL: Logs │ Derivations │ AI Chat  │
└────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v16+ (https://nodejs.org)
- npm v8+

### Installation

```bash
# Clone / unzip the project
cd smart-grid-digital-twin

# Install all dependencies (root + frontend + backend)
npm run install:all
```

### Running the App

**Option A — Full Stack (Frontend + Backend):**
```bash
npm start
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

**Option B — Frontend only (no AI):**
```bash
cd frontend && npm start
```

**Option B — Backend only:**
```bash
cd backend && npm start
```

---

## 🤖 AI Features (Optional)

To enable AI-powered explanations, add your Anthropic API key:

```bash
# Create backend/.env
echo "ANTHROPIC_API_KEY=your_key_here" > backend/.env
```

Without a key, the built-in knowledge base handles common questions.

---

## 📁 Project Structure

```
smart-grid-digital-twin/
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js                  ← Main layout
│   │   ├── index.js
│   │   ├── store/
│   │   │   └── gridStore.js        ← Zustand state
│   │   ├── engine/
│   │   │   ├── yBus.js             ← Y-Bus formation
│   │   │   ├── loadFlow.js         ← Newton-Raphson solver
│   │   │   ├── faultAnalysis.js    ← Z-Bus fault analysis
│   │   │   └── stability.js        ← Swing eq + dispatch
│   │   ├── components/
│   │   │   ├── TopBar.js           ← Control bar
│   │   │   ├── LeftPanel.js        ← Grid builder
│   │   │   ├── CenterCanvas.js     ← 2D canvas twin
│   │   │   ├── ThreeScene.js       ← 3D Three.js scene
│   │   │   ├── RightPanel.js       ← Results tabs
│   │   │   └── BottomPanel.js      ← Logs + AI chat
│   │   └── utils/
│   │       └── utils.js            ← Helpers & validation
│   └── package.json
├── backend/
│   ├── server.js                   ← Express server
│   ├── routes/
│   │   └── api.js                  ← API endpoints
│   └── package.json
├── package.json                    ← Root scripts
├── .gitignore
└── README.md
```

---

## ⚡ Features Guide

### Load Flow
1. Click **"Run Load Flow"** in the top bar
2. Results appear in right panel **⚡ Flow** tab
3. Bus voltages, angles, P/Q values displayed
4. Line loadings shown as color-coded bars

### Fault Analysis
1. Select fault bus from the dropdown in the top bar
2. Click **"Run Fault"**
3. See fault current (kA) and post-fault bus voltages

### Stability
1. Must run Load Flow first
2. Click **"Run Stability"**
3. View rotor angle and frequency time plots

### Economic Dispatch
1. Click **"Run Dispatch"**
2. See optimal generation schedule and total cost

### 3D View
- Click **3D** button in top bar
- Drag to orbit, scroll to zoom
- Buses shown as glowing spheres
- Power flow particles on lines

### Disturbance Panel
- Left panel → **Disturb** tab
- Adjust Load Scale, Fault Severity sliders
- Use timeline (t=0→3) for scenario playback

### AI Chat
- Bottom panel → **🤖 AI Assistant**
- Ask questions like:
  - "Why is voltage low at bus 3?"
  - "Explain Newton-Raphson"
  - "How do I fix overloaded lines?"

---

## 🔬 Simulation Engine

| Method | Algorithm | Tolerance |
|--------|-----------|-----------|
| Load Flow | Newton-Raphson | 1e-6 pu |
| Fault Analysis | Z-Bus inversion | — |
| Stability | Euler integration | dt=0.01s |
| Dispatch | Lambda iteration (bisection) | 1e-6 pu |

---

## 🏗️ Build for Production

```bash
# Build frontend
npm run build

# The Express server will serve the built frontend
NODE_ENV=production node backend/server.js
```

---

## 🔑 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |

---

## 📦 ZIP Instructions

**Mac/Linux:**
```bash
zip -r smart-grid-digital-twin.zip smart-grid-digital-twin/
```

**Windows (PowerShell):**
```powershell
Compress-Archive -Path smart-grid-digital-twin -DestinationPath smart-grid-digital-twin.zip
```

---

## 📜 License

MIT — Free to use, modify, and distribute.
