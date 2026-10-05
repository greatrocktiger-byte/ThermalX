/**
 * ============================================================================
 * THERMALX: PURE COMPUTATIONAL MATHEMATICAL ENGINE
 * Governing PDE: 2D Steady-State Poisson Heat Equation: ∇²T = -q/k
 * Finite Difference Discretization: 5-Point Central Stencil
 * Iterative Solvers: Jacobi vs. Gauss-Seidel Relaxation
 * Vector Calculus: Temperature Gradient ∇T & Fourier Heat Flux q = -k∇T
 * ============================================================================
 */

export class ThermalFieldSolver {
  constructor(nx = 40, ny = 40, ambientTemp = 25.0) {
    this.nx = nx;
    this.ny = ny;
    this.ambientTemp = ambientTemp;
    this.k = 1.5; // Thermal conductivity (W/m·K)
    this.h = 1.0; // Spatial step size Δx = Δy = h
    
    // Allocate 2D computational grid
    this.grid = new Float64Array(nx * ny);
    this.resetGrid();
    
    // Heat sources (silicon components)
    this.sources = [
      { id: 'cpu', name: 'CPU Core', x0: 10, x1: 17, y0: 10, y1: 17, temp: 90.0, color: '#ef4444' },
      { id: 'gpu', name: 'GPU Die',  x0: 23, x1: 30, y0: 10, y1: 17, temp: 82.0, color: '#f97316' },
      { id: 'bat', name: 'Battery',  x0: 12, x1: 28, y0: 26, y1: 32, temp: 42.0, color: '#eab308' }
    ];

    this.coolingFactor = 0.05; // Convective dissipation
    this.currentIteration = 0;
    this.maxIterations = 2000;
    this.tolerance = 0.001;
    this.lastResidual = 0;
    this.history = [];
    this.isConverged = false;
  }

  resetGrid() {
    this.grid.fill(this.ambientTemp);
    this.currentIteration = 0;
    this.lastResidual = 0;
    this.history = [];
    this.isConverged = false;
    this.applySources();
  }

  setResolution(nx, ny) {
    this.nx = nx;
    this.ny = ny;
    this.grid = new Float64Array(nx * ny);
    this.resetGrid();
  }

  applySources() {
    const scaleX = this.nx / 40;
    const scaleY = this.ny / 40;
    
    for (const src of this.sources) {
      const x0 = Math.max(1, Math.floor(src.x0 * scaleX));
      const x1 = Math.min(this.nx - 2, Math.floor(src.x1 * scaleX));
      const y0 = Math.max(1, Math.floor(src.y0 * scaleY));
      const y1 = Math.min(this.ny - 2, Math.floor(src.y1 * scaleY));

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          this.grid[y * this.nx + x] = src.temp;
        }
      }
    }
  }

  isSourceCell(x, y) {
    const scaleX = this.nx / 40;
    const scaleY = this.ny / 40;
    for (const src of this.sources) {
      if (x >= src.x0 * scaleX && x <= src.x1 * scaleX &&
          y >= src.y0 * scaleY && y <= src.y1 * scaleY) {
        return true;
      }
    }
    return false;
  }

  /**
   * Jacobi Iteration: Uses strictly values from previous time-step k.
   * Requires dual buffer.
   */
  stepJacobi() {
    const nx = this.nx;
    const ny = this.ny;
    const old = this.grid;
    const next = new Float64Array(old);
    let maxDiff = 0.0;

    for (let y = 1; y < ny - 1; y++) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x++) {
        if (this.isSourceCell(x, y)) continue;

        const idx = row + x;
        // 5-point central Laplacian stencil
        const updated = 0.25 * (
          old[idx - nx] + // North
          old[idx + nx] + // South
          old[idx - 1]  + // West
          old[idx + 1]    // East
        ) - (this.coolingFactor * (old[idx] - this.ambientTemp) * 0.01);

        const diff = Math.abs(updated - old[idx]);
        if (diff > maxDiff) maxDiff = diff;
        next[idx] = updated;
      }
    }

    this.grid = next;
    this.currentIteration++;
    this.lastResidual = maxDiff;
    this.history.push(maxDiff);

    if (maxDiff < this.tolerance || this.currentIteration >= this.maxIterations) {
      this.isConverged = true;
    }

    return { iteration: this.currentIteration, residual: maxDiff, converged: this.isConverged };
  }

  /**
   * Gauss-Seidel Iteration: In-place array updates with immediate reuse.
   * Information propagates ~2x faster across the spatial lattice.
   */
  stepGaussSeidel() {
    const nx = this.nx;
    const ny = this.ny;
    const grid = this.grid;
    let maxDiff = 0.0;

    for (let y = 1; y < ny - 1; y++) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x++) {
        if (this.isSourceCell(x, y)) continue;

        const idx = row + x;
        const oldVal = grid[idx];
        
        // Directly references updated west and north cells within the same sweep
        const updated = 0.25 * (
          grid[idx - nx] + // North (already updated in this sweep)
          grid[idx + nx] + // South
          grid[idx - 1]  + // West (already updated in this sweep)
          grid[idx + 1]    // East
        ) - (this.coolingFactor * (oldVal - this.ambientTemp) * 0.01);

        const diff = Math.abs(updated - oldVal);
        if (diff > maxDiff) maxDiff = diff;
        grid[idx] = updated;
      }
    }

    this.currentIteration++;
    this.lastResidual = maxDiff;
    this.history.push(maxDiff);

    if (maxDiff < this.tolerance || this.currentIteration >= this.maxIterations) {
      this.isConverged = true;
    }

    return { iteration: this.currentIteration, residual: maxDiff, converged: this.isConverged };
  }

  /**
   * Vector Calculus: Computes the 2D Temperature Gradient ∇T & Heat Flux q = -k∇T
   * Central Difference 2nd-order approximation:
   * ∂T/∂x = [T(x+1, y) - T(x-1, y)] / 2h
   * ∂T/∂y = [T(x, y+1) - T(x, y-1)] / 2h
   */
  computeGradientField() {
    const nx = this.nx;
    const ny = this.ny;
    const grid = this.grid;
    const gradX = new Float32Array(nx * ny);
    const gradY = new Float32Array(nx * ny);
    const gradMag = new Float32Array(nx * ny);
    let maxGrad = 0;
    let maxGradPos = { x: 0, y: 0 };

    for (let y = 1; y < ny - 1; y++) {
      const row = y * nx;
      for (let x = 1; x < nx - 1; x++) {
        const idx = row + x;
        const gx = (grid[idx + 1] - grid[idx - 1]) * 0.5;
        const gy = (grid[idx + nx] - grid[idx - nx]) * 0.5;
        const mag = Math.hypot(gx, gy);

        gradX[idx] = gx;
        gradY[idx] = gy;
        gradMag[idx] = mag;

        if (mag > maxGrad) {
          maxGrad = mag;
          maxGradPos = { x, y };
        }
      }
    }

    return { gradX, gradY, gradMag, maxGrad, maxGradPos };
  }

  /**
   * Extracts a 1D temperature slice profile along a specified horizontal y-axis cutline.
   */
  getHorizontalSlice(yIndex) {
    const y = Math.min(this.ny - 1, Math.max(0, yIndex));
    const slice = [];
    const offset = y * this.nx;
    for (let x = 0; x < this.nx; x++) {
      slice.push(this.grid[offset + x]);
    }
    return slice;
  }

  /**
   * Hotspot and thermal telemetry statistics
   */
  getStatistics() {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let hotspots = 0;

    for (let i = 0; i < this.grid.length; i++) {
      const v = this.grid[i];
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
      if (v >= 75.0) hotspots++;
    }

    const avg = sum / this.grid.length;
    let status = 'Optimal';
    let statusColor = '#10b981';
    if (max >= 90) {
      status = 'Critical Throttle';
      statusColor = '#ef4444';
    } else if (max >= 75) {
      status = 'Thermal Warning';
      statusColor = '#f59e0b';
    } else if (max >= 50) {
      status = 'Elevated';
      statusColor = '#38bdf8';
    }

    return { min, max, avg, hotspots, status, statusColor };
  }
}
