"""
=================================================================================
THERMALX — 2D NUMERICAL HEAT CONDUCTION & PDE SOLVER ENGINE
=================================================================================
Course Mapping: Computational Mathematics / Numerical Methods & Analysis
Core Equation:  2D Elliptic Poisson Equation:
                ∇²T = (∂²T/∂x²) + (∂²T/∂y²) = -q(x,y) / k

Discretization: 5-Point Laplacian Finite Difference Stencil
Iterative Solvers:
  1. Jacobi Iteration (Simultaneous Displacement)
  2. Gauss-Seidel Iteration (Successive Displacement)
  3. Successive Over-Relaxation (SOR with relaxation parameter ω)
=================================================================================
"""

import time
import numpy as np


class ThermalGrid2D:
    def __init__(self, rows=40, cols=40, ambient=25.0, dx=0.005, dy=0.005, k=150.0):
        """
        Initializes 2D thermal conduction grid for semiconductor package.
        :param rows: Number of grid nodes along Y-axis
        :param cols: Number of grid nodes along X-axis
        :param ambient: Ambient boundary temperature (°C)
        :param dx, dy: Spatial step size (meters)
        :param k: Thermal conductivity of substrate (W/m·K)
        """
        self.rows = rows
        self.cols = cols
        self.ambient = ambient
        self.dx = dx
        self.dy = dy
        self.k = k

        # Initialize field to ambient temperature (Dirichlet boundary)
        self.grid = np.full((rows, cols), ambient, dtype=np.float64)
        self.sources = []
        self.cooling_zones = []

        # Setup realistic laptop motherboard components
        self._setup_hardware_topology()

    def _setup_hardware_topology(self):
        """Places high-power silicon dies (CPU, GPU, Battery) onto the chassis mesh."""
        # CPU die (Silicon hotspot: ~95°C max under load)
        self.sources.append({
            'name': 'CPU Die (x86-64 Octa-Core)',
            'r_start': int(self.rows * 0.22),
            'r_end': int(self.rows * 0.38),
            'c_start': int(self.cols * 0.20),
            'c_end': int(self.cols * 0.36),
            'target_temp': 95.0,
            'heat_flux': 45.0  # W/cell internal generation
        })

        # Discrete GPU Die (~84°C under rendering)
        self.sources.append({
            'name': 'Discrete GPU (RTX Silicon)',
            'r_start': int(self.rows * 0.26),
            'r_end': int(self.rows * 0.44),
            'c_start': int(self.cols * 0.58),
            'c_end': int(self.cols * 0.76),
            'target_temp': 84.0,
            'heat_flux': 38.0
        })

        # Battery Pack (~42°C sustained)
        self.sources.append({
            'name': 'Li-Ion Battery Cell',
            'r_start': int(self.rows * 0.65),
            'r_end': int(self.rows * 0.90),
            'c_start': int(self.cols * 0.22),
            'c_end': int(self.cols * 0.78),
            'target_temp': 42.0,
            'heat_flux': 6.0
        })

        # Dual Exhaust Heat Sink Cooling Zones
        self.cooling_zones.append({
            'name': 'Left Fin Stack & Fan',
            'r_start': 0, 'r_end': int(self.rows * 0.12),
            'c_start': int(self.cols * 0.15), 'c_end': int(self.cols * 0.40),
            'sink_temp': 28.0
        })
        self.cooling_zones.append({
            'name': 'Right Fin Stack & Fan',
            'r_start': 0, 'r_end': int(self.rows * 0.12),
            'c_start': int(self.cols * 0.55), 'c_end': int(self.cols * 0.80),
            'sink_temp': 28.0
        })

    def apply_boundary_conditions(self, T):
        """Enforces Dirichlet Boundary conditions along chassis edges and heat dies."""
        # Outer chassis boundary maintained at ambient
        T[0, :] = self.ambient
        T[-1, :] = self.ambient
        T[:, 0] = self.ambient
        T[:, -1] = self.ambient

        # Apply forced heat generation inside active silicon dies
        for src in self.sources:
            T[src['r_start']:src['r_end'], src['c_start']:src['c_end']] = src['target_temp']

        # Apply forced cooling at exhaust sinks
        for cz in self.cooling_zones:
            T[cz['r_start']:cz['r_end'], cz['c_start']:cz['c_end']] = cz['sink_temp']

    def solve_jacobi(self, max_iter=1000, tol=1e-3):
        """
        Solves 2D Heat Conduction using Jacobi Iteration (Simultaneous update).
        Syllabus Formula:
            T_{i,j}^{(k+1)} = (T_{i+1,j}^{(k)} + T_{i-1,j}^{(k)} + T_{i,j+1}^{(k)} + T_{i,j-1}^{(k)}) / 4
        """
        T = np.full((self.rows, self.cols), self.ambient, dtype=np.float64)
        self.apply_boundary_conditions(T)

        residuals = []
        start_time = time.perf_counter()

        for it in range(1, max_iter + 1):
            T_new = T.copy()

            # Vectorized 5-point interior update
            T_new[1:-1, 1:-1] = 0.25 * (
                T[2:, 1:-1] +    # South (i+1, j)
                T[:-2, 1:-1] +   # North (i-1, j)
                T[1:-1, 2:] +    # East  (i, j+1)
                T[1:-1, :-2]     # West  (i, j-1)
            )

            self.apply_boundary_conditions(T_new)

            # L-infinity norm of residual error: max |T^(k+1) - T^(k)|
            max_diff = np.max(np.abs(T_new - T))
            residuals.append(max_diff)

            T = T_new
            if max_diff < tol:
                elapsed = time.perf_counter() - start_time
                return {
                    'method': 'Jacobi',
                    'converged': True,
                    'iterations': it,
                    'final_error': max_diff,
                    'time_seconds': elapsed,
                    'residuals': residuals,
                    'grid': T
                }

        elapsed = time.perf_counter() - start_time
        return {
            'method': 'Jacobi',
            'converged': False,
            'iterations': max_iter,
            'final_error': residuals[-1],
            'time_seconds': elapsed,
            'residuals': residuals,
            'grid': T
        }

    def solve_gauss_seidel(self, max_iter=1000, tol=1e-3):
        """
        Solves 2D Heat Conduction using Gauss-Seidel Iteration (Successive update).
        Uses newly updated values immediately within the current sweep.
        Syllabus Formula:
            T_{i,j}^{(k+1)} = (T_{i+1,j}^{(k)} + T_{i-1,j}^{(k+1)} + T_{i,j+1}^{(k)} + T_{i,j-1}^{(k+1)}) / 4
        """
        T = np.full((self.rows, self.cols), self.ambient, dtype=np.float64)
        self.apply_boundary_conditions(T)

        residuals = []
        start_time = time.perf_counter()

        # Build mask of interior nodes excluding fixed sources
        is_fixed = np.zeros((self.rows, self.cols), dtype=bool)
        is_fixed[0, :] = is_fixed[-1, :] = is_fixed[:, 0] = is_fixed[:, -1] = True
        for src in self.sources:
            is_fixed[src['r_start']:src['r_end'], src['c_start']:src['c_end']] = True
        for cz in self.cooling_zones:
            is_fixed[cz['r_start']:cz['r_end'], cz['c_start']:cz['c_end']] = True

        for it in range(1, max_iter + 1):
            max_diff = 0.0

            for i in range(1, self.rows - 1):
                for j in range(1, self.cols - 1):
                    if is_fixed[i, j]:
                        continue

                    old_val = T[i, j]
                    # In-place update uses already updated T[i-1, j] and T[i, j-1]
                    new_val = 0.25 * (T[i+1, j] + T[i-1, j] + T[i, j+1] + T[i, j-1])
                    T[i, j] = new_val

                    diff = abs(new_val - old_val)
                    if diff > max_diff:
                        max_diff = diff

            residuals.append(max_diff)
            if max_diff < tol:
                elapsed = time.perf_counter() - start_time
                return {
                    'method': 'Gauss-Seidel',
                    'converged': True,
                    'iterations': it,
                    'final_error': max_diff,
                    'time_seconds': elapsed,
                    'residuals': residuals,
                    'grid': T
                }

        elapsed = time.perf_counter() - start_time
        return {
            'method': 'Gauss-Seidel',
            'converged': False,
            'iterations': max_iter,
            'final_error': residuals[-1],
            'time_seconds': elapsed,
            'residuals': residuals,
            'grid': T
        }

    def solve_sor(self, omega=1.45, max_iter=1000, tol=1e-3):
        """
        Solves using Successive Over-Relaxation (SOR) with acceleration parameter ω.
        Syllabus Formula:
            T_{i,j}^{(k+1)} = (1 - ω) T_{i,j}^{(k)} + ω * T_{i,j}^{GS}
        """
        T = np.full((self.rows, self.cols), self.ambient, dtype=np.float64)
        self.apply_boundary_conditions(T)

        residuals = []
        start_time = time.perf_counter()

        is_fixed = np.zeros((self.rows, self.cols), dtype=bool)
        is_fixed[0, :] = is_fixed[-1, :] = is_fixed[:, 0] = is_fixed[:, -1] = True
        for src in self.sources:
            is_fixed[src['r_start']:src['r_end'], src['c_start']:src['c_end']] = True
        for cz in self.cooling_zones:
            is_fixed[cz['r_start']:cz['r_end'], cz['c_start']:cz['c_end']] = True

        for it in range(1, max_iter + 1):
            max_diff = 0.0

            for i in range(1, self.rows - 1):
                for j in range(1, self.cols - 1):
                    if is_fixed[i, j]:
                        continue

                    old_val = T[i, j]
                    t_gs = 0.25 * (T[i+1, j] + T[i-1, j] + T[i, j+1] + T[i, j-1])
                    new_val = (1.0 - omega) * old_val + omega * t_gs
                    T[i, j] = new_val

                    diff = abs(new_val - old_val)
                    if diff > max_diff:
                        max_diff = diff

            residuals.append(max_diff)
            if max_diff < tol:
                elapsed = time.perf_counter() - start_time
                return {
                    'method': f'SOR (ω={omega:.2f})',
                    'converged': True,
                    'iterations': it,
                    'final_error': max_diff,
                    'time_seconds': elapsed,
                    'residuals': residuals,
                    'grid': T
                }

        elapsed = time.perf_counter() - start_time
        return {
            'method': f'SOR (ω={omega:.2f})',
            'converged': False,
            'iterations': max_iter,
            'final_error': residuals[-1],
            'time_seconds': elapsed,
            'residuals': residuals,
            'grid': T
        }
