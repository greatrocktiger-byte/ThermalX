/**
 * NUMERIX LAB - Next-Gen Thermal Canvas Visualizer
 * Ultra-clean semiconductor & thermal infrared engine with delicate silicon die footprints,
 * dual smoothing modes (Raw Mesh vs FLIR Smooth), and interactive point sampling.
 */

export class ThermalCanvas {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = Object.assign({
      mode: 'laptop', // 'laptop' or 'custom'
      showGrid: true,
      smoothing: 'high', // 'high' (bilinear FLIR) or 'raw' (discrete mesh)
      minTemp: 25.0,
      maxTemp: 100.0,
      onProbe: null,
      onCellClick: null
    }, options);

    this.grid = null;
    this.sources = [];
    this.coolers = [];
    this.probePos = null; // { x, y, r, c, temp }
    this.isHovering = false;

    // INNOVATION TOGGLES: Temperature Gradient & Isotherms
    this.showVectors = false;
    this.showContours = false;
    this.showSlice = false;
    this.sliceR = 10;

    // Offscreen buffer for smooth interpolation
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');

    this.setupEvents();
  }

  setSmoothing(mode) {
    this.options.smoothing = mode;
    this.render();
  }

  setupEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (!this.grid || this.grid.length === 0) return;
      const rows = this.grid.length;
      const cols = this.grid[0].length;
      const cellW = this.canvas.width / cols;
      const cellH = this.canvas.height / rows;

      const c = Math.max(0, Math.min(cols - 1, Math.floor(x / cellW)));
      const r = Math.max(0, Math.min(rows - 1, Math.floor(y / cellH)));
      const temp = this.grid[r][c];

      this.probePos = { x, y, r, c, temp };
      this.isHovering = true;
      this.render();

      if (this.options.onProbe) {
        this.options.onProbe(this.probePos);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.probePos = null;
      this.render();
      if (this.options.onProbe) this.options.onProbe(null);
    });

    this.canvas.addEventListener('click', () => {
      if (this.probePos && this.options.onCellClick) {
        this.options.onCellClick(this.probePos);
      }
    });
  }

  // Pure thermal color spectrum (25°C Deep Navy/Cyan -> 50°C Emerald -> 75°C Amber -> 100°C+ Radiant Red)
  getThermalRGB(temp) {
    const min = this.options.minTemp;
    const max = this.options.maxTemp;
    const t = Math.max(0, Math.min(1, (temp - min) / (max - min)));

    let r, g, b;
    if (t < 0.25) {
      // 0.0 to 0.25: Deep Oceanic Blue -> Cryo Cyan (#0a1f44 -> #00f0ff)
      const f = t / 0.25;
      r = Math.round(10 + f * (0 - 10));
      g = Math.round(31 + f * (240 - 31));
      b = Math.round(68 + f * (255 - 68));
    } else if (t < 0.50) {
      // 0.25 to 0.50: Cryo Cyan -> Kinetic Emerald (#00f0ff -> #10b981)
      const f = (t - 0.25) / 0.25;
      r = Math.round(0 + f * (16 - 0));
      g = Math.round(240 + f * (185 - 240));
      b = Math.round(255 + f * (129 - 255));
    } else if (t < 0.75) {
      // 0.50 to 0.75: Emerald -> Thermal Flux Amber (#10b981 -> #ff9800)
      const f = (t - 0.50) / 0.25;
      r = Math.round(16 + f * (255 - 16));
      g = Math.round(185 + f * (152 - 185));
      b = Math.round(129 + f * (0 - 129));
    } else {
      // 0.75 to 1.0: Amber -> Thermodynamic Orange-Red (#ff9800 -> #ff2a00)
      const f = (t - 0.75) / 0.25;
      r = 255;
      g = Math.round(152 + f * (42 - 152));
      b = Math.round(0 + f * (0 - 0));
    }
    return [r, g, b];
  }

  getThermalColor(temp) {
    const [r, g, b] = this.getThermalRGB(temp);
    return `rgb(${r}, ${g}, ${b})`;
  }

  updateGrid(grid, sources = [], coolers = []) {
    this.grid = grid;
    this.sources = sources;
    this.coolers = coolers;
    this.render();
  }

  render() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Deep base canvas substrate
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, w, h);

    if (!this.grid || this.grid.length === 0) return;

    const rows = this.grid.length;
    const cols = this.grid[0].length;
    const cellW = w / cols;
    const cellH = h / rows;

    if (this.options.smoothing === 'high') {
      // --- ULTRA-SMOOTH FLIR THERMAL VIEW (Bicubic / Bilinear) ---
      // Render raw cells to a low-res offscreen buffer, then upscale with high smoothing quality
      if (this.offscreenCanvas.width !== cols || this.offscreenCanvas.height !== rows) {
        this.offscreenCanvas.width = cols;
        this.offscreenCanvas.height = rows;
      }
      const imgData = this.offscreenCtx.createImageData(cols, rows);
      const data = imgData.data;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = (r * cols + c) * 4;
          const [red, green, blue] = this.getThermalRGB(this.grid[r][c]);
          data[idx] = red;
          data[idx + 1] = green;
          data[idx + 2] = blue;
          data[idx + 3] = 255;
        }
      }
      this.offscreenCtx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.offscreenCanvas, 0, 0, w, h);
    } else {
      // --- RAW FINITE-DIFFERENCE MESH VIEW ---
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = this.getThermalColor(this.grid[r][c]);
          ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
        }
      }

      // Subtle discrete CAD grid wireframe lines
      if (this.options.showGrid) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) {
          ctx.beginPath();
          ctx.moveTo(c * cellW, 0);
          ctx.lineTo(c * cellW, h);
          ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * cellH);
          ctx.lineTo(w, r * cellH);
          ctx.stroke();
        }
      }
    }

    // --- NEXT-LEVEL SILICON DIE FOOTPRINT OVERLAYS ---
    if (this.options.mode === 'laptop') {
      this.renderSiliconFootprints(cellW, cellH, w, h);
    } else if (this.options.mode === 'custom') {
      this.renderCustomFootprints(cellW, cellH);
    }

    // --- INNOVATIONS: ISOTHERMS & TEMPERATURE GRADIENT QUIVER FIELD ---
    if (this.showContours) {
      this.renderIsothermalContours(cellW, cellH, rows, cols);
    }
    if (this.showVectors) {
      this.renderQuiverField(cellW, cellH, rows, cols);
    }
    if (this.showSlice) {
      this.renderSliceCutline(cellW, cellH, w, cols);
    }

    // --- INTERACTIVE HOVER PROBE HUD ---
    if (this.isHovering && this.probePos) {
      this.renderHoverProbe(this.probePos, cellW, cellH);
    }
  }

  // INNOVATION 1: Renders Temperature Gradient & Heat Flux Quiver Vector Arrows (q = -k∇T)
  renderQuiverField(cellW, cellH, rows, cols) {
    const ctx = this.ctx;
    const grid = this.grid;
    const step = Math.max(2, Math.floor(cols / 16));

    // Calculate maximum gradient magnitude for normalized arrow length
    let maxGrad = 0.001;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const gx = (grid[r][c + 1] - grid[r][c - 1]) * 0.5;
        const gy = (grid[r + 1][c] - grid[r - 1][c]) * 0.5;
        const mag = Math.hypot(gx, gy);
        if (mag > maxGrad) maxGrad = mag;
      }
    }

    for (let r = 1; r < rows - 1; r += step) {
      for (let c = 1; c < cols - 1; c += step) {
        // 2nd-order central differences: ∇T = (∂T/∂x, ∂T/∂y)
        const gx = (grid[r][c + 1] - grid[r][c - 1]) * 0.5;
        const gy = (grid[r + 1][c] - grid[r - 1][c]) * 0.5;
        const mag = Math.hypot(gx, gy);
        if (mag < 0.2) continue;

        // Fourier's Law: heat flux q = -k∇T (heat flows from hot dies to cold perimeter)
        const fx = -gx;
        const fy = -gy;
        const angle = Math.atan2(fy, fx);

        const cx = (c + 0.5) * cellW;
        const cy = (r + 0.5) * cellH;
        const len = Math.min(cellW * 1.8, (mag / maxGrad) * (cellW * 2.0) + 4);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        const intensity = Math.min(1, mag / (maxGrad * 0.75));
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + intensity * 0.5})`;
        ctx.lineWidth = 1.3 + intensity * 0.8;

        ctx.beginPath();
        ctx.moveTo(-len * 0.3, 0);
        ctx.lineTo(len * 0.7, 0);
        ctx.lineTo(len * 0.45, -3);
        ctx.moveTo(len * 0.7, 0);
        ctx.lineTo(len * 0.45, 3);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  // INNOVATION 2: Renders Isothermal Contour Boundaries (Isolines of equal temperature)
  renderIsothermalContours(cellW, cellH, rows, cols) {
    const ctx = this.ctx;
    const grid = this.grid;
    const levels = [35.0, 50.0, 65.0, 80.0];

    ctx.save();
    ctx.lineWidth = 1.0;

    for (const lvl of levels) {
      ctx.strokeStyle = lvl >= 80 ? 'rgba(255, 42, 0, 0.75)' :
                        lvl >= 65 ? 'rgba(255, 152, 0, 0.7)' :
                        lvl >= 50 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(0, 240, 255, 0.5)';

      ctx.beginPath();
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          const v0 = grid[r][c];
          const v1 = grid[r][c + 1];
          const v2 = grid[r + 1][c + 1];
          const v3 = grid[r + 1][c];
          const min = Math.min(v0, v1, v2, v3);
          const max = Math.max(v0, v1, v2, v3);

          if (lvl >= min && lvl <= max) {
            const px = (c + 0.5) * cellW;
            const py = (r + 0.5) * cellH;
            ctx.rect(px - 1, py - 1, 2, 2);
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // INNOVATION 3: Draws Horizontal Slice Line across the canvas
  renderSliceCutline(cellW, cellH, w, cols) {
    const ctx = this.ctx;
    const yPos = (this.sliceR + 0.5) * cellH;

    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(w, yPos);
    ctx.stroke();

    // Slice Badge
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(9, 14, 28, 0.9)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(w - 95, yPos - 11, 90, 22);
    ctx.fillRect(w - 95, yPos - 11, 90, 22);

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.fillText(`Slice Row ${this.sliceR}`, w - 88, yPos + 4);
    ctx.restore();
  }

  // Draw delicate dashed silicon die footprints (as seen in the reference AI image)
  renderSiliconFootprints(cellW, cellH, w, h) {
    const ctx = this.ctx;
    ctx.save();

    // 1. CPU Silicon Die Footprint
    const cpuSrc = this.sources.find(s => s.type === 'cpu');
    if (cpuSrc) {
      const cx = cpuSrc.c * cellW;
      const cy = cpuSrc.r * cellH;
      const cw = cpuSrc.width * cellW;
      const ch = cpuSrc.height * cellH;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx, cy, cw, ch);

      // Subtle corner CAD tick marks
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      const tick = 6;
      // Top-Left
      ctx.beginPath(); ctx.moveTo(cx, cy + tick); ctx.lineTo(cx, cy); ctx.lineTo(cx + tick, cy); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(cx + cw - tick, cy); ctx.lineTo(cx + cw, cy); ctx.lineTo(cx + cw, cy + tick); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(cx, cy + ch - tick); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + tick, cy + ch); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(cx + cw - tick, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx + cw, cy + ch - tick); ctx.stroke();

      // Translucent silicon die watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CPU DIE', cx + cw / 2, cy + ch / 2);
    }

    // 2. Discrete GPU Silicon Die Footprint
    const gpuSrc = this.sources.find(s => s.type === 'gpu');
    if (gpuSrc) {
      const gx = gpuSrc.c * cellW;
      const gy = gpuSrc.r * cellH;
      const gw = gpuSrc.width * cellW;
      const gh = gpuSrc.height * cellH;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx, gy, gw, gh);

      // Corner CAD tick marks
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      const tick = 6;
      ctx.beginPath(); ctx.moveTo(gx, gy + tick); ctx.lineTo(gx, gy); ctx.lineTo(gx + tick, gy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx + gw - tick, gy); ctx.lineTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + tick); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx, gy + gh - tick); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + tick, gy + gh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(gx + gw - tick, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.lineTo(gx + gw, gy + gh - tick); ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '600 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GPU DIE', gx + gw / 2, gy + gh / 2);
    }

    // 3. Lower Chassis Li-Ion Battery Pack Footprint
    const batSrc = this.sources.find(s => s.type === 'battery');
    if (batSrc) {
      const bx = batSrc.c * cellW;
      const by = batSrc.r * cellH;
      const bw = batSrc.width * cellW;
      const bh = batSrc.height * cellH;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BATTERY CELL PACK', bx + bw / 2, by + bh / 2);
    }

    ctx.restore();
  }

  renderCustomFootprints(cellW, cellH) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setLineDash([3, 3]);

    for (const src of this.sources) {
      const x = src.c * cellW;
      const y = src.r * cellH;
      const w = src.width * cellW;
      const h = src.height * cellH;

      ctx.strokeStyle = 'rgba(255, 87, 34, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }

    for (const clr of this.coolers) {
      const x = clr.c * cellW;
      const y = clr.r * cellH;
      const w = clr.width * cellW;
      const h = clr.height * cellH;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  renderHoverProbe(probe, cellW, cellH) {
    const ctx = this.ctx;
    const { x, y, r, c, temp } = probe;

    // Crosshair target
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);

    // Floating Tooltip HUD
    const hudW = 130;
    const hudH = 46;
    let hudX = x + 16;
    let hudY = y - 54;

    if (hudX + hudW > this.canvas.width) hudX = x - hudW - 16;
    if (hudY < 10) hudY = y + 20;

    ctx.fillStyle = 'rgba(9, 14, 28, 0.94)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`CELL [${r}, ${c}]`, hudX + 10, hudY + 16);

    ctx.fillStyle = temp >= 80 ? '#ff3b19' : (temp >= 65 ? '#ff9800' : '#00f0ff');
    ctx.font = 'bold 15px Space Grotesk, sans-serif';
    ctx.fillText(`${temp.toFixed(1)}°C`, hudX + 10, hudY + 36);

    // Mini status badge
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9px JetBrains Mono';
    ctx.fillText(temp >= 80 ? 'CRITICAL' : (temp >= 65 ? 'WARM' : 'STABLE'), hudX + 75, hudY + 35);
  }
}
