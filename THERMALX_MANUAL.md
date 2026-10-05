# THERMALX — Numerical Thermal-Field & Gradient Simulator
## Complete Project Manual, Syllabus Mapping & Academic Viva Voce Guide

**Course:** Computational Mathematics / Numerical Analysis / Scientific Computing  
**Project Title:** THERMALX — Numerical Methods, Visualized  
**Architecture:** 100% Deterministic Client-Side Simulation & Python Laboratory Suite  
**Author / Presenter:** Computer Science & Engineering / Mathematics  

---

# SECTION 1: HOW THERMALX MAPS INTO THE UNIVERSITY SYLLABUS

When your examiner or professor asks:  
> **"How does this project fit into our university syllabus, and what specific topics does it demonstrate?"**

Here is the exact mapping table and formal academic justification you can present:

### 📑 Comprehensive Syllabus Alignment Matrix

| Syllabus Unit / Module | University Textbook Topics Covered | ThermalX Theoretical Implementation | Practical Code & Visual Feature |
| :--- | :--- | :--- | :--- |
| **Unit 1: Numerical Solutions of PDEs** | Elliptic Partial Differential Equations, Laplace Equation ($\nabla^2 T = 0$), Poisson Equation ($\nabla^2 T = -q/k$) | Continuous heat conduction problem converted into an algebraic system of linear equations across a 2D spatial grid. | 2D steady-state thermal distribution over a $40 \times 40$ hardware chassis lattice. |
| **Unit 2: Finite Difference Method (FDM)** | Taylor series expansions, central difference approximations, truncation error ($O(h^2)$), 5-point discrete Laplacian stencil | $\frac{\partial^2 T}{\partial x^2} \approx \frac{T_{i+1,j} - 2T_{i,j} + T_{i-1,j}}{h^2}$<br>Discretized stencil: $T_{i,j} = \frac{1}{4}[T_{i+1,j} + T_{i-1,j} + T_{i,j+1} + T_{i,j-1}] + \frac{qh^2}{4k}$ | Live stencil engine in `thermalSolver.js` and `thermal_simulation.py`. |
| **Unit 3: Iterative Linear System Solvers** | Iterative methods for large sparse linear systems ($A\mathbf{x} = \mathbf{b}$), Jacobi relaxation vs. Gauss-Seidel relaxation | **Jacobi:** $T^{(k+1)}$ computed strictly from prior iteration $k$ (requires dual grid buffers).<br>**Gauss-Seidel:** In-place updates immediately reusing newly computed neighbor cells. | Side-by-side solver switch and benchmark race showing Gauss-Seidel converging in ~50% of the sweeps. |
| **Unit 4: Convergence Theory & Spectral Radius** | Spectral radius $\rho(G)$, matrix conditioning, diagonal dominance, Young's Theorem for 2-cyclic consistently ordered matrices | Proves why Gauss-Seidel converges faster:<br>$$\rho(G_{GS}) = [\rho(G_J)]^2 < \rho(G_J) < 1$$<br>Asymptotic rate: $R_\infty(G_{GS}) = 2 R_\infty(G_J)$. | Live logarithmic error decay curve ($\log_{10}(\text{Residue})$ vs Iterations). |
| **Unit 5: Vector Calculus & Numerical Differentiation** | Gradient vector $\nabla T$, directional derivatives, Fourier's Law of Heat Conduction ($\mathbf{q} = -k\nabla T$), heat flux | Central difference gradient:<br>$\frac{\partial T}{\partial x} \approx \frac{T(x+1, y) - T(x-1, y)}{2h}$<br>$\frac{\partial T}{\partial y} \approx \frac{T(x, y+1) - T(x, y-1)}{2h}$ | **Innovation:** Quiver plot overlay with glowing directional arrows showing heat flux escaping silicon dies. |
| **Unit 6: Error Analysis & Stopping Criteria** | Residual norms ($L_\infty$ and $L_2$ norm), tolerance thresholds ($\epsilon$), floating-point stability | Stop when max absolute change between sweeps is below threshold: $\|T^{(k+1)} - T^{(k)}\|_\infty < 10^{-3}$. | Real-time residue display updating on every animation frame. |
| **Unit 7: Boundary Value Problems (BVPs)** | Dirichlet boundary conditions (fixed boundary values) and Neumann boundary conditions (insulated boundaries) | Chassis outer walls fixed at ambient room temperature ($T_{boundary} = 25^\circ\text{C}$); heat dissipation along chassis perimeter. | Boundary temperature slider and insulated edge toggles. |

---

# SECTION 2: MATHEMATICAL FORMULATIONS & DERIVATIONS

### 1. The Governing Differential Equation (Poisson's Heat Equation)
Steady-state heat diffusion through a 2D isotropic medium with localized heat-generating silicon dies (CPU, GPU) is governed by:
$$\nabla^2 T(x, y) = \frac{\partial^2 T}{\partial x^2} + \frac{\partial^2 T}{\partial y^2} = -\frac{q(x, y)}{k}$$
- $T(x, y)$ = Temperature at spatial coordinate $(x, y)$ in $^\circ\text{C}$.
- $q(x, y)$ = Volumetric heat generation density ($\text{W/m}^3$).
- $k$ = Thermal conductivity coefficient ($\text{W/m}\cdot\text{K}$).

In regions outside active silicon dies ($q = 0$), the equation simplifies to the **Laplace Equation**:
$$\nabla^2 T = 0$$

---

### 2. Taylor Series Finite Difference Discretization
Let the 2D computational domain be discretized with uniform grid spacing $\Delta x = \Delta y = h$. Expanding $T(x+h, y)$ and $T(x-h, y)$ via Taylor series about $(x, y)$:
$$T(x+h, y) = T(x, y) + h \frac{\partial T}{\partial x} + \frac{h^2}{2} \frac{\partial^2 T}{\partial x^2} + \frac{h^3}{6} \frac{\partial^3 T}{\partial x^3} + O(h^4)$$
$$T(x-h, y) = T(x, y) - h \frac{\partial T}{\partial x} + \frac{h^2}{2} \frac{\partial^2 T}{\partial x^2} - \frac{h^3}{6} \frac{\partial^3 T}{\partial x^3} + O(h^4)$$

Adding both expansions eliminates odd-order derivative terms:
$$T(x+h, y) + T(x-h, y) = 2 T(x, y) + h^2 \frac{\partial^2 T}{\partial x^2} + O(h^4)$$
$$\implies \frac{\partial^2 T}{\partial x^2} = \frac{T_{i+1, j} - 2T_{i, j} + T_{i-1, j}}{h^2} + O(h^2)$$

Applying the identical derivation along the $y$-axis:
$$\frac{\partial^2 T}{\partial y^2} = \frac{T_{i, j+1} - 2T_{i, j} + T_{i, j-1}}{h^2} + O(h^2)$$

Substituting into Poisson's equation $\nabla^2 T = -q/k$:
$$\frac{T_{i+1, j} - 2T_{i, j} + T_{i-1, j}}{h^2} + \frac{T_{i, j+1} - 2T_{i, j} + T_{i, j-1}}{h^2} = -\frac{q_{i, j}}{k}$$
$$\implies T_{i+1, j} + T_{i-1, j} + T_{i, j+1} + T_{i, j-1} - 4T_{i, j} = -\frac{q_{i, j} h^2}{k}$$

Solving for the central node $T_{i, j}$:
$$\mathbf{T_{i, j}^{(k+1)} = \frac{1}{4} \left[ T_{i+1, j} + T_{i-1, j} + T_{i, j+1} + T_{i, j-1} \right] + \frac{q_{i, j} h^2}{4k}}$$

> **Physical Interpretation:** At thermal equilibrium, every interior node's temperature is strictly equal to the arithmetic average of its four immediate neighbors, plus the localized silicon heat generation.

---

### 3. Iterative Solvers: Jacobi vs. Gauss-Seidel Mechanics

#### A. Jacobi Iterative Method (Simultaneous Relaxation)
The updated grid $T^{(k+1)}$ is computed strictly using values from the prior iteration $k$:
$$T_{i,j}^{(k+1)} = \frac{1}{4} \left[ T_{i+1,j}^{(k)} + T_{i-1,j}^{(k)} + T_{i,j+1}^{(k)} + T_{i,j-1}^{(k)} \right]$$
- **Memory Footprint:** Requires $2 \times N^2$ memory buffers (`T_old` and `T_new`).
- **Parallelism:** All interior cells are independent within a sweep, making it embarrassingly parallel (ideal for GPU shaders).
- **Convergence Rate:** Slower; spectral radius is $\rho(G_J)$.

#### B. Gauss-Seidel Iterative Method (Successive Relaxation)
Within a single sweep from top-left to bottom-right, newly computed values for the West cell ($i-1, j$) and North cell ($i, j-1$) are immediately overwritten and reused:
$$T_{i,j}^{(k+1)} = \frac{1}{4} \left[ T_{i+1,j}^{(k)} + T_{i-1,j}^{(k+1)} + T_{i,j+1}^{(k)} + T_{i,j-1}^{(k+1)} \right]$$
- **Memory Footprint:** In-place array mutation ($1 \times N^2$ buffer). Saves 50% RAM.
- **Convergence Rate:** Information propagates across the spatial grid twice as fast per sweep.

#### C. Proof of Convergence & The Spectral Radius Relation
By decomposing the coefficient matrix $A = D - L - U$ (Diagonal, strictly Lower triangular, strictly Upper triangular):
- Jacobi iteration matrix: $G_J = D^{-1}(L + U)$
- Gauss-Seidel iteration matrix: $G_{GS} = (D - L)^{-1}U$

For consistently ordered, 2-cyclic tridiagonal-block matrices resulting from the 5-point discrete Laplace stencil on a rectangle:
$$\mathbf{\rho(G_{GS}) = \left[ \rho(G_J) \right]^2 < \rho(G_J) < 1}$$

Because $\rho < 1$, squaring it cuts the dominant eigenvalue, doubling the asymptotic rate of convergence:
$$R_\infty(G_{GS}) = -\ln \rho(G_{GS}) = -2\ln \rho(G_J) = 2 R_\infty(G_J)$$
**Conclusion:** Gauss-Seidel takes approximately half the iterations of Jacobi to achieve the exact same error tolerance.

---

# SECTION 3: INNOVATIONS IN THERMALX

Beyond standard textbooks, ThermalX introduces four advanced visualization and engineering tools:

### 1. Temperature Gradient Vector Field (Quiver Plot $\nabla T$)
- Uses central differences to compute the gradient vector field:
  $$\nabla T(x, y) = \frac{\partial T}{\partial x} \hat{\mathbf{i}} + \frac{\partial T}{\partial y} \hat{\mathbf{j}}$$
- Computes **Fourier's Heat Flux Vector**:
  $$\mathbf{q} = -k \nabla T$$
- Graphical representation: Animated directional arrows overlaid onto the canvas showing the direction and speed of heat dissipation escaping from silicon dies towards the cold perimeter.
- Magnitude $|\nabla T| = \sqrt{(\partial T/\partial x)^2 + (\partial T/\partial y)^2}$ measures thermal stress.

### 2. Isothermal Contour Boundaries (Isolines)
- Implements spatial edge detection to draw contours of constant temperature (e.g. 35°C, 50°C, 65°C, 80°C).
- Visually shows how thermal wavefronts propagate outwards through aluminum chassis conduction.

### 3. 1D Cross-Section Thermal Slice Graph
- An interactive horizontal cut line ($y = C$) that slices through the CPU, GPU, and boundary walls.
- Plots the continuous 1D temperature profile $T(x)$ on a dedicated canvas, showing steep thermal gradients at die boundaries and gradual parabolic dissipation.

### 4. Hotspot Gradient Stress Telemetry
- Automatically flags peak thermal gradient $|\nabla T|_{max}$ in $^\circ\text{C/cell}$.
- Extreme gradients ($> 10^\circ\text{C/cell}$) indicate mechanical expansion risk and thermal shock in consumer electronics.

---

# SECTION 4: VIVA VOCE QUESTIONS & MODEL ANSWERS

### Q1: Why is the finite difference Laplacian stencil called a "5-point stencil"?
> **Model Answer:** Because the second-order central difference approximation at point $(i, j)$ requires evaluating exactly 5 nodes: the center node itself $(i, j)$ and its four cardinal orthogonal neighbors — East $(i+1, j)$, West $(i-1, j)$, North $(i, j+1)$, and South $(i, j-1)$.

### Q2: What boundary conditions are used in ThermalX?
> **Model Answer:** We use **Dirichlet Boundary Conditions** for the outer perimeter of the laptop chassis, setting $T_{boundary} = T_{ambient} = 25^\circ\text{C}$ (representing the aluminum frame exposed to ambient room air). The silicon dies (CPU and GPU) are modeled as internal Dirichlet/constant heat sources.

### Q3: Why does Gauss-Seidel converge faster than Jacobi?
> **Model Answer:** Jacobi stores newly calculated values in a separate buffer, so information only advances by one grid cell per iteration. Gauss-Seidel immediately overwrites and reuses newly calculated cells in the same sweep. Mathematically, for the discrete Laplacian matrix, the spectral radius of Gauss-Seidel equals the square of the Jacobi spectral radius: $\rho(G_{GS}) = [\rho(G_J)]^2$. Because $\rho < 1$, squaring it doubles the asymptotic rate of convergence, requiring ~50% fewer iterations.

### Q4: Under what conditions is convergence guaranteed for Jacobi and Gauss-Seidel?
> **Model Answer:** Convergence is unconditionally guaranteed if the coefficient matrix $A$ is **strictly diagonally dominant** ($|a_{ii}| > \sum_{j \ne i} |a_{ij}|$) or **symmetric positive definite (SPD)**. For the 5-point discrete Laplace stencil, the diagonal entry is $4$ and the sum of off-diagonal entries is $1 + 1 + 1 + 1 = 4$, making it **irreducibly diagonally dominant** with at least one strict inequality at boundary cells. Therefore, spectral radius $\rho < 1$ and convergence is mathematically guaranteed.

### Q5: What is the physical meaning of the Temperature Gradient $\nabla T$ and Heat Flux $\mathbf{q}$?
> **Model Answer:** The gradient $\nabla T$ points in the direction of maximum temperature increase. According to **Fourier's Law of Heat Conduction** ($\mathbf{q} = -k\nabla T$), heat energy naturally flows down the thermal gradient from regions of high temperature to low temperature. The negative sign reflects the second law of thermodynamics (heat flows from hot to cold).

### Q6: What stopping criterion is implemented in the solver?
> **Model Answer:** We evaluate the **$L_\infty$ residual norm** between consecutive sweeps:
> $$\|T^{(k+1)} - T^{(k)}\|_\infty = \max_{i, j} |T_{i, j}^{(k+1)} - T_{i, j}^{(k)}| < \text{tolerance}$$
> When the maximum temperature change across any cell in the entire grid is less than the specified tolerance (e.g. $10^{-3}$), the field is considered mathematically converged to steady state.

---

# SECTION 5: HOW TO RUN & DEMONSTRATE

### 1. Interactive Web Application
- Simply double-click [`Desktop/ThermalX/index.html`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/index.html) to open in any web browser.
- Click **"Benchmark Solvers"** to run a live race between Jacobi and Gauss-Seidel.
- Click **"Syllabus Mapping & Math"** to show the examiner the academic syllabus table.
- Toggle **"Heat Flux $\nabla T$"** to show glowing quiver vector arrows.
- Move the **"Horizontal Slice Position"** slider to demonstrate the 1D cross-section graph.

### 2. Standalone Python Lab Script
Open terminal or VS Code and run:
```bash
python "C:\Users\great\OneDrive\Desktop\ThermalX\python_lab\thermal_simulation.py"
```
This runs the finite difference simulation, computes the gradient field, verifies the 1.8x speedup ratio, and displays the **4-panel scientific telemetry figure**:
1. Converged Temperature Field & Isothermal Contours
2. Heat Flux & Gradient Vector Field (Quiver Plot)
3. 1D Cross-Section Temperature Profile
4. Log-Residual Convergence Curves
