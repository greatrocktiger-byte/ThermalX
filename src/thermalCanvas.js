/**
 * ============================================================================
 * THERMALX: CANVAS VISUALIZATION ENGINE
 * Features:
 * 1. 2D Scientific Heatmap Shader (Bilinear Colormap Interpolation)
 * 2. Temperature Gradient Quiver Field Overlay (Vector Arrows: q = -k∇T)
 * 3. Isothermal Contour Lines (Isolines of Equal Temperature)
 * 4. Interactive 1D Slice Line Indicator
 * ============================================================================
 */

export class ThermalCanvasRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    
    // Visualization Toggles
    this.showVectors = true;
    this.showContours = true;
    this.showComponents = true;
    this.showSliceLine = true;
    this.sliceY = 13; // default cutline
    
    // Internal offscreen buffer for crisp rendering
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d');
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /**
   * Scientific Colormap Interpolation (Inferno/Turbo inspired)
   * Blue (25°C) -> Teal (40°C) -> Green (55°C) -> Orange (75°C) -> Deep Red (95°C)
   */
  getColor(temp, minT = 25.0, maxT = 95.0) {
    const t = Math.max(0, Math.min(1, (temp - minT) / (maxT - minT)));
    
    let r, g, b;
    if (t < 0.25) { // Navy to Cyan
      const factor = t / 0.25;
      r = Math.floor(11 + factor * (56 - 11));
      g = Math.floor(15 + factor * (189 - 15));
      b = Math.floor(45 + factor * (248 - 45));
    } else if (t < 0.5) { // Cyan to Emerald Green
      const factor = (t - 0.25) / 0.25;
      r = Math.floor(56 - factor * 20);
      g = Math.floor(189 + factor * 22);
      b = Math.floor(248 - factor * 120);
    } else if (t < 0.75) { // Green to Amber/Orange
      const factor = (t - 0.5) / 0.25;
      r = Math.floor(36 + factor * (245 - 36));
      g = Math.floor(211 - factor * (211 - 158));
      b = Math.floor(128 - factor * 117);
    } else { // Orange to Bright Crimson
      const factor = (t - 0.75) / 0.25;
      r = Math.floor(245 + factor * 10);
      g = Math.floor(158 - factor * 110);
      b = Math.floor(11 + factor * 40);
    }
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Main Render Sweep
   */
  render(solver) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const nx = solver.nx;
    const ny = solver.ny;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Temperature Grid Heatmap
    const cellW = w / nx;
    const cellH = h / ny;

    for (let y = 0; y < ny; y++) {
      const rowOffset = y * nx;
      for (let x = 0; x < nx; x++) {
        const temp = solver.grid[rowOffset + x];
        ctx.fillStyle = this.getColor(temp, solver.ambientTemp, 95.0);
        ctx.fillRect(x * cellW, y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // 2. Draw Isothermal Contour Lines if enabled
    if (this.showContours) {
      this.drawContours(solver, cellW, cellH);
    }

    // 3. Draw Temperature Gradient Quiver Vectors (Heat flux arrows)
    if (this.showVectors) {
      this.drawQuiverField(solver, cellW, cellH);
    }

    // 4. Draw Component Overlays (CPU, GPU, Battery boundaries)
    if (this.showComponents) {
      this.drawComponentBadges(solver, cellW, cellH);
    }

    // 5. Draw 1D Slice Cutline Indicator
    if (this.showSliceLine) {
      this.drawSliceIndicator(solver, cellH, w);
    }
  }

  /**
   * INNOVATION: Draws Heat Flux & Gradient Vectors (Quiver Plot)
   * Arrow points along flux vector (-∇T) from hot dies to cold edges.
   */
  drawQuiverField(solver, cellW, cellH) {
    const ctx = this.ctx;
    const { gradX, gradY, gradMag, maxGrad } = solver.computeGradientField();
    const nx = solver.nx;
    const ny = solver.ny;
    
    // Sub-sample vectors so the canvas is clear and readable
    const step = Math.max(2, Math.floor(nx / 16));

    for (let y = 1; y < ny - 1; y += step) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x += step) {
        const idx = row + x;
        const mag = gradMag[idx];
        if (mag < 0.2) continue; // Skip negligible flux

        // Heat flux vector is directed opposite to the gradient (Fourier's law q = -k∇T)
        const fx = -gradX[idx];
        const fy = -gradY[idx];
        const angle = Math.atan2(fy, fx);

        const cx = (x + 0.5) * cellW;
        const cy = (y + 0.5) * cellH;
        
        // Arrow length proportional to gradient magnitude
        const len = Math.min(cellW * 1.6, (mag / (maxGrad || 1)) * (cellW * 1.8) + 4);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Vector arrow styling: high-flux is bright white/cyan
        const normIntensity = Math.min(1, mag / (maxGrad * 0.7 || 1));
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + normIntensity * 0.5})`;
        ctx.lineWidth = 1.2 + normIntensity * 0.8;

        // Arrow line
        ctx.beginPath();
        ctx.moveTo(-len * 0.3, 0);
        ctx.lineTo(len * 0.7, 0);
        // Arrow head
        ctx.lineTo(len * 0.45, -3);
        ctx.moveTo(len * 0.7, 0);
        ctx.lineTo(len * 0.45, 3);
        ctx.stroke();

        ctx.restore();
      }
    }
  }

  /**
   * INNOVATION: Renders Isothermal Contour Boundaries
   */
  drawContours(solver, cellW, cellH) {
    const ctx = this.ctx;
    const nx = solver.nx;
    const ny = solver.ny;
    const grid = solver.grid;
    
    // Contour thresholds: 35°C, 50°C, 65°C, 80°C
    const levels = [35.0, 50.0, 65.0, 80.0];

    ctx.save();
    ctx.lineWidth = 1.0;

    for (const level of levels) {
      ctx.strokeStyle = (level >= 80) ? 'rgba(239, 68, 68, 0.7)' :
                        (level >= 65) ? 'rgba(245, 158, 11, 0.6)' :
                        (level >= 50) ? 'rgba(52, 211, 153, 0.5)' : 'rgba(56, 189, 248, 0.4)';

      ctx.beginPath();
      // Marching squares edge detection
      for (let y = 0; y < ny - 1; y++) {
        const r1 = y * nx;
        const r2 = (y + 1) * nx;
        for (let x = 0; x < nx - 1; x++) {
          const v0 = grid[r1 + x];
          const v1 = grid[r1 + x + 1];
          const v2 = grid[r2 + x + 1];
          const v3 = grid[r2 + x];

          // Check if contour crosses cell
          const min = Math.min(v0, v1, v2, v3);
          const max = Math.max(v0, v1, v2, v3);
          if (level >= min && level <= max) {
            const px = (x + 0.5) * cellW;
            const py = (y + 0.5) * cellH;
            ctx.rect(px - 1, py - 1, 2, 2);
          }
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Component Chassis Badges (CPU, GPU, Battery boundaries)
   */
  drawComponentBadges(solver, cellW, cellH) {
    const ctx = this.ctx;
    const scaleX = solver.nx / 40;
    const scaleY = solver.ny / 40;

    for (const src of solver.sources) {
      const x0 = src.x0 * scaleX * cellW;
      const y0 = src.y0 * scaleY * cellH;
      const bw = (src.x1 - src.x0) * scaleX * cellW;
      const bh = (src.y1 - src.y0) * scaleY * cellH;

      ctx.save();
      // Bounding box with dashed border
      ctx.strokeStyle = src.color || '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x0, y0, bw, bh);

      // Component pill label
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(x0 + 4, y0 + 4, 75, 18);
      ctx.strokeStyle = src.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 4, y0 + 4, 75, 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${src.name}`, x0 + 8, y0 + 16);
      ctx.restore();
    }
  }

  /**
   * 1D Slice Line Indicator
   */
  drawSliceIndicator(solver, cellH, w) {
    const ctx = this.ctx;
    const yPos = (this.sliceY + 0.5) * cellH;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(w, yPos);
    ctx.stroke();

    // Slice label badge
    ctx.setLineDash([]);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(w - 95, yPos - 10, 90, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9.5px monospace';
    ctx.fillText(`Slice y=${this.sliceY}`, w - 85, yPos + 4);
    ctx.restore();
  }
}
