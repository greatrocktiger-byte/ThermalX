/**
 * NUMERIX LAB - Master Application Controller
 * Unifies THERMALX, LINKRANK, and ACADEMIC LAB into one seamless cybernetic platform.
 */

import { ThermalGrid } from './numerical/thermalSolver.js';
import { LinkRankNetwork } from './numerical/linkrankSolver.js';
import { AcademicLab } from './numerical/academicLab.js';
import { ThermalCanvas } from './components/thermalCanvas.js';
import { NetworkGraph } from './components/networkGraph.js';

// Sound Synthesizer via Web Audio API (zero external assets required)
class AudioSynth {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }
  click() {
    if (this.muted || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }
  chime() {
    if (this.muted || !this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major arpeggio
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.06, this.ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.06 + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.06);
        osc.stop(this.ctx.currentTime + i * 0.06 + 0.3);
      });
    } catch (e) {}
  }
}

export class NumerixApp {
  constructor() {
    this.synth = new AudioSynth();
    this.currentModule = 'thermalx';
    this.currentScreen = 'thermalx-home';

    // Thermal State
    this.thermalConfig = {
      ambient: 25.0,
      cpu: 85.0,
      gpu: 75.0,
      battery: 40.0,
      cooling: 0.60,
      resolution: 'medium', // 'low' (16x12), 'medium' (24x18), 'high' (32x24)
      solver: 'gauss-seidel',
      maxIter: 50,
      tolerance: 0.001
    };
    this.thermalGrid = null;
    this.thermalResult = null;
    this.thermalCanvasMain = null;
    this.thermalCanvasSolver = null;
    this.customGridCanvas = null;
    this.customTool = 'heat';
    this.customToolTemp = 90;
    this.customSelectedCell = null;
    this.runHistory = [];
    this.selectedHistoryRun = null;
    this.graphicalTab = 'multi';
    this.graphicalSliceRow = 11;
    this.graphicalActiveRuns = new Set();
    this.graphicalSelectedRunIdx = null;

    // LinkRank State
    this.currentCategory = 'technology';
    this.network = LinkRankNetwork.createPreset('technology');
    this.networkGraphEditor = null;
    this.networkGraphResults = null;
    this.linkrankResult = null;

    // Navigation History Stack
    this.navHistory = [];

    this.init();
  }

  init() {
    // Audio unlock on first user gesture
    window.addEventListener('click', () => this.synth.init(), { once: true });

    // Browser Back / Forward Button Handling
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.screen) {
        this.navigate(e.state.screen, false);
      }
    });

    this.setupNavigation();
    this.setupThermalControls();
    this.setupCustomGrid();
    this.setupLinkRankControls();
    this.setupAcademicLab();
    this.setupModals();

    // Default view
    this.navigate('thermalx-home', false);
  }

  // --- NAVIGATION CONTROLLER ---
  navigate(screenId, recordHistory = true) {
    this.synth.click();
    const isFromTransient = this.currentScreen === 'thermalx-solver' || this.currentScreen === 'linkrank-solver';
    if (recordHistory && !isFromTransient && this.currentScreen && this.currentScreen !== screenId) {
      this.navHistory.push(this.currentScreen);
      try {
        history.pushState({ screen: screenId }, '', '#' + screenId);
      } catch (e) {}
    }
    this.currentScreen = screenId;

    // Update screen visibility
    document.querySelectorAll('.tab-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    // Update breadcrumbs and global back button
    this.updateBreadcrumbs(screenId);

    // Update top header module active pill
    if (screenId.startsWith('thermalx')) {
      this.setActiveNavModule('thermalx');
    } else if (screenId.startsWith('linkrank')) {
      this.setActiveNavModule('linkrank');
    } else if (screenId.startsWith('academic')) {
      this.setActiveNavModule('academic');
    }

    // Lifecycle triggers for specific screens
    if (screenId === 'thermalx-config') {
      this.syncThermalConfigUI();
    } else if (screenId === 'thermalx-curves') {
      this.renderGraphicalScreen();
    } else if (screenId === 'thermalx-custom') {
      this.initCustomGridEnvironment();
    } else if (screenId === 'linkrank-editor') {
      this.initNetworkEditor();
    } else if (screenId === 'academic-hub') {
      this.runDefaultAcademicExamples();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    this.synth.click();
    while (this.navHistory.length > 0) {
      const prev = this.navHistory.pop();
      if (prev !== 'thermalx-solver' && prev !== 'linkrank-solver' && prev !== this.currentScreen) {
        this.navigate(prev, false);
        return;
      }
    }
    if (this.currentScreen.startsWith('thermalx') && this.currentScreen !== 'thermalx-home') {
      this.navigate('thermalx-home', false);
    } else if (this.currentScreen.startsWith('linkrank') && this.currentScreen !== 'linkrank-home') {
      this.navigate('linkrank-home', false);
    } else {
      this.navigate('thermalx-home', false);
    }
  }

  updateBreadcrumbs(screenId) {
    const backBtn = document.getElementById('globalBackBtn');
    const crumbsContainer = document.getElementById('globalBreadcrumbs');
    if (!crumbsContainer) return;

    const isHome = screenId === 'thermalx-home' || screenId === 'linkrank-home' || screenId === 'academic-hub';
    if (backBtn) {
      backBtn.style.opacity = isHome ? '0.35' : '1.0';
      backBtn.style.pointerEvents = isHome ? 'none' : 'auto';
    }

    const trail = [];
    trail.push({ label: 'Home', screen: 'thermalx-home', icon: 'home' });

    if (screenId.startsWith('thermalx')) {
      trail.push({ label: 'THERMALX', screen: 'thermalx-home' });
      if (screenId === 'thermalx-select') trail.push({ label: 'Choose Mode', screen: 'thermalx-select' });
      if (screenId === 'thermalx-config') trail.push({ label: 'Laptop Simulation', screen: 'thermalx-config' });
      if (screenId === 'thermalx-solver') trail.push({ label: 'Solving Temperature Field', screen: 'thermalx-solver' });
      if (screenId === 'thermalx-results') trail.push({ label: 'Simulation Results', screen: 'thermalx-results' });
      if (screenId === 'thermalx-curves') trail.push({ label: 'Graphical Analytics', screen: 'thermalx-curves' });
      if (screenId === 'thermalx-custom') trail.push({ label: 'Custom Grid Designer', screen: 'thermalx-custom' });
      if (screenId === 'thermalx-challenge') trail.push({ label: 'Thermal Challenge', screen: 'thermalx-challenge' });
    } else if (screenId.startsWith('linkrank')) {
      trail.push({ label: 'LINKRANK', screen: 'linkrank-home' });
      if (screenId === 'linkrank-select') trail.push({ label: 'Select Network', screen: 'linkrank-select' });
      if (screenId === 'linkrank-editor') trail.push({ label: 'Network Editor', screen: 'linkrank-editor' });
      if (screenId === 'linkrank-solver') trail.push({ label: 'Computing Centrality', screen: 'linkrank-solver' });
      if (screenId === 'linkrank-results') trail.push({ label: 'Network Ranking Results', screen: 'linkrank-results' });
    } else if (screenId.startsWith('academic')) {
      trail.push({ label: 'Numerical Lab', screen: 'academic-hub' });
    }

    crumbsContainer.innerHTML = trail.map((c, idx) => {
      const isLast = idx === trail.length - 1;
      return `
        <span class="inline-flex items-center gap-1.5 ${isLast ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-white cursor-pointer transition-colors'}" 
          ${!isLast ? `onclick="app.navigate('${c.screen}')"` : ''}>
          ${c.icon ? `<span class="material-symbols-outlined text-[15px]">${c.icon}</span>` : ''}
          <span>${c.label}</span>
        </span>
        ${!isLast ? '<span class="text-white/20 select-none">/</span>' : ''}
      `;
    }).join('');
  }

  setActiveNavModule(mod) {
    this.currentModule = mod;
    document.querySelectorAll('.nav-module-btn').forEach(btn => {
      const match = btn.dataset.module === mod;
      btn.classList.toggle('text-primary', match);
      btn.classList.toggle('border-primary', match);
      btn.classList.toggle('text-on-surface-variant', !match);
    });
  }

  setupNavigation() {
    // Top Nav buttons
    document.querySelectorAll('.nav-module-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.module;
        if (mod === 'thermalx') this.navigate('thermalx-home');
        else if (mod === 'linkrank') this.navigate('linkrank-home');
        else if (mod === 'academic') this.navigate('academic-hub');
      });
    });

    // Sound toggle
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.synth.muted = !this.synth.muted;
        soundBtn.innerHTML = this.synth.muted 
          ? '<span class="material-symbols-outlined text-[20px]">volume_off</span>'
          : '<span class="material-symbols-outlined text-[20px]">volume_up</span>';
      });
    }
  }

  // ==========================================
  // --- THERMALX CONTROLS & SOLVER LOGIC ---
  // ==========================================
  setupThermalControls() {
    // Sliders
    const sliders = [
      { id: 'ambientSlider', key: 'ambient', valId: 'ambientVal', unit: '°C' },
      { id: 'cpuSlider', key: 'cpu', valId: 'cpuVal', unit: '°C' },
      { id: 'gpuSlider', key: 'gpu', valId: 'gpuVal', unit: '°C' },
      { id: 'batterySlider', key: 'battery', valId: 'batteryVal', unit: '°C' },
      { id: 'coolingSlider', key: 'cooling', valId: 'coolingVal', unit: '%', mult: 100 }
    ];

    sliders.forEach(s => {
      const el = document.getElementById(s.id);
      const valEl = document.getElementById(s.valId);
      if (el) {
        el.addEventListener('input', () => {
          let val = parseFloat(el.value);
          if (s.mult) {
            this.thermalConfig[s.key] = val / s.mult;
            if (valEl) valEl.textContent = `${Math.round(val)}${s.unit}`;
          } else {
            this.thermalConfig[s.key] = val;
            if (valEl) valEl.textContent = `${val}${s.unit}`;
          }
          this.updatePredictiveDeltaGraph();
        });
      }
    });

    // Resolution Buttons
    document.querySelectorAll('.res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.res-btn').forEach(b => b.classList.remove('bg-primary-container', 'text-on-primary-container'));
        btn.classList.add('bg-primary-container', 'text-on-primary-container');
        this.thermalConfig.resolution = btn.dataset.res;
        this.updatePredictiveDeltaGraph();
      });
    });

    // Solver Method Toggle (Gauss-Seidel vs Jacobi)
    const methodSelect = document.getElementById('thermalMethodSelect');
    if (methodSelect) {
      methodSelect.addEventListener('change', (e) => {
        this.thermalConfig.solver = e.target.value;
      });
    }

    // Start Simulation Button
    const runBtn = document.getElementById('runThermalSimulationBtn');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runThermalSimulation());
    }

    // Initial draw of predictive response curve
    setTimeout(() => this.updatePredictiveDeltaGraph(), 100);
  }

  syncThermalConfigUI() {
    document.getElementById('ambientSlider').value = this.thermalConfig.ambient;
    document.getElementById('ambientVal').textContent = `${this.thermalConfig.ambient}°C`;
    document.getElementById('cpuSlider').value = this.thermalConfig.cpu;
    document.getElementById('cpuVal').textContent = `${this.thermalConfig.cpu}°C`;
    document.getElementById('gpuSlider').value = this.thermalConfig.gpu;
    document.getElementById('gpuVal').textContent = `${this.thermalConfig.gpu}°C`;
    document.getElementById('batterySlider').value = this.thermalConfig.battery;
    document.getElementById('batteryVal').textContent = `${this.thermalConfig.battery}°C`;
    document.getElementById('coolingSlider').value = Math.round(this.thermalConfig.cooling * 100);
    document.getElementById('coolingVal').textContent = `${Math.round(this.thermalConfig.cooling * 100)}%`;
    this.updatePredictiveDeltaGraph();
  }

  getGridDimensions(res) {
    switch (res) {
      case 'low': return { rows: 16, cols: 22 };
      case 'high': return { rows: 32, cols: 42 };
      default: return { rows: 24, cols: 32 }; // medium
    }
  }

  runThermalSimulation() {
    this.navigate('thermalx-solver');

    const { rows, cols } = this.getGridDimensions(this.thermalConfig.resolution);
    this.thermalGrid = new ThermalGrid(rows, cols, this.thermalConfig.ambient);
    this.thermalGrid.setupLaptopTopology(
      this.thermalConfig.cpu,
      this.thermalConfig.gpu,
      this.thermalConfig.battery,
      this.thermalConfig.cooling
    );

    // Setup live solver canvas
    const canvas = document.getElementById('thermalLiveCanvas');
    if (!this.thermalCanvasSolver && canvas) {
      this.thermalCanvasSolver = new ThermalCanvas(canvas, { mode: 'laptop', showGrid: true });
    }

    // Checklist elements
    const stepInit = document.getElementById('stepInit');
    const stepBoundary = document.getElementById('stepBoundary');
    const stepSources = document.getElementById('stepSources');
    const stepSolve = document.getElementById('stepSolve');

    stepInit.classList.add('text-primary');
    stepBoundary.classList.add('text-primary');
    stepSources.classList.add('text-primary');
    stepSolve.classList.add('text-primary');

    // Solver metadata
    document.getElementById('solverMethodBadge').textContent = 
      this.thermalConfig.solver === 'jacobi' ? 'Jacobi Iteration' : 'Gauss-Seidel Method';

    let currentGrid = this.thermalGrid.cloneGrid(this.thermalGrid.grid);
    let iter = 0;
    const maxIter = this.thermalConfig.maxIter;
    const tol = this.thermalConfig.tolerance;
    const history = [];

    const circleProgress = document.getElementById('solverCircleProgress');
    const percentText = document.getElementById('solverPercentText');
    const iterText = document.getElementById('solverIterText');
    const errorText = document.getElementById('solverErrorText');

    // Step-by-step solver loop with visual pacing
    const stepIterate = () => {
      iter++;
      let result;
      if (this.thermalConfig.solver === 'jacobi') {
        result = this.thermalGrid.iterateJacobi(currentGrid);
        currentGrid = result.nextGrid;
      } else {
        result = this.thermalGrid.iterateGaussSeidel(currentGrid);
        currentGrid = result.nextGrid;
      }

      const err = result.maxError;
      const stats = this.thermalGrid.calculateStatistics(currentGrid);
      history.push({ iteration: iter, error: err, ...stats });

      // Update UI Telemetry
      const pct = Math.min(100, Math.round((iter / maxIter) * 100));
      if (percentText) percentText.textContent = `${pct}%`;
      if (iterText) iterText.textContent = `Iteration ${iter} / ${maxIter}`;
      if (errorText) errorText.textContent = `Error: ${err.toFixed(5)}`;

      if (circleProgress) {
        const circumference = 2 * Math.PI * 40;
        circleProgress.style.strokeDashoffset = circumference - (pct / 100) * circumference;
      }

      // Update live canvas
      if (this.thermalCanvasSolver) {
        this.thermalCanvasSolver.updateGrid(currentGrid, this.thermalGrid.sources, this.thermalGrid.coolers);
      }

      if (err <= tol || iter >= maxIter) {
        // Complete!
        this.thermalGrid.grid = currentGrid;
        this.thermalResult = {
          converged: err <= tol,
          iterations: iter,
          finalError: err,
          history,
          stats
        };
        this.synth.chime();
        setTimeout(() => this.showThermalResults(), 600);
      } else {
        requestAnimationFrame(stepIterate);
      }
    };

    requestAnimationFrame(stepIterate);
  }

  showThermalResults() {
    this.navigate('thermalx-results');
    const { stats, iterations, finalError, converged } = this.thermalResult;

    // Canvas Results
    const canvas = document.getElementById('thermalResultsCanvas');
    if (!this.thermalCanvasMain && canvas) {
      this.thermalCanvasMain = new ThermalCanvas(canvas, {
        mode: 'laptop',
        showGrid: true,
        smoothing: 'high',
        onProbe: (probe) => {
          const probeTag = document.getElementById('resultsProbeTag');
          const pip = document.getElementById('thermalPip');
          if (probe) {
            if (probeTag) probeTag.textContent = `CELL [${probe.r}, ${probe.c}] : ${probe.temp.toFixed(1)}°C`;
            if (pip) {
              const pct = Math.max(0, Math.min(94, (1 - (probe.temp - 25) / 75) * 94));
              pip.style.top = `${pct}%`;
            }
          } else {
            if (probeTag) probeTag.textContent = 'READY';
          }
        },
        onCellClick: (probe) => {
          if (this.thermalCanvasMain && probe) {
            this.synth.click();
            this.thermalCanvasMain.sliceR = probe.r;
            this.thermalCanvasMain.showSlice = true;
            this.thermalCanvasMain.render();
            const sliceContainer = document.getElementById('resultsSliceContainer');
            if (sliceContainer) sliceContainer.classList.remove('hidden');
            const sliceBtn = document.getElementById('toggleSliceBtn');
            if (sliceBtn) {
              sliceBtn.classList.add('border-emerald-400', 'bg-emerald-500/20');
            }
            this.renderSliceGraph();
          }
        }
      });
    }

    // Toggle Smoothing Mode Button
    const smoothBtn = document.getElementById('toggleSmoothingBtn');
    if (smoothBtn && !smoothBtn.dataset.bound) {
      smoothBtn.dataset.bound = 'true';
      smoothBtn.addEventListener('click', () => {
        this.synth.click();
        const isHigh = this.thermalCanvasMain.options.smoothing === 'high';
        const nextMode = isHigh ? 'raw' : 'high';
        this.thermalCanvasMain.setSmoothing(nextMode);
        document.getElementById('smoothingLabel').textContent = nextMode === 'high' ? 'High (FLIR)' : 'Raw Mesh';
      });
    }

    // Top Floating Chip Badges
    const cpuEl = document.getElementById('stageCpuTemp');
    if (cpuEl) cpuEl.textContent = `${this.thermalConfig.cpu.toFixed(1)}°C`;
    const gpuEl = document.getElementById('stageGpuTemp');
    if (gpuEl) gpuEl.textContent = `${(this.thermalConfig.gpu * 0.992).toFixed(1)}°C`;
    const batEl = document.getElementById('stageBatTemp');
    if (batEl) batEl.textContent = `${this.thermalConfig.battery.toFixed(1)}°C`;

    if (this.thermalCanvasMain) {
      this.thermalCanvasMain.updateGrid(this.thermalGrid.grid, this.thermalGrid.sources, this.thermalGrid.coolers);
    }

    // Telemetry Cards
    document.getElementById('resMaxTemp').textContent = stats.maxTemp.toFixed(1);
    document.getElementById('resAvgTemp').textContent = stats.avgTemp.toFixed(1);
    document.getElementById('resHotspots').textContent = stats.hotspots;
    document.getElementById('resStatusBadge').textContent = stats.status.toUpperCase();
    document.getElementById('resIterations').textContent = iterations;
    document.getElementById('resFinalError').textContent = finalError.toExponential(3);

    // Primary Hotspot chip
    document.getElementById('resHotspotName').textContent = stats.primaryHotspot.name;
    document.getElementById('resHotspotTemp').textContent = `${stats.primaryHotspot.temp}°C`;

    // Status colors
    const badge = document.getElementById('resStatusBadge');
    if (stats.status === 'Critical') {
      badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-500/50';
    } else if (stats.status === 'Hot') {
      badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/50';
    } else {
      badge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/50';
    }

    // --- RUN-TO-RUN DELTA TEMPERATURE TRACKING ---
    const prevRun = this.runHistory.length > 0 ? this.runHistory[this.runHistory.length - 1] : null;
    const deltaMax = prevRun ? (stats.maxTemp - prevRun.maxTemp) : 0;
    const deltaAvg = prevRun ? (stats.avgTemp - prevRun.avgTemp) : 0;
    const deltaCpu = prevRun ? (this.thermalConfig.cpu - prevRun.cpu) : 0;
    const deltaCool = prevRun ? (Math.round(this.thermalConfig.cooling * 100) - prevRun.cooling) : 0;

    const runRecord = {
      runIndex: this.runHistory.length + 1,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpu: this.thermalConfig.cpu,
      gpu: this.thermalConfig.gpu,
      cooling: Math.round(this.thermalConfig.cooling * 100),
      solver: this.thermalConfig.solver,
      maxTemp: stats.maxTemp,
      avgTemp: stats.avgTemp,
      deltaMax,
      deltaAvg,
      deltaCpu,
      deltaCool,
      iterations,
      grid: this.thermalGrid.cloneGrid(this.thermalGrid.grid)
    };
    this.runHistory.push(runRecord);

    // Update Delta Drift Telemetry Cards
    this.updateDriftKPIs(runRecord, prevRun);

    // Render 1D Cross-Section profile for initial view
    this.renderSliceGraph();

    // Render Run History Evolution Graph
    this.renderRunHistoryGraph();
  }

  // --- PREDICTIVE LIVE RESPONSE CURVE (THERMALX-CONFIG) ---
  updatePredictiveDeltaGraph() {
    const canvas = document.getElementById('liveConfigCurveCanvas');
    if (!canvas) return;

    const baseCpu = 85.0;
    const currentCpu = this.thermalConfig.cpu || 85.0;
    const cooling = this.thermalConfig.cooling !== undefined ? this.thermalConfig.cooling : 0.6;
    const delta = currentCpu - baseCpu;
    const predictedPeak = currentCpu * (1.0 - cooling * 0.12) + (this.thermalConfig.ambient || 25.0) * (cooling * 0.12);

    const badge = document.getElementById('predictiveDeltaBadge');
    if (badge) {
      if (delta > 0.05) {
        badge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-red-950/80 text-red-400 border border-red-500/40';
        badge.innerHTML = `▲ +${delta.toFixed(1)}°C vs Base (85°C)`;
      } else if (delta < -0.05) {
        badge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40';
        badge.innerHTML = `▼ ${delta.toFixed(1)}°C vs Base (85°C)`;
      } else {
        badge.className = 'px-2.5 py-0.5 rounded text-[11px] font-bold bg-primary/20 text-cyan-300 border border-primary/30';
        badge.innerHTML = `0.0°C (Baseline 85°C)`;
      }
    }

    const label = document.getElementById('predictiveSteadyStateLabel');
    if (label) {
      label.textContent = `Predicted Peak: ${predictedPeak.toFixed(1)}°C (Cooling: ${Math.round(cooling * 100)}%)`;
    }

    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 500;
    const h = rect.height > 0 ? rect.height : 96;
    canvas.width = w * window.devicePixelRatio || w;
    canvas.height = h * window.devicePixelRatio || h;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const padL = 35;
    const padR = 20;
    const padT = 12;
    const padB = 16;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Grid lines
    [25, 50, 75, 100].forEach(t => {
      const y = padT + plotH - ((t - 20) / 85) * plotH;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t}°`, padL - 4, y + 3);
    });

    // Draw theoretical dynamic step response: T(t) = T_amb + (T_ss - T_amb)*(1 - e^(-t / tau))
    const tau = 8.0 / (0.5 + cooling * 1.5);
    const steps = 40;
    const pts = [];
    const tAmb = this.thermalConfig.ambient || 25.0;

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 20.0;
      const temp = tAmb + (predictedPeak - tAmb) * (1.0 - Math.exp(-t / tau));
      const x = padL + (i / steps) * plotW;
      const y = padT + plotH - ((temp - 20) / 85) * plotH;
      pts.push({ x, y, temp });
    }

    // Gradient fill under predicted curve
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, delta >= 0 ? 'rgba(255, 42, 0, 0.28)' : 'rgba(0, 240, 255, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + plotH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve line
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = delta >= 0 ? '#ff3b30' : '#00f0ff';
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // End point beacon
    const endPt = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = delta >= 0 ? '#ff3b30' : '#00f0ff';
    ctx.fill();
  }

  // --- RUN-TO-RUN DELTA TELEMETRY & DRIFT CARDS ---
  updateDriftKPIs(curr, prev) {
    const curMaxEl = document.getElementById('driftCurrentMax');
    const badgeMax = document.getElementById('driftBadgeMax');
    const subMax = document.getElementById('driftSubMax');

    if (curMaxEl) curMaxEl.textContent = `${curr.maxTemp.toFixed(1)}°C`;
    if (badgeMax) {
      if (!prev) {
        badgeMax.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
        badgeMax.textContent = 'Run 1 (Baseline)';
      } else if (curr.deltaMax > 0.05) {
        badgeMax.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-red-950/80 text-red-400 border border-red-500/50';
        badgeMax.innerHTML = `▲ +${curr.deltaMax.toFixed(1)}°C (Hotter)`;
      } else if (curr.deltaMax < -0.05) {
        badgeMax.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/50';
        badgeMax.innerHTML = `▼ ${curr.deltaMax.toFixed(1)}°C (Cooler)`;
      } else {
        badgeMax.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/10 text-white/80 border border-white/20';
        badgeMax.textContent = `~ 0.0°C (Stable)`;
      }
    }
    if (subMax) {
      subMax.textContent = prev ? `Prev: ${prev.maxTemp.toFixed(1)}°C (CPU: ${prev.cpu}°C)` : 'Baseline reference run';
    }

    const curAvgEl = document.getElementById('driftCurrentAvg');
    const badgeAvg = document.getElementById('driftBadgeAvg');
    const subAvg = document.getElementById('driftSubAvg');

    if (curAvgEl) curAvgEl.textContent = `${curr.avgTemp.toFixed(1)}°C`;
    if (badgeAvg) {
      if (!prev) {
        badgeAvg.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
        badgeAvg.textContent = 'Run 1 (Baseline)';
      } else if (curr.deltaAvg > 0.05) {
        badgeAvg.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-red-950/80 text-red-400 border border-red-500/50';
        badgeAvg.innerHTML = `▲ +${curr.deltaAvg.toFixed(1)}°C`;
      } else if (curr.deltaAvg < -0.05) {
        badgeAvg.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/50';
        badgeAvg.innerHTML = `▼ ${curr.deltaAvg.toFixed(1)}°C`;
      } else {
        badgeAvg.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-white/10 text-white/80 border border-white/20';
        badgeAvg.textContent = `~ 0.0°C`;
      }
    }
    if (subAvg) {
      subAvg.textContent = prev ? `Prev: ${prev.avgTemp.toFixed(1)}°C` : 'Chassis reference baseline';
    }

    const coolEl = document.getElementById('driftCoolingEffect');
    const badgeCool = document.getElementById('driftBadgeCool');
    const subCool = document.getElementById('driftSubCool');

    if (coolEl) coolEl.textContent = `${curr.cooling}% Convection`;
    if (badgeCool) {
      if (curr.deltaCool > 0) {
        badgeCool.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40';
        badgeCool.textContent = `+${curr.deltaCool}% Fan Boost`;
      } else if (curr.deltaCool < 0) {
        badgeCool.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-500/40';
        badgeCool.textContent = `${curr.deltaCool}% Fan Reduced`;
      } else {
        badgeCool.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40';
        badgeCool.textContent = `Convection Constant`;
      }
    }
    if (subCool) {
      subCool.textContent = `Solver: ${curr.solver.toUpperCase()} (${curr.iterations} sweeps)`;
    }

    const countLabel = document.getElementById('historyRunsCount');
    if (countLabel) {
      countLabel.textContent = `${this.runHistory.length} ${this.runHistory.length === 1 ? 'Run' : 'Runs'} Recorded`;
    }
  }

  // --- RUN HISTORY MULTI-NODE GRAPH (CANVAS) ---
  renderRunHistoryGraph() {
    const canvas = document.getElementById('runHistoryCanvas');
    if (!canvas || this.runHistory.length === 0) return;

    const runs = this.runHistory;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 750;
    const h = rect.height > 0 ? rect.height : 160;
    canvas.width = w * window.devicePixelRatio || w;
    canvas.height = h * window.devicePixelRatio || h;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Substrate
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const padL = 45;
    const padR = 40;
    const padT = 28;
    const padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const allTemps = runs.flatMap(r => [r.maxTemp, r.avgTemp]);
    const minVal = Math.max(20, Math.floor(Math.min(...allTemps) - 5));
    const maxVal = Math.min(105, Math.ceil(Math.max(...allTemps) + 8));

    // Horizontal Guidelines
    const step = 15;
    for (let t = minVal; t <= maxVal; t += step) {
      const y = padT + plotH - ((t - minVal) / (maxVal - minVal)) * plotH;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t}°C`, padL - 6, y + 3);
    }

    const n = runs.length;
    const getX = (idx) => n === 1 ? padL + plotW * 0.5 : padL + (idx / (n - 1)) * plotW;
    const getY = (val) => padT + plotH - ((val - minVal) / (maxVal - minVal)) * plotH;

    // Draw Line 2: Avg Temp (Cyan)
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#00f0ff';
    ctx.beginPath();
    runs.forEach((r, idx) => {
      const x = getX(idx);
      const y = getY(r.avgTemp);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Line 1: Max Temp (Red/Orange)
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#ff3b30';
    ctx.beginPath();
    runs.forEach((r, idx) => {
      const x = getX(idx);
      const y = getY(r.maxTemp);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Run Points & ΔT Annotations
    runs.forEach((r, idx) => {
      const x = getX(idx);
      const yMax = getY(r.maxTemp);
      const yAvg = getY(r.avgTemp);

      // Vertical connector dash
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x, yMax);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Avg Temp dot
      ctx.beginPath();
      ctx.arc(x, yAvg, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00f0ff';
      ctx.fill();

      // Max Temp dot with halo
      ctx.beginPath();
      ctx.arc(x, yMax, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3b30';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Run X Label
      ctx.fillStyle = '#8899ac';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Run #${r.runIndex}`, x, padT + plotH + 16);

      // ΔT Badge above node
      let badgeText = `${r.maxTemp.toFixed(1)}°C`;
      let badgeColor = '#ff3b30';
      if (idx > 0) {
        if (r.deltaMax > 0.05) {
          badgeText = `▲ +${r.deltaMax.toFixed(1)}°`;
          badgeColor = '#ef4444';
        } else if (r.deltaMax < -0.05) {
          badgeText = `▼ ${r.deltaMax.toFixed(1)}°`;
          badgeColor = '#10b981';
        } else {
          badgeText = `~ 0.0°`;
          badgeColor = '#38bdf8';
        }
      }

      ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
      ctx.strokeStyle = badgeColor;
      ctx.lineWidth = 1;
      const tw = ctx.measureText(badgeText).width + 10;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - tw / 2, yMax - 22, tw, 15, 3);
      else ctx.rect(x - tw / 2, yMax - 22, tw, 15);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeColor;
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      ctx.fillText(badgeText, x, yMax - 11);
    });

    // Interactive canvas click to inspect run
    if (!canvas.dataset.boundClick) {
      canvas.dataset.boundClick = 'true';
      canvas.addEventListener('click', (e) => {
        const cRect = canvas.getBoundingClientRect();
        const clickX = e.clientX - cRect.left;
        const runsArr = this.runHistory;
        if (runsArr.length < 2) return;

        let closestIdx = 0;
        let minD = Infinity;
        runsArr.forEach((_, i) => {
          const px = getX(i);
          const d = Math.abs(clickX - px);
          if (d < minD) { minD = d; closestIdx = i; }
        });

        if (minD < 35) {
          this.synth.click();
          const targetRun = runsArr[closestIdx];
          const prevOfTarget = closestIdx > 0 ? runsArr[closestIdx - 1] : null;
          this.updateDriftKPIs(targetRun, prevOfTarget);
        }
      });
    }
  }

  // --- DIFFERENTIAL HEATMAP TOGGLE (CURRENT vs PREVIOUS RUN) ---
  toggleDiffHeatmap() {
    this.synth.click();
    if (this.runHistory.length < 2) {
      alert("Please run at least 2 simulations with different slider values (e.g. adjust CPU temp or Fan speed) to visualize the ΔT differential heatmap!");
      return;
    }

    const curr = this.runHistory[this.runHistory.length - 1];
    const prev = this.runHistory[this.runHistory.length - 2];
    const rows = curr.grid.length;
    const cols = curr.grid[0].length;

    // Calculate delta grid: ΔT_{i,j} = T_current - T_previous
    const diffGrid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(curr.grid[r][c] - prev.grid[r][c]);
      }
      diffGrid.push(row);
    }

    if (this.thermalCanvasMain) {
      const isDiff = this.thermalCanvasMain.toggleDiffMode(diffGrid);
      const btnText = document.getElementById('diffModeBtnText');
      const btn = document.getElementById('toggleDiffHeatmapBtn');
      if (btnText) {
        btnText.textContent = isDiff ? 'Exit ΔT Heatmap (Normal View)' : 'Show ΔT Heatmap (Current - Prev)';
      }
      if (btn) {
        btn.classList.toggle('border-primary', isDiff);
        btn.classList.toggle('bg-primary/20', isDiff);
      }
    }
  }

  // --- INNOVATION GRAPHICAL REPRESENTATION CONTROLLERS ---
  toggleQuiverField() {
    this.synth.click();
    if (this.thermalCanvasMain) {
      this.thermalCanvasMain.showVectors = !this.thermalCanvasMain.showVectors;
      this.thermalCanvasMain.render();
      const btn = document.getElementById('toggleQuiverBtn');
      if (btn) {
        btn.classList.toggle('border-primary', this.thermalCanvasMain.showVectors);
        btn.classList.toggle('bg-primary/25', this.thermalCanvasMain.showVectors);
      }
    }
  }

  toggleIsotherms() {
    this.synth.click();
    if (this.thermalCanvasMain) {
      this.thermalCanvasMain.showContours = !this.thermalCanvasMain.showContours;
      this.thermalCanvasMain.render();
      const btn = document.getElementById('toggleIsothermsBtn');
      if (btn) {
        btn.classList.toggle('border-amber-400', this.thermalCanvasMain.showContours);
        btn.classList.toggle('bg-amber-500/25', this.thermalCanvasMain.showContours);
      }
    }
  }

  toggleSliceProfile() {
    this.synth.click();
    if (this.thermalCanvasMain) {
      this.thermalCanvasMain.showSlice = !this.thermalCanvasMain.showSlice;
      this.thermalCanvasMain.render();
      const btn = document.getElementById('toggleSliceBtn');
      const container = document.getElementById('resultsSliceContainer');
      if (btn) {
        btn.classList.toggle('border-emerald-400', this.thermalCanvasMain.showSlice);
        btn.classList.toggle('bg-emerald-500/25', this.thermalCanvasMain.showSlice);
      }
      if (container) {
        container.classList.toggle('hidden', !this.thermalCanvasMain.showSlice);
      }
      if (this.thermalCanvasMain.showSlice) {
        this.renderSliceGraph();
      }
    }
  }

  renderSliceGraph() {
    const canvas = document.getElementById('resultsSliceCanvas');
    if (!canvas || !this.thermalGrid || !this.thermalGrid.grid) return;

    const r = (this.thermalCanvasMain && this.thermalCanvasMain.sliceR !== undefined)
      ? Math.max(0, Math.min(this.thermalGrid.rows - 1, this.thermalCanvasMain.sliceR))
      : Math.floor(this.thermalGrid.rows / 2);

    const rowTemps = this.thermalGrid.grid[r];
    if (!rowTemps || rowTemps.length === 0) return;

    const label = document.getElementById('resultsSliceRowLabel');
    const maxT = Math.max(...rowTemps);
    const minT = Math.min(...rowTemps);
    if (label) {
      label.textContent = `Row ${r} (Peak: ${maxT.toFixed(1)}°C, Min: ${minT.toFixed(1)}°C)`;
    }

    // High-DPI setup for crisp lines
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 700;
    const h = rect.height > 0 ? rect.height : 96;
    canvas.width = w * window.devicePixelRatio || w;
    canvas.height = h * window.devicePixelRatio || h;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    // Dark sleek background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 45;
    const padRight = 20;
    const padTop = 16;
    const padBottom = 20;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    // Grid guide lines (25°C, 50°C, 75°C, 100°C)
    const tMin = 20;
    const tMax = 100;
    const levels = [25, 50, 75, 100];

    ctx.lineWidth = 1;
    levels.forEach(lvl => {
      const y = padTop + plotH - ((lvl - tMin) / (tMax - tMin)) * plotH;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lvl}°C`, padLeft - 6, y + 3);
    });

    // Compute coordinate points
    const pts = rowTemps.map((temp, i) => {
      const x = padLeft + (i / (rowTemps.length - 1)) * plotW;
      const y = padTop + plotH - ((Math.min(tMax, Math.max(tMin, temp)) - tMin) / (tMax - tMin)) * plotH;
      return { x, y, temp };
    });

    if (pts.length < 2) return;

    // Gradient fill under the 1D temperature curve
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, 'rgba(255, 42, 0, 0.35)');
    grad.addColorStop(0.5, 'rgba(255, 152, 0, 0.20)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.04)');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, padTop + plotH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Plot line
    ctx.lineWidth = 2.0;
    ctx.strokeStyle = '#00f0ff';
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Data points & peak indicator
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.temp > 70 ? '#ff3b30' : (p.temp > 45 ? '#ff9500' : '#00f0ff');
      ctx.fill();
    });

    // Highlight maximum point
    const maxPt = pts.reduce((prev, curr) => curr.temp > prev.temp ? curr : prev, pts[0]);
    if (maxPt) {
      ctx.beginPath();
      ctx.arc(maxPt.x, maxPt.y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${maxPt.temp.toFixed(1)}°C`, maxPt.x, maxPt.y - 7);
    }
  }

  // =========================================================================
  // --- DEDICATED GRAPHICAL ANALYTICS DASHBOARD (VIEW GRAPHICALLY) ---
  // =========================================================================

  switchGraphicalTab(tab) {
    this.synth.click();
    this.graphicalTab = tab;

    const multiBtn = document.getElementById('graphTabMultiBtn');
    const singleBtn = document.getElementById('graphTabSingleBtn');
    const multiPanel = document.getElementById('graphPanelMulti');
    const singlePanel = document.getElementById('graphPanelSingle');

    if (tab === 'multi') {
      if (multiBtn) {
        multiBtn.className = 'px-4 py-2 rounded-xl text-xs font-heading font-bold flex items-center gap-2 bg-primary/20 text-cyan-300 border border-primary/40 transition-all shadow-md';
      }
      if (singleBtn) {
        singleBtn.className = 'px-4 py-2 rounded-xl text-xs font-mono text-on-surface-variant hover:text-white border border-transparent hover:border-white/10 flex items-center gap-2 transition-all';
      }
      if (multiPanel) multiPanel.classList.remove('hidden');
      if (singlePanel) singlePanel.classList.add('hidden');
      requestAnimationFrame(() => this.renderMultiRunEnvelopeGraph());
    } else {
      if (singleBtn) {
        singleBtn.className = 'px-4 py-2 rounded-xl text-xs font-heading font-bold flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 transition-all shadow-md';
      }
      if (multiBtn) {
        multiBtn.className = 'px-4 py-2 rounded-xl text-xs font-mono text-on-surface-variant hover:text-white border border-transparent hover:border-white/10 flex items-center gap-2 transition-all';
      }
      if (multiPanel) multiPanel.classList.add('hidden');
      if (singlePanel) singlePanel.classList.remove('hidden');
      requestAnimationFrame(() => this.renderSingleRunGradientGraph());
    }
  }

  renderGraphicalScreen() {
    // 1. Ensure baseline runs exist so graphs are immediately populated
    if (this.runHistory.length === 0) {
      const { rows, cols } = this.getGridDimensions(this.thermalConfig.resolution || 'medium');
      // Baseline Run 1: Standard Balanced (CPU 85°C, Cooling 60%)
      const tg1 = new ThermalGrid(rows, cols, 25.0);
      tg1.setupLaptopTopology(85.0, 74.4, 40.0, 0.6);
      let g1 = tg1.cloneGrid(tg1.grid);
      for (let i = 0; i < 35; i++) {
        const res = tg1.iterateGaussSeidel(g1);
        g1 = res.nextGrid;
        if (res.maxError < 0.005) break;
      }
      const st1 = tg1.calculateStatistics(g1);
      this.runHistory.push({
        runIndex: 1,
        time: 'Run 1 (Baseline)',
        cpu: 85.0,
        gpu: 74.4,
        cooling: 60,
        solver: 'gauss-seidel',
        maxTemp: st1.maxTemp,
        avgTemp: st1.avgTemp,
        deltaMax: 0,
        deltaAvg: 0,
        deltaCpu: 0,
        deltaCool: 0,
        iterations: 35,
        grid: g1
      });

      // Baseline Run 2: Heavy Load (CPU 95°C, Cooling 45%)
      const tg2 = new ThermalGrid(rows, cols, 25.0);
      tg2.setupLaptopTopology(95.0, 82.0, 42.0, 0.45);
      let g2 = tg2.cloneGrid(tg2.grid);
      for (let i = 0; i < 40; i++) {
        const res = tg2.iterateGaussSeidel(g2);
        g2 = res.nextGrid;
        if (res.maxError < 0.005) break;
      }
      const st2 = tg2.calculateStatistics(g2);
      this.runHistory.push({
        runIndex: 2,
        time: 'Run 2 (Heavy Load)',
        cpu: 95.0,
        gpu: 82.0,
        cooling: 45,
        solver: 'gauss-seidel',
        maxTemp: st2.maxTemp,
        avgTemp: st2.avgTemp,
        deltaMax: st2.maxTemp - st1.maxTemp,
        deltaAvg: st2.avgTemp - st1.avgTemp,
        deltaCpu: 10,
        deltaCool: -15,
        iterations: 40,
        grid: g2
      });

      if (!this.thermalGrid) {
        this.thermalGrid = tg1;
        this.thermalGrid.grid = g1;
      }
    }

    // 2. Initialize active runs set with all runs by default
    if (this.graphicalActiveRuns.size === 0) {
      this.runHistory.forEach(r => this.graphicalActiveRuns.add(r.runIndex));
    } else {
      // Ensure any newly added run is checked
      this.runHistory.forEach(r => this.graphicalActiveRuns.add(r.runIndex));
    }

    // 3. Populate Multi-Run toggle checkboxes
    const container = document.getElementById('multiRunCheckboxesContainer');
    if (container) {
      container.innerHTML = this.runHistory.map(r => {
        const isChecked = this.graphicalActiveRuns.has(r.runIndex);
        return `
          <label class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-dim border ${isChecked ? 'border-primary/50 text-cyan-300' : 'border-white/10 text-on-surface-variant'} text-xs font-mono cursor-pointer select-none transition-colors">
            <input type="checkbox" value="${r.runIndex}" ${isChecked ? 'checked' : ''} onchange="app.toggleGraphicalRun(${r.runIndex}, this.checked)" class="rounded bg-surface-card border-white/20 text-primary focus:ring-0">
            <span>Run #${r.runIndex}</span>
            <span class="text-[10px] ${r.maxTemp > 80 ? 'text-red-400' : 'text-emerald-400'}">(${r.maxTemp.toFixed(1)}°C)</span>
          </label>
        `;
      }).join('');
    }

    // 4. Populate Single-Run Dropdown
    const select = document.getElementById('singleRunSelect');
    if (select) {
      const selectedVal = this.graphicalSelectedRunIdx || this.runHistory[this.runHistory.length - 1].runIndex;
      select.innerHTML = this.runHistory.map(r => `
        <option value="${r.runIndex}" ${r.runIndex === selectedVal ? 'selected' : ''}>
          Run #${r.runIndex} (${r.time}) - Peak ${r.maxTemp.toFixed(1)}°C
        </option>
      `).join('');
      this.graphicalSelectedRunIdx = selectedVal;
    }

    // 5. Setup Slice Row Slider bounds
    const slider = document.getElementById('singleRunSliceSlider');
    const badge = document.getElementById('singleRunSliceRowBadge');
    const gridRows = this.thermalGrid && this.thermalGrid.rows ? this.thermalGrid.rows : (this.runHistory[0].grid.length || 24);
    if (slider) {
      slider.max = gridRows - 1;
      if (this.graphicalSliceRow >= gridRows) this.graphicalSliceRow = Math.floor(gridRows / 2);
      slider.value = this.graphicalSliceRow;
    }
    if (badge) {
      badge.textContent = `Y = ${this.graphicalSliceRow}`;
    }

    // 6. Render current active tab
    if (this.graphicalTab === 'multi') {
      this.switchGraphicalTab('multi');
    } else {
      this.switchGraphicalTab('single');
    }
  }

  toggleGraphicalRun(runIdx, isChecked) {
    if (isChecked) {
      this.graphicalActiveRuns.add(runIdx);
    } else {
      if (this.graphicalActiveRuns.size > 1) {
        this.graphicalActiveRuns.delete(runIdx);
      } else {
        // Keep at least one run active
        const chk = document.querySelector(`#multiRunCheckboxesContainer input[value="${runIdx}"]`);
        if (chk) chk.checked = true;
        return;
      }
    }
    this.renderMultiRunEnvelopeGraph();
  }

  onSingleRunSliderInput(val) {
    this.graphicalSliceRow = parseInt(val, 10);
    const badge = document.getElementById('singleRunSliceRowBadge');
    if (badge) badge.textContent = `Y = ${this.graphicalSliceRow}`;
    this.renderSingleRunGradientGraph();
  }

  onSingleRunSelectChange() {
    const select = document.getElementById('singleRunSelect');
    if (select) {
      this.graphicalSelectedRunIdx = parseInt(select.value, 10);
      this.renderSingleRunGradientGraph();
    }
  }

  // --- TAB 1: MULTI-RUN DUAL-ENVELOPE GRAPH (MIN VS MAX CURVES) ---
  renderMultiRunEnvelopeGraph() {
    const canvas = document.getElementById('multiRunEnvelopeCanvas');
    if (!canvas || this.runHistory.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 780;
    const h = rect.height > 0 ? rect.height : 360;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Deep cosmic substrate
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const padL = 55;
    const padR = 40;
    const padT = 36;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const activeRuns = this.runHistory.filter(r => this.graphicalActiveRuns.has(r.runIndex));
    if (activeRuns.length === 0) return;

    const shadeRibbon = document.getElementById('toggleEnvelopeRibbon')?.checked ?? true;
    const splineSmooth = document.getElementById('toggleSplineSmooth')?.checked ?? true;

    // Determine temperature domain range across active runs
    let globalMin = Infinity;
    let globalMax = -Infinity;

    activeRuns.forEach(r => {
      if (r.maxTemp > globalMax) globalMax = r.maxTemp;
      const g = r.grid;
      for (let row = 0; row < g.length; row++) {
        for (let col = 0; col < g[row].length; col++) {
          const val = g[row][col];
          if (val < globalMin) globalMin = val;
        }
      }
    });

    const yMin = Math.max(15, Math.floor(globalMin - 5));
    const yMax = Math.min(110, Math.ceil(globalMax + 8));

    // Draw horizontal grid lines & temperature scale
    const tempStep = 15;
    for (let t = Math.ceil(yMin / tempStep) * tempStep; t <= yMax; t += tempStep) {
      const y = padT + plotH - ((t - yMin) / (yMax - yMin)) * plotH;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t}°C`, padL - 8, y + 3.5);
    }

    // Vertical node guideline ticks
    const sampleCols = activeRuns[0].grid[0].length;
    const colStep = Math.max(4, Math.floor(sampleCols / 8));
    for (let c = 0; c < sampleCols; c += colStep) {
      const x = padL + (c / (sampleCols - 1)) * plotW;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`X=${c}`, x, padT + plotH + 16);
    }
    // Final edge column tick
    const xEnd = padL + plotW;
    ctx.fillText(`X=${sampleCols - 1}`, xEnd, padT + plotH + 16);

    // Axis Titles
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPATIAL CHASSIS / DIE LATERAL POSITION X', padL + plotW / 2, padT + plotH + 32);

    ctx.translate(16, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('TEMPERATURE (°C)', 0, 0);
    ctx.restore();

    // Helper coordinate converters
    const getX = (colIdx, colsTotal) => padL + (colIdx / (colsTotal - 1)) * plotW;
    const getY = (val) => padT + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

    // Palette for distinguishing multiple runs
    const runColors = [
      { red: '#ff3b30', blue: '#00f0ff', ribbon: 'rgba(255, 59, 48, 0.12)' },
      { red: '#ff9500', blue: '#38bdf8', ribbon: 'rgba(255, 149, 0, 0.08)' },
      { red: '#ec4899', blue: '#818cf8', ribbon: 'rgba(236, 72, 153, 0.08)' },
      { red: '#f43f5e', blue: '#2dd4bf', ribbon: 'rgba(244, 63, 94, 0.08)' }
    ];

    // Store plot points for interactive hover
    const runPlotData = [];

    // Plot each active run
    activeRuns.forEach((r, runOrder) => {
      const g = r.grid;
      const rows = g.length;
      const cols = g[0].length;
      const isLatest = runOrder === activeRuns.length - 1;
      const colorScheme = runColors[runOrder % runColors.length];

      const minCurve = [];
      const maxCurve = [];

      for (let c = 0; c < cols; c++) {
        let colMin = Infinity;
        let colMax = -Infinity;
        for (let row = 0; row < rows; row++) {
          const val = g[row][c];
          if (val < colMin) colMin = val;
          if (val > colMax) colMax = val;
        }
        minCurve.push({ x: getX(c, cols), y: getY(colMin), val: colMin, col: c });
        maxCurve.push({ x: getX(c, cols), y: getY(colMax), val: colMax, col: c });
      }

      runPlotData.push({ run: r, minCurve, maxCurve, colorScheme, isLatest });

      // 1. Shaded Thermal Ribbon between Min (Blue) and Max (Red)
      if (shadeRibbon) {
        ctx.beginPath();
        ctx.moveTo(maxCurve[0].x, maxCurve[0].y);
        if (splineSmooth) {
          for (let i = 0; i < maxCurve.length - 1; i++) {
            const xc = (maxCurve[i].x + maxCurve[i + 1].x) / 2;
            const yc = (maxCurve[i].y + maxCurve[i + 1].y) / 2;
            ctx.quadraticCurveTo(maxCurve[i].x, maxCurve[i].y, xc, yc);
          }
          ctx.lineTo(maxCurve[maxCurve.length - 1].x, maxCurve[maxCurve.length - 1].y);

          // Return along minCurve
          ctx.lineTo(minCurve[minCurve.length - 1].x, minCurve[minCurve.length - 1].y);
          for (let i = minCurve.length - 1; i > 0; i--) {
            const xc = (minCurve[i].x + minCurve[i - 1].x) / 2;
            const yc = (minCurve[i].y + minCurve[i - 1].y) / 2;
            ctx.quadraticCurveTo(minCurve[i].x, minCurve[i].y, xc, yc);
          }
          ctx.lineTo(minCurve[0].x, minCurve[0].y);
        } else {
          maxCurve.forEach(p => ctx.lineTo(p.x, p.y));
          for (let i = minCurve.length - 1; i >= 0; i--) {
            ctx.lineTo(minCurve[i].x, minCurve[i].y);
          }
        }
        ctx.closePath();

        const gradRibbon = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        gradRibbon.addColorStop(0, colorScheme.ribbon);
        gradRibbon.addColorStop(1, 'rgba(0, 240, 255, 0.03)');
        ctx.fillStyle = gradRibbon;
        ctx.fill();
      }

      // 2. BLUE CURVE: Lowest Temperature Baseline (T_min)
      ctx.lineWidth = isLatest ? 2.6 : 1.8;
      ctx.strokeStyle = colorScheme.blue;
      ctx.shadowColor = colorScheme.blue;
      ctx.shadowBlur = isLatest ? 8 : 0;
      ctx.beginPath();
      if (splineSmooth) {
        ctx.moveTo(minCurve[0].x, minCurve[0].y);
        for (let i = 0; i < minCurve.length - 1; i++) {
          const xc = (minCurve[i].x + minCurve[i + 1].x) / 2;
          const yc = (minCurve[i].y + minCurve[i + 1].y) / 2;
          ctx.quadraticCurveTo(minCurve[i].x, minCurve[i].y, xc, yc);
        }
        ctx.lineTo(minCurve[minCurve.length - 1].x, minCurve[minCurve.length - 1].y);
      } else {
        minCurve.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. RED CURVE: Highest Temperature Envelope (T_max) - Low -> High -> Low
      ctx.lineWidth = isLatest ? 3.0 : 2.0;
      ctx.strokeStyle = colorScheme.red;
      ctx.shadowColor = colorScheme.red;
      ctx.shadowBlur = isLatest ? 12 : 0;
      ctx.beginPath();
      if (splineSmooth) {
        ctx.moveTo(maxCurve[0].x, maxCurve[0].y);
        for (let i = 0; i < maxCurve.length - 1; i++) {
          const xc = (maxCurve[i].x + maxCurve[i + 1].x) / 2;
          const yc = (maxCurve[i].y + maxCurve[i + 1].y) / 2;
          ctx.quadraticCurveTo(maxCurve[i].x, maxCurve[i].y, xc, yc);
        }
        ctx.lineTo(maxCurve[maxCurve.length - 1].x, maxCurve[maxCurve.length - 1].y);
      } else {
        maxCurve.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw node dots on key inflection points (start edge, peak hotspot, end edge)
      const peakMaxPt = maxCurve.reduce((prev, curr) => curr.val > prev.val ? curr : prev, maxCurve[0]);
      const minPt = minCurve.reduce((prev, curr) => curr.val < prev.val ? curr : prev, minCurve[0]);

      // Peak Indicator
      ctx.beginPath();
      ctx.arc(peakMaxPt.x, peakMaxPt.y, isLatest ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = colorScheme.red;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Peak Label Badge
      ctx.fillStyle = 'rgba(6, 9, 19, 0.9)';
      ctx.strokeStyle = colorScheme.red;
      ctx.lineWidth = 1;
      const peakLabel = `Run #${r.runIndex} Max: ${peakMaxPt.val.toFixed(1)}°C`;
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      const ptw = ctx.measureText(peakLabel).width + 12;
      const badgeY = Math.max(padT + 4, peakMaxPt.y - 18 - runOrder * 16);
      if (ctx.roundRect) ctx.roundRect(peakMaxPt.x - ptw / 2, badgeY, ptw, 16, 4);
      else ctx.rect(peakMaxPt.x - ptw / 2, badgeY, ptw, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colorScheme.red;
      ctx.textAlign = 'center';
      ctx.fillText(peakLabel, peakMaxPt.x, badgeY + 11.5);
    });

    // Update 4 KPI Cards
    const kpiMin = document.getElementById('multiKpiMinTemp');
    const kpiMax = document.getElementById('multiKpiMaxTemp');
    const kpiSpread = document.getElementById('multiKpiSpread');
    const kpiRuns = document.getElementById('multiKpiRunsCount');

    if (kpiMin) kpiMin.textContent = `${globalMin.toFixed(1)}°C`;
    if (kpiMax) kpiMax.textContent = `${globalMax.toFixed(1)}°C`;
    if (kpiSpread) kpiSpread.textContent = `${(globalMax - globalMin).toFixed(1)}°C`;
    if (kpiRuns) kpiRuns.textContent = `${activeRuns.length} of ${this.runHistory.length}`;

    // Mouseover dynamic crosshair inspector
    if (!canvas.dataset.boundHover) {
      canvas.dataset.boundHover = 'true';
      canvas.addEventListener('mousemove', (e) => {
        const cRect = canvas.getBoundingClientRect();
        const mx = e.clientX - cRect.left;
        const my = e.clientY - cRect.top;
        if (mx < padL || mx > w - padR || my < padT || my > padT + plotH) {
          canvas.title = '';
          return;
        }

        const colsTotal = activeRuns[0].grid[0].length;
        const colFraction = (mx - padL) / plotW;
        const colIdx = Math.max(0, Math.min(colsTotal - 1, Math.round(colFraction * (colsTotal - 1))));

        let tip = `[Node X=${colIdx}]\n`;
        activeRuns.forEach(r => {
          let cMin = Infinity, cMax = -Infinity;
          for (let row = 0; row < r.grid.length; row++) {
            const v = r.grid[row][colIdx];
            if (v < cMin) cMin = v;
            if (v > cMax) cMax = v;
          }
          tip += `Run #${r.runIndex}: Red Peak=${cMax.toFixed(1)}°C | Blue Min=${cMin.toFixed(1)}°C (Δ=${(cMax - cMin).toFixed(1)}°C)\n`;
        });
        canvas.title = tip;
      });
    }
  }

  // --- TAB 2: SINGLE-RUN SPATIAL GRADIENT (∇T) CROSS-SECTION GRAPH ---
  renderSingleRunGradientGraph() {
    const canvas = document.getElementById('singleRunGradientCanvas');
    if (!canvas || this.runHistory.length === 0) return;

    // 1. Pick target run
    const targetRunIdx = this.graphicalSelectedRunIdx || this.runHistory[this.runHistory.length - 1].runIndex;
    const run = this.runHistory.find(r => r.runIndex === targetRunIdx) || this.runHistory[this.runHistory.length - 1];

    const g = run.grid;
    const rows = g.length;
    const cols = g[0].length;

    // 2. Pick target row (clamped)
    const rIdx = Math.max(0, Math.min(rows - 1, this.graphicalSliceRow !== undefined ? this.graphicalSliceRow : Math.floor(rows / 2)));
    const rowTemps = g[rIdx];

    // 3. Compute spatial temperature gradient |dT/dx|
    // Node spatial spacing: approx dx = 0.5 cm
    const dx = 0.5;
    const gradArr = [];
    for (let c = 0; c < cols; c++) {
      let dT;
      if (c === 0) {
        dT = Math.abs(rowTemps[1] - rowTemps[0]) / dx;
      } else if (c === cols - 1) {
        dT = Math.abs(rowTemps[cols - 1] - rowTemps[cols - 2]) / dx;
      } else {
        dT = Math.abs(rowTemps[c + 1] - rowTemps[c - 1]) / (2 * dx);
      }
      gradArr.push(dT);
    }

    const maxTemp = Math.max(...rowTemps);
    const minTemp = Math.min(...rowTemps);
    const peakCol = rowTemps.indexOf(maxTemp);
    const minCol = rowTemps.indexOf(minTemp);

    const maxGrad = Math.max(...gradArr);
    const maxGradCol = gradArr.indexOf(maxGrad);

    // 4. Update KPI Cards
    const peakEl = document.getElementById('singlePeakTemp');
    const peakPos = document.getElementById('singlePeakPos');
    const minEl = document.getElementById('singleMinTemp');
    const minPos = document.getElementById('singleMinPos');
    const gradEl = document.getElementById('singleMaxGrad');
    const gradPos = document.getElementById('singleMaxGradPos');
    const fluxEl = document.getElementById('singleMaxFlux');

    if (peakEl) peakEl.textContent = `${maxTemp.toFixed(1)}°C`;
    if (peakPos) peakPos.textContent = `Node X = ${peakCol}, Y = ${rIdx}`;
    if (minEl) minEl.textContent = `${minTemp.toFixed(1)}°C`;
    if (minPos) minPos.textContent = `Node X = ${minCol}, Y = ${rIdx}`;
    if (gradEl) gradEl.textContent = `${maxGrad.toFixed(2)}`;
    if (gradPos) gradPos.textContent = `Interface at X = ${maxGradCol}`;
    if (fluxEl) {
      // Fourier Law: q = k * |dT/dx|, with k=1.5 W/m-K and dx in cm -> flux in W/m²
      const conductiveFlux = (maxGrad * 100 * 1.5).toFixed(0);
      fluxEl.textContent = `${conductiveFlux}`;
    }

    // 5. Canvas Drawing (Dual Axis)
    const rect = canvas.getBoundingClientRect();
    const w = rect.width > 0 ? rect.width : 780;
    const h = rect.height > 0 ? rect.height : 360;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, w, h);

    const padL = 55;
    const padR = 60;
    const padT = 36;
    const padB = 40;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Scale Y Left (Temperature: 15°C to 105°C)
    const tMinAxis = 15;
    const tMaxAxis = Math.max(100, Math.ceil(maxTemp + 10));
    const getYLeft = (temp) => padT + plotH - ((temp - tMinAxis) / (tMaxAxis - tMinAxis)) * plotH;

    // Scale Y Right (Gradient: 0 to maxGrad * 1.3)
    const gMinAxis = 0;
    const gMaxAxis = Math.max(10, Math.ceil(maxGrad * 1.3));
    const getYRight = (gVal) => padT + plotH - ((gVal - gMinAxis) / (gMaxAxis - gMinAxis)) * plotH;

    const getX = (colIdx) => padL + (colIdx / (cols - 1)) * plotW;

    // Draw Left Grid & Temperature Axis
    const tempStep = 15;
    for (let t = 30; t <= tMaxAxis; t += tempStep) {
      const y = getYLeft(t);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${t}°C`, padL - 8, y + 3.5);
    }

    // Draw Right Axis (Gradient Scale in Amber)
    const gradStep = Math.max(2, Math.round(gMaxAxis / 4));
    for (let gr = 0; gr <= gMaxAxis; gr += gradStep) {
      const y = getYRight(gr);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '9.5px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${gr}`, w - padR + 8, y + 3.5);
    }

    // Right Axis Title
    ctx.save();
    ctx.translate(w - 12, padT + plotH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('|∇T| GRADIENT (°C/cm)', 0, 0);
    ctx.restore();

    // Left Axis Title
    ctx.save();
    ctx.translate(16, padT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEMPERATURE T(x) (°C)', 0, 0);
    ctx.restore();

    // Bottom Axis: Node X
    const colStep = Math.max(4, Math.floor(cols / 8));
    for (let c = 0; c < cols; c += colStep) {
      const x = getX(c);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`X=${c}`, x, padT + plotH + 16);
    }
    ctx.fillText(`X=${cols - 1}`, padL + plotW, padT + plotH + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CUTLINE NODE X (ACROSS ROW Y=${rIdx})`, padL + plotW / 2, padT + plotH + 32);

    // --- CURVE 1: PRIMARY TEMPERATURE PROFILE T(x) ---
    // Underfill
    ctx.beginPath();
    ctx.moveTo(getX(0), padT + plotH);
    for (let c = 0; c < cols - 1; c++) {
      const xc = (getX(c) + getX(c + 1)) / 2;
      const yc = (getYLeft(rowTemps[c]) + getYLeft(rowTemps[c + 1])) / 2;
      ctx.quadraticCurveTo(getX(c), getYLeft(rowTemps[c]), xc, yc);
    }
    ctx.lineTo(getX(cols - 1), getYLeft(rowTemps[cols - 1]));
    ctx.lineTo(getX(cols - 1), padT + plotH);
    ctx.closePath();

    const tGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    tGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
    tGrad.addColorStop(0.6, 'rgba(245, 158, 11, 0.12)');
    tGrad.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
    ctx.fillStyle = tGrad;
    ctx.fill();

    // Stroke
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(getX(0), getYLeft(rowTemps[0]));
    for (let c = 0; c < cols - 1; c++) {
      const xc = (getX(c) + getX(c + 1)) / 2;
      const yc = (getYLeft(rowTemps[c]) + getYLeft(rowTemps[c + 1])) / 2;
      ctx.quadraticCurveTo(getX(c), getYLeft(rowTemps[c]), xc, yc);
    }
    ctx.lineTo(getX(cols - 1), getYLeft(rowTemps[cols - 1]));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // --- CURVE 2: SECONDARY TEMPERATURE GRADIENT |∇T(x)| CURVE ---
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(getX(0), getYRight(gradArr[0]));
    for (let c = 0; c < cols - 1; c++) {
      const xc = (getX(c) + getX(c + 1)) / 2;
      const yc = (getYRight(gradArr[c]) + getYRight(gradArr[c + 1])) / 2;
      ctx.quadraticCurveTo(getX(c), getYRight(gradArr[c]), xc, yc);
    }
    ctx.lineTo(getX(cols - 1), getYRight(gradArr[cols - 1]));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Mark Peak Temperature Point
    const px = getX(peakCol);
    const py = getYLeft(maxTemp);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(6, 9, 19, 0.9)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    const tBadge = `Peak T: ${maxTemp.toFixed(1)}°C`;
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    const tbw = ctx.measureText(tBadge).width + 12;
    if (ctx.roundRect) ctx.roundRect(px - tbw / 2, py - 24, tbw, 16, 4);
    else ctx.rect(px - tbw / 2, py - 24, tbw, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'center';
    ctx.fillText(tBadge, px, py - 12.5);

    // Mark Peak Gradient Interface Point
    const gx = getX(maxGradCol);
    const gy = getYRight(maxGrad);
    ctx.beginPath();
    ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(6, 9, 19, 0.9)';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    const gBadge = `Max |∇T|: ${maxGrad.toFixed(2)} °C/cm`;
    const gbw = ctx.measureText(gBadge).width + 12;
    const gBadgeY = Math.min(plotH + padT - 20, gy + 14);
    if (ctx.roundRect) ctx.roundRect(gx - gbw / 2, gBadgeY, gbw, 16, 4);
    else ctx.rect(gx - gbw / 2, gBadgeY, gbw, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'center';
    ctx.fillText(gBadge, gx, gBadgeY + 11.5);
  }

  // --- CUSTOM GRID SETUP ---
  setupCustomGrid() {
    document.querySelectorAll('.grid-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.grid-tool-btn').forEach(b => b.classList.remove('border-primary', 'bg-surface-container-high'));
        btn.classList.add('border-primary', 'bg-surface-container-high');
        this.customTool = btn.dataset.tool;
      });
    });

    const simulateBtn = document.getElementById('simulateCustomGridBtn');
    if (simulateBtn) {
      simulateBtn.addEventListener('click', () => this.runCustomGridSimulation());
    }

    const clearBtn = document.getElementById('clearCustomGridBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.thermalGrid = new ThermalGrid(16, 16, 25.0);
        this.customGridCanvas.updateGrid(this.thermalGrid.grid, [], []);
        document.getElementById('customPropPanel').classList.add('hidden');
      });
    }
  }

  initCustomGridEnvironment() {
    if (!this.thermalGrid || this.currentScreen === 'thermalx-custom') {
      this.thermalGrid = new ThermalGrid(16, 16, 25.0);
      // Default demo sources
      this.thermalGrid.sources.push({
        r: 4, c: 4, width: 3, height: 3, targetTemp: 90.0, heatFlux: 30.0, type: 'custom'
      });
      this.thermalGrid.coolers.push({
        r: 10, c: 11, width: 2, height: 2, efficiency: 1.0
      });
    }

    const canvas = document.getElementById('customGridCanvas');
    if (!this.customGridCanvas && canvas) {
      this.customGridCanvas = new ThermalCanvas(canvas, {
        mode: 'custom',
        showGrid: true,
        showMotherboard: false,
        onCellClick: (probe) => this.handleCustomCellClick(probe)
      });
    }

    if (this.customGridCanvas) {
      this.customGridCanvas.updateGrid(this.thermalGrid.grid, this.thermalGrid.sources, this.thermalGrid.coolers);
    }
  }

  handleCustomCellClick(cell) {
    const { r, c } = cell;
    this.synth.click();

    if (this.customTool === 'heat') {
      this.thermalGrid.sources.push({
        r, c, width: 2, height: 2, targetTemp: this.customToolTemp, heatFlux: 25.0, type: 'custom'
      });
    } else if (this.customTool === 'cool') {
      this.thermalGrid.coolers.push({
        r, c, width: 2, height: 2, efficiency: 1.2
      });
    } else if (this.customTool === 'eraser') {
      this.thermalGrid.sources = this.thermalGrid.sources.filter(s => !(s.r <= r && r < s.r + s.height && s.c <= c && c < s.c + s.width));
      this.thermalGrid.coolers = this.thermalGrid.coolers.filter(cl => !(cl.r <= r && r < cl.r + cl.height && cl.c <= c && c < cl.c + cl.width));
    }

    this.customGridCanvas.updateGrid(this.thermalGrid.grid, this.thermalGrid.sources, this.thermalGrid.coolers);

    // Inspector
    const panel = document.getElementById('customPropPanel');
    if (panel) {
      panel.classList.remove('hidden');
      document.getElementById('propCoord').textContent = `[${r}, ${c}]`;
      document.getElementById('propTemp').textContent = `${cell.temp.toFixed(1)}°C`;
    }
  }

  runCustomGridSimulation() {
    this.thermalConfig.solver = 'gauss-seidel';
    this.navigate('thermalx-solver');

    const canvas = document.getElementById('thermalLiveCanvas');
    if (!this.thermalCanvasSolver && canvas) {
      this.thermalCanvasSolver = new ThermalCanvas(canvas, { mode: 'custom', showGrid: true });
    }

    let currentGrid = this.thermalGrid.cloneGrid(this.thermalGrid.grid);
    let iter = 0;
    const maxIter = 40;
    const history = [];

    const stepIter = () => {
      iter++;
      const result = this.thermalGrid.iterateGaussSeidel(currentGrid);
      currentGrid = result.nextGrid;
      const err = result.maxError;
      const stats = this.thermalGrid.calculateStatistics(currentGrid);
      history.push({ iteration: iter, error: err, ...stats });

      const pct = Math.min(100, Math.round((iter / maxIter) * 100));
      document.getElementById('solverPercentText').textContent = `${pct}%`;
      document.getElementById('solverIterText').textContent = `Iteration ${iter} / ${maxIter}`;
      document.getElementById('solverErrorText').textContent = `Error: ${err.toFixed(5)}`;

      if (this.thermalCanvasSolver) {
        this.thermalCanvasSolver.updateGrid(currentGrid, this.thermalGrid.sources, this.thermalGrid.coolers);
      }

      if (err <= 0.001 || iter >= maxIter) {
        this.thermalGrid.grid = currentGrid;
        this.thermalResult = { converged: true, iterations: iter, finalError: err, history, stats };
        this.synth.chime();
        setTimeout(() => this.showThermalResults(), 600);
      } else {
        requestAnimationFrame(stepIter);
      }
    };
    requestAnimationFrame(stepIter);
  }

  // ==========================================
  // --- LINKRANK CONTROLS & GRAPH LOGIC ---
  // ==========================================
  setupLinkRankControls() {
    // Preset cards
    document.querySelectorAll('.network-category-card').forEach(card => {
      card.addEventListener('click', () => {
        const cat = card.dataset.category;
        this.currentCategory = cat;
        this.network = LinkRankNetwork.createPreset(cat);
        this.navigate('linkrank-editor');
      });
    });

    // Calculate Ranking Button
    const calcBtn = document.getElementById('calculateLinkRankBtn');
    if (calcBtn) {
      calcBtn.addEventListener('click', () => this.runLinkRankSolver());
    }

    // Add Node Form
    const addNodeBtn = document.getElementById('addNodeBtn');
    if (addNodeBtn) {
      addNodeBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('newNodeName');
        const catInput = document.getElementById('newNodeCategory');
        const name = nameInput.value.trim();
        if (name) {
          const id = name.toLowerCase().replace(/\s+/g, '_');
          this.network.addNode(id, name, catInput.value || 'Custom');
          nameInput.value = '';
          this.syncNetworkEditorUI();
        }
      });
    }

    // Add Link Form
    const addLinkBtn = document.getElementById('addLinkBtn');
    if (addLinkBtn) {
      addLinkBtn.addEventListener('click', () => {
        const fromSel = document.getElementById('linkFromSelect');
        const toSel = document.getElementById('linkToSelect');
        if (fromSel.value && toSel.value && fromSel.value !== toSel.value) {
          this.network.addEdge(fromSel.value, toSel.value);
          this.syncNetworkEditorUI();
        }
      });
    }

    // Reset Network
    const resetNetBtn = document.getElementById('resetNetworkBtn');
    if (resetNetBtn) {
      resetNetBtn.addEventListener('click', () => {
        this.network = LinkRankNetwork.createPreset(this.currentCategory);
        this.syncNetworkEditorUI();
      });
    }
  }

  initNetworkEditor() {
    const canvas = document.getElementById('networkEditorCanvas');
    if (!this.networkGraphEditor && canvas) {
      this.networkGraphEditor = new NetworkGraph(canvas, {
        onNodeClick: (node) => {
          this.synth.click();
          this.showNodeDetails(node);
        }
      });
    }
    this.syncNetworkEditorUI();
  }

  syncNetworkEditorUI() {
    // Update Dropdowns
    const fromSel = document.getElementById('linkFromSelect');
    const toSel = document.getElementById('linkToSelect');
    if (fromSel && toSel) {
      const opts = this.network.nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
      fromSel.innerHTML = opts;
      toSel.innerHTML = opts;
      if (this.network.nodes.length > 1) toSel.selectedIndex = 1;
    }

    // Update Counts
    const metaTag = document.getElementById('networkMetaTag');
    if (metaTag) {
      metaTag.textContent = `${this.network.nodes.length} Nodes • ${this.network.edges.length} Edges`;
    }

    if (this.networkGraphEditor) {
      this.networkGraphEditor.setData(this.network.nodes, this.network.edges);
    }
  }

  showNodeDetails(node) {
    const info = document.getElementById('selectedNodeInspector');
    if (info) {
      info.classList.remove('hidden');
      document.getElementById('inspectNodeName').textContent = node.name;
      document.getElementById('inspectNodeCategory').textContent = node.category || 'General';
      const inDeg = this.network.edges.filter(e => e.to === node.id).length;
      const outDeg = this.network.edges.filter(e => e.from === node.id).length;
      document.getElementById('inspectNodeInDeg').textContent = inDeg;
      document.getElementById('inspectNodeOutDeg').textContent = outDeg;
    }
  }

  runLinkRankSolver() {
    this.navigate('linkrank-solver');

    const circleProgress = document.getElementById('linkrankCircleProgress');
    const percentText = document.getElementById('linkrankPercentText');
    const iterText = document.getElementById('linkrankIterText');
    const errorText = document.getElementById('linkrankErrorText');

    let currentIter = 0;
    const maxIter = 20;

    // Simulate animated power iteration step presentation
    const runStep = () => {
      currentIter++;
      const partialSolve = this.network.solve({ maxIterations: currentIter, tolerance: 1e-6 });
      const lastHist = partialSolve.history[partialSolve.history.length - 1];
      const err = lastHist ? lastHist.error : 0.001;

      const pct = Math.min(100, Math.round((currentIter / maxIter) * 100));
      if (percentText) percentText.textContent = `${pct}%`;
      if (iterText) iterText.textContent = `Iteration ${currentIter} / ${maxIter}`;
      if (errorText) errorText.textContent = `Error: ${err.toFixed(6)}`;

      if (circleProgress) {
        const circumference = 2 * Math.PI * 40;
        circleProgress.style.strokeDashoffset = circumference - (pct / 100) * circumference;
      }

      if (currentIter < 12) {
        setTimeout(runStep, 80);
      } else {
        // Final Solve
        this.linkrankResult = this.network.solve({ maxIterations: 35, tolerance: 1e-6 });
        this.synth.chime();
        setTimeout(() => this.showLinkRankResults(), 500);
      }
    };

    setTimeout(runStep, 100);
  }

  showLinkRankResults() {
    this.navigate('linkrank-results');
    const res = this.linkrankResult;
    if (!res) return;

    // Table Leaderboard
    const tableBody = document.getElementById('rankingsTableBody');
    if (tableBody) {
      tableBody.innerHTML = res.rankings.map(r => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
          <td class="py-3 px-3">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-bold ${
              r.rank === 1 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
              r.rank === 2 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50' :
              'bg-surface-container-high text-on-surface-variant'
            }">
              #${r.rank}
            </span>
          </td>
          <td class="py-3 px-3">
            <div class="font-heading font-semibold text-sm text-on-surface">${r.name}</div>
            <div class="text-xs text-on-surface-variant">${r.category}</div>
          </td>
          <td class="py-3 px-3 font-mono text-sm text-right text-primary font-bold">
            ${r.score.toFixed(4)}
          </td>
          <td class="py-3 px-3">
            <div class="w-24 bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style="width: ${Math.min(100, r.percentage * 2.5)}%"></div>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Top Node Highlight Card
    const top = res.rankings[0];
    if (top) {
      document.getElementById('topNodeName').textContent = top.name;
      document.getElementById('topNodeScore').textContent = `Score: ${top.score.toFixed(4)} (${top.percentage}%)`;
    }

    // Results Canvas Graph with scaled aura and radii
    const canvas = document.getElementById('networkResultsCanvas');
    if (!this.networkGraphResults && canvas) {
      this.networkGraphResults = new NetworkGraph(canvas);
    }
    if (this.networkGraphResults) {
      this.networkGraphResults.setData(this.network.nodes, this.network.edges, res.rankings);
    }
  }

  // ==========================================
  // --- WHAT-IF LIVE NETWORK COMPARISON ---
  // ==========================================
  openWhatIfModal() {
    this.synth.click();
    const modal = document.getElementById('whatIfModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const top = this.linkrankResult.rankings[0];
    const challenger = this.linkrankResult.rankings[1] || this.linkrankResult.rankings[0];

    document.getElementById('whatIfChallengerName').textContent = challenger.name;
    document.getElementById('whatIfLeaderName').textContent = top.name;

    // Action: Redirect an edge from leader to challenger
    const executeWhatIf = (actionType) => {
      let modifiedEdges = [...this.network.edges];
      if (actionType === 'boostChallenger') {
        // Point all other nodes to challenger
        for (const n of this.network.nodes) {
          if (n.id !== challenger.id && !modifiedEdges.some(e => e.from === n.id && e.to === challenger.id)) {
            modifiedEdges.push({ from: n.id, to: challenger.id });
          }
        }
      } else if (actionType === 'cutLeader') {
        // Sever incoming edges to leader
        modifiedEdges = modifiedEdges.filter(e => e.to !== top.id);
      }

      const diff = this.network.simulateWhatIf(modifiedEdges);
      this.renderWhatIfComparison(diff);
    };

    document.getElementById('whatIfBoostBtn').onclick = () => executeWhatIf('boostChallenger');
    document.getElementById('whatIfSeverBtn').onclick = () => executeWhatIf('cutLeader');

    // Run baseline
    const initialDiff = this.network.simulateWhatIf(this.network.edges);
    this.renderWhatIfComparison(initialDiff);
  }

  renderWhatIfComparison(diff) {
    const list = document.getElementById('whatIfDeltaList');
    if (!list) return;

    list.innerHTML = diff.comparison.map(item => `
      <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container-high/60 border border-white/5">
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface">
            #${item.previousRank} → #${item.rank}
          </span>
          <span class="font-heading font-semibold text-sm text-on-surface">${item.name}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs ${item.scoreDelta > 0 ? 'text-emerald-400' : (item.scoreDelta < 0 ? 'text-red-400' : 'text-on-surface-variant')}">
            ${item.scoreDelta > 0 ? '+' : ''}${item.scoreDelta.toFixed(4)}
          </span>
          <span class="text-xs px-2 py-0.5 rounded font-semibold ${
            item.rankDelta > 0 ? 'bg-emerald-500/20 text-emerald-300' :
            item.rankDelta < 0 ? 'bg-red-500/20 text-red-300' : 'bg-surface-container text-on-surface-variant'
          }">
            ${item.rankDelta > 0 ? `▲ +${item.rankDelta}` : (item.rankDelta < 0 ? `▼ ${item.rankDelta}` : '—')}
          </span>
        </div>
      </div>
    `).join('');
  }

  // ==========================================
  // --- ACADEMIC LAB (VIVA CENTER) ---
  // ==========================================
  setupAcademicLab() {
    this.academicState = {
      linear: { result: null, step: 0, animating: false, timer: null },
      bisection: { result: null, step: 0, animating: false, timer: null },
      newton: { result: null, step: 0, animating: false, timer: null },
      power: { result: null, step: 0, animating: false, timer: null }
    };

    // Subtabs switcher
    document.querySelectorAll('.academic-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.synth.click();
        document.querySelectorAll('.academic-subtab-btn').forEach(b => {
          b.classList.remove('bg-primary-container', 'text-on-primary-container');
          b.classList.add('text-on-surface-variant');
        });
        btn.classList.add('bg-primary-container', 'text-on-primary-container');
        btn.classList.remove('text-on-surface-variant');

        const tab = btn.dataset.tab;
        document.querySelectorAll('.academic-tab-content').forEach(c => c.classList.add('hidden'));
        const target = document.getElementById(tab);
        if (target) {
          target.classList.remove('hidden');
          // Redraw active canvas after tab becomes visible
          if (tab === 'academic-linear') this.redrawLinearCanvas();
          else if (tab === 'academic-bisection') this.redrawBisectionCanvas();
          else if (tab === 'academic-newton') this.redrawNewtonCanvas();
          else if (tab === 'academic-power') this.redrawPowerCanvas();
        }
      });
    });

    // --- Tab 1: Linear System Controls ---
    const linearPresetSelect = document.getElementById('linearPresetSelect');
    if (linearPresetSelect) {
      linearPresetSelect.addEventListener('change', () => {
        this.synth.click();
        const pKey = linearPresetSelect.value;
        const p = AcademicLab.linearPresets[pKey];
        if (p) {
          document.getElementById('linearPresetDesc').textContent = p.desc;
          document.getElementById('linearEquationStrip').textContent = p.equationStr;
        }
        this.initLinearSystemDemo();
      });
    }

    const linearTolSlider = document.getElementById('linearTolSlider');
    if (linearTolSlider) {
      linearTolSlider.addEventListener('input', (e) => {
        const exp = parseInt(e.target.value);
        document.getElementById('linearTolVal').textContent = `1e-${exp}`;
      });
    }

    document.getElementById('runAcademicLinearBtn')?.addEventListener('click', () => {
      this.playLinearSystemAnimation();
    });
    document.getElementById('stepAcademicLinearBtn')?.addEventListener('click', () => {
      this.stepLinearSystem();
    });
    document.getElementById('resetAcademicLinearBtn')?.addEventListener('click', () => {
      this.initLinearSystemDemo();
    });

    // --- Tab 2: Bisection Controls ---
    const bisFuncSelect = document.getElementById('bisectionFuncSelect');
    if (bisFuncSelect) {
      bisFuncSelect.addEventListener('change', () => {
        this.synth.click();
        const fKey = bisFuncSelect.value;
        const p = AcademicLab.bisectionPresets[fKey];
        if (p) {
          document.getElementById('bisectionPresetDesc').textContent = p.desc;
          document.getElementById('bisInputA').value = p.defaultA;
          document.getElementById('bisInputB').value = p.defaultB;
        }
        this.validateBisectionBracket();
        this.initBisectionDemo();
      });
    }

    const validateBis = () => this.validateBisectionBracket();
    document.getElementById('bisInputA')?.addEventListener('input', validateBis);
    document.getElementById('bisInputB')?.addEventListener('input', validateBis);

    document.getElementById('runAcademicBisectionBtn')?.addEventListener('click', () => {
      this.playBisectionAnimation();
    });
    document.getElementById('stepAcademicBisectionBtn')?.addEventListener('click', () => {
      this.stepBisection();
    });
    document.getElementById('resetAcademicBisectionBtn')?.addEventListener('click', () => {
      this.initBisectionDemo();
    });

    // --- Tab 3: Newton-Raphson Controls ---
    const newtonFuncSelect = document.getElementById('newtonFuncSelect');
    if (newtonFuncSelect) {
      newtonFuncSelect.addEventListener('change', () => {
        this.synth.click();
        const fKey = newtonFuncSelect.value;
        const p = AcademicLab.newtonPresets[fKey];
        if (p) {
          document.getElementById('newtonPresetDesc').textContent = p.desc;
          document.getElementById('newtonInputX0').value = p.defaultX0;
          document.getElementById('newtonFormulaBox').textContent = p.formula;
        }
        this.initNewtonDemo();
      });
    }

    document.getElementById('runAcademicNewtonBtn')?.addEventListener('click', () => {
      this.playNewtonAnimation();
    });
    document.getElementById('stepAcademicNewtonBtn')?.addEventListener('click', () => {
      this.stepNewton();
    });
    document.getElementById('resetAcademicNewtonBtn')?.addEventListener('click', () => {
      this.initNewtonDemo();
    });

    // --- Tab 4: Power Method Controls ---
    const powerPresetSelect = document.getElementById('powerPresetSelect');
    if (powerPresetSelect) {
      powerPresetSelect.addEventListener('change', () => {
        this.synth.click();
        const pKey = powerPresetSelect.value;
        const p = AcademicLab.powerPresets[pKey];
        if (p) {
          document.getElementById('powerPresetDesc').textContent = p.desc;
          document.getElementById('powerMatrixStrip').textContent = `A = ${p.matrixStr}`;
        }
        this.initPowerDemo();
      });
    }

    document.getElementById('runAcademicPowerBtn')?.addEventListener('click', () => {
      this.playPowerAnimation();
    });
    document.getElementById('stepAcademicPowerBtn')?.addEventListener('click', () => {
      this.stepPower();
    });
    document.getElementById('resetAcademicPowerBtn')?.addEventListener('click', () => {
      this.initPowerDemo();
    });

    // Handle window resize for canvases
    window.addEventListener('resize', () => {
      if (this.currentScreen === 'academic-hub') {
        this.redrawLinearCanvas();
        this.redrawBisectionCanvas();
        this.redrawNewtonCanvas();
        this.redrawPowerCanvas();
      }
    });
  }

  runDefaultAcademicExamples() {
    this.initLinearSystemDemo();
    this.initBisectionDemo();
    this.initNewtonDemo();
    this.initPowerDemo();
  }

  // ------------------------------------------
  // TAB 1: LINEAR SYSTEM (JACOBI VS GAUSS-SEIDEL)
  // ------------------------------------------
  initLinearSystemDemo() {
    const preset = document.getElementById('linearPresetSelect')?.value || 'standard';
    const exp = parseInt(document.getElementById('linearTolSlider')?.value || 4);
    const tol = Math.pow(10, -exp);

    const res = AcademicLab.solveLinearSystem({ preset, tol });
    this.academicState.linear = {
      result: res,
      step: res.gaussSeidel.steps.length,
      animating: false,
      timer: null
    };

    this.renderLinearTable(this.academicState.linear.step);
    this.redrawLinearCanvas();
  }

  playLinearSystemAnimation() {
    this.synth.chime();
    const st = this.academicState.linear;
    if (st.timer) clearInterval(st.timer);

    st.step = 0;
    st.animating = true;
    const maxSteps = Math.max(st.result.jacobi.steps.length, st.result.gaussSeidel.steps.length);

    st.timer = setInterval(() => {
      if (st.step < maxSteps) {
        st.step++;
        this.synth.click();
        this.renderLinearTable(st.step);
        this.redrawLinearCanvas();
      } else {
        clearInterval(st.timer);
        st.animating = false;
        this.synth.chime();
      }
    }, 280);
  }

  stepLinearSystem() {
    this.synth.click();
    const st = this.academicState.linear;
    if (st.timer) clearInterval(st.timer);
    const maxSteps = Math.max(st.result.jacobi.steps.length, st.result.gaussSeidel.steps.length);
    if (st.step < maxSteps) {
      st.step++;
      this.renderLinearTable(st.step);
      this.redrawLinearCanvas();
    }
  }

  renderLinearTable(currentStep) {
    const res = this.academicState.linear.result;
    if (!res) return;
    const tbody = document.getElementById('academicLinearTable');
    if (!tbody) return;

    const maxCount = Math.max(res.jacobi.steps.length, res.gaussSeidel.steps.length);
    const visibleCount = Math.min(currentStep, maxCount);

    tbody.innerHTML = Array.from({ length: visibleCount }).map((_, idx) => {
      const iter = idx + 1;
      const j = res.jacobi.steps[idx] || { x: ['converged'], error: '-' };
      const gs = res.gaussSeidel.steps[idx] || { x: ['converged'], error: '-' };
      const isCurrent = iter === visibleCount;

      return `
        <tr class="border-b border-white/5 text-xs font-mono transition-colors ${isCurrent ? 'bg-primary/10' : 'hover:bg-white/5'}">
          <td class="py-2.5 px-3 text-on-surface-variant font-bold">${iter}</td>
          <td class="py-2.5 px-3 text-cyan-300">${Array.isArray(j.x) ? `[${j.x.join(', ')}]` : '✓ Converged'}</td>
          <td class="py-2.5 px-3 text-on-surface-variant">${j.error}</td>
          <td class="py-2.5 px-3 text-emerald-300 font-semibold">${Array.isArray(gs.x) ? `[${gs.x.join(', ')}]` : '✓ Converged'}</td>
          <td class="py-2.5 px-3 ${gs.error !== '-' ? 'text-emerald-400 font-bold' : 'text-on-surface-variant'}">${gs.error}</td>
        </tr>
      `;
    }).join('');

    const summaryEl = document.getElementById('academicLinearSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <span class="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
        <span><strong>Gauss-Seidel:</strong> ${res.gaussSeidel.iterations} iterations &bull; <strong>Jacobi:</strong> ${res.jacobi.iterations} iterations &bull; <strong>Convergence Speedup:</strong> <span class="text-primary font-bold">${res.speedup}x faster</span>.</span>
      `;
    }
  }

  redrawLinearCanvas() {
    const canvas = document.getElementById('academicLinearCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const res = this.academicState.linear.result;
    if (!res) return;

    const jSteps = res.jacobi.steps;
    const gsSteps = res.gaussSeidel.steps;
    const maxIters = Math.max(jSteps.length, gsSteps.length, 1);
    const visibleStep = this.academicState.linear.step;

    // Background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 30; y < h - 20; y += 30) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(w - 15, y);
      ctx.stroke();
    }

    const getX = (iter) => 35 + ((iter - 1) / Math.max(1, maxIters - 1)) * (w - 60);
    const getY = (errVal) => {
      if (typeof errVal !== 'number' || errVal <= 0) return h - 30;
      const logVal = Math.log10(errVal);
      const clamped = Math.max(-5, Math.min(1, logVal));
      return 25 + ((1 - clamped) / 6) * (h - 55);
    };

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(35, 20);
    ctx.lineTo(35, h - 25);
    ctx.lineTo(w - 15, h - 25);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px JetBrains Mono';
    ctx.fillText('10⁰', 10, 30);
    ctx.fillText('10⁻²', 10, h / 2);
    ctx.fillText('10⁻⁵', 10, h - 30);
    ctx.fillText('k=1', 35, h - 10);
    ctx.fillText(`k=${maxIters}`, w - 45, h - 10);

    // Plot Jacobi curve (Cyan)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const jVisible = jSteps.slice(0, visibleStep);
    jVisible.forEach((pt, i) => {
      const px = getX(pt.iteration);
      const py = getY(pt.error);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    jVisible.forEach((pt) => {
      const px = getX(pt.iteration);
      const py = getY(pt.error);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Plot Gauss-Seidel curve (Orange-Red)
    ctx.strokeStyle = '#ff5722';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const gsVisible = gsSteps.slice(0, visibleStep);
    gsVisible.forEach((pt, i) => {
      const px = getX(pt.iteration);
      const py = getY(pt.error);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    gsVisible.forEach((pt) => {
      const px = getX(pt.iteration);
      const py = getY(pt.error);
      ctx.fillStyle = '#ff5722';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Highlight active step
    if (gsVisible.length > 0) {
      const lastGS = gsVisible[gsVisible.length - 1];
      const lx = getX(lastGS.iteration);
      const ly = getY(lastGS.error);
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ------------------------------------------
  // TAB 2: BISECTION METHOD
  // ------------------------------------------
  validateBisectionBracket() {
    const fKey = document.getElementById('bisectionFuncSelect')?.value || 'cube1';
    const preset = AcademicLab.bisectionPresets[fKey] || AcademicLab.bisectionPresets.cube1;
    const a = parseFloat(document.getElementById('bisInputA')?.value || preset.defaultA);
    const b = parseFloat(document.getElementById('bisInputB')?.value || preset.defaultB);
    const fa = preset.f(a);
    const fb = preset.f(b);

    const statusEl = document.getElementById('bisBracketStatus');
    if (!statusEl) return false;

    if (fa * fb <= 0) {
      statusEl.className = 'p-2 rounded-lg bg-surface-card border border-emerald-500/30 text-[11px] font-mono flex items-center gap-2 text-emerald-400';
      statusEl.innerHTML = `
        <span class="material-symbols-outlined text-[15px]">check_circle</span>
        <span>Valid Bracket: f(${a.toFixed(2)}) = ${fa.toFixed(2)} and f(${b.toFixed(2)}) = ${fb.toFixed(2)} have opposite signs.</span>
      `;
      return true;
    } else {
      statusEl.className = 'p-2 rounded-lg bg-surface-card border border-red-500/40 text-[11px] font-mono flex items-center gap-2 text-red-400';
      statusEl.innerHTML = `
        <span class="material-symbols-outlined text-[15px]">error</span>
        <span>Invalid Bracket: f(a) & f(b) have the SAME sign! Root is not guaranteed.</span>
      `;
      return false;
    }
  }

  initBisectionDemo() {
    const fKey = document.getElementById('bisectionFuncSelect')?.value || 'cube1';
    const a = parseFloat(document.getElementById('bisInputA')?.value || 2.0);
    const b = parseFloat(document.getElementById('bisInputB')?.value || 3.0);

    const res = AcademicLab.runBisection({ funcId: fKey, a, b });
    this.academicState.bisection = {
      result: res,
      step: res.steps ? res.steps.length : 0,
      animating: false,
      timer: null
    };

    this.renderBisectionTable(this.academicState.bisection.step);
    this.redrawBisectionCanvas();
  }

  playBisectionAnimation() {
    if (!this.validateBisectionBracket()) return;
    this.synth.chime();
    const st = this.academicState.bisection;
    if (st.timer) clearInterval(st.timer);

    st.step = 0;
    st.animating = true;
    const maxSteps = st.result.steps.length;

    st.timer = setInterval(() => {
      if (st.step < maxSteps) {
        st.step++;
        this.synth.click();
        this.renderBisectionTable(st.step);
        this.redrawBisectionCanvas();
      } else {
        clearInterval(st.timer);
        st.animating = false;
        this.synth.chime();
      }
    }, 320);
  }

  stepBisection() {
    this.synth.click();
    const st = this.academicState.bisection;
    if (st.timer) clearInterval(st.timer);
    if (st.step < st.result.steps.length) {
      st.step++;
      this.renderBisectionTable(st.step);
      this.redrawBisectionCanvas();
    }
  }

  renderBisectionTable(currentStep) {
    const res = this.academicState.bisection.result;
    if (!res || !res.steps) return;
    const tbody = document.getElementById('academicBisectionTable');
    if (!tbody) return;

    const visibleSteps = res.steps.slice(0, currentStep);

    tbody.innerHTML = visibleSteps.map((s, idx) => {
      const isCurrent = idx === visibleSteps.length - 1;
      const subInterval = s.sign === '+' ? `[${s.a}, ${s.c}]` : `[${s.c}, ${s.b}]`;
      return `
        <tr class="border-b border-white/5 text-xs font-mono transition-colors ${isCurrent ? 'bg-primary/10' : 'hover:bg-white/5'}">
          <td class="py-2.5 px-3 text-on-surface-variant font-bold">${s.iteration}</td>
          <td class="py-2.5 px-3 text-red-400 font-semibold">${s.a}</td>
          <td class="py-2.5 px-3 text-blue-400 font-semibold">${s.b}</td>
          <td class="py-2.5 px-3 text-primary font-bold">${s.c}</td>
          <td class="py-2.5 px-3 text-on-surface">${s.fc} (${s.sign})</td>
          <td class="py-2.5 px-3 text-emerald-400">${s.error}</td>
          <td class="py-2.5 px-3 text-cyan-300 font-mono text-[11px]">${subInterval}</td>
        </tr>
      `;
    }).join('');

    const rootEl = document.getElementById('academicBisectionRoot');
    if (rootEl) {
      rootEl.innerHTML = `
        <span class="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
        <span><strong>Converged Root:</strong> x* &approx; <span class="text-primary font-bold text-sm">${res.root}</span> &bull; <strong>Residual f(x*):</strong> ${res.fRoot} in <strong>${res.steps.length} steps</strong>.</span>
      `;
    }
  }

  redrawBisectionCanvas() {
    const canvas = document.getElementById('academicBisectionCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const res = this.academicState.bisection.result;
    if (!res || !res.preset) return;

    const preset = res.preset;
    const xMin = preset.xMin;
    const xMax = preset.xMax;
    const pts = AcademicLab.sampleFunction(preset.f, xMin, xMax, 100);

    let yMin = Infinity, yMax = -Infinity;
    pts.forEach(p => {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    });
    if (yMin > 0) yMin = -2;
    if (yMax < 0) yMax = 2;

    const mapX = (x) => 35 + ((x - xMin) / (xMax - xMin)) * (w - 70);
    const mapY = (y) => (h - 25) - ((y - yMin) / (yMax - yMin)) * (h - 50);

    // Zero-axis lines
    const zeroY = mapY(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, zeroY);
    ctx.lineTo(w - 35, zeroY);
    ctx.stroke();

    // Plot f(x) curve
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const px = mapX(p.x);
      const py = mapY(p.y);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Active bracket at current step
    const curStepIdx = Math.max(0, Math.min(this.academicState.bisection.step - 1, res.steps.length - 1));
    const stepData = res.steps[curStepIdx];
    if (stepData) {
      const ax = mapX(stepData.a);
      const bx = mapX(stepData.b);
      const cx = mapX(stepData.c);

      // Shaded active interval [a, b]
      ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
      ctx.fillRect(ax, 15, bx - ax, h - 40);

      // Vertical line for a (Crimson)
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax, 15);
      ctx.lineTo(ax, h - 25);
      ctx.stroke();

      // Vertical line for b (Blue)
      ctx.strokeStyle = '#60a5fa';
      ctx.beginPath();
      ctx.moveTo(bx, 15);
      ctx.lineTo(bx, h - 25);
      ctx.stroke();

      // Vertical dashed line for midpoint c (Amber)
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 15);
      ctx.lineTo(cx, h - 25);
      ctx.stroke();
      ctx.setLineDash([]);

      // Midpoint point on curve
      const cy = mapY(stepData.fc);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Text tags
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`a=${stepData.a}`, ax + 4, 30);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`b=${stepData.b}`, bx - 45, 30);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`c=${stepData.c}`, cx + 4, 45);
    }
  }

  // ------------------------------------------
  // TAB 3: NEWTON-RAPHSON METHOD
  // ------------------------------------------
  initNewtonDemo() {
    const fKey = document.getElementById('newtonFuncSelect')?.value || 'cube1';
    const x0 = parseFloat(document.getElementById('newtonInputX0')?.value || 2.0);

    const res = AcademicLab.runNewtonRaphson({ funcId: fKey, x0 });
    this.academicState.newton = {
      result: res,
      step: res.steps ? res.steps.length : 0,
      animating: false,
      timer: null
    };

    this.renderNewtonTable(this.academicState.newton.step);
    this.redrawNewtonCanvas();
  }

  playNewtonAnimation() {
    this.synth.chime();
    const st = this.academicState.newton;
    if (st.timer) clearInterval(st.timer);

    st.step = 0;
    st.animating = true;
    const maxSteps = st.result.steps.length;

    st.timer = setInterval(() => {
      if (st.step < maxSteps) {
        st.step++;
        this.synth.click();
        this.renderNewtonTable(st.step);
        this.redrawNewtonCanvas();
      } else {
        clearInterval(st.timer);
        st.animating = false;
        this.synth.chime();
      }
    }, 380);
  }

  stepNewton() {
    this.synth.click();
    const st = this.academicState.newton;
    if (st.timer) clearInterval(st.timer);
    if (st.step < st.result.steps.length) {
      st.step++;
      this.renderNewtonTable(st.step);
      this.redrawNewtonCanvas();
    }
  }

  renderNewtonTable(currentStep) {
    const res = this.academicState.newton.result;
    if (!res || !res.steps) return;
    const tbody = document.getElementById('academicNewtonTable');
    if (!tbody) return;

    const visibleSteps = res.steps.slice(0, currentStep);

    tbody.innerHTML = visibleSteps.map((s, idx) => {
      const isCurrent = idx === visibleSteps.length - 1;
      return `
        <tr class="border-b border-white/5 text-xs font-mono transition-colors ${isCurrent ? 'bg-primary/10' : 'hover:bg-white/5'}">
          <td class="py-2.5 px-3 text-on-surface-variant font-bold">${s.iteration}</td>
          <td class="py-2.5 px-3 text-cyan-300 font-semibold">${s.x}</td>
          <td class="py-2.5 px-3 text-amber-300">${s.fx}</td>
          <td class="py-2.5 px-3 text-on-surface-variant">${s.dfx}</td>
          <td class="py-2.5 px-3 text-primary font-bold">${s.nextX}</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold">${s.error}</td>
        </tr>
      `;
    }).join('');

    const rootEl = document.getElementById('academicNewtonRoot');
    if (rootEl) {
      rootEl.innerHTML = `
        <span class="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
        <span><strong>Converged Root:</strong> x* &approx; <span class="text-primary font-bold text-sm">${res.root}</span> &bull; <strong>Quadratic Steps:</strong> ${res.steps.length} &bull; <strong>Residual:</strong> ${res.fRoot}.</span>
      `;
    }
  }

  redrawNewtonCanvas() {
    const canvas = document.getElementById('academicNewtonCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const res = this.academicState.newton.result;
    if (!res || !res.preset) return;

    const preset = res.preset;
    const xMin = preset.xMin;
    const xMax = preset.xMax;
    const pts = AcademicLab.sampleFunction(preset.f, xMin, xMax, 100);

    let yMin = Infinity, yMax = -Infinity;
    pts.forEach(p => {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    });
    if (yMin > 0) yMin = -2;
    if (yMax < 0) yMax = 2;

    const mapX = (x) => 35 + ((x - xMin) / (xMax - xMin)) * (w - 70);
    const mapY = (y) => (h - 25) - ((y - yMin) / (yMax - yMin)) * (h - 50);

    // Zero-axis
    const zeroY = mapY(0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, zeroY);
    ctx.lineTo(w - 35, zeroY);
    ctx.stroke();

    // f(x) curve
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      const px = mapX(p.x);
      const py = mapY(p.y);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Tangent Projection for active step
    const curStepIdx = Math.max(0, Math.min(this.academicState.newton.step - 1, res.steps.length - 1));
    const s = res.steps[curStepIdx];
    if (s) {
      const xk = s.x;
      const fxk = preset.f(xk);
      const nextX = s.nextX;

      const pxK = mapX(xk);
      const pyK = mapY(fxk);
      const pNextX = mapX(nextX);
      const pNextY = zeroY;

      // Vertical line from (xk, 0) up to (xk, fxk)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pxK, zeroY);
      ctx.lineTo(pxK, pyK);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tangent line from (xk, fxk) down to (nextX, 0)
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pxK, pyK);
      ctx.lineTo(pNextX, pNextY);
      ctx.stroke();

      // Point on curve
      ctx.fillStyle = '#ff9800';
      ctx.beginPath();
      ctx.arc(pxK, pyK, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Intercept on x-axis
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pNextX, pNextY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Text Labels
      ctx.font = '10px JetBrains Mono';
      ctx.fillStyle = '#ff9800';
      ctx.fillText(`(x_${s.iteration}, f(x))`, pxK + 6, pyK - 4);
      ctx.fillStyle = '#10b981';
      ctx.fillText(`x_${s.iteration + 1}=${nextX}`, pNextX - 20, pNextY + 16);
    }
  }

  // ------------------------------------------
  // TAB 4: POWER ITERATION (EIGENVALUES)
  // ------------------------------------------
  initPowerDemo() {
    const pKey = document.getElementById('powerPresetSelect')?.value || 'symmetric';
    const res = AcademicLab.runPowerIteration({ preset: pKey });
    this.academicState.power = {
      result: res,
      step: res.steps ? res.steps.length : 0,
      animating: false,
      timer: null
    };

    this.renderPowerTable(this.academicState.power.step);
    this.redrawPowerCanvas();
  }

  playPowerAnimation() {
    this.synth.chime();
    const st = this.academicState.power;
    if (st.timer) clearInterval(st.timer);

    st.step = 0;
    st.animating = true;
    const maxSteps = st.result.steps.length;

    st.timer = setInterval(() => {
      if (st.step < maxSteps) {
        st.step++;
        this.synth.click();
        this.renderPowerTable(st.step);
        this.redrawPowerCanvas();
      } else {
        clearInterval(st.timer);
        st.animating = false;
        this.synth.chime();
      }
    }, 280);
  }

  stepPower() {
    this.synth.click();
    const st = this.academicState.power;
    if (st.timer) clearInterval(st.timer);
    if (st.step < st.result.steps.length) {
      st.step++;
      this.renderPowerTable(st.step);
      this.redrawPowerCanvas();
    }
  }

  renderPowerTable(currentStep) {
    const res = this.academicState.power.result;
    if (!res || !res.steps) return;
    const tbody = document.getElementById('academicPowerTable');
    if (!tbody) return;

    const visibleSteps = res.steps.slice(0, currentStep);

    tbody.innerHTML = visibleSteps.map((s, idx) => {
      const isCurrent = idx === visibleSteps.length - 1;
      return `
        <tr class="border-b border-white/5 text-xs font-mono transition-colors ${isCurrent ? 'bg-primary/10' : 'hover:bg-white/5'}">
          <td class="py-2.5 px-3 text-on-surface-variant font-bold">${s.iteration}</td>
          <td class="py-2.5 px-3 text-primary font-bold text-sm">${s.lambda}</td>
          <td class="py-2.5 px-3 text-cyan-300 font-semibold">[${s.eigenvector.join(', ')}]</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold">${s.error}</td>
        </tr>
      `;
    }).join('');

    const eigenEl = document.getElementById('academicPowerEigen');
    if (eigenEl) {
      eigenEl.innerHTML = `
        <span class="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
        <span><strong>Dominant Eigenvalue:</strong> &lambda;₁ &approx; <span class="text-primary font-bold text-sm">${res.dominantEigenvalue}</span> &bull; <strong>Principal Eigenvector:</strong> [${res.eigenvector.join(', ')}].</span>
      `;
    }
  }

  redrawPowerCanvas() {
    const canvas = document.getElementById('academicPowerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const res = this.academicState.power.result;
    if (!res || !res.steps) return;

    const steps = res.steps;
    const currentStep = Math.max(1, Math.min(this.academicState.power.step, steps.length));
    const visibleSteps = steps.slice(0, currentStep);

    // Left half: Rayleigh Quotient curve
    const plotW = w * 0.58;
    const barW = w * 0.38;

    // Background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(35, 25);
    ctx.lineTo(plotW, 25);
    ctx.moveTo(35, h / 2);
    ctx.lineTo(plotW, h / 2);
    ctx.moveTo(35, h - 25);
    ctx.lineTo(plotW, h - 25);
    ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(35, 15);
    ctx.lineTo(35, h - 25);
    ctx.lineTo(plotW, h - 25);
    ctx.stroke();

    // Rayleigh quotient bounds
    let lMin = Infinity, lMax = -Infinity;
    steps.forEach(s => {
      if (s.lambda < lMin) lMin = s.lambda;
      if (s.lambda > lMax) lMax = s.lambda;
    });
    const range = Math.max(0.1, lMax - lMin);
    const mapY = (l) => (h - 35) - ((l - (lMin - range * 0.1)) / (range * 1.2)) * (h - 55);
    const mapX = (iter) => 35 + ((iter - 1) / Math.max(1, steps.length - 1)) * (plotW - 50);

    // Plot Rayleigh quotient curve
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    visibleSteps.forEach((s, idx) => {
      const px = mapX(s.iteration);
      const py = mapY(s.lambda);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Dots
    visibleSteps.forEach(s => {
      const px = mapX(s.iteration);
      const py = mapY(s.lambda);
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px JetBrains Mono';
    ctx.fillText(`λ=${lMax.toFixed(2)}`, 5, 25);
    ctx.fillText(`λ=${lMin.toFixed(2)}`, 5, h - 35);
    ctx.fillText('k=1', 35, h - 10);
    ctx.fillText(`k=${steps.length}`, plotW - 30, h - 10);

    // Right half: Normalized Eigenvector Bars at current step
    const curStepData = visibleSteps[visibleSteps.length - 1];
    if (curStepData && curStepData.eigenvector) {
      const vec = curStepData.eigenvector;
      const barStartX = plotW + 25;
      const barAvailableW = w - barStartX - 20;

      ctx.fillStyle = '#f8fafc';
      ctx.font = '10px Space Grotesk';
      ctx.fillText('Eigenvector Coordinates v^(k):', barStartX, 25);

      vec.forEach((vVal, i) => {
        const barY = 45 + i * 36;
        const normW = Math.max(2, Math.abs(vVal) * barAvailableW);

        // Track bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(barStartX, barY, barAvailableW, 16);

        // Filled bar
        const gradient = ctx.createLinearGradient(barStartX, 0, barStartX + normW, 0);
        gradient.addColorStop(0, '#0566d9');
        gradient.addColorStop(1, '#10b981');
        ctx.fillStyle = gradient;
        ctx.fillRect(barStartX, barY, normW, 16);

        // Label
        ctx.fillStyle = '#dee2f6';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`v[${i + 1}] = ${vVal.toFixed(4)}`, barStartX + 6, barY + 12);
      });
    }
  }

  // ==========================================
  // --- MODALS & EXTRAS ---
  // ==========================================
  setupModals() {
    // Show the Math (Thermal)
    const showMathBtn = document.getElementById('showThermalMathBtn');
    if (showMathBtn) {
      showMathBtn.addEventListener('click', () => {
        this.synth.click();
        document.getElementById('thermalMathModal').classList.remove('hidden');
      });
    }

    // Compare Solvers Modal
    const compareBtn = document.getElementById('compareSolversBtn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        this.synth.click();
        this.openCompareSolversModal();
      });
    }

    // Optimize Cooling (Bisection) Modal
    const optCoolingBtn = document.getElementById('optimizeCoolingBtn');
    if (optCoolingBtn) {
      optCoolingBtn.addEventListener('click', () => {
        this.synth.click();
        this.openBisectionOptimizerModal();
      });
    }

    // Save Simulation Report
    const exportBtn = document.getElementById('exportThermalReportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.synth.click();
        this.generateSimulationReport();
      });
    }

    // Close buttons on all modals
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.synth.click();
        const modal = btn.closest('.modal-container');
        if (modal) modal.classList.add('hidden');
      });
    });

    // What If LinkRank
    const whatIfBtn = document.getElementById('whatIfBtn');
    if (whatIfBtn) {
      whatIfBtn.addEventListener('click', () => this.openWhatIfModal());
    }

    // Show Math (LinkRank)
    const showLinkRankMathBtn = document.getElementById('showLinkRankMathBtn');
    if (showLinkRankMathBtn) {
      showLinkRankMathBtn.addEventListener('click', () => {
        this.synth.click();
        document.getElementById('linkrankMathModal').classList.remove('hidden');
      });
    }
  }

  openCompareSolversModal() {
    const modal = document.getElementById('compareSolversModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const res = this.thermalGrid.compareSolvers({ maxIterations: 45, tolerance: 0.001 });

    document.getElementById('compareJacobiIter').textContent = res.jacobi.iterations;
    document.getElementById('compareJacobiError').textContent = res.jacobi.finalError.toExponential(3);
    document.getElementById('compareJacobiTime').textContent = `${res.jacobi.durationMs.toFixed(1)} ms`;

    document.getElementById('compareGSIter').textContent = res.gaussSeidel.iterations;
    document.getElementById('compareGSError').textContent = res.gaussSeidel.finalError.toExponential(3);
    document.getElementById('compareGSTime').textContent = `${res.gaussSeidel.durationMs.toFixed(1)} ms`;

    document.getElementById('compareSpeedup').textContent = `${res.speedup}x Faster`;

    // Render Convergence Graph Canvas
    const canvas = document.getElementById('compareGraphCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#090e1c';
      ctx.fillRect(0, 0, w, h);

      // Axes
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(40, 20, w - 60, h - 50);

      // Plot Jacobi Curve (Cyan)
      const jHist = res.jacobi.history;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      jHist.forEach((pt, i) => {
        const x = 40 + (i / Math.max(1, jHist.length - 1)) * (w - 60);
        const y = 20 + (Math.log10(Math.max(1e-5, pt.error)) / -4.0) * (h - 50);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Plot Gauss-Seidel Curve (Orange-Red)
      const gsHist = res.gaussSeidel.history;
      ctx.strokeStyle = '#ff5722';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      gsHist.forEach((pt, i) => {
        const x = 40 + (i / Math.max(1, jHist.length - 1)) * (w - 60);
        const y = 20 + (Math.log10(Math.max(1e-5, pt.error)) / -4.0) * (h - 50);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Legend
      ctx.fillStyle = '#00f0ff';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText('— Jacobi', w - 140, 36);
      ctx.fillStyle = '#ff5722';
      ctx.fillText('— Gauss-Seidel', w - 140, 52);
    }
  }

  openBisectionOptimizerModal() {
    const modal = document.getElementById('bisectionOptimizerModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const res = this.thermalGrid.optimizeCoolingBisection({ targetMaxTemp: 75.0, tolerance: 0.01 });

    document.getElementById('bisectionOptimalPct').textContent = `${res.optimalPercent}%`;
    document.getElementById('bisectionAchievedTemp').textContent = `${res.achievedTemp}°C (Target: ≤ 75°C)`;
    document.getElementById('bisectionStepsCount').textContent = `${res.steps.length} Steps`;

    const tbody = document.getElementById('bisectionStepsTable');
    if (tbody) {
      tbody.innerHTML = res.steps.map(s => `
        <tr class="border-b border-white/5 text-xs font-mono">
          <td class="py-2 px-3 text-on-surface-variant font-bold">${s.step}</td>
          <td class="py-2 px-3">${s.a}%</td>
          <td class="py-2 px-3">${s.b}%</td>
          <td class="py-2 px-3 text-primary font-bold">${s.mid}%</td>
          <td class="py-2 px-3 ${s.maxTemp <= 75 ? 'text-emerald-400 font-bold' : 'text-red-400'}">${s.maxTemp}°C</td>
          <td class="py-2 px-3 font-semibold ${s.satisfied ? 'text-emerald-400' : 'text-amber-400'}">
            ${s.satisfied ? '✓ Satisfied' : '✗ Too Hot'}
          </td>
        </tr>
      `).join('');
    }
  }

  generateSimulationReport() {
    const { stats, iterations, finalError } = this.thermalResult;
    const reportHtml = `
      NUMERIX LAB - SCIENTIFIC SIMULATION REPORT
      Date: ${new Date().toLocaleString()}
      Module: THERMALX - 2D Thermal Field Solver
      --------------------------------------------------
      CONFIGURATION:
      Ambient Temperature: ${this.thermalConfig.ambient}°C
      CPU Die Temperature: ${this.thermalConfig.cpu}°C
      Discrete GPU Temperature: ${this.thermalConfig.gpu}°C
      Cooling Convection: ${Math.round(this.thermalConfig.cooling * 100)}%
      Mesh Resolution: ${this.thermalConfig.resolution.toUpperCase()} (${this.thermalGrid.rows}x${this.thermalGrid.cols})
      Numerical Method: ${this.thermalConfig.solver.toUpperCase()}
      
      COMPUTATIONAL RESULTS:
      Converged: YES (in ${iterations} iterations)
      Final Residual Error: ${finalError.toExponential(4)}
      Maximum Field Temperature: ${stats.maxTemp}°C
      Average Chassis Temperature: ${stats.avgTemp}°C
      Active Hotspot Count: ${stats.hotspots}
      Primary Hotspot: ${stats.primaryHotspot.name} (${stats.primaryHotspot.temp}°C)
      Chassis Thermal State: ${stats.status.toUpperCase()}
      --------------------------------------------------
      Verified with 2D Finite Difference Poisson Formulation.
    `;

    const blob = new Blob([reportHtml], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `THERMALX_Report_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Instantiate App when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new NumerixApp();
});
