# ThermalX: Complete Python Numerical Engine Guide
**Course:** Computational Mathematics / Numerical Methods & Analysis  
**Repository Location:** `C:\Users\great\OneDrive\Desktop\ThermalX`  
**Execution:** `python main.py` or double-click `run_simulation.bat`

---

## 🐍 Python Architecture Overview

All Python code is located right at the root of the project directory for immediate visibility in VS Code:

| File Name | Purpose | Syllabus Concept |
|---|---|---|
| [`main.py`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/main.py) | Master CLI Runner & Interactive Menu | Unified workflow orchestration |
| [`thermal_solver.py`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/thermal_solver.py) | 2D Finite Difference PDE Engine | Jacobi, Gauss-Seidel, and SOR iterations |
| [`gradient_quiver_plotter.py`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/gradient_quiver_plotter.py) | Vector Field & Quiver Graphics | Fourier's Law $\mathbf{q} = -k\nabla T$ & 1D cutline profile |
| [`bisection_optimizer.py`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/bisection_optimizer.py) | Non-Linear Root Finding | Bisection Method for active cooling fan velocity |
| [`syllabus_verification.py`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/syllabus_verification.py) | Academic Proofs & Spectral Radii | Young's Theorem $\rho(G_{GS}) = [\rho(G_J)]^2$, condition number $\kappa(A)$ |
| [`requirements.txt`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/requirements.txt) | Environment dependencies | `numpy`, `matplotlib`, `scipy` |
| [`run_simulation.bat`](file:///C:/Users/great/OneDrive/Desktop/ThermalX/run_simulation.bat) | 1-Click Windows execution script | Batch launcher |

---

## 🚀 How to Run the Python Code for Sir

### Option 1: Master Interactive Runner
Open your terminal in VS Code and type:
```bash
python main.py
```
This presents an interactive menu:
```text
SELECT A MODULE TO EXECUTE:
  [1] Run 2D Finite Difference Solvers (Jacobi vs Gauss-Seidel vs SOR)
  [2] Compute & Plot Heat Flux Quiver Field & 1D Profile (Generates PNG)
  [3] Run Bisection Method Cooling Optimization (Root-Finding)
  [4] Verify Syllabus Mathematical Theorems (Young's Theorem Proof)
  [5] Run Complete Suite & Generate Full Telemetry
  [6] Open ThermalX Web App in Browser
  [0] Exit
```

### Option 2: Run All Modules in One Command
```bash
python main.py --all
```
This automatically runs all solvers, outputs exact convergence stats, proves Young's theorem, and exports `thermal_telemetry_dashboard.png`.

### Option 3: Double-Click Batch File (No terminal needed)
Double-click `run_simulation.bat` on your Desktop in the `ThermalX` folder.

---

## 🔬 Mathematical Formulas Implemented in Python

### 1. 2D Elliptic Heat Conduction PDE (`thermal_solver.py`)
$$\nabla^2 T = \frac{\partial^2 T}{\partial x^2} + \frac{\partial^2 T}{\partial y^2} = -\frac{q(x, y)}{k}$$
- **Discretization:** 5-Point Laplacian stencil:
  $$T_{i,j}^{(k+1)} = \frac{T_{i+1,j} + T_{i-1,j} + T_{i,j+1} + T_{i,j-1}}{4} + \frac{\Delta x^2 q_{i,j}}{4k}$$
- **Jacobi Method:** Updates all nodes simultaneously using values from previous sweep $k$.
- **Gauss-Seidel Method:** Updates in-place using newly computed values from sweep $k+1$.
- **SOR Method:** Accelerated using over-relaxation parameter $\omega = 1.45$:
  $$T_{i,j}^{(k+1)} = (1 - \omega) T_{i,j}^{(k)} + \omega T_{i,j}^{GS}$$

### 2. Fourier's Law & Heat Flux Vector Field (`gradient_quiver_plotter.py`)
$$\mathbf{q} = -k \nabla T = -k \left( \frac{\partial T}{\partial x}\hat{i} + \frac{\partial T}{\partial y}\hat{j} \right)$$
- Numerical gradients computed via 2nd-order central differences:
  $$\left(\frac{\partial T}{\partial x}\right)_{i,j} \approx \frac{T_{i,j+1} - T_{i,j-1}}{2\Delta x}, \quad \left(\frac{\partial T}{\partial y}\right)_{i,j} \approx \frac{T_{i+1,j} - T_{i-1,j}}{2\Delta y}$$
- Outputs `thermal_telemetry_dashboard.png` with 4 synchronized engineering plots.

### 3. Non-Linear Root Finding via Bisection (`bisection_optimizer.py`)
Finds the active airflow velocity $v^*$ such that junction temperature matches safe target:
$$f(v) = T_{\text{die}}(v) - T_{\text{target}} = 0$$
- Guaranteed convergence in $N = \lceil \log_2((b-a)/\epsilon) \rceil = 17$ steps.

### 4. Young's Theorem Proof (`syllabus_verification.py`)
- Spectral radius of Jacobi matrix: $\rho(G_J) = \cos(\pi / (N+1)) = 0.997066$
- Spectral radius of Gauss-Seidel: $\rho(G_{GS}) = [\rho(G_J)]^2 = 0.994140$
- Asymptotic rate of convergence: $R_\infty(GS) = 2 \cdot R_\infty(J)$ (Gauss-Seidel is mathematically twice as fast as Jacobi!).
