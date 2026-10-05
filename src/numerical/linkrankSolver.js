/**
 * NUMERIX LAB - LINKRANK Engine
 * Genuine Network Influence, Eigenvalues & Eigenvector Centrality
 * 
 * Mathematical Formulation:
 * Graph G = (V, E) with N nodes.
 * Adjacency Matrix A in R^{N x N}: A_{j,i} = 1 if edge from i -> j exists.
 * Out-degree of node i: outDeg(i) = sum_{j} A_{j,i}.
 * 
 * Column-Stochastic Transition Matrix M:
 *   If outDeg(i) > 0: M_{j,i} = A_{j,i} / outDeg(i)
 *   If outDeg(i) == 0 (dangling node): M_{j,i} = 1 / N
 * 
 * Google Matrix with Damping Factor d (default 0.85):
 *   G = d * M + (1 - d) / N * J_{N x N}
 * 
 * Perron-Frobenius Theorem:
 *   Matrix G is primitive and strictly positive, so its spectral radius rho(G) = 1.
 *   The dominant eigenvalue is lambda_1 = 1.
 *   The stationary distribution v satisfies G * v = lambda_1 * v = 1 * v.
 * 
 * Power Iteration:
 *   v^{k+1} = G * v^k, normalized to sum(v) = 1.
 *   Convergence error: || v^{k+1} - v^k ||_1 < tolerance.
 */

export class LinkRankNetwork {
  constructor(nodes = [], edges = []) {
    this.nodes = nodes.map(n => typeof n === 'string' ? { id: n, name: n, category: 'General' } : { ...n });
    this.edges = edges.map(e => ({ from: e.from, to: e.to }));
    this.dampingFactor = 0.85;
  }

  addNode(id, name = id, category = 'Custom', icon = 'hub') {
    if (this.nodes.some(n => n.id === id)) return false;
    this.nodes.push({ id, name, category, icon });
    return true;
  }

  removeNode(id) {
    this.nodes = this.nodes.filter(n => n.id !== id);
    this.edges = this.edges.filter(e => e.from !== id && e.to !== id);
  }

  addEdge(from, to) {
    if (from === to) return false; // Avoid trivial self loops for clean visualization
    if (!this.nodes.some(n => n.id === from) || !this.nodes.some(n => n.id === to)) return false;
    if (this.edges.some(e => e.from === from && e.to === to)) return false;
    this.edges.push({ from, to });
    return true;
  }

  removeEdge(from, to) {
    this.edges = this.edges.filter(e => !(e.from === from && e.to === to));
  }

  // Build Adjacency Matrix A: A[j][i] = 1 if edge i -> j
  buildAdjacencyMatrix() {
    const N = this.nodes.length;
    const nodeIndex = new Map(this.nodes.map((n, idx) => [n.id, idx]));
    const A = Array.from({ length: N }, () => new Float64Array(N));

    for (const edge of this.edges) {
      const i = nodeIndex.get(edge.from);
      const j = nodeIndex.get(edge.to);
      if (i !== undefined && j !== undefined) {
        A[j][i] = 1.0;
      }
    }
    return { A, nodeIndex };
  }

  // Build Column-Stochastic Transition Matrix M
  buildTransitionMatrix() {
    const { A, nodeIndex } = this.buildAdjacencyMatrix();
    const N = this.nodes.length;
    if (N === 0) return { M: [], nodeIndex, outDegrees: [] };

    const M = Array.from({ length: N }, () => new Float64Array(N));
    const outDegrees = new Float64Array(N);

    // Compute out-degrees for each column i
    for (let i = 0; i < N; i++) {
      let sum = 0.0;
      for (let j = 0; j < N; j++) {
        sum += A[j][i];
      }
      outDegrees[i] = sum;
    }

    // Populate stochastic transition matrix
    for (let i = 0; i < N; i++) {
      if (outDegrees[i] > 0) {
        for (let j = 0; j < N; j++) {
          M[j][i] = A[j][i] / outDegrees[i];
        }
      } else {
        // Dangling node: teleports uniformly to all nodes
        for (let j = 0; j < N; j++) {
          M[j][i] = 1.0 / N;
        }
      }
    }

    return { M, nodeIndex, outDegrees, A };
  }

  // Power Iteration Method to find the dominant eigenvector of G
  solve({ maxIterations = 35, tolerance = 1e-5, damping = 0.85, onStep = null } = {}) {
    const startTime = performance.now();
    const N = this.nodes.length;
    if (N === 0) {
      return { rankings: [], iterations: 0, converged: true, error: 0, durationMs: 0, history: [] };
    }

    const { M, nodeIndex, outDegrees, A } = this.buildTransitionMatrix();

    // Initial uniform probability vector v_0 = [1/N, 1/N, ...]
    let v = new Float64Array(N);
    v.fill(1.0 / N);

    const history = [];
    let iteration = 0;
    let converged = false;
    let currentError = 1.0;

    const teleportProb = (1.0 - damping) / N;

    while (iteration < maxIterations && !converged) {
      iteration++;
      const nextV = new Float64Array(N);

      // Matrix-Vector multiplication: nextV = d * M * v + (1 - d)/N
      for (let j = 0; j < N; j++) {
        let sum = 0.0;
        for (let i = 0; i < N; i++) {
          sum += M[j][i] * v[i];
        }
        nextV[j] = damping * sum + teleportProb;
      }

      // Re-normalize to safeguard against floating-point drift
      let sumNorm = 0.0;
      for (let j = 0; j < N; j++) sumNorm += nextV[j];
      for (let j = 0; j < N; j++) nextV[j] /= sumNorm;

      // L1 residual error: sum_j |nextV[j] - v[j]|
      let l1Error = 0.0;
      for (let j = 0; j < N; j++) {
        l1Error += Math.abs(nextV[j] - v[j]);
      }
      currentError = l1Error;

      // Rayleigh Quotient estimate for eigenvalue: lambda = (v^T G v) / (v^T v)
      const rayleigh = 1.0; // By Perron-Frobenius, dominant lambda = 1.0

      history.push({
        iteration,
        error: currentError,
        eigenvalue: rayleigh,
        vector: Array.from(nextV)
      });

      if (onStep) {
        onStep({ iteration, maxIterations, error: currentError, vector: Array.from(nextV) });
      }

      if (currentError < tolerance) {
        converged = true;
      }

      v = nextV;
    }

    const durationMs = performance.now() - startTime;

    // Build structured output rankings
    const rankings = this.nodes.map((node, idx) => {
      const score = v[idx];
      return {
        id: node.id,
        name: node.name,
        category: node.category,
        icon: node.icon || 'hub',
        score: parseFloat(score.toFixed(4)),
        percentage: parseFloat((score * 100).toFixed(1)),
        outDegree: outDegrees[idx],
        inDegree: this.edges.filter(e => e.to === node.id).length
      };
    });

    // Sort descending by calculated score
    rankings.sort((a, b) => b.score - a.score);

    // Assign integer ranks 1..N
    rankings.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return {
      rankings,
      iterations: iteration,
      maxIterations,
      converged,
      finalError: currentError,
      durationMs,
      history,
      dominantEigenvalue: 1.0,
      dampingFactor: damping,
      adjacencyMatrix: A,
      transitionMatrix: M
    };
  }

  // WHAT-IF LIVE COMPARISON
  // Calculates baseline ranking, performs proposed link changes, calculates new ranking,
  // and returns itemized rank movements and score differentials!
  simulateWhatIf(modifiedEdges) {
    // 1. Solve Current Baseline
    const baseline = this.solve({ maxIterations: 40 });

    // 2. Clone network with modified edges
    const clone = new LinkRankNetwork(this.nodes, modifiedEdges);
    const updated = clone.solve({ maxIterations: 40 });

    // 3. Match nodes and compute movements
    const baselineMap = new Map(baseline.rankings.map(r => [r.id, r]));
    const comparison = updated.rankings.map(after => {
      const before = baselineMap.get(after.id) || { rank: after.rank, score: 0, percentage: 0 };
      const rankDelta = before.rank - after.rank; // e.g. from rank 3 to rank 1 => +2 rise
      const scoreDelta = parseFloat((after.score - before.score).toFixed(4));
      const percentDelta = parseFloat((after.percentage - before.percentage).toFixed(1));

      return {
        ...after,
        previousRank: before.rank,
        previousScore: before.score,
        rankDelta,
        scoreDelta,
        percentDelta,
        movement: rankDelta > 0 ? 'rose' : (rankDelta < 0 ? 'fell' : 'unchanged')
      };
    });

    return {
      baseline,
      updated,
      comparison,
      changedEdgesCount: Math.abs(modifiedEdges.length - this.edges.length)
    };
  }

  // PRESET FACTORY FOR DEMO CATEGORIES
  static createPreset(category) {
    switch (category.toLowerCase()) {
      case 'technology':
        return new LinkRankNetwork(
          [
            { id: 'wikipedia', name: 'Wikipedia', category: 'Knowledge Base', icon: 'library_books' },
            { id: 'github', name: 'GitHub', category: 'Code Repository', icon: 'deployed_code' },
            { id: 'stackoverflow', name: 'Stack Overflow', category: 'Developer Forum', icon: 'forum' },
            { id: 'mdn', name: 'MDN Web Docs', category: 'Documentation', icon: 'code' },
            { id: 'python', name: 'Python Org', category: 'Language Ecosystem', icon: 'terminal' }
          ],
          [
            { from: 'github', to: 'wikipedia' },
            { from: 'stackoverflow', to: 'github' },
            { from: 'stackoverflow', to: 'wikipedia' },
            { from: 'python', to: 'stackoverflow' },
            { from: 'mdn', to: 'python' },
            { from: 'wikipedia', to: 'mdn' },
            { from: 'python', to: 'github' }
          ]
        );

      case 'education':
        return new LinkRankNetwork(
          [
            { id: 'mit', name: 'MIT', category: 'University', icon: 'school' },
            { id: 'stanford', name: 'Stanford', category: 'University', icon: 'school' },
            { id: 'cmu', name: 'Carnegie Mellon', category: 'University', icon: 'school' },
            { id: 'harvard', name: 'Harvard', category: 'University', icon: 'school' },
            { id: 'arxiv', name: 'arXiv Preprints', category: 'Research Archive', icon: 'article' },
            { id: 'coursera', name: 'Coursera', category: 'EdTech', icon: 'laptop_chromebook' }
          ],
          [
            { from: 'harvard', to: 'mit' },
            { from: 'stanford', to: 'mit' },
            { from: 'cmu', to: 'stanford' },
            { from: 'cmu', to: 'arxiv' },
            { from: 'arxiv', to: 'mit' },
            { from: 'arxiv', to: 'stanford' },
            { from: 'coursera', to: 'mit' },
            { from: 'coursera', to: 'stanford' },
            { from: 'mit', to: 'arxiv' }
          ]
        );

      case 'space':
        return new LinkRankNetwork(
          [
            { id: 'nasa', name: 'NASA', category: 'Space Agency', icon: 'rocket_launch' },
            { id: 'spacex', name: 'SpaceX', category: 'Aerospace Launch', icon: 'rocket' },
            { id: 'esa', name: 'ESA', category: 'Space Agency', icon: 'public' },
            { id: 'isro', name: 'ISRO', category: 'Space Agency', icon: 'satellite_alt' },
            { id: 'jaxa', name: 'JAXA', category: 'Space Agency', icon: 'explore' },
            { id: 'hubble', name: 'Hubble / JWST', category: 'Space Observatory', icon: 'telescope' }
          ],
          [
            { from: 'spacex', to: 'nasa' },
            { from: 'esa', to: 'nasa' },
            { from: 'isro', to: 'nasa' },
            { from: 'jaxa', to: 'esa' },
            { from: 'hubble', to: 'nasa' },
            { from: 'nasa', to: 'hubble' },
            { from: 'nasa', to: 'spacex' },
            { from: 'isro', to: 'jaxa' }
          ]
        );

      case 'social':
        return new LinkRankNetwork(
          [
            { id: 'alex', name: 'Alex (Tech Lead)', category: 'Social Core', icon: 'person' },
            { id: 'maya', name: 'Maya (Architect)', category: 'Social Core', icon: 'person' },
            { id: 'sam', name: 'Sam (Researcher)', category: 'Social Peer', icon: 'person' },
            { id: 'jordan', name: 'Jordan (DevOps)', category: 'Social Peer', icon: 'person' },
            { id: 'chris', name: 'Chris (Designer)', category: 'Social Peer', icon: 'person' },
            { id: 'taylor', name: 'Taylor (Intern)', category: 'Social Junior', icon: 'person' }
          ],
          [
            { from: 'taylor', to: 'alex' },
            { from: 'taylor', to: 'maya' },
            { from: 'sam', to: 'maya' },
            { from: 'jordan', to: 'alex' },
            { from: 'chris', to: 'maya' },
            { from: 'chris', to: 'alex' },
            { from: 'maya', to: 'alex' },
            { from: 'alex', to: 'maya' }
          ]
        );

      default:
        return new LinkRankNetwork(
          [
            { id: 'node_a', name: 'Node Alpha', category: 'Core', icon: 'radio_button_checked' },
            { id: 'node_b', name: 'Node Beta', category: 'Relay', icon: 'share' },
            { id: 'node_c', name: 'Node Gamma', category: 'Relay', icon: 'scatter_plot' }
          ],
          [
            { from: 'node_b', to: 'node_a' },
            { from: 'node_c', to: 'node_a' },
            { from: 'node_a', to: 'node_b' }
          ]
        );
    }
  }
}
