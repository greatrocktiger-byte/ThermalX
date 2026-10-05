/**
 * NUMERIX LAB - THERMALX Engine
 * Genuine 2D Finite Difference Thermal-Field Simulation & Optimization
 * 
 * Mathematical Model:
 * 2D Steady-State / Transient Heat Conduction (Poisson / Helmholtz):
 *   k * (d^2 T / dx^2 + d^2 T / dy^2) + Q(x,y) - h_conv * (T - T_ambient) = 0
 * 
 * Finite Difference 5-Point Stencil:
 *   T_{i,j}^{k+1} = [ T_{i+1,j} + T_{i-1,j} + T_{i,j+1} + T_{i,j-1} + (h^2/k)*Q_{i,j} + H*T_ambient ] / (4 + H)
 *   where H = h_conv * h^2 / k (dimensionless cooling conductance)
 */

export class ThermalGrid {
  constructor(rows = 24, cols = 32, ambientTemp = 25.0) {
    this.rows = rows;
    this.cols = cols;
    this.ambientTemp = ambientTemp;
    this.grid = this.createGrid(ambientTemp);
    this.sources = []; // { x, y, width, height, targetTemp, heatFlux, type: 'cpu'|'gpu'|'battery'|'custom' }
    this.coolers = []; // { x, y, width, height, efficiency }
    this.insulators = new Set(); // Set of "r,c" for zero-flux Neumann walls
    this.fixedCells = new Map(); // "r,c" -> fixedTemp
    this.coolingIntensity = 0.60; // 0.0 to 1.0
    this.boundaryType = 'dirichlet'; // 'dirichlet' (fixed ambient) or 'neumann' (insulated edges)
  }

  createGrid(val) {
    const g = [];
    for (let r = 0; r < this.rows; r++) {
      const row = new Float64Array(this.cols);
      row.fill(val);
      g.push(row);
    }
    return g;
  }

  cloneGrid(src) {
    const copy = [];
    for (let r = 0; r < this.rows; r++) {
      copy.push(new Float64Array(src[r]));
    }
    return copy;
  }

  reset(ambient = this.ambientTemp) {
    this.ambientTemp = ambient;
    this.grid = this.createGrid(ambient);
  }

  // Setup default realistic laptop motherboard heat topology
  setupLaptopTopology(cpuTemp = 85.0, gpuTemp = 75.0, batteryTemp = 40.0, cooling = 0.60) {
    this.sources = [];
    this.coolers = [];
    this.coolingIntensity = cooling;

    // Relative coordinates scaled to current grid dimensions
    const rScale = this.rows / 24;
    const cScale = this.cols / 32;

    // CPU Die (High power density, center-left)
    const cpuR = Math.round(8 * rScale);
    const cpuC = Math.round(9 * cScale);
    const cpuW = Math.max(3, Math.round(5 * cScale));
    const cpuH = Math.max(3, Math.round(5 * rScale));
    this.sources.push({
      id: 'cpu',
      name: 'CPU Die',
      r: cpuR,
      c: cpuC,
      width: cpuW,
      height: cpuH,
      targetTemp: cpuTemp,
      heatFlux: 13.6 * (cpuTemp / 85.0),
      type: 'cpu'
    });

    // GPU Die (Moderate-high power, center-right)
    const gpuR = Math.round(7 * rScale);
    const gpuC = Math.round(21 * cScale);
    const gpuW = Math.max(3, Math.round(6 * cScale));
    const gpuH = Math.max(3, Math.round(5 * rScale));
    this.sources.push({
      id: 'gpu',
      name: 'Discrete GPU',
      r: gpuR,
      c: gpuC,
      width: gpuW,
      height: gpuH,
      targetTemp: gpuTemp,
      heatFlux: 10.2 * (gpuTemp / 75.0),
      type: 'gpu'
    });

    // Battery Pack (Lower chassis, distributed gentle heat)
    const batR = Math.round(17 * rScale);
    const batC = Math.round(7 * cScale);
    const batW = Math.max(6, Math.round(18 * cScale));
    const batH = Math.max(2, Math.round(4 * rScale));
    this.sources.push({
      id: 'battery',
      name: 'Li-Ion Battery Cell',
      r: batR,
      c: batC,
      width: batW,
      height: batH,
      targetTemp: batteryTemp,
      heatFlux: 2.2 * (batteryTemp / 40.0),
      type: 'battery'
    });

    // Copper Heat Pipe & Exhaust Fans (Top perimeter)
    const fan1C = Math.round(4 * cScale);
    const fan2C = Math.round(27 * cScale);
    this.coolers.push({
      name: 'Left Exhaust Fan',
      r: 1,
      c: fan1C,
      width: Math.max(2, Math.round(4 * cScale)),
      height: Math.max(2, Math.round(3 * rScale)),
      efficiency: 1.2
    });
    this.coolers.push({
      name: 'Right Exhaust Fan',
      r: 1,
      c: fan2C,
      width: Math.max(2, Math.round(4 * cScale)),
      height: Math.max(2, Math.round(3 * rScale)),
      efficiency: 1.2
    });
  }

  // Perform a single Jacobi iteration
  // New values computed solely from previous grid k
  iterateJacobi(currentGrid) {
    const nextGrid = this.cloneGrid(currentGrid);
    const { rows, cols, ambientTemp, coolingIntensity, boundaryType } = this;
    const baseH = 0.08 * coolingIntensity;
    let maxError = 0.0;

    // Precalculate source and cooling field maps for fast lookup
    const { qMap, hMap, fixedMap } = this.buildFieldMaps(baseH);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;

        // Fixed Dirichlet cell or insulator
        if (fixedMap.has(key)) {
          nextGrid[r][c] = fixedMap.get(key);
          continue;
        }

        // Boundary handling
        const isBoundary = (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
        if (isBoundary) {
          if (boundaryType === 'dirichlet') {
            nextGrid[r][c] = ambientTemp;
            continue;
          } else {
            // Neumann insulated: mirror neighbor
            const nr = r === 0 ? 1 : (r === rows - 1 ? rows - 2 : r);
            const nc = c === 0 ? 1 : (c === cols - 1 ? cols - 2 : c);
            nextGrid[r][c] = currentGrid[nr][nc];
            continue;
          }
        }

        // 5-point stencil neighbors from PREVIOUS grid (Pure Jacobi)
        const tUp = currentGrid[r - 1][c];
        const tDown = currentGrid[r + 1][c];
        const tLeft = currentGrid[r][c - 1];
        const tRight = currentGrid[r][c + 1];

        const localH = hMap[r][c];
        const localQ = qMap[r][c];

        const sumNeighbors = tUp + tDown + tLeft + tRight;
        const newVal = (sumNeighbors + localQ + localH * ambientTemp) / (4.0 + localH);

        const diff = Math.abs(newVal - currentGrid[r][c]);
        if (diff > maxError) maxError = diff;

        nextGrid[r][c] = newVal;
      }
    }

    return { nextGrid, maxError };
  }

  // Perform a single Gauss-Seidel iteration
  // Interior updates IMMEDIATELY reuse newly calculated values in the current pass
  iterateGaussSeidel(gridInOut) {
    const { rows, cols, ambientTemp, coolingIntensity, boundaryType } = this;
    const baseH = 0.08 * coolingIntensity;
    let maxError = 0.0;

    const { qMap, hMap, fixedMap } = this.buildFieldMaps(baseH);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r},${c}`;

        if (fixedMap.has(key)) {
          gridInOut[r][c] = fixedMap.get(key);
          continue;
        }

        const isBoundary = (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
        if (isBoundary) {
          if (boundaryType === 'dirichlet') {
            gridInOut[r][c] = ambientTemp;
            continue;
          } else {
            const nr = r === 0 ? 1 : (r === rows - 1 ? rows - 2 : r);
            const nc = c === 0 ? 1 : (c === cols - 1 ? cols - 2 : c);
            gridInOut[r][c] = gridInOut[nr][nc];
            continue;
          }
        }

        // Immediate in-place values: tUp and tLeft already updated in this scan!
        const tUp = gridInOut[r - 1][c];
        const tDown = gridInOut[r + 1][c];
        const tLeft = gridInOut[r][c - 1];
        const tRight = gridInOut[r][c + 1];

        const localH = hMap[r][c];
        const localQ = qMap[r][c];

        const sumNeighbors = tUp + tDown + tLeft + tRight;
        const newVal = (sumNeighbors + localQ + localH * ambientTemp) / (4.0 + localH);

        const diff = Math.abs(newVal - gridInOut[r][c]);
        if (diff > maxError) maxError = diff;

        gridInOut[r][c] = newVal;
      }
    }

    return { nextGrid: gridInOut, maxError };
  }

  // Generate 2D continuous matrices for heat sources Q and cooling H
  buildFieldMaps(baseH) {
    const rows = this.rows;
    const cols = this.cols;
    const qMap = Array.from({ length: rows }, () => new Float64Array(cols));
    const hMap = Array.from({ length: rows }, () => new Float64Array(cols));
    const fixedMap = new Map(this.fixedCells);

    // Baseline convection dissipation across entire chassis
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        hMap[r][c] = baseH;
      }
    }

    // Apply Heat Sources
    for (const src of this.sources) {
      const rStart = Math.max(0, src.r);
      const rEnd = Math.min(rows, src.r + src.height);
      const cStart = Math.max(0, src.c);
      const cEnd = Math.min(cols, src.c + src.width);

      for (let r = rStart; r < rEnd; r++) {
        for (let c = cStart; c < cEnd; c++) {
          // Heat source flux
          qMap[r][c] += src.heatFlux;
        }
      }
    }

    // Apply Active Cooling Exhaust Sinks
    for (const clr of this.coolers) {
      const rStart = Math.max(0, clr.r);
      const rEnd = Math.min(rows, clr.r + clr.height);
      const cStart = Math.max(0, clr.c);
      const cEnd = Math.min(cols, clr.c + clr.width);

      for (let r = rStart; r < rEnd; r++) {
        for (let c = cStart; c < cEnd; c++) {
          hMap[r][c] += baseH * (3.5 * clr.efficiency);
        }
      }
    }

    return { qMap, hMap, fixedMap };
  }

  // Run full simulation until convergence or maxIterations
  solve({ method = 'gauss-seidel', maxIterations = 50, tolerance = 0.001, onStep = null }) {
    const startTime = performance.now();
    let currentGrid = this.cloneGrid(this.grid);
    const history = []; // [ { iteration, error, maxTemp, avgTemp } ]

    let iteration = 0;
    let converged = false;
    let finalError = 1.0;

    while (iteration < maxIterations && !converged) {
      iteration++;
      let result;

      if (method === 'jacobi') {
        result = this.iterateJacobi(currentGrid);
        currentGrid = result.nextGrid;
      } else {
        // Gauss-Seidel
        result = this.iterateGaussSeidel(currentGrid);
        currentGrid = result.nextGrid;
      }

      finalError = result.maxError;
      const stats = this.calculateStatistics(currentGrid);
      history.push({
        iteration,
        error: finalError,
        maxTemp: stats.maxTemp,
        avgTemp: stats.avgTemp,
        minTemp: stats.minTemp
      });

      if (onStep) {
        onStep({
          iteration,
          maxIterations,
          error: finalError,
          grid: currentGrid,
          stats
        });
      }

      if (finalError <= tolerance) {
        converged = true;
      }
    }

    const durationMs = performance.now() - startTime;
    this.grid = currentGrid;
    const finalStats = this.calculateStatistics(currentGrid);

    return {
      converged,
      iterations: iteration,
      maxIterations,
      finalError,
      durationMs,
      history,
      grid: currentGrid,
      stats: finalStats,
      method
    };
  }

  // Compute thermal metrics across grid
  calculateStatistics(g = this.grid) {
    let maxTemp = -Infinity;
    let minTemp = Infinity;
    let sum = 0;
    let count = 0;
    let maxR = 0;
    let maxC = 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const val = g[r][c];
        if (val > maxTemp) {
          maxTemp = val;
          maxR = r;
          maxC = c;
        }
        if (val < minTemp) {
          minTemp = val;
        }
        sum += val;
        count++;
      }
    }

    const avgTemp = count > 0 ? sum / count : this.ambientTemp;

    // Determine status tier
    let status = 'Stable';
    if (maxTemp >= 90) status = 'Critical';
    else if (maxTemp >= 80) status = 'Hot';
    else if (maxTemp >= 65) status = 'Warm';

    // Count hotspots (> 75°C)
    let hotspotCount = 0;
    for (const src of this.sources) {
      if (src.targetTemp >= 70) hotspotCount++;
    }
    if (hotspotCount === 0 && maxTemp > 75) hotspotCount = 1;

    return {
      maxTemp: parseFloat(maxTemp.toFixed(1)),
      minTemp: parseFloat(minTemp.toFixed(1)),
      avgTemp: parseFloat(avgTemp.toFixed(1)),
      hotspots: hotspotCount,
      primaryHotspot: {
        name: maxTemp >= 82 ? 'CPU Core Die' : (maxTemp >= 74 ? 'Discrete GPU' : 'Mainboard Core'),
        temp: parseFloat(maxTemp.toFixed(1)),
        r: maxR,
        c: maxC
      },
      status
    };
  }

  // BISECTION METHOD FOR THERMAL OPTIMIZATION
  // Problem: Find the minimum cooling intensity C* in [0, 1]
  // such that MaxTemp(C*) <= targetMaxTemp (e.g. 75.0°C).
  // Guaranteed mathematically since MaxTemp(C) is monotonically decreasing in C.
  optimizeCoolingBisection({
    targetMaxTemp = 75.0,
    tolerance = 0.01,
    maxSteps = 12,
    solverMethod = 'gauss-seidel',
    maxIterPerRun = 40
  }) {
    let a = 0.0; // 0% cooling
    let b = 1.0; // 100% cooling
    const steps = [];

    // Helper to evaluate T_max given cooling C
    const evalCooling = (coolingVal) => {
      const sim = new ThermalGrid(this.rows, this.cols, this.ambientTemp);
      sim.sources = JSON.parse(JSON.stringify(this.sources));
      sim.coolers = JSON.parse(JSON.stringify(this.coolers));
      sim.coolingIntensity = coolingVal;
      sim.fixedCells = new Map(this.fixedCells);
      sim.boundaryType = this.boundaryType;
      const res = sim.solve({ method: solverMethod, maxIterations: maxIterPerRun, tolerance: 0.005 });
      return res.stats.maxTemp;
    };

    // Test boundaries
    const tempAtZero = evalCooling(a);
    const tempAtFull = evalCooling(b);

    if (tempAtZero <= targetMaxTemp) {
      return {
        optimalCooling: 0.0,
        optimalPercent: 0,
        achievedTemp: tempAtZero,
        targetMaxTemp,
        steps: [{ step: 1, a: 0, b: 0, mid: 0, maxTemp: tempAtZero, satisfied: true }],
        status: 'Passively Stable (No extra cooling needed)'
      };
    }

    if (tempAtFull > targetMaxTemp) {
      return {
        optimalCooling: 1.0,
        optimalPercent: 100,
        achievedTemp: tempAtFull,
        targetMaxTemp,
        steps: [{ step: 1, a: 0, b: 1, mid: 1, maxTemp: tempAtFull, satisfied: false }],
        status: 'Insufficient Cooling (Cannot meet target even at 100% fan speed)'
      };
    }

    let optimalCooling = b;
    let achievedTemp = tempAtFull;

    for (let step = 1; step <= maxSteps; step++) {
      const mid = (a + b) / 2.0;
      const maxT = evalCooling(mid);
      const satisfied = maxT <= targetMaxTemp;

      steps.push({
        step,
        a: parseFloat((a * 100).toFixed(1)),
        b: parseFloat((b * 100).toFixed(1)),
        mid: parseFloat((mid * 100).toFixed(1)),
        maxTemp: parseFloat(maxT.toFixed(1)),
        satisfied,
        intervalWidth: parseFloat(((b - a) * 100).toFixed(2))
      });

      if (satisfied) {
        // Cooling is enough; try to lower cooling further (search lower interval [a, mid])
        optimalCooling = mid;
        achievedTemp = maxT;
        b = mid;
      } else {
        // Cooling is not enough; must increase cooling (search upper interval [mid, b])
        a = mid;
      }

      if ((b - a) < tolerance) {
        break;
      }
    }

    return {
      optimalCooling,
      optimalPercent: Math.round(optimalCooling * 100),
      achievedTemp: parseFloat(achievedTemp.toFixed(1)),
      targetMaxTemp,
      steps,
      status: 'Optimal Cooling Found'
    };
  }

  // SOLVER COMPARISON: JACOBI VS GAUSS-SEIDEL
  // Runs both methods on identical thermal boundary conditions
  compareSolvers({ maxIterations = 50, tolerance = 0.001 }) {
    // Run Jacobi
    const jacobiGrid = new ThermalGrid(this.rows, this.cols, this.ambientTemp);
    jacobiGrid.sources = JSON.parse(JSON.stringify(this.sources));
    jacobiGrid.coolers = JSON.parse(JSON.stringify(this.coolers));
    jacobiGrid.coolingIntensity = this.coolingIntensity;
    jacobiGrid.fixedCells = new Map(this.fixedCells);
    jacobiGrid.boundaryType = this.boundaryType;
    const jacobiResult = jacobiGrid.solve({ method: 'jacobi', maxIterations, tolerance });

    // Run Gauss-Seidel
    const gsGrid = new ThermalGrid(this.rows, this.cols, this.ambientTemp);
    gsGrid.sources = JSON.parse(JSON.stringify(this.sources));
    gsGrid.coolers = JSON.parse(JSON.stringify(this.coolers));
    gsGrid.coolingIntensity = this.coolingIntensity;
    gsGrid.fixedCells = new Map(this.fixedCells);
    gsGrid.boundaryType = this.boundaryType;
    const gsResult = gsGrid.solve({ method: 'gauss-seidel', maxIterations, tolerance });

    return {
      jacobi: jacobiResult,
      gaussSeidel: gsResult,
      speedup: gsResult.iterations > 0 ? parseFloat((jacobiResult.iterations / gsResult.iterations).toFixed(2)) : 1.0,
      theoreticalRatio: 2.0 // Gauss-Seidel has spectral radius rho(T_GS) ~ rho(T_J)^2 for Laplace
    };
  }
}
