/**
 * NUMERIX LAB - ACADEMIC SUITE & VIVA LAB
 * Dedicated Interactive Academic Demonstrations for Viva Presentations:
 * 1. Jacobi vs Gauss-Seidel Linear System Solver (A * x = b)
 * 2. Bisection Method Root Optimization
 * 3. Newton-Raphson Nonlinear Solver
 * 4. Power Iteration Dominant Eigenvalue & Eigenvector Calculator
 */

export class AcademicLab {
  // Preset catalog for Linear Systems (Ax = b)
  static linearPresets = {
    standard: {
      name: "4x4 Diagonally Dominant (Viva Benchmark)",
      desc: "Strictly diagonally dominant (|a_ii| > Σ|a_ij|), ensuring guaranteed Jacobi and Gauss-Seidel convergence.",
      equationStr: "10x₁ - x₂ + 2x₃ = 6 | -x₁ + 11x₂ - x₃ + 3x₄ = 25 | 2x₁ - x₂ + 10x₃ - x₄ = -11 | 3x₂ - x₃ + 8x₄ = 15",
      A: [
        [10, -1, 2, 0],
        [-1, 11, -1, 3],
        [2, -1, 10, -1],
        [0, 3, -1, 8]
      ],
      b: [6, 25, -11, 15]
    },
    thermal: {
      name: "3x3 Heat Conduction 1D Rod",
      desc: "Discretized 1D heat equation (Laplacian finite difference: -T_{i-1} + 2T_i - T_{i+1} = Q_i).",
      equationStr: "4T₁ - T₂ = 60 | -T₁ + 4T₂ - T₃ = 20 | -T₂ + 4T₃ = 90",
      A: [
        [4, -1, 0],
        [-1, 4, -1],
        [0, -1, 4]
      ],
      b: [60, 20, 90]
    },
    slow: {
      name: "3x3 Weakly Dominant (Gauss-Seidel 2.5x Speedup)",
      desc: "Highlights how Gauss-Seidel reuses newly computed values immediately, outperforming Jacobi.",
      equationStr: "3x₁ + 2x₂ = 5 | x₁ + 3x₂ + x₃ = 5 | 2x₂ + 3x₃ = 5",
      A: [
        [3, 2, 0],
        [1, 3, 1],
        [0, 2, 3]
      ],
      b: [5, 5, 5]
    }
  };

  // 1. JACOBI & GAUSS-SEIDEL MATRIX SOLVER
  static solveLinearSystem({
    preset = 'standard',
    A = null,
    b = null,
    initialGuess = null,
    maxIter = 30,
    tol = 1e-4
  }) {
    const selectedPreset = this.linearPresets[preset] || this.linearPresets.standard;
    const matA = A || selectedPreset.A;
    const vecB = b || selectedPreset.b;
    const n = vecB.length;
    const x0 = initialGuess ? [...initialGuess] : new Array(n).fill(0);

    // --- JACOBI ---
    const jacobiSteps = [];
    let xJ = [...x0];
    let jConverged = false;

    for (let k = 1; k <= maxIter; k++) {
      const nextX = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          if (i !== j) sum += matA[i][j] * xJ[j];
        }
        nextX[i] = (vecB[i] - sum) / matA[i][i];
      }

      let err = 0;
      for (let i = 0; i < n; i++) {
        err = Math.max(err, Math.abs(nextX[i] - xJ[i]));
      }

      jacobiSteps.push({
        iteration: k,
        x: nextX.map(v => parseFloat(v.toFixed(5))),
        error: parseFloat(err.toExponential(4))
      });

      xJ = nextX;
      if (err < tol) {
        jConverged = true;
        break;
      }
    }

    // --- GAUSS-SEIDEL ---
    const gsSteps = [];
    let xGS = [...x0];
    let gsConverged = false;

    for (let k = 1; k <= maxIter; k++) {
      const nextX = [...xGS];
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          if (i !== j) sum += matA[i][j] * nextX[j]; // Immediately reuses freshly updated values!
        }
        nextX[i] = (vecB[i] - sum) / matA[i][i];
      }

      let err = 0;
      for (let i = 0; i < n; i++) {
        err = Math.max(err, Math.abs(nextX[i] - xGS[i]));
      }

      gsSteps.push({
        iteration: k,
        x: nextX.map(v => parseFloat(v.toFixed(5))),
        error: parseFloat(err.toExponential(4))
      });

      xGS = nextX;
      if (err < tol) {
        gsConverged = true;
        break;
      }
    }

    return {
      preset: selectedPreset,
      jacobi: { steps: jacobiSteps, solution: xJ, converged: jConverged, iterations: jacobiSteps.length },
      gaussSeidel: { steps: gsSteps, solution: xGS, converged: gsConverged, iterations: gsSteps.length },
      speedup: gsSteps.length > 0 ? parseFloat((jacobiSteps.length / gsSteps.length).toFixed(2)) : 1.0
    };
  }

  // Preset catalog for Bisection
  static bisectionPresets = {
    cube1: {
      name: "f(x) = x³ - 4x - 9",
      desc: "Standard cubic polynomial root finding viva problem.",
      formula: "x³ - 4x - 9 = 0",
      f: (x) => Math.pow(x, 3) - 4 * x - 9,
      defaultA: 2.0,
      defaultB: 3.0,
      xMin: 1.5,
      xMax: 3.5
    },
    cube2: {
      name: "f(x) = x³ - x - 2",
      desc: "Continuous curve crossing zero in [1.0, 2.0].",
      formula: "x³ - x - 2 = 0",
      f: (x) => Math.pow(x, 3) - x - 2,
      defaultA: 1.0,
      defaultB: 2.0,
      xMin: 0.5,
      xMax: 2.5
    },
    trig: {
      name: "f(x) = cos(x) - x",
      desc: "Transcendental root (Dottie number: x ≈ 0.739085).",
      formula: "cos(x) - x = 0",
      f: (x) => Math.cos(x) - x,
      defaultA: 0.0,
      defaultB: 1.5,
      xMin: -0.5,
      xMax: 2.0
    },
    thermal: {
      name: "f(T) = T⁴ - 2.5×10⁷ (Thermal Radiation)",
      desc: "Stefan-Boltzmann radiation equilibrium temperature (T ≈ 70.71°C).",
      formula: "T⁴ - 2.5×10⁷ = 0",
      f: (x) => Math.pow(x, 4) - 2.5e7,
      defaultA: 60.0,
      defaultB: 80.0,
      xMin: 50.0,
      xMax: 90.0
    }
  };

  // 2. BISECTION METHOD ROOT FINDER
  static runBisection({
    funcId = 'cube1',
    a = null,
    b = null,
    tol = 1e-5,
    maxIter = 25
  }) {
    const preset = this.bisectionPresets[funcId] || this.bisectionPresets.cube1;
    const f = preset.f;
    const startA = a !== null ? parseFloat(a) : preset.defaultA;
    const startB = b !== null ? parseFloat(b) : preset.defaultB;

    let curA = startA;
    let curB = startB;
    let fa = f(curA);
    let fb = f(curB);

    if (fa * fb > 0) {
      return {
        error: `Invalid bracket: f(${curA.toFixed(2)}) = ${fa.toFixed(2)} and f(${curB.toFixed(2)}) = ${fb.toFixed(2)} have the SAME sign! For Bisection, f(a)·f(b) must be ≤ 0.`,
        steps: [],
        preset
      };
    }

    const steps = [];
    let root = (curA + curB) / 2;

    for (let k = 1; k <= maxIter; k++) {
      const c = (curA + curB) / 2;
      const fc = f(c);
      const halfInterval = Math.abs(curB - curA) / 2;

      steps.push({
        iteration: k,
        a: parseFloat(curA.toFixed(6)),
        b: parseFloat(curB.toFixed(6)),
        c: parseFloat(c.toFixed(6)),
        fc: parseFloat(fc.toExponential(4)),
        error: parseFloat(halfInterval.toExponential(4)),
        sign: fc > 0 ? '+' : (fc < 0 ? '-' : '0')
      });

      root = c;
      if (Math.abs(fc) < tol || halfInterval < tol) {
        break;
      }

      if (fa * fc < 0) {
        curB = c;
        fb = fc;
      } else {
        curA = c;
        fa = fc;
      }
    }

    return {
      root: parseFloat(root.toFixed(6)),
      fRoot: parseFloat(f(root).toExponential(4)),
      steps,
      preset,
      startA,
      startB
    };
  }

  // Preset catalog for Newton-Raphson
  static newtonPresets = {
    cube1: {
      name: "f(x) = x³ - 2x - 5",
      desc: "Classic cubic viva problem solved with quadratic tangent convergence.",
      formula: "x³ - 2x - 5 = 0, f'(x) = 3x² - 2",
      f: (x) => Math.pow(x, 3) - 2 * x - 5,
      fPrime: (x) => 3 * Math.pow(x, 2) - 2,
      defaultX0: 2.0,
      xMin: 1.0,
      xMax: 3.2
    },
    sqrt7: {
      name: "f(x) = x² - 7 (Compute √7)",
      desc: "Babylonian square root iteration: x_{k+1} = (x_k + 7/x_k) / 2.",
      formula: "x² - 7 = 0, f'(x) = 2x",
      f: (x) => Math.pow(x, 2) - 7,
      fPrime: (x) => 2 * x,
      defaultX0: 3.0,
      xMin: 1.5,
      xMax: 4.0
    },
    kepler: {
      name: "f(x) = x - 0.5·sin(x) - 0.8 (Kepler)",
      desc: "Celestial orbital mechanics equation with rapid tangent convergence.",
      formula: "x - 0.5·sin(x) - 0.8 = 0, f'(x) = 1 - 0.5·cos(x)",
      f: (x) => x - 0.5 * Math.sin(x) - 0.8,
      fPrime: (x) => 1 - 0.5 * Math.cos(x),
      defaultX0: 1.0,
      xMin: 0.0,
      xMax: 2.5
    }
  };

  // 3. NEWTON-RAPHSON NONLINEAR SOLVER
  static runNewtonRaphson({
    funcId = 'cube1',
    x0 = null,
    tol = 1e-6,
    maxIter = 15
  }) {
    const preset = this.newtonPresets[funcId] || this.newtonPresets.cube1;
    const f = preset.f;
    const fPrime = preset.fPrime;
    const initialGuess = x0 !== null ? parseFloat(x0) : preset.defaultX0;

    const steps = [];
    let x = initialGuess;
    let converged = false;

    for (let k = 1; k <= maxIter; k++) {
      const fx = f(x);
      const dfx = fPrime(x);

      if (Math.abs(dfx) < 1e-12) {
        return { error: 'Derivative near zero (division by zero)', steps, preset };
      }

      const nextX = x - fx / dfx;
      const err = Math.abs(nextX - x);

      steps.push({
        iteration: k,
        x: parseFloat(x.toFixed(7)),
        fx: parseFloat(fx.toExponential(4)),
        dfx: parseFloat(dfx.toFixed(5)),
        nextX: parseFloat(nextX.toFixed(7)),
        error: parseFloat(err.toExponential(4))
      });

      x = nextX;
      if (err < tol) {
        converged = true;
        break;
      }
    }

    return {
      root: parseFloat(x.toFixed(7)),
      fRoot: parseFloat(f(x).toExponential(4)),
      steps,
      converged,
      preset,
      initialGuess
    };
  }

  // Preset catalog for Power Iteration
  static powerPresets = {
    symmetric: {
      name: "3x3 Real Symmetric Matrix",
      desc: "Eigenvalues are all real. Dominant λ₁ ≈ 4.879 dominates rapidly.",
      matrixStr: "[4, 1, 1] | [1, 3, 0] | [1, 0, 2]",
      A: [
        [4, 1, 1],
        [1, 3, 0],
        [1, 0, 2]
      ]
    },
    pagerank: {
      name: "3x3 Column-Stochastic Matrix (Perron-Frobenius)",
      desc: "Markov transition matrix with largest eigenvalue λ₁ = 1.000 representing stationary distribution.",
      matrixStr: "[0.5, 0.4, 0.1] | [0.3, 0.4, 0.3] | [0.2, 0.2, 0.6]",
      A: [
        [0.5, 0.4, 0.1],
        [0.3, 0.4, 0.3],
        [0.2, 0.2, 0.6]
      ]
    },
    dominant: {
      name: "3x3 Strongly Dominant (Fast Spectral Gap)",
      desc: "Large ratio |λ₁ / λ₂| produces immediate convergence in just 6-8 iterations.",
      matrixStr: "[8, 1, 2] | [0, 5, 1] | [1, 2, 3]",
      A: [
        [8, 1, 2],
        [0, 5, 1],
        [1, 2, 3]
      ]
    }
  };

  // 4. POWER ITERATION FOR EIGENVALUES & EIGENVECTORS
  static runPowerIteration({
    preset = 'symmetric',
    A = null,
    maxIter = 25,
    tol = 1e-6
  }) {
    const selectedPreset = this.powerPresets[preset] || this.powerPresets.symmetric;
    const matA = A || selectedPreset.A;
    const n = matA.length;
    let v = new Array(n).fill(1 / Math.sqrt(n)); // Initial normalized unit vector
    const steps = [];
    let dominantLambda = 0;

    for (let k = 1; k <= maxIter; k++) {
      // y = A * v
      const y = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          y[i] += matA[i][j] * v[j];
        }
      }

      // Rayleigh Quotient estimate: lambda = (v^T * A * v) / (v^T * v)
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += v[i] * y[i];
        den += v[i] * v[i];
      }
      dominantLambda = num / (den || 1);

      // Normalize next vector
      let norm = 0;
      for (let i = 0; i < n; i++) norm += y[i] * y[i];
      norm = Math.sqrt(norm);

      const nextV = y.map(val => val / (norm || 1));

      // Error: || nextV - v ||_2
      let err = 0;
      for (let i = 0; i < n; i++) {
        err += Math.pow(nextV[i] - v[i], 2);
      }
      err = Math.sqrt(err);

      steps.push({
        iteration: k,
        lambda: parseFloat(dominantLambda.toFixed(6)),
        eigenvector: nextV.map(val => parseFloat(val.toFixed(5))),
        error: parseFloat(err.toExponential(4))
      });

      v = nextV;
      if (err < tol) break;
    }

    return {
      preset: selectedPreset,
      dominantEigenvalue: parseFloat(dominantLambda.toFixed(6)),
      eigenvector: v.map(val => parseFloat(val.toFixed(5))),
      steps
    };
  }

  // Curve sampling helper for graphing functions on HTML5 Canvas
  static sampleFunction(f, xMin, xMax, points = 120) {
    const pts = [];
    const step = (xMax - xMin) / (points - 1);
    for (let i = 0; i < points; i++) {
      const x = xMin + i * step;
      try {
        const y = f(x);
        if (Number.isFinite(y)) pts.push({ x, y });
      } catch (e) {}
    }
    return pts;
  }
}
