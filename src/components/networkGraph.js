/**
 * NUMERIX LAB - Network Graph Visualizer
 * Physics-Driven Force-Directed Canvas Network Graph with Dynamic Eigenvector Sizing & Energy Flux
 */

export class NetworkGraph {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.options = Object.assign({
      width: 700,
      height: 450,
      enablePhysics: true,
      onNodeClick: null,
      onNodeHover: null,
      onEdgeClick: null
    }, options);

    this.nodes = [];
    this.edges = [];
    this.rankings = new Map(); // id -> { rank, score, percentage }

    this.draggedNode = null;
    this.hoveredNode = null;
    this.hoveredEdge = null;
    this.selectedNode = null;

    this.animId = null;
    this.particles = []; // traveling energy pulses along edges

    this.setupEvents();
    this.startLoop();
  }

  setData(nodes, edges, rankingsList = []) {
    this.edges = edges.map(e => ({ ...e }));
    this.rankings = new Map(rankingsList.map(r => [r.id, r]));

    // Initialize or preserve node positions
    const existingPos = new Map(this.nodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const count = nodes.length;

    this.nodes = nodes.map((n, i) => {
      const prev = existingPos.get(n.id);
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const radius = Math.min(cx, cy) * 0.65;
      return {
        ...n,
        x: prev ? prev.x : cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 20,
        y: prev ? prev.y : cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 20,
        vx: prev ? prev.vx : 0,
        vy: prev ? prev.vy : 0,
        radius: 24
      };
    });

    // Reset particles
    this.initParticles();
    this.updateRadii();
  }

  updateRadii() {
    let maxScore = 0.001;
    for (const r of this.rankings.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }

    for (const node of this.nodes) {
      const rankData = this.rankings.get(node.id);
      if (rankData) {
        // Radius between 20px and 44px based on eigenvector importance
        node.radius = 20 + 24 * (rankData.score / maxScore);
      } else {
        node.radius = 24;
      }
    }
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < Math.min(18, this.edges.length * 3); i++) {
      const edge = this.edges[i % this.edges.length];
      if (edge) {
        this.particles.push({
          from: edge.from,
          to: edge.to,
          progress: Math.random(),
          speed: 0.006 + Math.random() * 0.006
        });
      }
    }
  }

  setupEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const hit = this.findNodeAt(pos.x, pos.y);
      if (hit) {
        this.draggedNode = hit;
        this.selectedNode = hit;
        if (this.options.onNodeClick) this.options.onNodeClick(hit);
      } else {
        this.selectedNode = null;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.canvas) return;
      const pos = getPos(e);
      if (this.draggedNode) {
        this.draggedNode.x = pos.x;
        this.draggedNode.y = pos.y;
        this.draggedNode.vx = 0;
        this.draggedNode.vy = 0;
      } else {
        const hit = this.findNodeAt(pos.x, pos.y);
        if (hit !== this.hoveredNode) {
          this.hoveredNode = hit;
          this.canvas.style.cursor = hit ? 'pointer' : 'default';
          if (this.options.onNodeHover) this.options.onNodeHover(hit);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.draggedNode = null;
    });
  }

  findNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) {
        return n;
      }
    }
    return null;
  }

  stepPhysics() {
    if (!this.options.enablePhysics) return;
    const { nodes, edges } = this;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;

    // 1. Coulomb Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        let dx = n2.x - n1.x;
        let dy = n2.y - n1.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 300) {
          const force = 3500 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (n1 !== this.draggedNode) { n1.vx -= fx; n1.vy -= fy; }
          if (n2 !== this.draggedNode) { n2.vx += fx; n2.vy += fy; }
        }
      }
    }

    // 2. Spring Hooke Attraction along edges
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const targetDist = 130;
    for (const edge of edges) {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) continue;

      let dx = tgt.x - src.x;
      let dy = tgt.y - src.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const delta = dist - targetDist;
      const force = delta * 0.035;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (src !== this.draggedNode) { src.vx += fx; src.vy += fy; }
      if (tgt !== this.draggedNode) { tgt.vx -= fx; tgt.vy -= fy; }
    }

    // 3. Centering gravity & integration
    for (const n of nodes) {
      if (n === this.draggedNode) continue;
      const cdx = cx - n.x;
      const cdy = cy - n.y;
      n.vx += cdx * 0.008;
      n.vy += cdy * 0.008;

      n.vx *= 0.85; // damping
      n.vy *= 0.85;

      n.x += n.vx;
      n.y += n.vy;

      // Keep within bounds
      const pad = n.radius + 10;
      n.x = Math.max(pad, Math.min(this.canvas.width - pad, n.x));
      n.y = Math.max(pad, Math.min(this.canvas.height - pad, n.y));
    }

    // 4. Advance flux particles
    for (const p of this.particles) {
      p.progress += p.speed;
      if (p.progress >= 1.0) {
        p.progress = 0.0;
      }
    }
  }

  startLoop() {
    const renderLoop = () => {
      this.stepPhysics();
      this.draw();
      this.animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle background cybernetic grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const nodeMap = new Map(this.nodes.map(n => [n.id, n]));

    // 1. Draw Directed Edges
    for (const edge of this.edges) {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) continue;

      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Start outside src radius and stop outside tgt radius
      const x1 = src.x + ux * src.radius;
      const y1 = src.y + uy * src.radius;
      const x2 = tgt.x - ux * (tgt.radius + 6);
      const y2 = tgt.y - uy * (tgt.radius + 6);

      // Edge line gradient
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      grad.addColorStop(1, 'rgba(173, 198, 255, 0.85)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Arrow Head
      const arrowSize = 7;
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = '#adc6ff';
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - arrowSize * Math.cos(angle - Math.PI / 6), y2 - arrowSize * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - arrowSize * Math.cos(angle + Math.PI / 6), y2 - arrowSize * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    // 2. Draw Traveling Energy Pulses (Flux Particles)
    for (const p of this.particles) {
      const src = nodeMap.get(p.from);
      const tgt = nodeMap.get(p.to);
      if (!src || !tgt) continue;

      const px = src.x + (tgt.x - src.x) * p.progress;
      const py = src.y + (tgt.y - src.y) * p.progress;

      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Draw Nodes with Eigenvector Aura and Labels
    for (const node of this.nodes) {
      const rankInfo = this.rankings.get(node.id);
      const isTop = rankInfo && rankInfo.rank === 1;
      const isHover = this.hoveredNode === node;
      const isSelected = this.selectedNode === node;
      const r = node.radius;

      // Outer Glow Aura
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + (isTop ? 10 : 5), 0, Math.PI * 2);
      if (isTop) {
        ctx.fillStyle = 'rgba(255, 87, 34, 0.22)';
        ctx.strokeStyle = 'rgba(255, 110, 64, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = isHover ? 'rgba(0, 240, 255, 0.2)' : 'rgba(5, 102, 217, 0.12)';
        ctx.strokeStyle = isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      }
      ctx.fill();

      // Node Body Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isTop ? '#3b0900' : '#161b2a';
      ctx.fill();

      // Center Core
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = isTop ? '#93000a' : (isSelected ? '#0566d9' : '#252a39');
      ctx.fill();

      // Rank Badge on top of node
      if (rankInfo) {
        ctx.fillStyle = isTop ? '#ff5722' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090e1c';
        ctx.font = 'bold 10px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${rankInfo.rank}`, node.x + r * 0.7, node.y - r * 0.7);
      }

      // Node Name Label
      ctx.fillStyle = '#dee2f6';
      ctx.font = '600 12px Space Grotesk, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, node.x, node.y + r + 6);

      // Score Label
      if (rankInfo) {
        ctx.fillStyle = isTop ? '#ff8a65' : '#adc6ff';
        ctx.font = '500 10px JetBrains Mono';
        ctx.fillText(`${(rankInfo.score * 100).toFixed(1)}%`, node.x, node.y + r + 22);
      }
    }
  }
}
