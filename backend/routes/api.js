const express = require('express');
const router = express.Router();

// ── Knowledge Base for AI explanations ───────────────────────────────────────
const knowledgeBase = {
  'newton-raphson': `Newton-Raphson Load Flow solves nonlinear power equations iteratively.
Starting from an initial guess (flat start: V=1.0 pu, θ=0), it linearizes the mismatch equations using the Jacobian matrix J:
  [ΔP]   [H  N] [Δθ  ]
  [ΔQ] = [J  L] [ΔV/V]
Each iteration updates θ and V until mismatches ΔP, ΔQ < tolerance (typically 1e-6 pu).
Convergence is typically quadratic, taking 3–7 iterations for well-conditioned systems.`,

  'y-bus': `The Y-Bus (admittance matrix) is the foundation of power system analysis.
For each branch i–j with impedance z = R + jX:
  y_series = 1/z = R/(R²+X²) - jX/(R²+X²)
Diagonal: Y_ii = Σ(y_ij) + jb_shunt  (sum over all connected branches)
Off-diagonal: Y_ij = -y_ij  (negative of series admittance)
The matrix is sparse, symmetric, and singular for islanded systems.`,

  'voltage low': `Low bus voltage (< 0.95 pu) is caused by:
1. Excessive reactive power demand (high Qd loads)
2. Long transmission lines with high X/R ratio
3. Insufficient reactive compensation
4. Heavy real power loading
FIXES: Add shunt capacitor banks, install SVC/STATCOM, reduce load, add local generation.`,

  'overload': `Line overload occurs when apparent power flow S = √(P²+Q²) exceeds MVA rating.
Causes: Load growth, contingency (N-1), poor dispatch
FIXES: Add parallel circuit, install series capacitor to reduce X, load shedding, optimal dispatch.`,

  'fault': `Fault current I_f = V_pre / Z_kk where Z_kk is the driving-point impedance.
For 3-phase faults: I_f = V_pre / |Z_kk| (symmetrical, maximum current)
For SLG faults: I_f = 3·V_pre / (Z1 + Z2 + Z0) (requires sequence networks)
Protection: Circuit breakers must clear fault within 3–5 cycles (50–80ms).`,

  'stability': `Transient stability is governed by the swing equation:
  M·(dω/dt) = Pm - Pe - D·ω   (power balance on rotor)
  dδ/dt = ω                    (angle rate = speed deviation)
where M = 2H/ω₀, H = inertia constant (MWs/MVA).
Equal Area Criterion: System stable if accelerating area < decelerating area.
Critical clearing time (CCT) must not be exceeded for stability.`,

  'economic dispatch': `Economic dispatch minimizes total fuel cost ΣC_i(P_i) subject to ΣP_i = P_load.
Using KKT conditions: dC_i/dP_i = λ for all generators at their optimal output.
For quadratic cost C_i = a_i·P_i² + b_i·P_i + c_i:
  Optimal: P_i* = (λ - b_i) / (2·a_i), clipped to [P_min, P_max]
Lambda (λ) = incremental cost ($/MWh) found by bisection until ΣP_i = P_load.`,

  'default': `This is the Smart Grid Digital Twin simulator.
I can explain: Newton-Raphson load flow, Y-Bus formation, fault analysis, transient stability, economic dispatch, voltage regulation, reactive power compensation, per-unit system, and power system protection.
Try asking about a specific topic or paste your simulation result for analysis.`,
};

function findBestAnswer(query) {
  const q = query.toLowerCase();
  if (q.includes('newton') || q.includes('load flow') || q.includes('convergence') || q.includes('iteration')) return knowledgeBase['newton-raphson'];
  if (q.includes('y-bus') || q.includes('ybus') || q.includes('admittance') || q.includes('y bus')) return knowledgeBase['y-bus'];
  if (q.includes('low voltage') || q.includes('voltage drop') || q.includes('voltage collapse') || q.includes('why is voltage')) return knowledgeBase['voltage low'];
  if (q.includes('overload') || q.includes('line loading') || q.includes('fix line')) return knowledgeBase['overload'];
  if (q.includes('fault') || q.includes('short circuit') || q.includes('breaker')) return knowledgeBase['fault'];
  if (q.includes('stability') || q.includes('rotor') || q.includes('swing') || q.includes('oscillat')) return knowledgeBase['stability'];
  if (q.includes('dispatch') || q.includes('economic') || q.includes('cost') || q.includes('lambda') || q.includes('lmp')) return knowledgeBase['economic dispatch'];
  return knowledgeBase['default'];
}

// ── POST /api/ai-explain ──────────────────────────────────────────────────────
router.post('/ai-explain', async (req, res) => {
  const { query, context } = req.body;
  if (!query) return res.status(400).json({ error: 'query is required' });

  try {
    // Try Anthropic API if key is available
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    if (ANTHROPIC_KEY) {
      const systemPrompt = `You are an expert power systems engineer and educator. 
You assist users of a Smart Grid Digital Twin Simulator.
Provide clear, technical, but accessible explanations.
Include: what happened, why it happened, how to fix it.
Use engineering terminology but explain it. Keep responses under 200 words.
Current system context: ${JSON.stringify(context || {})}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: query }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const explanation = data.content?.[0]?.text || 'No response.';
        return res.json({ explanation, source: 'anthropic' });
      }
    }

    // Fallback to local knowledge base
    const explanation = findBestAnswer(query);
    res.json({ explanation, source: 'local' });

  } catch (err) {
    console.error('AI explain error:', err.message);
    const explanation = findBestAnswer(query);
    res.json({ explanation, source: 'local' });
  }
});

// ── POST /api/save-system ─────────────────────────────────────────────────────
router.post('/save-system', (req, res) => {
  const { name, buses, lines, generators } = req.body;
  if (!buses || !lines) return res.status(400).json({ error: 'buses and lines required' });
  const system = { name: name || `System_${Date.now()}`, buses, lines, generators: generators || [], savedAt: new Date().toISOString() };
  // In a real app, save to DB. Here we echo back.
  res.json({ success: true, system });
});

// ── POST /api/validate-system ─────────────────────────────────────────────────
router.post('/validate-system', (req, res) => {
  const { buses, lines } = req.body;
  const issues = [];
  if (!buses?.length) issues.push({ severity: 'error', msg: 'No buses defined' });
  if (!lines?.length) issues.push({ severity: 'warning', msg: 'No lines defined — isolated buses cannot be solved' });
  const slackCount = buses?.filter(b => b.type === 'slack').length || 0;
  if (slackCount === 0) issues.push({ severity: 'error', msg: 'No slack bus defined' });
  if (slackCount > 1) issues.push({ severity: 'warning', msg: 'Multiple slack buses defined' });
  res.json({ valid: issues.filter(i => i.severity === 'error').length === 0, issues });
});

// ── GET /api/prebuilt-systems ─────────────────────────────────────────────────
router.get('/prebuilt-systems', (req, res) => {
  res.json({
    systems: [
      { id: 'ieee5', name: 'IEEE 5-Bus', description: '5-bus test system with 2 generators', buses: 5, lines: 7 },
      { id: 'simple3', name: 'Simple 3-Bus', description: 'Simple 3-bus radial system', buses: 3, lines: 3 },
    ]
  });
});

module.exports = router;
